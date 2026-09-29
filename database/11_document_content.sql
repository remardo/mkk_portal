-- ============================================
-- МКК ФК - 11: текст документа прямо в БД
-- Зачем: страница /documents/[id] рендерит markdown
-- как страницу сайта. Сначала читает content,
-- иначе докачивает .md из storage bucket documents.
-- Применение: psql "$SUPABASE_DB_URL" -f database/11_document_content.sql
-- Идемпотентная.
-- ============================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS content TEXT;

COMMENT ON COLUMN documents.content IS 'Markdown-текст для рендера страницей /documents/[id]; если пуст — берётся файл из storage по file_path';
