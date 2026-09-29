-- ============================================
-- МКК ФК - 13: полноценный таск-трекер
-- Проекты и подпроекты, привязка задач к проектам,
-- подзадачи, уведомления (назначение, комментарии,
-- смена статуса), storage-политики для вложений.
-- Применение: psql "$SUPABASE_DB_URL" -f database/13_task_tracker.sql
-- Идемпотентная. Bucket task-attachments создаётся
-- отдельно через storage API (см. README ниже).
-- ============================================

-- --------------------------------------------
-- 1. ПРОЕКТЫ (parent_id = подпроекты)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE projects IS 'Проекты и подпроекты таск-трекера';

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
    FOR UPDATE USING (
        created_by = auth.uid()
        OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects
    FOR DELETE USING (
        created_by = auth.uid()
        OR get_current_user_role() = 'it_admin'
    );

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- --------------------------------------------
-- 2. ЗАДАЧИ: проект, подзадачи, порядок
-- --------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- --------------------------------------------
-- 3. УВЕДОМЛЕНИЯ
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'task',
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE notifications IS 'Уведомления: назначения, комментарии, статусы задач';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Прямая вставка клиентам запрещена: пишут только триггеры (SECURITY DEFINER обходит RLS)
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications
    FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- --------------------------------------------
-- 4. ТРИГГЕРЫ УВЕДОМЛЕНИЙ
-- --------------------------------------------
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_link TEXT
) RETURNS VOID AS $$
BEGIN
    IF p_user_id IS NULL THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_active = true) THEN RETURN; END IF;
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Назначение исполнителя
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assignee_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
       AND NEW.assignee_id IS DISTINCT FROM auth.uid() THEN
        PERFORM create_notification(
            NEW.assignee_id, 'task_assigned',
            'Вам назначена задача: ' || NEW.title,
            left(coalesce(NEW.description, ''), 200),
            '/tasks/' || NEW.id::TEXT
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_tasks_notify_assigned ON tasks;
CREATE TRIGGER trg_tasks_notify_assigned
    AFTER INSERT OR UPDATE OF assignee_id ON tasks
    FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- Смена статуса: автору и исполнителю (кроме того, кто поменял)
CREATE OR REPLACE FUNCTION notify_task_status()
RETURNS TRIGGER AS $$
DECLARE
    v_status_label TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        CASE NEW.status
            WHEN 'in_progress' THEN v_status_label := 'взята в работу';
            WHEN 'done' THEN v_status_label := 'выполнена';
            WHEN 'rejected' THEN v_status_label := 'отклонена';
            ELSE v_status_label := 'снова открыта';
        END CASE;
        IF NEW.author_id IS DISTINCT FROM auth.uid() THEN
            PERFORM create_notification(
                NEW.author_id, 'task_status',
                'Задача ' || v_status_label || ': ' || NEW.title,
                NULL, '/tasks/' || NEW.id::TEXT
            );
        END IF;
        IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM auth.uid()
           AND NEW.assignee_id IS DISTINCT FROM NEW.author_id THEN
            PERFORM create_notification(
                NEW.assignee_id, 'task_status',
                'Задача ' || v_status_label || ': ' || NEW.title,
                NULL, '/tasks/' || NEW.id::TEXT
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_tasks_notify_status ON tasks;
CREATE TRIGGER trg_tasks_notify_status
    AFTER UPDATE OF status ON tasks
    FOR EACH ROW EXECUTE FUNCTION notify_task_status();

-- Новый комментарий: автору задачи, исполнителю и другим комментаторам
CREATE OR REPLACE FUNCTION notify_task_comment()
RETURNS TRIGGER AS $$
DECLARE
    v_task RECORD;
    v_author_name TEXT;
    r UUID;
BEGIN
    SELECT id, title, author_id, assignee_id INTO v_task
    FROM tasks WHERE id = NEW.task_id;
    IF v_task.id IS NULL THEN RETURN NEW; END IF;
    SELECT full_name INTO v_author_name FROM profiles WHERE id = NEW.author_id;

    IF v_task.author_id IS DISTINCT FROM NEW.author_id THEN
        PERFORM create_notification(
            v_task.author_id, 'task_comment',
            (v_author_name || ' прокомментировал: ' || v_task.title),
            left(NEW.content, 200), '/tasks/' || v_task.id::TEXT
        );
    END IF;
    IF v_task.assignee_id IS NOT NULL
       AND v_task.assignee_id IS DISTINCT FROM NEW.author_id
       AND v_task.assignee_id IS DISTINCT FROM v_task.author_id THEN
        PERFORM create_notification(
            v_task.assignee_id, 'task_comment',
            (v_author_name || ' прокомментировал: ' || v_task.title),
            left(NEW.content, 200), '/tasks/' || v_task.id::TEXT
        );
    END IF;
    FOR r IN SELECT DISTINCT author_id FROM task_comments
             WHERE task_id = NEW.task_id AND author_id IS DISTINCT FROM NEW.author_id
               AND author_id IS DISTINCT FROM v_task.author_id
               AND author_id IS DISTINCT FROM v_task.assignee_id LOOP
        PERFORM create_notification(
            r, 'task_comment',
            (v_author_name || ' прокомментировал: ' || v_task.title),
            left(NEW.content, 200), '/tasks/' || v_task.id::TEXT
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_comments_notify ON task_comments;
CREATE TRIGGER trg_comments_notify
    AFTER INSERT ON task_comments
    FOR EACH ROW EXECUTE FUNCTION notify_task_comment();

-- --------------------------------------------
-- 5. STORAGE-ПОЛИТИКИ для bucket task-attachments
-- (сам bucket создать через API: storage/createBucket)
-- --------------------------------------------
DROP POLICY IF EXISTS "task_files_select" ON storage.objects;
CREATE POLICY "task_files_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'task-attachments'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

DROP POLICY IF EXISTS "task_files_insert" ON storage.objects;
CREATE POLICY "task_files_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'task-attachments'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;
CREATE POLICY "task_files_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'task-attachments'
        AND (owner = auth.uid() OR get_current_user_role() = 'it_admin')
    );
