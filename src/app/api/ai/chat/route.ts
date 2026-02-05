import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    
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

    const { message, history } = await req.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

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
      // Fallback to text search
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
        ...history.slice(-5).map((h: any) => ({ role: h.role, content: h.content })),
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
