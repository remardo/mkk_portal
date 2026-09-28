-- ============================================
-- МКК ФК - 04_security: hardening migration
-- Применяется после 01_schema / 02_rls_policies / 03_views
-- Идемпотентная миграция (DROP IF EXISTS / OR REPLACE)
-- ============================================

-- --------------------------------------------
-- 1. Helpers: NULL для неактивных пользователей
-- Fixed search_path=public for SECURITY DEFINER
-- --------------------------------------------
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
DECLARE
    user_role_val user_role;
BEGIN
    SELECT role INTO user_role_val FROM profiles WHERE id = auth.uid() AND is_active = true;
    RETURN user_role_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_current_user_branch()
RETURNS UUID AS $$
DECLARE
    branch_val UUID;
BEGIN
    SELECT branch_id INTO branch_val FROM profiles WHERE id = auth.uid() AND is_active = true;
    RETURN branch_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_visible_by_roles(allowed_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    IF coalesce(cardinality(allowed_roles), 0) = 0 THEN
        RETURN true;
    END IF;
    RETURN get_current_user_role() = ANY(allowed_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_ops_manager_for_branch(branch_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM branches
        WHERE id = branch_uuid
        AND ops_manager_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------
-- 2. system_settings: RLS + только админ
-- --------------------------------------------
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON system_settings;
CREATE POLICY "settings_select" ON system_settings
    FOR SELECT USING (
        get_current_user_role() = 'it_admin'
    );

DROP POLICY IF EXISTS "settings_modify" ON system_settings;
CREATE POLICY "settings_modify" ON system_settings
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );

-- --------------------------------------------
-- 3. document_categories: чтение аутентифицированным, запись админу
-- --------------------------------------------
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_categories_select" ON document_categories;
CREATE POLICY "document_categories_select" ON document_categories
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

DROP POLICY IF EXISTS "document_categories_modify" ON document_categories;
CREATE POLICY "document_categories_modify" ON document_categories
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );

-- --------------------------------------------
-- 4. profiles: запрет смены role/branch_id/is_active не-админом
-- Trusted DBA bypass: direct postgres session or service_role,
-- so admin provisioning / Supabase service_role works.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
    actor_role user_role;
BEGIN
    IF session_user = 'postgres' THEN
        RETURN NEW;
    END IF;
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;
    SELECT role INTO actor_role FROM profiles WHERE id = auth.uid() AND is_active = true;
    IF actor_role = 'it_admin' THEN
        RETURN NEW;
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role
        OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
        OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        RAISE EXCEPTION 'Only it_admin may change role/branch_id/is_active';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_profiles_no_privilege_escalation ON profiles;
CREATE TRIGGER trg_profiles_no_privilege_escalation
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- --------------------------------------------
-- 5. test_attempts: score/passed меняет только админ
-- Trusted DBA bypass: direct postgres session or service_role.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION prevent_attempt_score_tampering()
RETURNS TRIGGER AS $$
DECLARE
    actor_role user_role;
BEGIN
    IF session_user = 'postgres' THEN
        RETURN NEW;
    END IF;
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;
    IF NEW.score IS DISTINCT FROM OLD.score
        OR NEW.passed IS DISTINCT FROM OLD.passed THEN
        SELECT role INTO actor_role FROM profiles WHERE id = auth.uid() AND is_active = true;
        IF actor_role IS DISTINCT FROM 'it_admin' THEN
            RAISE EXCEPTION 'Only it_admin may change score/passed';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_attempts_no_score_tampering ON test_attempts;
CREATE TRIGGER trg_attempts_no_score_tampering
    BEFORE UPDATE ON test_attempts
    FOR EACH ROW EXECUTE FUNCTION prevent_attempt_score_tampering();

-- --------------------------------------------
-- 6. RPC column fix: v_my_tasks includes extra columns
-- (updated_at/closed_at via t.*). Select explicit columns in
-- declared return order instead of v.*.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION get_my_tasks(user_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    type task_type,
    priority task_priority,
    status task_status,
    author_id UUID,
    assignee_id UUID,
    branch_id UUID,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    author_name TEXT,
    assignee_name TEXT,
    branch_name TEXT,
    is_overdue BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id,
        v.title,
        v.description,
        v.type,
        v.priority,
        v.status,
        v.author_id,
        v.assignee_id,
        v.branch_id,
        v.due_date,
        v.created_at,
        v.author_name,
        v.assignee_name,
        v.branch_name,
        v.is_overdue
    FROM v_my_tasks v
    WHERE v.assignee_id = user_id OR v.author_id = user_id
    ORDER BY
        CASE WHEN v.is_overdue THEN 0 ELSE 1 END,
        v.due_date ASC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- --------------------------------------------
-- 7. Same explicit-column hardening for get_my_checklists.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION get_my_checklists(user_branch_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    checklist_id UUID,
    branch_id UUID,
    due_date DATE,
    status checklist_status,
    created_by UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    checklist_title TEXT,
    checklist_type checklist_type,
    branch_name TEXT,
    total_items BIGINT,
    completed_items BIGINT,
    is_overdue BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id,
        v.checklist_id,
        v.branch_id,
        v.due_date,
        v.status,
        v.created_by,
        v.completed_at,
        v.created_at,
        v.checklist_title,
        v.checklist_type,
        v.branch_name,
        v.total_items,
        v.completed_items,
        v.is_overdue
    FROM v_my_checklists v
    WHERE v.branch_id = user_branch_id
    ORDER BY
        CASE WHEN v.is_overdue THEN 0 ELSE 1 END,
        v.due_date ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- --------------------------------------------
-- 8. profiles 42P17 infinite recursion fix (existing deployed DB).
-- profiles_select/profiles_update queried branches directly while
-- branches_select queries profiles -> RLS rewrite recursion over REST.
-- Use SECURITY DEFINER helper is_ops_manager_for_branch(branch_id)
-- which bypasses RLS inside the function and breaks the cycle.
-- --------------------------------------------
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (
        id = auth.uid()
        OR get_current_user_role() IN ('director', 'it_admin')
        OR (get_current_user_role() = 'ops_manager' AND is_ops_manager_for_branch(branch_id))
        OR (get_current_user_role() = 'branch_manager' AND branch_id = get_current_user_branch())
    );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE USING (
        id = auth.uid()
        OR get_current_user_role() = 'it_admin'
        OR (get_current_user_role() = 'ops_manager' AND is_ops_manager_for_branch(branch_id))
    );

-- --------------------------------------------
-- 9. Least-privilege grants (LAST: after all function recreations).
-- RLS stays enabled and controls rows.
-- anon inherits PUBLIC, so revoke EXECUTE from PUBLIC as well,
-- then grant to authenticated/service_role.
-- --------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_ops_manager_for_branch(UUID) TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
