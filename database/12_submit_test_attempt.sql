-- ============================================
-- МКК ФК - 12: серверный подсчёт результата теста
-- Зачем: is_correct скрыт от клиента (миграция 10),
-- поэтому score/passed считает только RPC.
-- Заодно закрываем attempts_update для обычных
-- пользователей (раньше можно было самому себе
-- проставить passed=true прямым UPDATE).
-- Применение: psql "$SUPABASE_DB_URL" -f database/12_submit_test_attempt.sql
-- Идемпотентная.
-- ============================================

CREATE OR REPLACE FUNCTION submit_test_attempt(
    p_attempt_id UUID,
    p_answers JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (score INT, passed BOOLEAN, correct INT, total INT) AS $$
DECLARE
    v_attempt test_attempts%ROWTYPE;
    v_pass_score INT;
    v_q RECORD;
    v_a JSONB;
    v_selected UUID[];
    v_correct UUID[];
    v_is_correct BOOLEAN;
    v_correct_count INT := 0;
    v_total INT := 0;
    v_text TEXT;
BEGIN
    SELECT * INTO v_attempt FROM test_attempts WHERE id = p_attempt_id;
    IF v_attempt.id IS NULL THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    IF v_attempt.status IS DISTINCT FROM 'in_progress' THEN
        RAISE EXCEPTION 'Attempt already finished';
    END IF;

    SELECT pass_score INTO v_pass_score FROM tests WHERE id = v_attempt.test_id;

    DELETE FROM test_attempt_answers WHERE attempt_id = p_attempt_id;

    FOR v_q IN SELECT id, type FROM test_questions
               WHERE test_id = v_attempt.test_id ORDER BY "order" LOOP
        SELECT elem INTO v_a FROM jsonb_array_elements(p_answers) AS elem
        WHERE elem->>'question_id' = v_q.id::TEXT LIMIT 1;

        v_selected := '{}';
        v_text := NULL;
        IF v_a IS NOT NULL THEN
            IF v_a ? 'selected_option_ids' THEN
                SELECT coalesce(array_agg(x::UUID), '{}') INTO v_selected
                FROM jsonb_array_elements_text(v_a->'selected_option_ids') AS x;
            END IF;
            IF v_a ? 'text_answer' THEN
                v_text := left(v_a->>'text_answer', 2000);
            END IF;
        END IF;

        IF v_q.type = 'text' THEN
            -- свободный ответ: проверка вручную, в score не входит
            INSERT INTO test_attempt_answers (attempt_id, question_id, selected_option_ids, text_answer, is_correct)
            VALUES (p_attempt_id, v_q.id, v_selected, v_text, NULL);
        ELSE
            v_total := v_total + 1;
            SELECT coalesce(array_agg(id), '{}') INTO v_correct
            FROM test_answer_options WHERE question_id = v_q.id AND is_correct = true;
            IF v_q.type = 'single_choice' THEN
                v_is_correct := array_length(v_selected, 1) = 1 AND v_selected[1] = ANY (v_correct);
            ELSE -- multiple_choice: множества должны совпасть
                v_is_correct := (SELECT array_agg(s ORDER BY s) FROM unnest(v_selected) s)
                             = (SELECT array_agg(c ORDER BY c) FROM unnest(v_correct) c);
            END IF;
            IF v_is_correct THEN
                v_correct_count := v_correct_count + 1;
            END IF;
            INSERT INTO test_attempt_answers (attempt_id, question_id, selected_option_ids, text_answer, is_correct)
            VALUES (p_attempt_id, v_q.id, v_selected, v_text, v_is_correct);
        END IF;
    END LOOP;

    IF v_total = 0 THEN
        UPDATE test_attempts SET status = 'completed', finished_at = NOW(),
               score = NULL, passed = NULL WHERE id = p_attempt_id;
        RETURN QUERY SELECT NULL::INT, NULL::BOOLEAN, 0, 0;
    ELSE
        UPDATE test_attempts SET status = 'completed', finished_at = NOW(),
               score = (v_correct_count * 100 / v_total),
               passed = (v_correct_count * 100 / v_total) >= v_pass_score
        WHERE id = p_attempt_id;
        RETURN QUERY SELECT (v_correct_count * 100 / v_total),
                            (v_correct_count * 100 / v_total) >= v_pass_score,
                            v_correct_count, v_total;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_test_attempt(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION submit_test_attempt(UUID, JSONB) TO authenticated;

-- Клиент больше не меняет попытки напрямую: подсчёт только через RPC.
-- it_admin сохраняет полный доступ (service_role обходит RLS в любом случае).
DROP POLICY IF EXISTS "attempts_update" ON test_attempts;
CREATE POLICY "attempts_update" ON test_attempts
    FOR UPDATE USING (
        get_current_user_role() = 'it_admin'
    );
