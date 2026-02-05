-- ============================================
-- МКК ФК - SQL Views для дэшбордов и отчётов
-- ============================================

-- --------------------------------------------
-- 1. Общая статистика компании
-- --------------------------------------------
CREATE OR REPLACE VIEW v_company_stats AS
SELECT
    (SELECT COUNT(*) FROM profiles WHERE is_active = true) as active_employees,
    (SELECT COUNT(*) FROM branches WHERE is_active = true) as active_branches,
    (SELECT COUNT(*) FROM tasks WHERE status NOT IN ('done', 'rejected')) as open_tasks,
    (SELECT COUNT(*) FROM checklist_runs WHERE status = 'overdue') as overdue_checklists,
    (SELECT COUNT(*) FROM news WHERE type = 'critical' AND published_at > NOW() - INTERVAL '30 days') as critical_news_30d;

-- --------------------------------------------
-- 2. Статистика по точкам
-- --------------------------------------------
CREATE OR REPLACE VIEW v_branch_stats AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    b.city,
    b.region,
    COUNT(DISTINCT p.id) as employee_count,
    COUNT(DISTINCT CASE WHEN p.is_active THEN p.id END) as active_employees,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('done', 'rejected')) as open_tasks,
    COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'overdue') as overdue_checklists,
    COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'completed' AND cr.due_date >= CURRENT_DATE - INTERVAL '7 days') as completed_checklists_7d,
    bm.full_name as ops_manager_name
FROM branches b
LEFT JOIN profiles p ON p.branch_id = b.id
LEFT JOIN tasks t ON t.branch_id = b.id
LEFT JOIN checklist_runs cr ON cr.branch_id = b.id
LEFT JOIN profiles bm ON bm.id = b.ops_manager_id
WHERE b.is_active = true
GROUP BY b.id, b.name, b.city, b.region, bm.full_name;

-- --------------------------------------------
-- 3. Прогресс обучения по сотрудникам
-- --------------------------------------------
CREATE OR REPLACE VIEW v_employee_learning_stats AS
SELECT 
    p.id as user_id,
    p.full_name,
    p.role,
    b.name as branch_name,
    COUNT(DISTINCT c.id) FILTER (WHERE c.mandatory = true) as mandatory_courses_total,
    COUNT(DISTINCT cp.course_id) FILTER (WHERE cp.status = 'completed' AND c.mandatory = true) as mandatory_courses_completed,
    COUNT(DISTINCT t.id) FILTER (WHERE t.mandatory = true) as mandatory_tests_total,
    COUNT(DISTINCT ta.id) FILTER (WHERE ta.passed = true AND t.mandatory = true) as mandatory_tests_passed,
    MAX(ta.finished_at) FILTER (WHERE ta.passed = true) as last_certification_date,
    CASE 
        WHEN COUNT(DISTINCT t.id) FILTER (WHERE t.mandatory = true) = 0 THEN true
        WHEN COUNT(DISTINCT ta.id) FILTER (WHERE ta.passed = true AND t.mandatory = true AND 
            (t.period_days IS NULL OR ta.finished_at > NOW() - (t.period_days || ' days')::INTERVAL)
        ) = COUNT(DISTINCT t.id) FILTER (WHERE t.mandatory = true) THEN true
        ELSE false
    END as certifications_actual
FROM profiles p
LEFT JOIN branches b ON b.id = p.branch_id
LEFT JOIN courses c ON c.mandatory = true 
    AND (array_length(c.visibility_roles, 1) = 0 OR p.role = ANY(c.visibility_roles))
    AND (array_length(c.visibility_branch_ids, 1) = 0 OR p.branch_id = ANY(c.visibility_branch_ids))
LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.user_id = p.id
LEFT JOIN tests t ON t.mandatory = true
    AND (array_length(t.visibility_roles, 1) = 0 OR p.role = ANY(t.visibility_roles))
    AND (array_length(t.visibility_branch_ids, 1) = 0 OR p.branch_id = ANY(t.visibility_branch_ids))
LEFT JOIN test_attempts ta ON ta.test_id = t.id AND ta.user_id = p.id AND ta.passed = true
WHERE p.is_active = true
GROUP BY p.id, p.full_name, p.role, b.name;

-- --------------------------------------------
-- 4. Ознакомление с обязательными документами
-- --------------------------------------------
CREATE OR REPLACE VIEW v_document_acknowledgement_stats AS
SELECT 
    d.id as document_id,
    d.title as document_title,
    d.version,
    d.effective_from,
    d.mandatory,
    COUNT(DISTINCT p.id) as total_employees,
    COUNT(DISTINCT da.user_id) as acknowledged_count,
    ROUND(COUNT(DISTINCT da.user_id) * 100.0 / NULLIF(COUNT(DISTINCT p.id), 0), 2) as acknowledgement_percent,
    array_agg(DISTINCT CASE WHEN da.user_id IS NULL THEN p.full_name END) FILTER (WHERE da.user_id IS NULL) as not_acknowledged_employees
FROM documents d
LEFT JOIN profiles p ON p.is_active = true
    AND (array_length(d.visibility_roles, 1) = 0 OR p.role = ANY(d.visibility_roles))
    AND (array_length(d.visibility_branch_ids, 1) = 0 OR p.branch_id = ANY(d.visibility_branch_ids))
LEFT JOIN document_acknowledgements da ON da.document_id = d.id AND da.user_id = p.id
WHERE d.mandatory = true
GROUP BY d.id, d.title, d.version, d.effective_from, d.mandatory;

-- --------------------------------------------
-- 5. Статистика задач по типам
-- --------------------------------------------
CREATE OR REPLACE VIEW v_tasks_by_type_stats AS
SELECT 
    type,
    priority,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) FILTER (WHERE closed_at IS NOT NULL) as avg_resolution_hours,
    COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done', 'rejected')) as overdue_count
FROM tasks
GROUP BY type, priority, status;

-- --------------------------------------------
-- 6. Активность в портале (последние 30 дней)
-- --------------------------------------------
CREATE OR REPLACE VIEW v_portal_activity AS
WITH daily_activity AS (
    SELECT 
        DATE(created_at) as date,
        'task_created' as activity_type,
        COUNT(*) as count
    FROM tasks
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    
    UNION ALL
    
    SELECT 
        DATE(created_at) as date,
        'checklist_completed' as activity_type,
        COUNT(*) as count
    FROM checklist_runs
    WHERE completed_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(completed_at)
    
    UNION ALL
    
    SELECT 
        DATE(finished_at) as date,
        'test_completed' as activity_type,
        COUNT(*) as count
    FROM test_attempts
    WHERE finished_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(finished_at)
    
    UNION ALL
    
    SELECT 
        DATE(read_at) as date,
        'document_acknowledged' as activity_type,
        COUNT(*) as count
    FROM document_acknowledgements
    WHERE acknowledged_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(read_at)
)
SELECT 
    date,
    activity_type,
    count,
    SUM(count) OVER (PARTITION BY date) as total_daily
FROM daily_activity
ORDER BY date DESC, activity_type;

-- --------------------------------------------
-- 7. Мои задачи (для текущего пользователя)
-- --------------------------------------------
CREATE OR REPLACE VIEW v_my_tasks AS
SELECT 
    t.*,
    author.full_name as author_name,
    assignee.full_name as assignee_name,
    b.name as branch_name,
    CASE 
        WHEN t.due_date < NOW() AND t.status NOT IN ('done', 'rejected') THEN true
        ELSE false
    END as is_overdue
FROM tasks t
LEFT JOIN profiles author ON author.id = t.author_id
LEFT JOIN profiles assignee ON assignee.id = t.assignee_id
LEFT JOIN branches b ON b.id = t.branch_id
WHERE t.status NOT IN ('done', 'rejected');

-- --------------------------------------------
-- 8. Мои чек-листы (для текущего пользователя)
-- --------------------------------------------
CREATE OR REPLACE VIEW v_my_checklists AS
SELECT 
    cr.*,
    c.title as checklist_title,
    c.type as checklist_type,
    b.name as branch_name,
    COUNT(ci.id) as total_items,
    COUNT(cri.id) FILTER (WHERE cri.checked = true) as completed_items,
    CASE 
        WHEN cr.due_date < CURRENT_DATE AND cr.status NOT IN ('completed') THEN true
        ELSE false
    END as is_overdue
FROM checklist_runs cr
JOIN checklists c ON c.id = cr.checklist_id
JOIN branches b ON b.id = cr.branch_id
LEFT JOIN checklist_items ci ON ci.checklist_id = c.id
LEFT JOIN checklist_run_items cri ON cri.run_id = cr.id AND cri.item_id = ci.id
GROUP BY cr.id, c.title, c.type, b.name;

-- --------------------------------------------
-- 9. Результаты тестов по пользователям
-- --------------------------------------------
CREATE OR REPLACE VIEW v_test_results_detailed AS
SELECT 
    ta.id as attempt_id,
    t.id as test_id,
    t.title as test_title,
    t.mandatory,
    t.pass_score,
    p.id as user_id,
    p.full_name,
    b.name as branch_name,
    ta.started_at,
    ta.finished_at,
    ta.score,
    ta.passed,
    ta.status,
    EXTRACT(EPOCH FROM (ta.finished_at - ta.started_at))/60 as duration_minutes,
    COUNT(tq.id) as total_questions,
    COUNT(taa.id) FILTER (WHERE taa.is_correct = true) as correct_answers
FROM test_attempts ta
JOIN tests t ON t.id = ta.test_id
JOIN profiles p ON p.id = ta.user_id
LEFT JOIN branches b ON b.id = p.branch_id
LEFT JOIN test_questions tq ON tq.test_id = t.id
LEFT JOIN test_attempt_answers taa ON taa.attempt_id = ta.id AND taa.question_id = tq.id
GROUP BY ta.id, t.id, t.title, t.mandatory, t.pass_score, p.id, p.full_name, b.name, 
         ta.started_at, ta.finished_at, ta.score, ta.passed, ta.status;

-- --------------------------------------------
-- 10. Прочтение новостей
-- --------------------------------------------
CREATE OR REPLACE VIEW v_news_read_stats AS
SELECT 
    n.id as news_id,
    n.title,
    n.type,
    n.published_at,
    COUNT(nr.id) as read_count,
    (SELECT COUNT(*) FROM profiles WHERE is_active = true) as total_employees,
    ROUND(COUNT(nr.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM profiles WHERE is_active = true), 0), 2) as read_percent
FROM news n
LEFT JOIN news_reads nr ON nr.news_id = n.id
WHERE n.published_at IS NOT NULL
GROUP BY n.id, n.title, n.type, n.published_at;

-- --------------------------------------------
-- 11. IT-статистика (время реакции/решения)
-- --------------------------------------------
CREATE OR REPLACE VIEW v_it_stats AS
SELECT 
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'done') as completed_tasks,
    AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) FILTER (WHERE closed_at IS NOT NULL) as avg_resolution_hours,
    COUNT(*) FILTER (WHERE priority = 'high') as high_priority_tasks,
    COUNT(*) FILTER (WHERE priority = 'high' AND status = 'done') as high_priority_completed
FROM tasks
WHERE type = 'it'
    AND created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- --------------------------------------------
-- 12. Прогресс по курсам (детально)
-- --------------------------------------------
CREATE OR REPLACE VIEW v_course_progress_detailed AS
SELECT 
    c.id as course_id,
    c.title as course_title,
    c.mandatory,
    p.id as user_id,
    p.full_name,
    b.name as branch_name,
    cp.status,
    cp.updated_at as last_activity,
    COUNT(cl.id) as total_lessons,
    COUNT(cl.id) FILTER (WHERE cp.status = 'completed' OR (cp.status = 'in_progress' AND cl.id <= cp.last_lesson_id)) as completed_lessons,
    CASE 
        WHEN COUNT(cl.id) = 0 THEN 0
        ELSE ROUND(COUNT(cl.id) FILTER (WHERE cp.status = 'completed' OR (cp.status = 'in_progress' AND cl.id <= cp.last_lesson_id)) * 100.0 / COUNT(cl.id), 2)
    END as progress_percent
FROM courses c
CROSS JOIN profiles p
LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.user_id = p.id
LEFT JOIN branches b ON b.id = p.branch_id
LEFT JOIN course_lessons cl ON cl.course_id = c.id
WHERE p.is_active = true
    AND (array_length(c.visibility_roles, 1) = 0 OR p.role = ANY(c.visibility_roles))
    AND (array_length(c.visibility_branch_ids, 1) = 0 OR p.branch_id = ANY(c.visibility_branch_ids))
GROUP BY c.id, c.title, c.mandatory, p.id, p.full_name, b.name, cp.status, cp.updated_at;

-- --------------------------------------------
-- 13. Сводка для директора
-- --------------------------------------------
CREATE OR REPLACE VIEW v_director_dashboard AS
SELECT
    -- Общие показатели
    (SELECT COUNT(*) FROM profiles WHERE is_active = true) as total_employees,
    (SELECT COUNT(*) FROM branches WHERE is_active = true) as total_branches,
    
    -- Аттестации
    (SELECT COUNT(*) FROM v_employee_learning_stats WHERE certifications_actual = true) as employees_with_actual_certifications,
    (SELECT COUNT(*) FROM v_employee_learning_stats) as total_active_employees,
    ROUND(
        (SELECT COUNT(*) FROM v_employee_learning_stats WHERE certifications_actual = true) * 100.0 / 
        NULLIF((SELECT COUNT(*) FROM v_employee_learning_stats), 0), 2
    ) as certification_compliance_percent,
    
    -- Чек-листы
    (SELECT COUNT(*) FROM checklist_runs WHERE status = 'completed' AND due_date >= CURRENT_DATE - INTERVAL '7 days') as checklists_completed_7d,
    (SELECT COUNT(*) FROM checklist_runs WHERE status = 'overdue') as checklists_overdue,
    
    -- Задачи
    (SELECT COUNT(*) FROM tasks WHERE status NOT IN ('done', 'rejected')) as open_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status NOT IN ('done', 'rejected') AND due_date < NOW()) as overdue_tasks,
    (SELECT COUNT(*) FROM tasks WHERE type = 'it' AND status NOT IN ('done', 'rejected')) as open_it_tasks,
    (SELECT COUNT(*) FROM tasks WHERE type = 'operations' AND status NOT IN ('done', 'rejected')) as open_operations_tasks,
    
    -- Активность
    (SELECT COUNT(*) FROM test_attempts WHERE finished_at > NOW() - INTERVAL '7 days') as tests_completed_7d,
    (SELECT COUNT(*) FROM document_acknowledgements WHERE acknowledged_at > NOW() - INTERVAL '7 days') as documents_acknowledged_7d;

-- --------------------------------------------
-- 14. Сводка для операционного руководителя
-- --------------------------------------------
CREATE OR REPLACE VIEW v_ops_manager_dashboard AS
SELECT 
    p.id as ops_manager_id,
    p.full_name as ops_manager_name,
    COUNT(DISTINCT b.id) as managed_branches,
    COUNT(DISTINCT emp.id) as total_employees,
    COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'overdue') as overdue_checklists,
    COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'completed' AND cr.due_date >= CURRENT_DATE - INTERVAL '7 days') as completed_checklists_7d,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('done', 'rejected')) as open_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('done', 'rejected') AND t.due_date < NOW()) as overdue_tasks,
    COUNT(DISTINCT CASE WHEN els.certifications_actual = false THEN els.user_id END) as employees_with_expired_certifications
FROM profiles p
JOIN branches b ON b.ops_manager_id = p.id
LEFT JOIN profiles emp ON emp.branch_id = b.id AND emp.is_active = true
LEFT JOIN checklist_runs cr ON cr.branch_id = b.id
LEFT JOIN tasks t ON t.branch_id = b.id
LEFT JOIN v_employee_learning_stats els ON els.user_id = emp.id
WHERE p.role = 'ops_manager'
GROUP BY p.id, p.full_name;

-- --------------------------------------------
-- 15. Непрочитанные новости для пользователя
-- --------------------------------------------
CREATE OR REPLACE VIEW v_unread_news AS
SELECT 
    n.*,
    p.id as current_user_id
FROM news n
CROSS JOIN profiles p
WHERE n.published_at IS NOT NULL
    AND n.published_at <= NOW()
    AND (array_length(n.audience_roles, 1) = 0 OR p.role = ANY(n.audience_roles))
    AND (array_length(n.audience_branch_ids, 1) = 0 OR p.branch_id = ANY(n.audience_branch_ids))
    AND NOT EXISTS (
        SELECT 1 FROM news_reads nr 
        WHERE nr.news_id = n.id AND nr.user_id = p.id
    );

-- ============================================
-- Функции для получения данных дэшбордов
-- ============================================

-- Функция: получить статистику для директора
CREATE OR REPLACE FUNCTION get_director_dashboard()
RETURNS TABLE (
    total_employees BIGINT,
    total_branches BIGINT,
    employees_with_actual_certifications BIGINT,
    total_active_employees BIGINT,
    certification_compliance_percent NUMERIC,
    checklists_completed_7d BIGINT,
    checklists_overdue BIGINT,
    open_tasks BIGINT,
    overdue_tasks BIGINT,
    open_it_tasks BIGINT,
    open_operations_tasks BIGINT,
    tests_completed_7d BIGINT,
    documents_acknowledged_7d BIGINT
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM v_director_dashboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция: получить статистику для ops_manager
CREATE OR REPLACE FUNCTION get_ops_manager_dashboard(manager_id UUID)
RETURNS TABLE (
    ops_manager_id UUID,
    ops_manager_name TEXT,
    managed_branches BIGINT,
    total_employees BIGINT,
    overdue_checklists BIGINT,
    completed_checklists_7d BIGINT,
    open_tasks BIGINT,
    overdue_tasks BIGINT,
    employees_with_expired_certifications BIGINT
) AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM v_ops_manager_dashboard 
    WHERE v_ops_manager_dashboard.ops_manager_id = manager_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция: получить мои задачи
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
    SELECT v.* FROM v_my_tasks v
    WHERE v.assignee_id = user_id OR v.author_id = user_id
    ORDER BY 
        CASE WHEN v.is_overdue THEN 0 ELSE 1 END,
        v.due_date ASC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция: получить мои чек-листы
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
    SELECT v.* FROM v_my_checklists v
    WHERE v.branch_id = user_branch_id
    ORDER BY 
        CASE WHEN v.is_overdue THEN 0 ELSE 1 END,
        v.due_date ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция: поиск по базе знаний (полнотекстовый)
CREATE OR REPLACE FUNCTION search_knowledge(search_query TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category_name TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ka.id,
        ka.title,
        LEFT(ka.content, 300) as content,
        kc.name as category_name,
        ts_rank(
            to_tsvector('russian', ka.title || ' ' || ka.content),
            plainto_tsquery('russian', search_query)
        ) as rank
    FROM knowledge_articles ka
    LEFT JOIN knowledge_categories kc ON kc.id = ka.category_id
    WHERE ka.status = 'published'
        AND (
            to_tsvector('russian', ka.title || ' ' || ka.content) @@ plainto_tsquery('russian', search_query)
            OR ka.title ILIKE '%' || search_query || '%'
            OR ka.content ILIKE '%' || search_query || '%'
        )
    ORDER BY rank DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
