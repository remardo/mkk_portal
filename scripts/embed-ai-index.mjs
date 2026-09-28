// Backfills ai_index.embedding via PostgREST (no deps) + OpenRouter embeddings.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
//      OPENAI_BASE_URL, OPENAI_EMBEDDINGS_MODEL
// Usage: node embed-ai-index.mjs
const SB = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OR_BASE = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1"
const MODEL = process.env.OPENAI_EMBEDDINGS_MODEL || "openai/text-embedding-3-small"
if (!SB || !SB_KEY || !process.env.OPENAI_API_KEY) {
  console.error("Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
  process.exit(1)
}

const rest = (path, init = {}) =>
  fetch(`${SB.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

async function embed(texts) {
  const res = await fetch(`${OR_BASE.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "mkk-portal-rag",
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  })
  if (!res.ok) throw new Error(`OR ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  return (json.data || []).map((d) => d.embedding)
}

const rows = await (async () => {
  const res = await rest("ai_index?select=id,content&embedding=is.null&order=id")
  if (!res.ok) throw new Error(`select ${res.status}: ${await res.text()}`)
  return res.json()
})()

if (rows.length === 0) {
  console.log("Nothing to embed.")
  process.exit(0)
}

console.log(`Rows without embedding: ${rows.length}`)
let done = 0
const PER = 16
for (let i = 0; i < rows.length; i += PER) {
  const batch = rows.slice(i, i + PER)
  const texts = batch.map((r) => (r.content || "").slice(0, 8000))
  const vectors = await embed(texts)
  for (let j = 0; j < batch.length; j++) {
    const vec = vectors[j]
    if (!vec) {
      console.warn(`no vector for ${batch[j].id}`)
      continue
    }
    const res = await rest(`ai_index?id=eq.${batch[j].id}`, {
      method: "PATCH",
      body: JSON.stringify({ embedding: vec }),
    })
    if (!res.ok) console.error(`update ${batch[j].id}: ${res.status} ${await res.text()}`)
  }
  done += batch.length
  console.log(`embedded ${done}/${rows.length}`)
}
console.log("Done. Model:", MODEL)
