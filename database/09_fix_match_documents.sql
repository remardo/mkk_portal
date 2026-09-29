-- ============================================
-- МКК ФК - 09: fix match_documents RLS bypass
-- Проблема: SECURITY DEFINER доверял входным
-- user_role/user_branch_id, прямой rpc с чужими
-- параметрами читал чужие документы.
-- Фикс: роль/branch берутся из auth.uid(),
-- входные параметры игнорируются (оставлены
-- для совместимости сигнатуры).
-- Применение: psql "$SUPABASE_DB_URL" -f database/09_fix_match_documents.sql
-- Идемпотентная.
-- ============================================

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding   VECTOR(1536),
    match_threshold   FLOAT DEFAULT 0.7,
    match_count       INT   DEFAULT 5,
    user_role         TEXT DEFAULT NULL,
    user_branch_id    UUID DEFAULT NULL
)
RETURNS TABLE (
    id           UUID,
    source_type  TEXT,
    source_id    UUID,
    content      TEXT,
    title        TEXT,
    similarity   FLOAT
) AS $fn$
DECLARE
    v_role user_role;
    v_branch UUID;
BEGIN
    -- Игнорируем входные user_role/user_branch_id, берём из auth
    SELECT role, branch_id INTO v_role, v_branch
    FROM profiles WHERE id = auth.uid() AND is_active = true;

    -- Неактивный/неизвестный пользователь: пустой результат
    IF v_role IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        ai.id,
        ai.source_type,
        ai.source_id,
        ai.content,
        ka.title,
        (1 - (ai.embedding <=> query_embedding))::FLOAT AS similarity
    FROM ai_index ai
    LEFT JOIN knowledge_articles ka
        ON ka.id = ai.source_id AND ai.source_type = 'article'
    WHERE ai.embedding IS NOT NULL
      AND 1 - (ai.embedding <=> query_embedding) > match_threshold
      AND (
          coalesce(cardinality(ai.visibility_roles), 0) = 0
          OR ai.visibility_roles::TEXT[] @> ARRAY[v_role::TEXT]
      )
      AND (
          coalesce(cardinality(ai.visibility_branch_ids), 0) = 0
          OR ai.visibility_branch_ids @> ARRAY[v_branch]
      )
    ORDER BY ai.embedding <=> query_embedding
    LIMIT match_count;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- REVOKE прямой вызов у anon, оставить authenticated (политика внутри через auth.uid)
REVOKE ALL ON FUNCTION match_documents(VECTOR, FLOAT, INT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION match_documents(VECTOR, FLOAT, INT, TEXT, UUID) TO authenticated;
