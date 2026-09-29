-- ============================================
-- МКК ФК - 10: скрыть is_correct до завершения теста
-- Проблема: options_select отдавал is_correct всем
-- видящим тест, аттестация обходилась прямым SELECT.
-- Фикс: колонка is_correct доступна только через
-- RPC get_question_options(), прямой SELECT колонки
-- закрыт для anon/authenticated.
-- Применение: psql "$SUPABASE_DB_URL" -f database/10_fix_test_options.sql
-- Идемпотентная.
-- ============================================

-- Публичный срез без is_correct для списков/прохождения
CREATE OR REPLACE VIEW v_test_options_public AS
SELECT id, question_id, text, "order" FROM test_answer_options;

-- RPC: is_correct только привилегированным или после завершения своей попытки
CREATE OR REPLACE FUNCTION get_question_options(p_question_id UUID)
RETURNS TABLE (id UUID, question_id UUID, text TEXT, "order" INT, is_correct BOOLEAN) AS $$
DECLARE
    v_role user_role;
    v_test UUID;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE profiles.id = auth.uid() AND is_active = true;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    SELECT test_id INTO v_test FROM test_questions WHERE test_questions.id = p_question_id;
    IF v_test IS NULL THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    -- доступ к вопросу как в options_select
    IF NOT EXISTS (
        SELECT 1 FROM tests t WHERE t.id = v_test
        AND (is_visible_by_roles(t.visibility_roles) OR v_role IN ('it_admin', 'director', 'ops_manager'))
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    IF v_role IN ('it_admin', 'director', 'ops_manager') THEN
        RETURN QUERY SELECT o.id, o.question_id, o.text, o."order", o.is_correct
        FROM test_answer_options o WHERE o.question_id = p_question_id ORDER BY o."order";
    ELSIF EXISTS (
        SELECT 1 FROM test_attempts a WHERE a.test_id = v_test
        AND a.user_id = auth.uid() AND a.status = 'completed'
    ) THEN
        RETURN QUERY SELECT o.id, o.question_id, o.text, o."order", o.is_correct
        FROM test_answer_options o WHERE o.question_id = p_question_id ORDER BY o."order";
    ELSE
        -- до завершения: is_correct всегда NULL
        RETURN QUERY SELECT o.id, o.question_id, o.text, o."order", NULL::BOOLEAN
        FROM test_answer_options o WHERE o.question_id = p_question_id ORDER BY o."order";
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_question_options(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_question_options(UUID) TO authenticated;

-- Колонка is_correct: закрыть прямой SELECT для anon/authenticated,
-- оставить остальные колонки читаемыми (RLS-политики продолжают действовать построчно)
REVOKE ALL ON test_answer_options FROM anon;
REVOKE ALL ON test_answer_options FROM authenticated;
GRANT SELECT (id, question_id, text, "order") ON test_answer_options TO authenticated;
GRANT ALL ON test_answer_options TO service_role;
