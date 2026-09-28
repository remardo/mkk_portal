-- ============================================
-- МКК ФК - 08_seed_content2.sql
-- Вторая волна контента: +8 статей БЗ (с новыми категориями),
-- 10 документов, 4 шаблона чек-листов с пунктами, чек-листы (runs)
-- на сегодня, +5 новостей.
-- Запускать после 01..07. Идемпотентный.
-- Файлы документов кладутся в storage bucket "documents"
-- (см. scripts/upload-docs.ps1).
-- ============================================

DO $seed$
DECLARE
    v_admin UUID;
    cat_it    UUID;
    cat_hr    UUID;
    cat_kred  UUID;
    cat_bezop UUID;
    cat_kassa UUID;
    cat_client UUID;
    cat_otchet UUID;
    br_ufa UUID; br_bal UUID;
BEGIN

    ------------------------------------------------------------------
    -- 0. Автор контента (как в 07)
    ------------------------------------------------------------------
    SELECT id INTO v_admin
    FROM profiles
    WHERE role = 'it_admin' AND is_active = true
    ORDER BY created_at LIMIT 1;
    IF v_admin IS NULL THEN
        SELECT id INTO v_admin FROM profiles WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_admin IS NULL THEN
        RAISE EXCEPTION 'Нет активного профиля: сначала создайте пользователя';
    END IF;

    ------------------------------------------------------------------
    -- 1. ДОПОЛНИТЕЛЬНЫЕ КАТЕГОРИИ
    ------------------------------------------------------------------
    INSERT INTO knowledge_categories (name, "order")
    SELECT v.name, v.ord
    FROM (VALUES
        ('ИТ и системы', 7),
        ('HR',           8)
    ) AS v(name, ord)
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_categories kc WHERE kc.name = v.name);

    SELECT id INTO cat_it   FROM knowledge_categories WHERE name = 'ИТ и системы';
    SELECT id INTO cat_hr   FROM knowledge_categories WHERE name = 'HR';
    SELECT id INTO cat_kred  FROM knowledge_categories WHERE name = 'Кредитование';
    SELECT id INTO cat_bezop FROM knowledge_categories WHERE name = 'Безопасность и верификация';
    SELECT id INTO cat_kassa FROM knowledge_categories WHERE name = 'Кассовые операции';
    SELECT id INTO cat_client FROM knowledge_categories WHERE name = 'Работа с клиентами';
    SELECT id INTO cat_otchet FROM knowledge_categories WHERE name = 'Отчётность';

    ------------------------------------------------------------------
    -- 2. НОВЫЕ СТАТЬИ (8)
    ------------------------------------------------------------------
    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_it,
           'Действия при отключении света или интернета в точке',
           E'## Электричество\n\n1. Не вскрывайте кассу в тёмной точке — подождите резерв (аккумулятор кассового модуля держит 30 минут).\n2. Если света нет дольше 30 минут — звонок ops-линии (доб. 2100), отправляйте клиентов домой.\n3. После восстановления — сверка остатка по X-отчёту, отметка в чек-листе «Открытие смены».\n\n## Интернет\n\n1. Переключите кассовый модуль на резервный LTE (кнопка на роутере — банковская SIM).\n2. Не работает — звонок IT (доб. 101), решение по звонку в течение 15 минут.\n3. CRM недоступна дольше 15 минут — выдачи приостанавливаются до восстановления.',
           '{свет,интернет,авария,точка}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Действия при отключении света или интернета в точке');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_it,
           'Работа в CRM: базовые операции',
           E'## Создание заявки\n\n1. Раздел «Заявки» → «Новая» → введите ФИО и телефон клиента.\n2. Система сама подтянет скоринг и ФССП — не вносите данные вручную.\n\n## Комментарии\n\nКаждый значимый контакт — запись в комментарии: дата, суть, результат. Комментарии попадают в ежедневный отчёт точки.\n\n## Горячие клавиши\n\n- F2 — поиск клиента по телефону\n- F5 — обновить дашборд\n- Alt+D — закрепить заявку как приоритетную',
           '{CRM,система,заявки}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Работа в CRM: базовые операции');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_bezop,
           'Тревожная кнопка: тестирование и порядок действий',
           E'## Где кнопки\n\n1. Под столом старшего (ножная).\n2. За кассовым модулем (ручная).\n\nТревожная кнопка отправляет сигнал в ЧОП, время реакции — 5-7 минут.\n\n## Тестирование\n\nЕжедневно в 9:05 во время чек-листа «Открытие смены»: нажмите контрольную кнопку-индикатор (не боевую!) — индикатор должен погаснуть и загореться заново.\n\n## Когда нажимать\n\n- Прямая угроза персоналу или клиенту\n- Попытка ограбления\n- Странное поведение клиента (см. красные флаги)\n\n> Ложно сработавшая боевая кнопка — штраф 5 000 ₽ на точку. Будьте внимательны.',
           '{тревожная кнопка,безопасность,тест}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Тревожная кнопка: тестирование и порядок действий');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_kassa,
           'Правила хранения денежных средств на точке',
           E'## Общие правила\n\n1. Максимум в кассе за смену: **200 000 ₽**. Превышение — срочная инкассация.\n2. Денежный ящик запирается ключом, ключ — у старшего точки.\n3. Между операциями ящик всегда закрыт.\n\n## Ночной пересчёт\n\nЗапрещён. Все суммы пересчитываются при сдаче Z-отчёта и в инкассации.\n\n## Расхождение\n\n| Сумма | Действие |\n|---|---|\n| до 100 ₽ | Фиксация в чек-листе, Z-отчёт |\n| 100–1 000 ₽ | Звонок бухгалтерии в тот же день |\n| свыше 1 000 ₽ | Инкассация + акт расхождения + звонок директору |
',
           '{касса,хранение,лимит,пересчёт}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Правила хранения денежных средств на точке');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_kred,
           'Досрочное погашение: порядок действий',
           E'## Полное досрочное погашение\n\n1. Клиент называет договор и дату.\n2. Пересчитайте сумму в CRM (кнопка «Расчёт на дату»).\n3. Принять наличные или карту → ПКО → закрытие договора.\n4. Выдать справку о закрытии (автоматически в системе).\n\n## Частичное погашение\n\nУменьшение тела долга, срок не меняется. Приём — через кассу, отметка в CRM.\n\n## Важно\n\n- Комиссия за досрочное погашение — **запрещена** (ст. 11 353-ФЗ).\n- Уведомление за 10 дней не требуется для займов до 100 000 ₽.',
           '{погашение,досрочно, ПСК}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Досрочное погашение: порядок действий');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_client,
           'Повторный займ: упрощённая процедура',
           E'## Условия\n\nКлиент с незакрытым договором без просрочек > 90 дней.\n\n## Что делаем\n\n1. Проверяем в CRM повторную заявку — скоринг подтянется автоматически.\n2. Паспорт сверяем (данные могли измениться).\n3. НЕ повторяем полную верификацию 254-П, но проверяем ФССП повторно.\n\n## Лимиты\n\n- 3-й повторный займ: до 30 000 ₽\n- 4-й: до 40 000 ₽\n- С 5-го: до лимита точки\n\nПросрочка 1+ дня — упрощённый поток недоступен, идём по полной верификации.',
           '{повторный займ,скоринг,лимиты}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Повторный займ: упрощённая процедура');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_hr,
           'Отпуска, больничные и замещение старшего точки',
           E'## Отпуск\n\n1. Заявление в CRM (раздел «Кадры») за 14 дней.\n2. Согласование у операционного руководителя.\n3. Приказ в разделе «Документы» — подписать после выхода.\n\n## Больничный\n\nВ первый день до 10:00 — звонок операционному руководителю. Электронный больничный автоматически попадает в CRM.\n\n## Замещение старшего\n\nЕсли старший уходит в отпуск:\n1. Передайте ключи и кассу по акту в разделе «Чек-листы» → «Передача смены».\n2. Доступ к кассовому модулю передаётся через IT (доб. 101).',
           '{отпуск,больничный,замещение}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Отпуска, больничные и замещение старшего точки');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_kassa,
           'Инкассация: порядок и документы',
           E'## Регулярная инкассация (20:30)\n\n1. Снимите Z-отчёт.\n2. Пересчитайте сумму в присутствии двух сотрудников.\n3. Упакуйте в инкассаторский пакет, подпишите бланк.\n4. Вызовите инкассатора через кассовый модуль (кнопка «Вызвать инкассацию»).' ||
           E'\n\n## Внеплановая (лимит кассы превышен)\n\nЗвонок бухгалтерии → приезд инкассатора в течение 2 часов.\n\n## Особые случаи\n\n- Инкассатор не пришёл до 21:00 — храните в сейфе, утром первая инкассация.\n- Расхождение при пересчёте — акт в 2 экземплярах + звонок бухгалтерии.',
           '{инкассация,Z-отчёт,касса}'::TEXT[],
           'published'::article_status, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Инкассация: порядок и документы');

    ------------------------------------------------------------------
    -- 3. ДОКУМЕНТЫ (10) — файлы лежат в bucket `documents`, путь в file_path
    ------------------------------------------------------------------
    INSERT INTO documents (category_id, title, description, file_path, version, effective_from, mandatory, created_by, updated_by)
    SELECT (SELECT id FROM document_categories WHERE name = 'ЛНА' LIMIT 1),
           v.title, v.descr, v.path, v.ver, v.eff, v.mandatory, v_admin, v_admin
    FROM (VALUES
        ('Положение о выдаче микрозаймов', 'Основные правила выдачи микрозаймов физическим лицам', 'lona/polozhenie-o-vydache-mikrozaimov.md', '1.2', '2026-09-01'::DATE, true),
        ('Правила внутреннего трудового распорядка', 'График, отпуска, дисциплинарные вопросы', 'lona/pvir.md', '2.0', '2026-08-01'::DATE, true),
        ('Положение о коммерческой тайне', 'Режим конфиденциальности для сотрудников', 'lona/komtayna.md', '1.1', '2026-07-15'::DATE, true),
        ('Регламент выдачи займа', 'Пошаговый процесс от заявки до выдачи', 'reg/reglament-vydachi-zaima.md', '2.1', '2026-09-20'::DATE, true),
        ('Регламент работы с просрочкой', 'Каналы коммуникации, эскалация, 230-ФЗ', 'reg/reglament-prosrochka.md', '1.4', '2026-09-01'::DATE, false),
        ('Регламент кассовой дисциплины', 'Открытие/закрытие кассы, лимиты, инкассация', 'reg/reglament-kassa.md', '3.0', '2026-09-15'::DATE, true),
        ('Инструкция по кассовому модулю', 'Работа с POS-терминалом и кассовым ПО', 'instr/kassoviy-modul.md', '1.0', '2026-06-10'::DATE, false),
        ('Инструкция: проверка клиента по 115-ФЗ', 'AML-проверки и reporting', 'instr/proverka-115fz.md', '1.1', '2026-09-05'::DATE, false),
        ('Бланк заявления на досрочное погашение', 'Заполняется от руки клиентом', 'forma/zayavlenie-dosrochnoe-pogashenie.md', '1.0', '2026-06-01'::DATE, false),
       ('Приказ №24-2026: обновление лимитов выдачи', 'Изменение лимитов на точках с 1 октября', 'prikaz/prikaz-24-2026-limity.md', '1.0', '2026-09-28'::DATE, true)
    ) AS v(title, descr, path, ver, eff, mandatory)
    WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.title = v.title);

    ------------------------------------------------------------------
    -- 3a. ОЗНАКОМЛЕНИЕ не проставляем — сотрудники ознакомятся сами
    ------------------------------------------------------------------

    ------------------------------------------------------------------
    -- 4. ШАБЛОНЫ ЧЕК-ЛИСТОВ
    ------------------------------------------------------------------
    INSERT INTO checklists (title, description, type, applicable_branch_ids, applicable_roles, created_by, updated_by)
    SELECT v.title, v.descr, v.ctype, '{}'::UUID[], v.roles::user_role[], v_admin, v_admin
    FROM (VALUES
        ('Открытие смены', 'Ежедневный утренний протокол точки', 'daily'::checklist_type, '{agent,branch_manager}'),
        ('Закрытие смены', 'Ежедневный вечерний протокол точки', 'daily'::checklist_type, '{agent,branch_manager}'),
        ('Еженедельная ревизия точки', 'Санитарная и техническая ревизия, вторник', 'weekly'::checklist_type, '{agent,branch_manager}'),
        ('Ежемесячный аудит документации', 'Проверка ознакомления сотрудников с ЛНА', 'monthly'::checklist_type, '{branch_manager,ops_manager}')
    ) AS v(title, descr, ctype, roles)
    WHERE NOT EXISTS (SELECT 1 FROM checklists c WHERE c.title = v.title);

    ------------------------------------------------------------------
    -- 5. ПУНКТЫ ЧЕК-ЛИСТОВ
    ------------------------------------------------------------------
    INSERT INTO checklist_items (checklist_id, title, type, required, "order")
    SELECT c.id, v.ititle, v.itype::checklist_item_type, v.req, v.ord
    FROM checklists c
    JOIN (VALUES
        ('Открытие смены', 'Снять X-отчёт, сверить остаток с вчерашним Z-отчётом', 'checkbox', true, 1),
        ('Открытие смены', 'Пересчитать наличные в кассе', 'checkbox', true, 2),
        ('Открытие смены', 'Проверить тревожную кнопку (индикатор)', 'checkbox', true, 3),
        ('Открытие смены', 'Проверить работу CRM и кассового модуля', 'checkbox', true, 4),
        ('Открытие смены', 'Убрать рабочее место, проверить рекламные материалы', 'checkbox', false, 5),
        ('Открытие смены', 'Фото счётчика кассового модуля', 'photo', true, 6),

        ('Закрытие смены', 'Снять Z-отчёт и загрузить фото в задачу дня', 'photo', true, 1),
        ('Закрытие смены', 'Сдать инкассацию (не позднее 20:30)', 'checkbox', true, 2),
        ('Закрытие смены', 'Пересчитать остаток в кассе', 'checkbox', true, 3),
        ('Закрытие смены', 'Заполнить отчёт по просрочке в CRM', 'checkbox', true, 4),
        ('Закрытие смены', 'Проверить, что все заявки клиента закрыты', 'checkbox', false, 5),
        ('Закрытие смены', 'Выключить технику, запереть точку', 'checkbox', true, 6),

        ('Еженедельная ревизия точки', 'Проверить бланки договоров (остаток не менее 50 шт.)', 'checkbox', true, 1),
        ('Еженедельная ревизия точки', 'Проверить расходные материалы кассового модуля', 'checkbox', true, 2),
        ('Еженедельная ревизия точки', 'Убрать архивные документы за неделю', 'checkbox', false, 3),
        ('Еженедельная ревизия точки', 'Проверить срок годности бланков приёмки платежей', 'checkbox', false, 4),
        ('Еженедельная ревизия точки', 'Фото состояния точки (общий план)', 'photo', true, 5),

        ('Ежемесячный аудит документации', 'Проверить ознакомление сотрудников с ЛНА', 'checkbox', true, 1),
        ('Ежемесячный аудит документации', 'Актуализировать версии договоров', 'checkbox', true, 2),
        ('Ежемесячный аудит документации', 'Проверить приём заявлений за месяц', 'checkbox', false, 3),
        ('Ежемесячный аудит документации', 'Сверить резервные копии журналов', 'checkbox', false, 4),
        ('Ежемесячный аудит документации', 'Подписать акт сверки с бухгалтерией', 'checkbox', true, 5)
    ) AS v(cl_title, ititle, itype, req, ord)
      ON c.title = v.cl_title
    WHERE NOT EXISTS (SELECT 1 FROM checklist_items i
                      WHERE i.checklist_id = c.id AND i.title = v.ititle);

    ------------------------------------------------------------------
    -- 6. ЧЕК-ЛИСТЫ (RUNS) НА СЕГОДНЯ: Уфа-Центр и Балашиха
    ------------------------------------------------------------------
    SELECT id INTO br_ufa FROM branches WHERE name = 'Точка Уфа-Центр';
    SELECT id INTO br_bal FROM branches WHERE name = 'Точка Балашиха';

    INSERT INTO checklist_runs (checklist_id, branch_id, due_date, status, created_by)
    SELECT c.id, v.branch_id, CURRENT_DATE, 'not_started'::checklist_status, v_admin
    FROM (VALUES (br_ufa), (br_bal)) AS v(branch_id)
    JOIN checklists c ON c.type IN ('daily')
    WHERE NOT EXISTS (
        SELECT 1 FROM checklist_runs r
        WHERE r.checklist_id = c.id
          AND r.branch_id = v.branch_id
          AND r.due_date = CURRENT_DATE
    );

    ------------------------------------------------------------------
    -- 7. НОВОСТИ (+5)
    ------------------------------------------------------------------
    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Запущен ИИ-помощник по базе знаний',
           E'На портале работает ИИ-помощник: отвечает на вопросы по регламентам, кассе, верификации.\n\nНайти: боковое меню → «ИИ-помощник». Ссылается на конкретные статьи.',
           'normal'::news_type, '{}'::user_role[], NOW() - INTERVAL '6 hours', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Запущен ИИ-помощник по базе знаний');

    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Новые лимиты выдачи с 1 октября',
           E'Приказ №24-2026: с 1 октября базовый лимит выдачи на точке повышается с 30 000 до 50 000 ₽ без подтверждения старшего.\n\nОзнакомьтесь с приказом в разделе «Документы» (обязательный).',
           'critical'::news_type, '{}'::user_role[], NOW() - INTERVAL '1 day', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Новые лимиты выдачи с 1 октября');

    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Курс «Работа с просрочкой» — аттестация до 15 октября',
           E'Все сотрудники точек обязаны пройти курс «Работа с просрочкой» и сдать тест до 15 октября.\n\nРаздел «Обучение» → курс → начать.',
           'critical'::news_type, '{agent,branch_manager}'::user_role[], NOW() - INTERVAL '2 days', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Курс «Работа с просрочкой» — аттестация до 15 октября');

    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Операционное собрание 6 октября, 15:00 МСК',
           E'Повестка: итоги сентября, новые лимиты, технология замещения старших точек.\n\nФормат: ZOOM, ссылка в календаре. Отсутствие — согласование с директором.',
           'normal'::news_type, '{branch_manager,ops_manager,director}'::user_role[], NOW() - INTERVAL '3 days', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Операционное собрание 6 октября');

    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Открытие точки в Казани',
           E'С 8 октября начинает работать точка Казань-центр (ул. Баумана, 44).\n\nПриём заявок на переводы — через CRM у операционного руководителя.',
           'normal'::news_type, '{}'::user_role[], NOW() - INTERVAL '4 days', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Открытие точки в Казани');

    ------------------------------------------------------------------
    -- 8. ЧАНКИ AI-ИНДЕКС ДЛЯ НОВЫХ СТАТЕЙ
    ------------------------------------------------------------------
    INSERT INTO ai_index (source_type, source_id, chunk_index, content, visibility_roles, visibility_branch_ids)
    SELECT 'article', a.id, 0, LEFT(a.content, 500), '{}'::user_role[], '{}'::UUID[]
    FROM knowledge_articles a
    WHERE a.status = 'published'
      AND NOT EXISTS (
          SELECT 1 FROM ai_index i
          WHERE i.source_type = 'article' AND i.source_id = a.id AND i.chunk_index = 0
      );

END;
$seed$;
