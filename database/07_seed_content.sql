-- ============================================
-- МКК ФК - 07_seed_content.sql
-- Наполнение портала контентом: офисы, категории и статьи базы знаний,
-- курсы с уроками, тесты с вопросами и ответами, новости, RAG-индекс.
--
-- Запускать ПОСЛЕ 01..06. Идемпотентный: повторный запуск ничего не дублирует.
--
-- Требования:
-- 1) применены 01..06 (README раздел «Настройка Supabase»);
-- 2) в profiles есть минимум один активный профиль (автор контента —
--    первый it_admin, иначе любой активный);
-- 3) офисы создаются БЕЗ ops_manager_id: создай сотрудников с ролью
--    ops_manager через «Админка -> Пользователи», затем свяжи офисы
--    запросом из блока 8.
-- ============================================

DO $seed$
DECLARE
    v_admin UUID;

    cat_kred    UUID;
    cat_zaimy   UUID;
    cat_bezop   UUID;
    cat_kassa   UUID;
    cat_client  UUID;
    cat_otchet  UUID;

    cr_basics UUID;
    cr_kyc    UUID;
    cr_coll   UUID;

    t_basics UUID;
    t_kyc    UUID;
    t_coll   UUID;

    q UUID;
    o UUID;
BEGIN

    ------------------------------------------------------------------
    -- 0. Автор контента
    ------------------------------------------------------------------
    SELECT id INTO v_admin
    FROM profiles
    WHERE role = 'it_admin' AND is_active = true
    ORDER BY created_at
    LIMIT 1;

    IF v_admin IS NULL THEN
        SELECT id INTO v_admin FROM profiles WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;

    IF v_admin IS NULL THEN
        RAISE EXCEPTION 'Нет активного профиля: сначала создайте пользователя (через /admin/users или Supabase Auth)';
    END IF;

    ------------------------------------------------------------------
    -- 1. ОФИСЫ (точки выдачи)
    ------------------------------------------------------------------
    INSERT INTO branches (name, city, address, phone, working_hours, region)
    SELECT 'Центральный офис', 'Москва',
           'ул. Тверская, д. 18, корп. 2, офис 401',
           '+7 (495) 120-30-01', 'Пн-Пт 9:00-18:00', 'Москва'
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Центральный офис');

    INSERT INTO branches (name, city, address, phone, working_hours, region)
    SELECT 'Точка «Зелёнка»', 'Москва',
           'ул. Зелёнодольская, д. 15, ТЦ «МАЯК», 1 этаж',
           '+7 (495) 120-30-02', 'Пн-Сб 9:00-20:00', 'Москва'
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Точка «Зелёнка»');

    INSERT INTO branches (name, city, address, phone, working_hours, region)
    SELECT 'Точка Балашиха', 'Балашиха',
           'ш. Энтузиастов, д. 22, ТЦ «Технопарк», 2 этаж',
           '+7 (495) 120-30-03', 'Пн-Сб 9:00-20:00', 'Московская область'
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Точка Балашиха');

    INSERT INTO branches (name, city, address, phone, working_hours, region)
    SELECT 'Точка Уфа-Центр', 'Уфа',
           'ул. Ленина, д. 60, офис 12',
           '+7 (347) 290-10-04', 'Пн-Сб 9:00-20:00', 'Башкортостан'
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Точка Уфа-Центр');

    INSERT INTO branches (name, city, address, phone, working_hours, region)
    SELECT 'Точка Тверь', 'Тверь',
           'бул. Цанова, д. 5, помещение 3',
           '+7 (4822) 45-10-05', 'Пн-Сб 9:00-19:00', 'Тверская область'
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Точка Тверь');

    ------------------------------------------------------------------
    -- 2. КАТЕГОРИИ БАЗЫ ЗНАНИЙ
    ------------------------------------------------------------------
    INSERT INTO knowledge_categories (name, "order")
    SELECT v.name, v.ord
    FROM (VALUES
        ('Кредитование',               1),
        ('Микрозаймы',                 2),
        ('Безопасность и верификация', 3),
        ('Кассовые операции',          4),
        ('Работа с клиентами',         5),
        ('Отчётность',                 6)
    ) AS v(name, ord)
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_categories kc WHERE kc.name = v.name);

    SELECT id INTO cat_kred   FROM knowledge_categories WHERE name = 'Кредитование';
    SELECT id INTO cat_zaimy  FROM knowledge_categories WHERE name = 'Микрозаймы';
    SELECT id INTO cat_bezop  FROM knowledge_categories WHERE name = 'Безопасность и верификация';
    SELECT id INTO cat_kassa  FROM knowledge_categories WHERE name = 'Кассовые операции';
    SELECT id INTO cat_client FROM knowledge_categories WHERE name = 'Работа с клиентами';
    SELECT id INTO cat_otchet FROM knowledge_categories WHERE name = 'Отчётность';

    ------------------------------------------------------------------
    -- 3. СТАТЬИ БАЗЫ ЗНАНИЙ (published — видны всем через RLS)
    ------------------------------------------------------------------
    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_zaimy,
           'Как оформить микрозайм: пошаговая инструкция',
           E'## Оформление микрозайма\n\n1. Проверь клиента по 254-П (см. статью «Проверка клиента по 254-П»).\n2. Отсканируй паспорт, запусти верификацию в системе.\n3. Рассчитай ПСК калькулятором системы — не вручную.\n4. Печатай договор только после подтверждения верификации.\n5. Выдай деньги в кассе и зафиксируй выдачу в CRM.\n\n> Лимит выдачи на точке: 30 000 ₽ без подтверждения старшего точки.\n\n## Частые ошибки\n\n- Расчёт ПСК по старой тарифной сетке — всегда сверяй дату тарифа.\n- Выдача без скана второго разворота паспорта.',
           '{микрозайм,выдача,инструкция}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Как оформить микрозайм: пошаговая инструкция');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_bezop,
           'Проверка клиента по 254-П: чек-лист верификации',
           E'## Верификация по 254-П\n\nОбязательные шаги до выдачи займа:\n\n1. **Идентификация** — паспорт действующий, фото совпадает, ФИО сверено.\n2. **Проверка ФССП** — сайт fssp.gov.ru, «Банк данных исполнительных производств».\n3. **Чёрные списки ЦБ** — внутренняя база по паспортам.\n4. **Скоринг** — не ниже 60 баллов.\n5. Результат занеси в комментарий заявки в CRM.\n\n## Красные флаги\n\n- Клиент не помнит адрес регистрации.\n- Паспорт выдан менее 2 дней назад.\n- Телефон оформлен на третье лицо.\n\nПри двух флагах и более — звонок на линию безопасности (доб. 1234).',
           '{254-П,верификация,паспорт,ФССП}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Проверка клиента по 254-П: чек-лист верификации');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_kassa,
           'Открытие и закрытие кассы: регламент точки',
           E'## Открытие кассы (9:00)\n\n1. Сними утренний X-отчёт и сверь остаток сYesterday вчерашним Z-отчётом.\n2. Пересчитай наличные, зафиксируй в кассовом модуле.\n3. Отметь пункт «Открытие смены» в ежедневном чек-листе точки.\n\n## Закрытие кассы (20:00)\n\n1. Сними Z-отчёт.\n2. Сдай наличные в инкассацию не позднее 20:30.\n3. Отметь чек-лист «Закрытие смены» — без фото счётчика закрытие не принимается.\n\n> Расхождение более 100 ₽ — звонок бухгалтерии сразу, не жди конца месяца.',
           '{касса,X-отчёт,Z-отчёт,инкассация}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Открытие и закрытие кассы: регламент точки');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_client,
           'Скрипт разговора с клиентом: выдача займа',
           E'## Приветствие\n\n«Добрый день! Меня зовут {имя}. Чем могу помочь?»\n\n## Уточнение заявки (2 минуты)\n\n1. Сколько нужно денег и на какой срок?\n2. Согласие на обработку персональных данных — отметка в системе.\n3. Проверку ФССП и скоринг клиенту не озвучиваем.\n\n## Озвучивание условий\n\nЗачитай вслух ставку, ПСК и штрафы. Клиент должен повторить сумму и срок своими словами.\n\n## Отказ\n\nЕсли скоринг не прошёл: «К сожалению, в выдаче вынуждены отказать. Повторное обращение возможно через 30 дней». Причину отказа не раскрывай.',
           '{скрипт,клиент,оферта,ПСК}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Скрипт разговора с клиентом: выдача займа');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_otchet,
           'Ежедневная отчётность точки: сроки и форматы',
           E'## Расписание отчётов\n\n| Отчёт | Срок | Куда |\n|---|---|---|\n| Кассовый Z-отчёт | 20:30 | Кассовый модуль |\n| Лист бронирования | 09:30 | ops@mkk-fk.ru |\n| Отчёт по просрочке | 18:00 | CRM, вкладка «Просрочка» |\n\n## Правила\n\n- Фото Z-отчёта загружай в задачу **в день снятия**.\n- Отсрочка согласовывается с операционным руководителем до 17:00.\n\n> Систематические опоздания по Z-отчёту — дисциплинарное взыскание по регламенту 4.2.',
           '{отчётность,Z-отчёт,точка}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Ежедневная отчётность точки: сроки и форматы');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_kred,
           'Просрочка: этапы работы и пороги эскалации',
           E'## Пороги эскалации\n\n| Просрочка | Действие |\n|---|---|\n| 1-3 дня | Звонок клиенту, фиксация обещания в CRM |\n| 4-7 дней | Звонок + письменное напоминание (СМС/мессенджер) |\n| 7-14 дней | Передача на выездную проверку (ставит операционный отдел) |\n| >14 дней | Отдел безопасности, подготовка к суду |\n\n## Запрещено (230-ФЗ)\n\n- Угрозы и давление на должника или родственников.\n- Звонки после 22:00 и до 8:00.\n- Разглашение долга третьим лицам без согласия.\n\nПри нарушении прав клиента зафиксируй инцидент в CRM и уведомь директора.',
           '{просрочка,эскалация,230-ФЗ}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Просрочка: этапы работы и пороги эскалации');

    INSERT INTO knowledge_articles (category_id, title, content, tags, status, created_by)
    SELECT cat_client,
           'Жалобы и обращения клиентов: порядок фиксации',
           E'## Приём жалобы\n\n1. Не спорь, зафиксируй обращение в CRM: категория и текст.\n2. Категории: «выдача», «технический сбой», «сервис», «деньги не поступили».\n3. Срок ответа клиенту — **1 рабочий день**.\n\n## Эскалация\n\n- Проверка операций — операционный отдел.\n- Проверка персонала — директор.\n- Угроза жалобы в ЦБ — немедленно директору и безопасности.',
           '{жалобы,клиенты,CRM}'::TEXT[],
           'published'::article_status,
           v_admin
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles
                      WHERE title = 'Жалобы и обращения клиентов: порядок фиксации');

    ------------------------------------------------------------------
    -- 4. КУРСЫ
    ------------------------------------------------------------------
    INSERT INTO courses (title, description, mandatory, period_days, created_by)
    SELECT 'Основы микрофинансирования',
           'Законодательство, ПСК, 230-ФЗ и базовые процедуры выдачи. Обязателен для всех новых сотрудников.',
           true, 365, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Основы микрофинансирования');

    INSERT INTO courses (title, description, mandatory, period_days, created_by)
    SELECT 'Верификация и 254-П',
           'Идентификация клиента, красные флаги мошенничества, работа с ФССП и скорингом. Для agent и branch_manager.',
           true, 180, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Верификация и 254-П');

    INSERT INTO courses (title, description, mandatory, period_days, created_by)
    SELECT 'Работа с просрочкой',
           'Коммуникация в рамках 230-ФЗ, скрипты звонков, эскалация и документирование. Для agent, branch_manager, ops_manager.',
           true, 180, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Работа с просрочкой');

    SELECT id INTO cr_basics FROM courses WHERE title = 'Основы микрофинансирования';
    SELECT id INTO cr_kyc    FROM courses WHERE title = 'Верификация и 254-П';
    SELECT id INTO cr_coll   FROM courses WHERE title = 'Работа с просрочкой';

    ------------------------------------------------------------------
    -- 5. УРОКИ
    ------------------------------------------------------------------
    INSERT INTO course_lessons (course_id, title, content, "order")
    SELECT v.course_id, v.title, v.content, v.ord
    FROM (VALUES
        (cr_basics, 1, 'Что такое МФК и МКК',
         E'Микрофинансовая компания (МФК) и микрокредитная компания (МКК) — два типа организаций в реестре ЦБ.\n\nКлючевые отличия:\n- МФК: капитал до 1,5 млрд ₽, займы до 500 000 ₽ с 21 года.\n- МКК: капитал до 500 млн ₽, займы до 200 000 ₽.\n\nВсе выданные займы фиксируются в реестре ЦБ.' ),
        (cr_basics, 2, 'ПСК и правила расчёта',
         E'Полная стоимость кредита — годовая ставка с учётом всех платежей клиента.\n\nПравила:\n- лимиты ПСК устанавливает ЦБ ежеквартально;\n- ПСК печатается в рамке на первой странице договора;\n- клиент может запросить расчёт — он автоматический в системе.' ),
        (cr_basics, 3, '230-ФЗ: права клиента',
         E'Ограничения взаимодействия с должником:\n- звонки: не более 1 раза в сутки, 2 раз в неделю, 8 раз в месяц;\n- личные встречи: не чаще 1 раза в неделю;\n- общение с третьими лицами — только с согласия должника.\n\nНарушение — штраф до 200 000 ₽ на компанию.' ),
        (cr_basics, 4, 'Первый рабочий день',
         E'1. Получи логин и временный пароль от IT.\n2. Пройди курс «Основы микрофинансирования» и тест (проходной 70%).\n3. Ознакомься с ЛНА в разделе «Документы».\n4. Получи наставника у старшего точки.' ),
        (cr_kyc, 1, 'Идентификация по 254-П',
         E'Обязательные действия до выдачи займа:\n\n1. Паспорт действующий, фото совпадает.\n2. Сверка ФИО и даты рождения с базой.\n3. Проверка ФССП и чёрных списков ЦБ.\n\nВыдача неидентифицированному клиенту запрещена.' ),
        (cr_kyc, 2, 'Красные флаги мошенничества',
         E'- Клиент не помнит данные паспорта.\n- Телефон оформлен на «помощника».\n- Просит перевести деньги на чужую карту.\n- Диктует СМС-код «сотруднику банка».\n\nДва флага и более — звонок на линию безопасности.' ),
        (cr_kyc, 3, 'Скоринг: причины отказов',
         E'Коды отказов системы:\n- 400: меньше 60 баллов скоринга;\n- 410: исполнительное производство ФССП свыше 10 000 ₽;\n- 420: чёрный список ЦБ.\n\nКлиенту озвучивай только «система не одобрила», причины не раскрывай.' ),
        (cr_kyc, 4, 'Практикум: разбор кейсов',
         E'Разбери с наставником пять кейсов:\n1. Клиент с подменной SIM-картой.\n2. Паспорт с переклеенной фотографией.\n3. Клиент отвечает под диктовку третьего лица.\n4. Займ по похищенному паспорту.\n5. Повторный займ без повторной проверки.' ),
        (cr_coll, 1, 'Пороги эскалации',
         E'1-3 дня: звонок, фиксация обещаний в CRM.\n7 дней: письменное требование.\n14 дней: передача в отдел безопасности.\n\nПросроченная задолженность подсвечивается в карточке клиента — не пропусти.' ),
        (cr_coll, 2, 'Что можно и что нельзя',
         E'Можно: звонить с 8:00 до 22:00 в будни, обсуждать долг по существу.\n\nНельзя (230-ФЗ): угрозы, давление, разглашение долга родственникам, ночные звонки.\n\nКаждая жалоба клиента может обернуться компенсацией — это зона ответственности точки.' ),
        (cr_coll, 3, 'Скрипты звонков',
         E'Скрипт 1 (1-3 дня):\n«Добрый день, {имя}. Вы оформляли займ {дата}, сегодня дата платежа. Когда удобно внести платёж?»\n\nСкрипт 2 (7 дней):\n«{имя}, по договору зафиксирован долг {сумма} ₽. При отсутствии оплаты договор будет передан в суд в течение 10 дней.»' ),
        (cr_coll, 4, 'Документирование',
         E'Каждый звонок фиксируй в CRM:\n- дата, время, длительность;\n- результат (обещание/отказ/недоступен);\n- дата следующего контакта.\n\nЗвонок без записи в CRM считается незавершённым.' )
    ) AS v(course_id, ord, title, content)
    WHERE NOT EXISTS (
        SELECT 1 FROM course_lessons l
        WHERE l.course_id = v.course_id AND l.title = v.title
    );

    ------------------------------------------------------------------
    -- 6. ТЕСТЫ
    ------------------------------------------------------------------
    INSERT INTO tests (title, description, course_id, mandatory, pass_score, max_attempts, time_limit_minutes, created_by)
    SELECT 'Тест: Основы микрофинансирования',
           'Итоговый тест курса. Проходной балл 70%. Две попытки.',
           cr_basics, true, 70, 2, 20, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM tests WHERE title = 'Тест: Основы микрофинансирования');

    INSERT INTO tests (title, description, course_id, mandatory, pass_score, max_attempts, time_limit_minutes, created_by)
    SELECT 'Тест: Верификация и 254-П',
           'Тест по идентификации клиента. Проходной балл 70%. Две попытки.',
           cr_kyc, true, 70, 2, 15, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM tests WHERE title = 'Тест: Верификация и 254-П');

    INSERT INTO tests (title, description, course_id, mandatory, pass_score, max_attempts, time_limit_minutes, created_by)
    SELECT 'Тест: Работа с просрочкой',
           'Тест по 230-ФЗ и скриптам. Проходной балл 70%. Три попытки.',
           cr_coll, true, 70, 3, 15, v_admin
    WHERE NOT EXISTS (SELECT 1 FROM tests WHERE title = 'Тест: Работа с просрочкой');

    SELECT id INTO t_basics FROM tests WHERE title = 'Тест: Основы микрофинансирования';
    SELECT id INTO t_kyc    FROM tests WHERE title = 'Тест: Верификация и 254-П';
    SELECT id INTO t_coll   FROM tests WHERE title = 'Тест: Работа с просрочкой';

    ------------------------------------------------------------------
    -- 7. ВОПРОСЫ И ОТВЕТЫ
    ------------------------------------------------------------------
    -- 7.1 Тест «Основы микрофинансирования»
    INSERT INTO test_questions (test_id, question_text, type, "order")
    SELECT t_basics, 'Что из перечисленного допустимо по 230-ФЗ?', 'single_choice'::question_type, 1
    WHERE NOT EXISTS (SELECT 1 FROM test_questions WHERE test_id = t_basics
                      AND question_text = 'Что из перечисленного допустимо по 230-ФЗ?');

    INSERT INTO test_questions (test_id, question_text, type, "order")
    SELECT t_basics, 'Где печатается ПСК в договоре?', 'single_choice'::question_type, 2
    WHERE NOT EXISTS (SELECT 1 FROM test_questions WHERE test_id = t_basics
                      AND question_text = 'Где печатается ПСК в договоре?');

    SELECT id INTO q1 FROM test_questions WHERE test_id = t_basics AND question_text = 'Что из перечисленного допустимо по 230-ФЗ?';
    SELECT id INTO q2 FROM test_questions WHERE test_id = t_basics AND question_text = 'Где печатается ПСК в договоре?';

    INSERT INTO test_answer_options (question_id, text, is_correct, "order")
    SELECT v.qid, v.text, v.ok, v.ord
    FROM (VALUES
        (q1, 'Звонок должнику не более 1 раза в сутки', true,  1),
        (q1, 'Звонки должнику в любое время суток',     false, 2),
        (q1, 'Общение с родственниками без согласия',   false, 3),
        (q1, 'Личная встреча каждый день',              false, 4),

        (q2, 'В рамке на первой странице',              true,  1),
        (q2, 'В приложении к договору',                 false, 2),
        (q2, 'Только в графике платежей',               false, 3),
        (q2, 'На последней странице договора',          false, 4)
    ) AS v(qid, text, ok, ord)
    WHERE NOT EXISTS (SELECT 1 FROM test_answer_options o WHERE o.question_id = v.qid AND o.text = v.text);

    -- 7.2 Тест «Верификация и 254-П»
    INSERT INTO test_questions (test_id, question_text, type, "order")
    SELECT t_kyc, 'Клиент не помнит адрес регистрации по паспорту. Действия?', 'single_choice'::question_type, 1
    WHERE NOT EXISTS (SELECT 1 FROM test_questions WHERE test_id = t_kyc
                      AND question_text = 'Клиент не помнит адрес регистрации по паспорту. Действия?');

    INSERT INTO test_questions (test_id, question_text, type, "order")
    SELECT t_kyc, 'Клиент диктует СМС-код «сотруднику банка» по телефону. Это…', 'single_choice'::question_type, 2
    WHERE NOT EXISTS (SELECT 1 FROM test_questions WHERE test_id = t_kyc
                      AND question_text = 'Клиент диктует СМС-код «сотруднику банка» по телефону. Это…');

    SELECT id INTO q1 FROM test_questions WHERE test_id = t_kyc AND question_text = 'Клиент не помнит адрес регистрации по паспорту. Действия?';
    SELECT id INTO q2 FROM test_questions WHERE test_id = t_kyc AND question_text = 'Клиент диктует СМС-код «сотруднику банка» по телефону. Это…';

    INSERT INTO test_answer_options (question_id, text, is_correct, "order")
    SELECT v.qid, v.text, v.ok, v.ord
    FROM (VALUES
        (q1, 'Остановить оформление и позвонить на линию безопасности', true,  1),
        (q1, 'Продолжить оформление — клиент просто волнуется',         false, 2),
        (q1, 'Подсказать адрес из базы',                                false, 3),
        (q1, 'Оформить займ на меньшую сумму',                          false, 4),

        (q2, 'Красный флаг мошенничества: прекратить и сообщить в безопасность', true,  1),
        (q2, 'Нормальная ситуация, помогать клиенту',                            false, 2),
        (q2, 'Попросить клиента перезвонить позже',                              false, 3),
        (q2, 'Продолжить, если сумма меньше 10 000 ₽',                           false, 4)
    ) AS v(qid, text, ok, ord)
    WHERE NOT EXISTS (SELECT 1 FROM test_answer_options o WHERE o.question_id = v.qid AND o.text = v.text);

    -- 7.3 Тест «Работа с просрочкой»
    INSERT INTO test_questions (test_id, question_text, type, "order")
    SELECT t_coll, 'Во сколько заканчивается разрешённое время звонков должнику?', 'single_choice'::question_type, 1
    WHERE NOT EXISTS (SELECT 1 FROM test_questions WHERE test_id = t_coll
                      AND question_text = 'Во сколько заканчивается разрешённое время звонков должнику?');

    SELECT id INTO q1 FROM test_questions WHERE test_id = t_coll AND question_text = 'Во сколько заканчивается разрешённое время звонков должнику?';

    INSERT INTO test_answer_options (question_id, text, is_correct, "order")
    SELECT v.qid, v.text, v.ok, v.ord
    FROM (VALUES
        (q1, '22:00',                                true,  1),
        (q1, 'Круглосуточно',                        false, 2),
        (q1, '23:00',                                false, 3),
        (q1, 'Ограничений нет, если клиент не жалуется', false, 4)
    ) AS v(qid, text, ok, ord)
    WHERE NOT EXISTS (SELECT 1 FROM test_answer_options o WHERE o.question_id = v.qid AND o.text = v.text);

    ------------------------------------------------------------------
    -- 8. НОВОСТИ
    ------------------------------------------------------------------
    INSERT INTO news (title, content, type, audience_roles, audience_branch_ids, published_at, created_by)
    SELECT 'График работы в майские праздники',
           E'Уважаемые коллеги!\n\n1 мая точки работают с 10:00 до 16:00, 9 мая — выходной.\n\nКассовый лимит на смену временно повышен до 50 000 ₽. Z-отчёт снимайте до конца смены.',
           'critical'::news_type, '{}'::user_role[], '{}'::UUID[], NOW() - INTERVAL '3 days', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'График работы в майские праздники');

    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Обновление регламента верификации',
           E'С 1 числа действует обновлённый регламент 254-П: добавлена проверка через НБКИ.\n\nПолный текст — в разделе «Документы», разбор — в базе знаний.\n\nПройти аттестацию до конца месяца: курс «Верификация и 254-П».',
           'normal'::news_type, '{agent,branch_manager}'::user_role[], NOW() - INTERVAL '7 days', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Обновление регламента верификации');

    INSERT INTO news (title, content, type, audience_roles, published_at, created_by)
    SELECT 'Обновление скоринга',
           E'С понедельника вступает в силу обновлённый модуль скоринга.\n\nЧто изменилось:\n- порог одобрения — 60 баллов;\n- автоматическая проверка НБКИ;\n- сокращённая анкета для повторных клиентов.',
           'normal'::news_type, '{}'::user_role[], NOW() - INTERVAL '1 day', v_admin
    WHERE NOT EXISTS (SELECT 1 FROM news WHERE title = 'Обновление скоринга');

    ------------------------------------------------------------------
    -- 9. СТАТЬЯ В AI-ИНДЕКС (структура для RAG: эмбеддинг дополнит фоновая задача)
    ------------------------------------------------------------------
    INSERT INTO ai_index (source_type, source_id, chunk_index, content, visibility_roles, visibility_branch_ids)
    SELECT 'article', a.id, 0, LEFT(a.content, 500), '{}'::user_role[], '{}'::UUID[]
    FROM knowledge_articles a
    WHERE a.status = 'published'
      AND NOT EXISTS (
          SELECT 1 FROM ai_index i
          WHERE i.source_type = 'article' AND i.source_id = a.id AND i.chunk_index = 0
      );

    ------------------------------------------------------------------
    -- 9. RAG-функция match_documents для /api/ai/chat
    ------------------------------------------------------------------
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
    BEGIN
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
              OR ai.visibility_roles::TEXT[] @> ARRAY[user_role::TEXT]
          )
          AND (
              coalesce(cardinality(ai.visibility_branch_ids), 0) = 0
              OR ai.visibility_branch_ids @> ARRAY[user_branch_id]
          )
        ORDER BY ai.embedding <=> query_embedding
        LIMIT match_count;
    END;
    $fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    ------------------------------------------------------------------
    -- 10. Индекс векторного поиска
    ------------------------------------------------------------------
    CREATE INDEX IF NOT EXISTS idx_ai_index_embedding
        ON ai_index USING hnsw (embedding vector_cosine_ops);

    ------------------------------------------------------------------
    -- 11. ПРИВЯЗКА ОПЕРАЦИОННЫХ МЕНЕДЖЕРОВ К ОФИСАМ
    -- Выполняется вручную ПОСЛЕ создания сотрудников через /admin/users.
    -- Пример:
    -- UPDATE branches b
    -- SET ops_manager_id = p.id
    -- FROM profiles p
    -- WHERE p.role = 'ops_manager'
    --   AND p.is_active
    --   AND p.full_name = 'ФАМИЛИЯ Имя Отчество'
    --   AND b.name = 'Точка Балашиха';
    ------------------------------------------------------------------

END;
$seed$;
