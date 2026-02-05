-- ============================================
-- МКК ФК - Внутренний портал сотрудников
-- Полная схема базы данных Supabase/Postgres
-- ============================================

-- ============================================
-- 1. ENUM ТИПЫ
-- ============================================

-- Роли пользователей
CREATE TYPE user_role AS ENUM (
    'agent',           -- сотрудник точки
    'branch_manager',  -- старший по точке
    'ops_manager',     -- операционный руководитель
    'director',        -- директор
    'security',        -- безопасность/верификация
    'accountant',      -- бухгалтерия
    'it_admin',        -- техотдел / админ портала
    'hr'               -- HR (опционально)
);

-- Типы чек-листов (периодичность)
CREATE TYPE checklist_type AS ENUM (
    'daily',    -- ежедневный
    'weekly',   -- еженедельный
    'monthly',  -- ежемесячный
    'once',     -- разовый
    'by_event'  -- по событию
);

-- Типы задач
CREATE TYPE task_type AS ENUM (
    'operations',
    'it',
    'security',
    'other'
);

-- Приоритеты задач
CREATE TYPE task_priority AS ENUM (
    'low',
    'medium',
    'high'
);

-- Статусы задач
CREATE TYPE task_status AS ENUM (
    'new',
    'in_progress',
    'done',
    'rejected'
);

-- Статусы чек-листов
CREATE TYPE checklist_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'overdue'
);

-- Типы вопросов тестов
CREATE TYPE question_type AS ENUM (
    'single_choice',
    'multiple_choice',
    'text'
);

-- Типы пунктов чек-листа
CREATE TYPE checklist_item_type AS ENUM (
    'checkbox',
    'text',
    'photo'
);

-- Типы новостей
CREATE TYPE news_type AS ENUM (
    'critical',
    'normal'
);

-- Статусы статей базы знаний
CREATE TYPE article_status AS ENUM (
    'draft',
    'published',
    'archived'
);

-- Статусы прогресса курса
CREATE TYPE course_progress_status AS ENUM (
    'not_started',
    'in_progress',
    'completed'
);

-- Статусы попыток тестов
CREATE TYPE test_attempt_status AS ENUM (
    'in_progress',
    'completed',
    'expired'
);

-- ============================================
-- 2. ТАБЛИЦЫ
-- ============================================

-- --------------------------------------------
-- 2.1 Профили пользователей (расширение auth.users)
-- --------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'agent',
    branch_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    hired_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Профили сотрудников с ролями и привязкой к точкам';

-- --------------------------------------------
-- 2.2 Точки выдачи (филиалы)
-- --------------------------------------------
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    working_hours TEXT,
    region TEXT,
    ops_manager_id UUID REFERENCES profiles(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавляем внешний ключ в profiles после создания branches
ALTER TABLE profiles 
    ADD CONSTRAINT fk_profiles_branch 
    FOREIGN KEY (branch_id) REFERENCES branches(id);

COMMENT ON TABLE branches IS 'Точки выдачи займов';

-- --------------------------------------------
-- 2.3 База знаний - категории
-- --------------------------------------------
CREATE TABLE knowledge_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES knowledge_categories(id),
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE knowledge_categories IS 'Категории статей базы знаний (иерархическая структура)';

-- --------------------------------------------
-- 2.4 База знаний - статьи
-- --------------------------------------------
CREATE TABLE knowledge_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES knowledge_categories(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    status article_status NOT NULL DEFAULT 'draft',
    visibility_roles user_role[] DEFAULT '{}',
    visibility_branch_ids UUID[] DEFAULT '{}',
    views INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE knowledge_articles IS 'Статьи базы знаний с контролем видимости';

-- --------------------------------------------
-- 2.5 Документы - категории
-- --------------------------------------------
CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------
-- 2.6 Документы
-- --------------------------------------------
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES document_categories(id),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    effective_from DATE,
    mandatory BOOLEAN NOT NULL DEFAULT false,
    visibility_roles user_role[] DEFAULT '{}',
    visibility_branch_ids UUID[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Регламенты, ЛНА, инструкции с контролем ознакомления';

-- --------------------------------------------
-- 2.7 Ознакомление с документами
-- --------------------------------------------
CREATE TABLE document_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

COMMENT ON TABLE document_acknowledgements IS 'Фиксация ознакомления с обязательными документами';

-- --------------------------------------------
-- 2.8 Курсы обучения
-- --------------------------------------------
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    mandatory BOOLEAN NOT NULL DEFAULT false,
    period_days INTEGER, -- периодичность переаттестации в днях
    visibility_roles user_role[] DEFAULT '{}',
    visibility_branch_ids UUID[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE courses IS 'Курсы обучения и аттестации';

-- --------------------------------------------
-- 2.9 Уроки курсов
-- --------------------------------------------
CREATE TABLE course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------
-- 2.10 Прогресс прохождения курсов
-- --------------------------------------------
CREATE TABLE course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status course_progress_status NOT NULL DEFAULT 'not_started',
    last_lesson_id UUID REFERENCES course_lessons(id),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, user_id)
);

-- --------------------------------------------
-- 2.11 Тесты
-- --------------------------------------------
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    course_id UUID REFERENCES courses(id),
    mandatory BOOLEAN NOT NULL DEFAULT false,
    pass_score INTEGER NOT NULL DEFAULT 70, -- процент проходного балла
    max_attempts INTEGER, -- null = неограниченно
    time_limit_minutes INTEGER, -- null = без ограничения
    visibility_roles user_role[] DEFAULT '{}',
    visibility_branch_ids UUID[] DEFAULT '{}',
    period_days INTEGER, -- периодичность переаттестации
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tests IS 'Тесты для аттестации';

-- --------------------------------------------
-- 2.12 Вопросы тестов
-- --------------------------------------------
CREATE TABLE test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type question_type NOT NULL DEFAULT 'single_choice',
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------
-- 2.13 Варианты ответов
-- --------------------------------------------
CREATE TABLE test_answer_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- --------------------------------------------
-- 2.14 Попытки прохождения тестов
-- --------------------------------------------
CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    score INTEGER,
    passed BOOLEAN,
    status test_attempt_status NOT NULL DEFAULT 'in_progress'
);

-- --------------------------------------------
-- 2.15 Ответы в попытках
-- --------------------------------------------
CREATE TABLE test_attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES test_questions(id),
    selected_option_ids UUID[] DEFAULT '{}',
    text_answer TEXT,
    is_correct BOOLEAN
);

-- --------------------------------------------
-- 2.16 Шаблоны чек-листов
-- --------------------------------------------
CREATE TABLE checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type checklist_type NOT NULL DEFAULT 'daily',
    applicable_branch_ids UUID[] DEFAULT '{}',
    applicable_roles user_role[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE checklists IS 'Шаблоны чек-листов для точек';

-- --------------------------------------------
-- 2.17 Пункты чек-листов
-- --------------------------------------------
CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type checklist_item_type NOT NULL DEFAULT 'checkbox',
    required BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- --------------------------------------------
-- 2.18 Экземпляры чек-листов (выполнения)
-- --------------------------------------------
CREATE TABLE checklist_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES checklists(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    due_date DATE NOT NULL,
    status checklist_status NOT NULL DEFAULT 'not_started',
    created_by UUID NOT NULL REFERENCES profiles(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE checklist_runs IS 'Конкретные экземпляры чек-листов для выполнения';

-- --------------------------------------------
-- 2.19 Ответы по пунктам чек-листа
-- --------------------------------------------
CREATE TABLE checklist_run_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id),
    checked BOOLEAN NOT NULL DEFAULT false,
    text_value TEXT,
    photo_path TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(run_id, item_id)
);

-- --------------------------------------------
-- 2.20 Задачи
-- --------------------------------------------
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type task_type NOT NULL DEFAULT 'other',
    priority task_priority NOT NULL DEFAULT 'medium',
    status task_status NOT NULL DEFAULT 'new',
    author_id UUID NOT NULL REFERENCES profiles(id),
    assignee_id UUID REFERENCES profiles(id),
    branch_id UUID REFERENCES branches(id),
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

COMMENT ON TABLE tasks IS 'Задачи сотрудников';

-- --------------------------------------------
-- 2.21 Комментарии к задачам
-- --------------------------------------------
CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------
-- 2.22 Вложения к задачам
-- --------------------------------------------
CREATE TABLE task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------
-- 2.23 Новости
-- --------------------------------------------
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type news_type NOT NULL DEFAULT 'normal',
    audience_roles user_role[] DEFAULT '{}',
    audience_branch_ids UUID[] DEFAULT '{}',
    published_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE news IS 'Новости и объявления для сотрудников';

-- --------------------------------------------
-- 2.24 Прочтение новостей
-- --------------------------------------------
CREATE TABLE news_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(news_id, user_id)
);

-- --------------------------------------------
-- 2.25 Каналы чата
-- --------------------------------------------
CREATE TABLE chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    visibility_roles user_role[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_channels IS 'Каналы для внутреннего чата';

-- --------------------------------------------
-- 2.26 Сообщения чата
-- --------------------------------------------
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------
-- 2.27 ИИ-индекс (векторный поиск)
-- --------------------------------------------
CREATE TABLE ai_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL, -- 'article', 'document', 'lesson'
    source_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- для OpenAI embeddings
    visibility_roles user_role[] DEFAULT '{}',
    visibility_branch_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_type, source_id, chunk_index)
);

COMMENT ON TABLE ai_index IS 'Векторный индекс для ИИ-поиска (RAG)';

-- --------------------------------------------
-- 2.28 Аудит-лог (опционально)
-- --------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Логирование важных действий в админке';

-- --------------------------------------------
-- 2.29 Настройки системы
-- --------------------------------------------
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'Ключи API, общие параметры системы';

-- ============================================
-- 3. ИНДЕКСЫ
-- ============================================

-- Профили
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_branch ON profiles(branch_id);
CREATE INDEX idx_profiles_active ON profiles(is_active);

-- Точки
CREATE INDEX idx_branches_ops_manager ON branches(ops_manager_id);
CREATE INDEX idx_branches_region ON branches(region);

-- Статьи базы знаний
CREATE INDEX idx_articles_category ON knowledge_articles(category_id);
CREATE INDEX idx_articles_status ON knowledge_articles(status);
CREATE INDEX idx_articles_created_by ON knowledge_articles(created_by);

-- Документы
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_mandatory ON documents(mandatory);
CREATE INDEX idx_documents_effective ON documents(effective_from);

-- Ознакомления
CREATE INDEX idx_ack_user ON document_acknowledgements(user_id);
CREATE INDEX idx_ack_document ON document_acknowledgements(document_id);

-- Курсы и прогресс
CREATE INDEX idx_course_progress_user ON course_progress(user_id);
CREATE INDEX idx_course_progress_course ON course_progress(course_id);
CREATE INDEX idx_course_progress_status ON course_progress(status);

-- Тесты и попытки
CREATE INDEX idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_test ON test_attempts(test_id);
CREATE INDEX idx_test_attempts_status ON test_attempts(status);

-- Чек-листы
CREATE INDEX idx_checklist_runs_branch ON checklist_runs(branch_id);
CREATE INDEX idx_checklist_runs_status ON checklist_runs(status);
CREATE INDEX idx_checklist_runs_due ON checklist_runs(due_date);

-- Задачи
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_author ON tasks(author_id);
CREATE INDEX idx_tasks_branch ON tasks(branch_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);

-- Новости
CREATE INDEX idx_news_published ON news(published_at);
CREATE INDEX idx_news_type ON news(type);

-- Чат
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- ИИ-индекс (для векторного поиска)
CREATE INDEX idx_ai_index_source ON ai_index(source_type, source_id);

-- ============================================
-- 4. ФУНКЦИИ И ТРИГГЕРЫ
-- ============================================

-- Функция обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_categories_updated_at BEFORE UPDATE ON knowledge_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_articles_updated_at BEFORE UPDATE ON knowledge_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_categories_updated_at BEFORE UPDATE ON document_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_lessons_updated_at BEFORE UPDATE ON course_lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_questions_updated_at BEFORE UPDATE ON test_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON checklists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_index_updated_at BEFORE UPDATE ON ai_index
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для увеличения счётчика просмотров статьи
CREATE OR REPLACE FUNCTION increment_article_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE knowledge_articles SET views = views + 1 WHERE id = article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для автоматического создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent'),
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для создания профиля
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. НАЧАЛЬНЫЕ ДАННЫЕ
-- ============================================

-- Категории документов
INSERT INTO document_categories (name) VALUES
    ('ЛНА'),
    ('Регламенты'),
    ('Инструкции'),
    ('Формы'),
    ('Приказы');

-- Каналы чата
INSERT INTO chat_channels (name, code, visibility_roles) VALUES
    ('Общий', 'general', '{}'),
    ('IT-поддержка', 'it_support', '{it_admin}'),
    ('Операционные вопросы', 'operations', '{ops_manager, director}'),
    ('Безопасность', 'security', '{security, director}');

-- Системные настройки
INSERT INTO system_settings (key, value, description) VALUES
    ('app_name', 'Портал МКК ФК', 'Название приложения'),
    ('llm_model', 'gpt-4o-mini', 'Модель LLM для ИИ-помощника'),
    ('max_file_size', '10485760', 'Максимальный размер файла (10MB)'),
    ('checklist_generation_time', '00:00', 'Время генерации ежедневных чек-листов');
