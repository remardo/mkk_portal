-- ============================================
-- МКК ФК - Row Level Security (RLS) политики
-- ============================================

-- Включаем RLS для всех таблиц
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_answer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- ============================================

-- Функция для получения роли текущего пользователя
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
DECLARE
    user_role_val user_role;
BEGIN
    SELECT role INTO user_role_val FROM profiles WHERE id = auth.uid();
    RETURN user_role_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для получения branch_id текущего пользователя
CREATE OR REPLACE FUNCTION get_current_user_branch()
RETURNS UUID AS $$
DECLARE
    branch_val UUID;
BEGIN
    SELECT branch_id INTO branch_val FROM profiles WHERE id = auth.uid();
    RETURN branch_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для проверки, является ли пользователь ops_manager для точки
CREATE OR REPLACE FUNCTION is_ops_manager_for_branch(branch_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM branches 
        WHERE id = branch_uuid 
        AND ops_manager_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для проверки видимости по ролям
CREATE OR REPLACE FUNCTION is_visible_by_roles(allowed_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    -- Если массив пустой - видно всем
    IF array_length(allowed_roles, 1) IS NULL OR array_length(allowed_roles, 1) = 0 THEN
        RETURN true;
    END IF;
    -- Проверяем, есть ли роль пользователя в массиве
    RETURN get_current_user_role() = ANY(allowed_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES - Профили пользователей
-- ============================================

-- SELECT: пользователь видит себя; ops_manager - своих сотрудников; director/it_admin - всех
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (
        id = auth.uid()  -- себя
        OR get_current_user_role() IN ('director', 'it_admin')  -- директор и админ видят всех
        OR (get_current_user_role() = 'ops_manager' AND branch_id IN (
            SELECT id FROM branches WHERE ops_manager_id = auth.uid()
        ))  -- ops_manager видит сотрудников своих точек
        OR (get_current_user_role() = 'branch_manager' AND branch_id = get_current_user_branch())
    );

-- INSERT: только it_admin
CREATE POLICY "profiles_insert" ON profiles
    FOR INSERT WITH CHECK (
        get_current_user_role() = 'it_admin'
    );

-- UPDATE: себя, it_admin, ops_manager для своих точек
CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE USING (
        id = auth.uid()
        OR get_current_user_role() = 'it_admin'
        OR (get_current_user_role() = 'ops_manager' AND branch_id IN (
            SELECT id FROM branches WHERE ops_manager_id = auth.uid()
        ))
    );

-- DELETE: только it_admin
CREATE POLICY "profiles_delete" ON profiles
    FOR DELETE USING (
        get_current_user_role() = 'it_admin'
    );

-- ============================================
-- BRANCHES - Точки выдачи
-- ============================================

-- SELECT: все активные пользователи видят все точки
CREATE POLICY "branches_select" ON branches
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

-- INSERT/UPDATE/DELETE: только it_admin
CREATE POLICY "branches_modify" ON branches
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );

-- ============================================
-- KNOWLEDGE_ARTICLES - Статьи базы знаний
-- ============================================

-- SELECT: опубликованные + видимость по ролям/точкам
CREATE POLICY "articles_select" ON knowledge_articles
    FOR SELECT USING (
        status = 'published'
        AND is_visible_by_roles(visibility_roles)
        AND (array_length(visibility_branch_ids, 1) IS NULL 
             OR array_length(visibility_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(visibility_branch_ids))
        OR created_by = auth.uid()  -- автор видит свои черновики
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- INSERT/UPDATE/DELETE: it_admin, director
CREATE POLICY "articles_modify" ON knowledge_articles
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director')
        OR created_by = auth.uid()
    );

-- ============================================
-- KNOWLEDGE_CATEGORIES - Категории базы знаний
-- ============================================

CREATE POLICY "categories_select" ON knowledge_categories
    FOR SELECT USING (true);

CREATE POLICY "categories_modify" ON knowledge_categories
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director')
    );

-- ============================================
-- DOCUMENTS - Документы
-- ============================================

-- SELECT: видимость по ролям/точкам
CREATE POLICY "documents_select" ON documents
    FOR SELECT USING (
        is_visible_by_roles(visibility_roles)
        AND (array_length(visibility_branch_ids, 1) IS NULL 
             OR array_length(visibility_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(visibility_branch_ids))
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- INSERT/UPDATE/DELETE: it_admin, director
CREATE POLICY "documents_modify" ON documents
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director')
    );

-- ============================================
-- DOCUMENT_ACKNOWLEDGEMENTS - Ознакомления
-- ============================================

-- SELECT: свои записи + it_admin + director
CREATE POLICY "ack_select" ON document_acknowledgements
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- INSERT: свои записи
CREATE POLICY "ack_insert" ON document_acknowledgements
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- UPDATE/DELETE: только it_admin
CREATE POLICY "ack_modify" ON document_acknowledgements
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );

-- ============================================
-- COURSES - Курсы
-- ============================================

-- SELECT: видимость по ролям/точкам
CREATE POLICY "courses_select" ON courses
    FOR SELECT USING (
        is_visible_by_roles(visibility_roles)
        AND (array_length(visibility_branch_ids, 1) IS NULL 
             OR array_length(visibility_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(visibility_branch_ids))
        OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- INSERT/UPDATE/DELETE: it_admin, director, ops_manager
CREATE POLICY "courses_modify" ON courses
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- ============================================
-- COURSE_LESSONS - Уроки
-- ============================================

-- SELECT: если виден курс
CREATE POLICY "lessons_select" ON course_lessons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE id = course_lessons.course_id
            AND (
                is_visible_by_roles(visibility_roles)
                AND (array_length(visibility_branch_ids, 1) IS NULL 
                     OR array_length(visibility_branch_ids, 1) = 0
                     OR get_current_user_branch() = ANY(visibility_branch_ids))
                OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
            )
        )
    );

-- MODIFY: it_admin, director, ops_manager
CREATE POLICY "lessons_modify" ON course_lessons
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- ============================================
-- COURSE_PROGRESS - Прогресс курсов
-- ============================================

-- SELECT: свой прогресс + it_admin + director + ops_manager
CREATE POLICY "progress_select" ON course_progress
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_current_user_role() IN ('it_admin', 'director')
        OR (get_current_user_role() = 'ops_manager' AND user_id IN (
            SELECT id FROM profiles WHERE branch_id IN (
                SELECT id FROM branches WHERE ops_manager_id = auth.uid()
            )
        ))
    );

-- INSERT/UPDATE: свой прогресс + it_admin
CREATE POLICY "progress_modify" ON course_progress
    FOR ALL USING (
        user_id = auth.uid()
        OR get_current_user_role() = 'it_admin'
    );

-- ============================================
-- TESTS - Тесты
-- ============================================

-- SELECT: видимость по ролям/точкам
CREATE POLICY "tests_select" ON tests
    FOR SELECT USING (
        is_visible_by_roles(visibility_roles)
        AND (array_length(visibility_branch_ids, 1) IS NULL 
             OR array_length(visibility_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(visibility_branch_ids))
        OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- MODIFY: it_admin, director, ops_manager
CREATE POLICY "tests_modify" ON tests
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- ============================================
-- TEST_QUESTIONS и TEST_ANSWER_OPTIONS
-- ============================================

CREATE POLICY "questions_select" ON test_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tests 
            WHERE id = test_questions.test_id
            AND (
                is_visible_by_roles(visibility_roles)
                OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
            )
        )
    );

CREATE POLICY "questions_modify" ON test_questions
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

CREATE POLICY "options_select" ON test_answer_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM test_questions q
            JOIN tests t ON q.test_id = t.id
            WHERE q.id = test_answer_options.question_id
            AND (
                is_visible_by_roles(t.visibility_roles)
                OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
            )
        )
    );

CREATE POLICY "options_modify" ON test_answer_options
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- ============================================
-- TEST_ATTEMPTS - Попытки тестов
-- ============================================

-- SELECT: свои попытки + it_admin + director + ops_manager для своих
CREATE POLICY "attempts_select" ON test_attempts
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_current_user_role() IN ('it_admin', 'director')
        OR (get_current_user_role() = 'ops_manager' AND user_id IN (
            SELECT id FROM profiles WHERE branch_id IN (
                SELECT id FROM branches WHERE ops_manager_id = auth.uid()
            )
        ))
    );

-- INSERT: только свои попытки
CREATE POLICY "attempts_insert" ON test_attempts
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- UPDATE: свои + it_admin
CREATE POLICY "attempts_update" ON test_attempts
    FOR UPDATE USING (
        user_id = auth.uid()
        OR get_current_user_role() = 'it_admin'
    );

-- ============================================
-- TEST_ATTEMPT_ANSWERS - Ответы в попытках
-- ============================================

CREATE POLICY "attempt_answers_select" ON test_attempt_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE id = test_attempt_answers.attempt_id
            AND (
                user_id = auth.uid()
                OR get_current_user_role() IN ('it_admin', 'director')
            )
        )
    );

CREATE POLICY "attempt_answers_modify" ON test_attempt_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE id = test_attempt_answers.attempt_id
            AND user_id = auth.uid()
        )
        OR get_current_user_role() = 'it_admin'
    );

-- ============================================
-- CHECKLISTS - Шаблоны чек-листов
-- ============================================

-- SELECT: применимость по ролям/точкам
CREATE POLICY "checklists_select" ON checklists
    FOR SELECT USING (
        is_visible_by_roles(applicable_roles)
        AND (array_length(applicable_branch_ids, 1) IS NULL 
             OR array_length(applicable_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(applicable_branch_ids))
        OR get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- MODIFY: it_admin, director, ops_manager
CREATE POLICY "checklists_modify" ON checklists
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- ============================================
-- CHECKLIST_ITEMS - Пункты чек-листов
-- ============================================

CREATE POLICY "checklist_items_select" ON checklist_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM checklists 
            WHERE id = checklist_items.checklist_id
        )
    );

CREATE POLICY "checklist_items_modify" ON checklist_items
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- ============================================
-- CHECKLIST_RUNS - Экземпляры чек-листов
-- ============================================

-- SELECT: своя точка + ops_manager своих точек + central office
CREATE POLICY "checklist_runs_select" ON checklist_runs
    FOR SELECT USING (
        branch_id = get_current_user_branch()
        OR is_ops_manager_for_branch(branch_id)
        OR get_current_user_role() IN ('it_admin', 'director', 'security', 'accountant')
    );

-- INSERT: it_admin, director, ops_manager
CREATE POLICY "checklist_runs_insert" ON checklist_runs
    FOR INSERT WITH CHECK (
        get_current_user_role() IN ('it_admin', 'director', 'ops_manager')
    );

-- UPDATE: сотрудники точки + ops_manager
CREATE POLICY "checklist_runs_update" ON checklist_runs
    FOR UPDATE USING (
        branch_id = get_current_user_branch()
        OR is_ops_manager_for_branch(branch_id)
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- ============================================
-- CHECKLIST_RUN_ITEMS - Ответы по пунктам
-- ============================================

-- SELECT: как у runs
CREATE POLICY "run_items_select" ON checklist_run_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM checklist_runs 
            WHERE id = checklist_run_items.run_id
            AND (
                branch_id = get_current_user_branch()
                OR is_ops_manager_for_branch(branch_id)
                OR get_current_user_role() IN ('it_admin', 'director', 'security')
            )
        )
    );

-- UPDATE: сотрудники точки
CREATE POLICY "run_items_update" ON checklist_run_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM checklist_runs r
            WHERE r.id = checklist_run_items.run_id
            AND r.branch_id = get_current_user_branch()
        )
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- ============================================
-- TASKS - Задачи
-- ============================================

-- SELECT: автор, исполнитель, сотрудники той же точки, ops_manager по точкам, admin
CREATE POLICY "tasks_select" ON tasks
    FOR SELECT USING (
        author_id = auth.uid()
        OR assignee_id = auth.uid()
        OR (branch_id = get_current_user_branch() AND branch_id IS NOT NULL)
        OR is_ops_manager_for_branch(branch_id)
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- INSERT: все авторизованные
CREATE POLICY "tasks_insert" ON tasks
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
    );

-- UPDATE: автор, исполнитель, ops_manager по точке, admin
CREATE POLICY "tasks_update" ON tasks
    FOR UPDATE USING (
        author_id = auth.uid()
        OR assignee_id = auth.uid()
        OR is_ops_manager_for_branch(branch_id)
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- DELETE: только автор и admin
CREATE POLICY "tasks_delete" ON tasks
    FOR DELETE USING (
        author_id = auth.uid()
        OR get_current_user_role() = 'it_admin'
    );

-- ============================================
-- TASK_COMMENTS - Комментарии к задачам
-- ============================================

CREATE POLICY "task_comments_select" ON task_comments
    FOR SELECT USING (
        EXISTS (
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

CREATE POLICY "task_comments_insert" ON task_comments
    FOR INSERT WITH CHECK (
        EXISTS (
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

-- ============================================
-- TASK_ATTACHMENTS - Вложения задач
-- ============================================

CREATE POLICY "task_attachments_select" ON task_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE id = task_attachments.task_id
            AND (
                author_id = auth.uid()
                OR assignee_id = auth.uid()
                OR branch_id = get_current_user_branch()
                OR get_current_user_role() IN ('it_admin', 'director')
            )
        )
    );

CREATE POLICY "task_attachments_insert" ON task_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE id = task_attachments.task_id
            AND (
                author_id = auth.uid()
                OR assignee_id = auth.uid()
                OR get_current_user_role() IN ('it_admin', 'director')
            )
        )
    );

-- ============================================
-- NEWS - Новости
-- ============================================

-- SELECT: по аудитории
CREATE POLICY "news_select" ON news
    FOR SELECT USING (
        is_visible_by_roles(audience_roles)
        AND (array_length(audience_branch_ids, 1) IS NULL 
             OR array_length(audience_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(audience_branch_ids))
        OR get_current_user_role() IN ('it_admin', 'director')
    );

-- MODIFY: it_admin, director
CREATE POLICY "news_modify" ON news
    FOR ALL USING (
        get_current_user_role() IN ('it_admin', 'director')
    );

-- ============================================
-- NEWS_READS - Прочтение новостей
-- ============================================

CREATE POLICY "news_reads_select" ON news_reads
    FOR SELECT USING (
        user_id = auth.uid()
        OR get_current_user_role() IN ('it_admin', 'director')
    );

CREATE POLICY "news_reads_insert" ON news_reads
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- ============================================
-- CHAT_CHANNELS - Каналы чата
-- ============================================

CREATE POLICY "chat_channels_select" ON chat_channels
    FOR SELECT USING (
        is_visible_by_roles(visibility_roles)
        OR array_length(visibility_roles, 1) IS NULL
        OR array_length(visibility_roles, 1) = 0
    );

CREATE POLICY "chat_channels_modify" ON chat_channels
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );

-- ============================================
-- CHAT_MESSAGES - Сообщения чата
-- ============================================

CREATE POLICY "chat_messages_select" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_channels 
            WHERE id = chat_messages.channel_id
            AND (
                is_visible_by_roles(visibility_roles)
                OR array_length(visibility_roles, 1) IS NULL
                OR array_length(visibility_roles, 1) = 0
            )
        )
    );

CREATE POLICY "chat_messages_insert" ON chat_messages
    FOR INSERT WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM chat_channels 
            WHERE id = chat_messages.channel_id
            AND (
                is_visible_by_roles(visibility_roles)
                OR array_length(visibility_roles, 1) IS NULL
                OR array_length(visibility_roles, 1) = 0
            )
        )
    );

-- ============================================
-- AI_INDEX - Векторный индекс
-- ============================================

-- SELECT: по видимости
CREATE POLICY "ai_index_select" ON ai_index
    FOR SELECT USING (
        is_visible_by_roles(visibility_roles)
        AND (array_length(visibility_branch_ids, 1) IS NULL 
             OR array_length(visibility_branch_ids, 1) = 0
             OR get_current_user_branch() = ANY(visibility_branch_ids))
        OR get_current_user_role() = 'it_admin'
    );

-- MODIFY: только it_admin
CREATE POLICY "ai_index_modify" ON ai_index
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );

-- ============================================
-- AUDIT_LOGS - Аудит-лог
-- ============================================

CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT USING (
        get_current_user_role() = 'it_admin'
    );

CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT WITH CHECK (true); -- разрешаем всем вставку (через триггеры)

-- ============================================
-- SYSTEM_SETTINGS - Настройки системы
-- ============================================

CREATE POLICY "settings_select" ON system_settings
    FOR SELECT USING (true);

CREATE POLICY "settings_modify" ON system_settings
    FOR ALL USING (
        get_current_user_role() = 'it_admin'
    );
