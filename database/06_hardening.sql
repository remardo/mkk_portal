-- ============================================
-- МКК ФК - 06_hardening: закрытие RLS-дыр из аудита
-- Применяется после 01..05. Идемпотентная.
-- ============================================

-- 1. tasks_insert: запретить подмену author_id
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
    FOR INSERT WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

-- 2. task_comments_insert: запретить подмену author_id
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
CREATE POLICY "task_comments_insert" ON task_comments
    FOR INSERT WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM tasks
            WHERE id = task_comments.task_id
            AND (
                author_id = auth.uid()
                OR assignee_id = auth.uid()
                OR branch_id = get_current_user_branch()
                OR get_current_user_role() IN ('it_admin', 'director')
            )
        )
    );

-- 3. task_attachments_insert: запретить подмену uploaded_by
DROP POLICY IF EXISTS "task_attachments_insert" ON task_attachments;
CREATE POLICY "task_attachments_insert" ON task_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM tasks
            WHERE id = task_attachments.task_id
            AND (
                author_id = auth.uid()
                OR assignee_id = auth.uid()
                OR get_current_user_role() IN ('it_admin', 'director')
            )
        )
    );

-- 4. audit_logs_insert: запретить подделку чужого user_id
-- Триггеры SECURITY DEFINER обходят RLS, поэтому ужесточение не ломает системные записи
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT WITH CHECK (
        user_id IS NULL OR user_id = auth.uid()
    );

-- 5. categories: чтение только активным
DROP POLICY IF EXISTS "categories_select" ON knowledge_categories;
CREATE POLICY "categories_select" ON knowledge_categories
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

-- 6. articles: запретить обычному юзеру публиковать/менять visibility
CREATE OR REPLACE FUNCTION prevent_article_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
    actor_role user_role;
BEGIN
    IF session_user = 'postgres' THEN RETURN NEW; END IF;
    IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
    SELECT role INTO actor_role FROM profiles WHERE id = auth.uid() AND is_active = true;
    IF actor_role IN ('it_admin', 'director') THEN RETURN NEW; END IF;
    -- автор может создавать только draft и не может трогать visibility
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'Only it_admin/director may publish articles';
        END IF;
        IF NEW.visibility_roles IS DISTINCT FROM '{}'::user_role[]
            OR NEW.visibility_branch_ids IS DISTINCT FROM '{}'::UUID[] THEN
            RAISE EXCEPTION 'Only it_admin/director may set visibility';
        END IF;
        IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'created_by must be current user';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
        OR NEW.visibility_roles IS DISTINCT FROM OLD.visibility_roles
        OR NEW.visibility_branch_ids IS DISTINCT FROM OLD.visibility_branch_ids THEN
        RAISE EXCEPTION 'Only it_admin/director may change status/visibility';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_articles_no_privilege_escalation ON knowledge_articles;
CREATE TRIGGER trg_articles_no_privilege_escalation
    BEFORE INSERT OR UPDATE ON knowledge_articles
    FOR EACH ROW EXECUTE FUNCTION prevent_article_privilege_escalation();

-- 7. course_progress: запретить прямую установку completed клиентом
CREATE OR REPLACE FUNCTION prevent_progress_tampering()
RETURNS TRIGGER AS $$
DECLARE
    actor_role user_role;
BEGIN
    IF session_user = 'postgres' THEN RETURN NEW; END IF;
    IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
    SELECT role INTO actor_role FROM profiles WHERE id = auth.uid() AND is_active = true;
    IF actor_role = 'it_admin' THEN RETURN NEW; END IF;
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'user_id must be current user';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Completed progress is final';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_progress_no_tampering ON course_progress;
CREATE TRIGGER trg_progress_no_tampering
    BEFORE INSERT OR UPDATE ON course_progress
    FOR EACH ROW EXECUTE FUNCTION prevent_progress_tampering();

-- 8. answers: ответы только по своей незавершённой попытке
DROP POLICY IF EXISTS "attempt_answers_modify" ON test_attempt_answers;
CREATE POLICY "attempt_answers_modify" ON test_attempt_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM test_attempts a
            WHERE a.id = test_attempt_answers.attempt_id
            AND a.user_id = auth.uid()
            AND a.status = 'in_progress'
        )
        OR get_current_user_role() = 'it_admin'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM test_attempts a
            WHERE a.id = test_attempt_answers.attempt_id
            AND a.user_id = auth.uid()
            AND a.status = 'in_progress'
        )
        OR get_current_user_role() = 'it_admin'
    );

-- 9. chat: только активные пользователи
DROP POLICY IF EXISTS "chat_channels_select" ON chat_channels;
CREATE POLICY "chat_channels_select" ON chat_channels
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND (
            is_visible_by_roles(visibility_roles)
            OR coalesce(cardinality(visibility_roles), 0) = 0
        )
    );

DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND EXISTS (
            SELECT 1 FROM chat_channels
            WHERE id = chat_messages.channel_id
            AND (
                is_visible_by_roles(visibility_roles)
                OR coalesce(cardinality(visibility_roles), 0) = 0
            )
        )
    );

DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages
    FOR INSERT WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
        AND EXISTS (
            SELECT 1 FROM chat_channels
            WHERE id = chat_messages.channel_id
            AND (
                is_visible_by_roles(visibility_roles)
                OR coalesce(cardinality(visibility_roles), 0) = 0
            )
        )
    );

-- 10. RPC: сверка с auth.uid(), запрет чтения чужих данных
CREATE OR REPLACE FUNCTION get_my_tasks(user_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID, title TEXT, description TEXT, type task_type, priority task_priority,
    status task_status, author_id UUID, assignee_id UUID, branch_id UUID,
    due_date TIMESTAMPTZ, created_at TIMESTAMPTZ,
    author_name TEXT, assignee_name TEXT, branch_name TEXT, is_overdue BOOLEAN
) AS $$
BEGIN
    IF user_id IS DISTINCT FROM auth.uid() AND get_current_user_role() NOT IN ('it_admin', 'director') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    RETURN QUERY
    SELECT v.id, v.title, v.description, v.type, v.priority, v.status,
        v.author_id, v.assignee_id, v.branch_id, v.due_date, v.created_at,
        v.author_name, v.assignee_name, v.branch_name, v.is_overdue
    FROM v_my_tasks v
    WHERE v.assignee_id = user_id OR v.author_id = user_id
    ORDER BY CASE WHEN v.is_overdue THEN 0 ELSE 1 END, v.due_date ASC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE OR REPLACE FUNCTION get_my_checklists(user_branch_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID, checklist_id UUID, branch_id UUID, due_date DATE, status checklist_status,
    created_by UUID, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
    checklist_title TEXT, checklist_type checklist_type, branch_name TEXT,
    total_items BIGINT, completed_items BIGINT, is_overdue BOOLEAN
) AS $$
BEGIN
    IF user_branch_id IS DISTINCT FROM get_current_user_branch()
        AND get_current_user_role() NOT IN ('it_admin', 'director') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    RETURN QUERY
    SELECT v.id, v.checklist_id, v.branch_id, v.due_date, v.status, v.created_by,
        v.completed_at, v.created_at, v.checklist_title, v.checklist_type,
        v.branch_name, v.total_items, v.completed_items, v.is_overdue
    FROM v_my_checklists v
    WHERE v.branch_id = user_branch_id
    ORDER BY CASE WHEN v.is_overdue THEN 0 ELSE 1 END, v.due_date ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
