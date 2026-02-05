# Портал МКК ФК

Внутренний портал сотрудников микрофинансовой компании.

## Функциональность

- **Аутентификация и роли** - вход по email/паролю, разграничение доступа по ролям
- **База знаний** - статьи с категориями, поиск, теги
- **Документы и регламенты** - хранилище с контролем ознакомления
- **Обучение и аттестация** - курсы, тесты, отслеживание прогресса
- **Чек-листы** - контрольные списки для точек
- **Таск-трекер** - задачи с назначением и отслеживанием
- **Новости** - лента объявлений с таргетингом
- **Чат** - каналы для коммуникации
- **ИИ-помощник** - RAG-поиск по базе знаний
- **Админка** - управление пользователями, контентом, настройками
- **Дэшборды** - сводные показатели для руководства

## Технологический стек

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime, pgvector)
- **Визуализация**: Recharts
- **ИИ**: OpenAI API + pgvector для RAG

## Установка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd mkk-portal
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```bash
cp .env.example .env.local
```

Необходимые переменные:
- `NEXT_PUBLIC_SUPABASE_URL` - URL проекта Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - anon key Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - service role key (для серверных операций)
- `OPENAI_API_KEY` - API ключ OpenAI (для ИИ-помощника)

### 4. Настройка Supabase

1. Создайте проект в [Supabase](https://supabase.com)
2. Выполните SQL-миграции из папки `database/`:
   - `01_schema.sql` - создание таблиц и enum
   - `02_rls_policies.sql` - политики безопасности RLS
   - `03_views.sql` - представления для дэшбордов

3. Включите pgvector extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

4. Создайте storage bucket `documents` для хранения файлов

### 5. Запуск development сервера

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

## Структура проекта

```
mkk-portal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (routes)/           # Страницы приложения
│   │   ├── api/                # API routes
│   │   └── layout.tsx          # Корневой layout
│   ├── components/
│   │   ├── ui/                 # UI компоненты (shadcn)
│   │   ├── sidebar.tsx         # Навигация
│   │   └── providers.tsx       # Провайдеры
│   ├── lib/
│   │   ├── supabase/           # Supabase клиенты
│   │   └── utils.ts            # Утилиты
│   └── types/
│       ├── database.ts         # TypeScript типы
│       └── supabase.ts         # Supabase типы
├── database/                   # SQL миграции
├── public/                     # Статические файлы
└── package.json
```

## Роли пользователей

- `agent` - сотрудник точки
- `branch_manager` - старший по точке
- `ops_manager` - операционный руководитель
- `director` - директор
- `security` - безопасность/верификация
- `accountant` - бухгалтерия
- `it_admin` - техотдел / админ портала
- `hr` - HR

## Безопасность

- Row Level Security (RLS) на всех таблицах
- Политики доступа основаны на ролях и принадлежности к точкам
- Все запросы к БД проходят через RLS

## Деплой

### Vercel (рекомендуется)

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в настройках проекта
3. Деплой выполнится автоматически

### Сборка для production

```bash
npm run build
npm start
```

## Дополнительная настройка

### Настройка ИИ-помощника

Для работы ИИ-помощника необходимо:

1. Указать `OPENAI_API_KEY` в переменных окружения
2. Создать функцию `match_documents` в Supabase:

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  user_role TEXT,
  user_branch_id UUID
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content TEXT,
  title TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_index.id,
    ai_index.source_type,
    ai_index.source_id,
    ai_index.content,
    knowledge_articles.title,
    1 - (ai_index.embedding <=> query_embedding) AS similarity
  FROM ai_index
  LEFT JOIN knowledge_articles ON knowledge_articles.id = ai_index.source_id
  WHERE 1 - (ai_index.embedding <=> query_embedding) > match_threshold
    AND (
      array_length(ai_index.visibility_roles, 1) IS NULL
      OR array_length(ai_index.visibility_roles, 1) = 0
      OR user_role = ANY(ai_index.visibility_roles)
    )
    AND (
      array_length(ai_index.visibility_branch_ids, 1) IS NULL
      OR array_length(ai_index.visibility_branch_ids, 1) = 0
      OR user_branch_id = ANY(ai_index.visibility_branch_ids)
    )
  ORDER BY ai_index.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

### Генерация эмбеддингов

Для индексации статей базы знаний используйте Edge Function или внешний скрипт:

```typescript
// Пример генерации эмбеддинга для статьи
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: articleContent,
});

await supabase.from("ai_index").insert({
  source_type: "article",
  source_id: articleId,
  content: articleContent,
  embedding: embedding.data[0].embedding,
});
```

## Лицензия

Private - для внутреннего использования.
