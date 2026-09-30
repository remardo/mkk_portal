import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

type ChatHistoryItem = {
  role: "user" | "assistant"
  content: string
}

function isValidHistoryItem(item: unknown): item is ChatHistoryItem {
  if (typeof item !== "object" || item === null) return false
  const h = item as Record<string, unknown>
  return (
    (h.role === "user" || h.role === "assistant") &&
    typeof h.content === "string" &&
    h.content.length <= 4000
  )
}

const rateBucket = new Map<string, number[]>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 60 * 1000

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true
  if (origin === req.nextUrl.origin) return true
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && (origin === appUrl || origin === appUrl.replace(/\/$/, ""))) return true
  return false
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (rateBucket.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) {
    rateBucket.set(key, hits)
    return true
  }
  hits.push(now)
  rateBucket.set(key, hits)
  return false
}

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    // Get user profile for RLS
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, branch_id, is_active")
      .eq("id", user.id)
      .single()

    if (!profile || profile.is_active !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { message, history = [] } = body ?? {}

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "Message too long (max 4000)" }, { status: 400 })
    }
    if (!Array.isArray(history) || history.length > 5) {
      return NextResponse.json({ error: "History must be an array with max 5 items" }, { status: 400 })
    }
    if (!history.every(isValidHistoryItem)) {
      return NextResponse.json(
        { error: "History items must have role user|assistant and string content" },
        { status: 400 }
      )
    }
    const validHistory = history as ChatHistoryItem[]

    // Чат: TokenHarbor (через relay), эмбеддинги: отдельный провайдер
    // (у TokenHarbor нет /embeddings) — остаются на OPENAI_* relay.
    const chatKey = process.env.TOKENHARBOR_API_KEY || process.env.OPENAI_API_KEY
    if (!chatKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }
    const chatBaseURL = process.env.TOKENHARBOR_BASE_URL || process.env.OPENAI_BASE_URL || undefined
    const chatModel = process.env.TOKENHARBOR_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini"
    const openai = new OpenAI({ apiKey: chatKey, ...(chatBaseURL ? { baseURL: chatBaseURL } : {}) })

    const embedKey = process.env.OPENAI_API_KEY
    const embedBaseURL = process.env.OPENAI_BASE_URL || undefined
    const embedClient = embedKey
      ? new OpenAI({ apiKey: embedKey, ...(embedBaseURL ? { baseURL: embedBaseURL } : {}) })
      : null

    // Vector search: embeddings may be unavailable, so degrade to text search.
    type MatchDoc = { content: string; title: string | null; source_id: string; source_type: string }
    let relevantDocs: MatchDoc[] | null = null
    try {
      if (!embedClient) throw new Error("no embeddings backend")
      const embeddingResponse = await embedClient.embeddings.create({
        model: process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small",
        input: message,
      })
      const queryEmbedding = embeddingResponse.data[0].embedding
      const { data } = await supabase.rpc("match_documents" as never, {
        query_embedding: queryEmbedding,
        match_threshold: Number(process.env.AI_MATCH_THRESHOLD || 0.45),
        match_count: 5,
        user_role: profile.role,
        user_branch_id: profile.branch_id,
      } as never) as unknown as { data: MatchDoc[] | null }
      relevantDocs = data
    } catch (e) {
      // No embeddings backend: fall back to text search below
    }

    // If no relevant documents found, search using text search as fallback
    // RLS на knowledge_articles уже ограничивает видимость, дополнительный фильтр не нужен
    let context = ""
    let sources: { title: string; id: string; type: string }[] = []

    if (relevantDocs && relevantDocs.length > 0) {
      context = relevantDocs.map((doc) => doc.content).join("\n\n")
      sources = relevantDocs.map((doc) => ({
        title: doc.title || "База знаний",
        id: doc.source_id,
        type: doc.source_type,
      }))
    } else {
      // Fallback to text search on the generated tsvector column title_content
      const { data: articles } = await supabase
        .from("knowledge_articles")
        .select("id, title, content")
        .eq("status", "published")
        .textSearch("title_content", message, {
          type: "websearch",
        })
        .limit(3)

      if (articles && articles.length > 0) {
        context = articles.map(a => a.content).join("\n\n")
        sources = articles.map(a => ({
          title: a.title,
          id: a.id,
          type: "knowledge",
        }))
      }
    }

    // Prepare system prompt
    const systemPrompt = `Вы - ИИ-помощник внутреннего портала микрофинансовой компании МКК ФК.
    
Ваша задача - помогать сотрудникам находить информацию в базе знаний компании.

ВАЖНЫЕ ПРАВИЛА:
1. Отвечайте ТОЛЬКО на основе предоставленного контекста из базы знаний
2. Если ответ не найден в контексте, честно скажите об этом
3. Не придумывайте информацию, которой нет в контексте
4. Отвечайте на русском языке
5. Будьте краткими и по делу
6. Если вопрос касается конкретной процедуры, укажите ссылку на источник

КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ:
${context || "Контекст не найден"}`

    // Call chat model (TokenHarbor)
    const completion = await openai.chat.completions.create({
      model: chatModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...validHistory.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    const response = completion.choices[0]?.message?.content || "Извините, не удалось сформировать ответ."

    return NextResponse.json({
      response,
      sources: sources.slice(0, 3),
    })
  } catch (error) {
    console.error("AI Chat Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
