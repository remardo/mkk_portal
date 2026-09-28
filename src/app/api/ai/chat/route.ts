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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile for RLS
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, branch_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
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

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }
    const openai = new OpenAI({ apiKey })

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    })

    const queryEmbedding = embeddingResponse.data[0].embedding

    // Search for relevant documents in the AI index
    // Note: This requires the pgvector extension and proper setup
    // @ts-ignore - RPC function not in generated types
    const { data: relevantDocs } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
      user_role: profile.role,
      user_branch_id: profile.branch_id,
    })

    // If no relevant documents found, search using text search as fallback
    let context = ""
    let sources: { title: string; id: string; type: string }[] = []

    if (relevantDocs && relevantDocs.length > 0) {
      context = relevantDocs.map((doc: any) => doc.content).join("\n\n")
      sources = relevantDocs.map((doc: any) => ({
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

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
