-- ============================================
-- МКК ФК - 05_verify: runtime integration checks
-- Read-only / transaction-rollback verification.
--
-- Usage (operator creates a disposable test user separately,
-- e.g. Supabase Auth user + profiles row role='agent', is_active=true):
--   psql "$DATABASE_URL" -v test_user_id='<uuid>' -f database/05_verify.sql
--
-- Everything runs inside one transaction that is ROLLED BACK,
-- so no data changes persist.
-- ============================================

\if :{?test_user_id}
\else
\echo 'ERROR: missing -v test_user_id=<uuid> (disposable test user created by operator separately)'
\quit 1
\endif

BEGIN;

-- --------------------------------------------
-- 1. Views are queryable (LIMIT 0 = parse/plan only, no rows)
-- --------------------------------------------
SELECT * FROM v_company_stats LIMIT 0;
SELECT * FROM v_branch_stats LIMIT 0;
SELECT * FROM v_employee_learning_stats LIMIT 0;
SELECT * FROM v_document_acknowledgement_stats LIMIT 0;
SELECT * FROM v_tasks_by_type_stats LIMIT 0;
SELECT * FROM v_portal_activity LIMIT 0;
SELECT * FROM v_my_tasks LIMIT 0;
SELECT * FROM v_my_checklists LIMIT 0;
SELECT * FROM v_test_results_detailed LIMIT 0;
SELECT * FROM v_news_read_stats LIMIT 0;
SELECT * FROM v_it_stats LIMIT 0;
SELECT * FROM v_course_progress_detailed LIMIT 0;
SELECT * FROM v_director_dashboard LIMIT 0;
SELECT * FROM v_ops_manager_dashboard LIMIT 0;
SELECT * FROM v_unread_news LIMIT 0;

-- RPCs execute runtime RETURN QUERY (no LIMIT 0), would 42703/42601 on mismatch
SELECT * FROM get_my_tasks(:'test_user_id'::uuid, 1);
SELECT * FROM get_my_checklists(
    (SELECT branch_id FROM profiles WHERE id = :'test_user_id'::uuid),
    1
);
SELECT * FROM get_director_dashboard();

-- --------------------------------------------
-- 2. RLS stays enabled (we never disable RLS)
-- --------------------------------------------
DO $$
DECLARE
    missing TEXT;
BEGIN
    SELECT string_agg(c.relname, ', ') INTO missing
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('profiles', 'tasks', 'system_settings', 'document_categories',
                        'news', 'news_reads', 'documents', 'document_acknowledgements',
                        'test_attempts')
      AND NOT c.relrowsecurity;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'RLS disabled on: %', missing;
    END IF;
    RAISE NOTICE 'ok - RLS enabled on hardened tables';
END $$;

-- --------------------------------------------
-- 3. anon has no object access
-- --------------------------------------------
DO $$
BEGIN
    IF has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
        RAISE EXCEPTION 'anon still has SELECT on public.profiles';
    END IF;
    IF has_function_privilege('anon', 'public.get_my_tasks(uuid, integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'anon still has EXECUTE on get_my_tasks';
    END IF;
    RAISE NOTICE 'ok - anon revoked on tables/functions';
END $$;

-- --------------------------------------------
-- 4. SECURITY DEFINER functions pin search_path=public
-- --------------------------------------------
DO $$
DECLARE
    bad TEXT;
BEGIN
    SELECT string_agg(p.proname, ', ') INTO bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_current_user_role', 'get_current_user_branch',
                        'is_ops_manager_for_branch',
                        'is_visible_by_roles', 'prevent_profile_privilege_escalation',
                        'prevent_attempt_score_tampering')
      AND (p.proconfig IS NULL
           OR NOT EXISTS (
               SELECT 1 FROM unnest(p.proconfig) AS cfg
               WHERE cfg LIKE 'search_path=%public%'
           ));
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'SECURITY DEFINER without fixed search_path: %', bad;
    END IF;
    RAISE NOTICE 'ok - SECURITY DEFINER search_path pinned';
END $$;

-- --------------------------------------------
-- 5. Privilege-escalation guards keep trusted DBA bypass
-- (direct postgres session / service_role for admin provisioning)
-- --------------------------------------------
DO $$
DECLARE
    def TEXT;
BEGIN
    SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'prevent_profile_privilege_escalation' LIMIT 1;
    IF def IS NULL OR position('service_role' IN def) = 0 OR position('postgres' IN def) = 0 THEN
        RAISE EXCEPTION 'prevent_profile_privilege_escalation missing trusted DBA bypass';
    END IF;
    SELECT pg_get_functiondef(oid) INTO def
    FROM pg_proc WHERE proname = 'prevent_attempt_score_tampering' LIMIT 1;
    IF def IS NULL OR position('service_role' IN def) = 0 OR position('postgres' IN def) = 0 THEN
        RAISE EXCEPTION 'prevent_attempt_score_tampering missing trusted DBA bypass';
    END IF;
    RAISE NOTICE 'ok - escalation guards allow postgres/service_role';
END $$;

-- --------------------------------------------
-- 6. Privilege-escalation must be verified over REST with an
-- authenticated JWT by the operator (we will do this).
-- NOTE: psql session_user is postgres (trusted DBA bypass), so any
-- SET ROLE simulation here would still bypass guards and prove nothing.
-- No simulated escalation test here on purpose.
-- This block only checks the disposable test user exists.
-- psql variables do not substitute inside DO dollar quotes, so the
-- test user id is passed via set_config outside DO and read back
-- with current_setting() within.
-- --------------------------------------------
SELECT set_config('test.user_id', :'test_user_id', true);

DO $$
DECLARE
    v_test_user UUID := current_setting('test.user_id')::uuid;
    v_role public.user_role;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_test_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'test user % not found in profiles (operator must create it separately)', v_test_user;
    END IF;
    RAISE NOTICE 'ok - test user % exists with role %; escalation check must be run over REST authenticated JWT by operator', v_test_user, v_role;
END $$;

-- --------------------------------------------
-- 7. Authenticated REST recursion check: SELECT profiles as the
-- disposable test user must not raise 42P17 infinite recursion.
-- Runs as ROLE authenticated with that user's JWT (not postgres
-- bypass, which skips RLS and would hide the rewrite). Read-only,
-- so the final ROLLBACK still holds.
-- --------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_id'), 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', current_setting('test.user_id'), true);
SELECT * FROM profiles LIMIT 1;
RESET ROLE;

DO $$
BEGIN
    RAISE NOTICE 'ok - authenticated SELECT profiles, no 42P17 recursion';
END $$;

ROLLBACK;
