// Production readiness static check — node builtins only.
// Run: node scripts/check-production.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function check(name, cond) {
  if (cond) {
    console.log(`ok - ${name}`);
  } else {
    console.log(`FAIL - ${name}`);
    failures.push(name);
  }
}

// ---- deployment config ----
const dockerfile = read("Dockerfile");
check("Dockerfile uses node22-alpine", /FROM node:22-alpine/.test(dockerfile));
check("Dockerfile multistage", (dockerfile.match(/^FROM /gm) || []).length >= 3);
check("Dockerfile npm ci", /npm ci/.test(dockerfile));
check("Dockerfile build", /npm run build/.test(dockerfile));
check("Dockerfile next start on port 3000", /3000/.test(dockerfile) && /npm.+start|next start/.test(dockerfile));
check("Dockerfile build args supabase", /NEXT_PUBLIC_SUPABASE_URL/.test(dockerfile) && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(dockerfile));
check(".dockerignore exists", fs.existsSync(path.join(root, ".dockerignore")));

const homePage = read("src/app/page.tsx");
check("root page redirects /dashboard", /redirect\(["']\/dashboard["']\)/.test(homePage));

const pkg = JSON.parse(read("package.json"));
check("next pinned 14.2.x", /^14\.2\.\d+$/.test(pkg.dependencies.next));
check("eslint-config-next pinned 14.2.x", /^14\.2\.\d+$/.test(pkg.devDependencies["eslint-config-next"]));
check("next is latest patched 14.2.35", pkg.dependencies.next === "14.2.35" && pkg.devDependencies["eslint-config-next"] === "14.2.35");
const lock = JSON.parse(read("package-lock.json"));
check("lockfile next 14.2.35", lock.packages?.["node_modules/next"]?.version === "14.2.35");

// ---- AI route ----
const aiRoute = read("src/app/api/ai/chat/route.ts");
check("AI: no top-level OpenAI instantiation", !/^const openai = new OpenAI/m.test(aiRoute));
check("AI: lazy OpenAI inside POST", /export async function POST[\s\S]*new OpenAI\(/.test(aiRoute));
check("AI: 503 if missing key", /503/.test(aiRoute) && /OPENAI_API_KEY/.test(aiRoute));
check("AI: message max4000 validation", /4000/.test(aiRoute) && /typeof message/.test(aiRoute));
check("AI: history array max5", /history\.length > 5/.test(aiRoute) && /Array\.isArray\(history\)/.test(aiRoute));
check("AI: history only user/assistant", /"user"[^]*"assistant"|user.*assistant/.test(aiRoute) && /h\.role === "user" \|\| h\.role === "assistant"/.test(aiRoute));
check("AI: fallback uses title_content", /\.textSearch\("title_content"/.test(aiRoute));

// ---- 01_schema ----
const schema = read("database/01_schema.sql");
check("schema: CREATE EXTENSION vector before tables", /CREATE EXTENSION[^;]*vector/i.test(schema) && schema.indexOf("CREATE EXTENSION") < schema.indexOf("CREATE TABLE profiles"));
check("schema: title_content generated tsvector", /title_content TSVECTOR GENERATED ALWAYS AS/.test(schema));
check("schema: handle_new_user always agent", /handle_new_user[\s\S]*?'agent'/.test(schema) && !/raw_user_meta_data->>'role'/.test(schema));

// ---- 02 RLS ----
const rls = read("database/02_rls_policies.sql");
check("rls: no array_length empty checks", !/array_length\(/.test(rls));
check("rls: cardinality coalesce used", /coalesce\(cardinality\(/.test(rls));
check("rls: system_settings RLS enabled", /ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY/.test(rls));
check("rls: settings admin only (no USING true)", !/settings_select" ON system_settings[\s\S]*?USING \(true\)/.test(rls) && /settings_select[\s\S]*?it_admin/.test(rls));
check("rls: document_categories policies", /document_categories_select/.test(rls) && /document_categories_modify/.test(rls));
check("rls: helpers NULL for inactive", /WHERE id = auth\.uid\(\) AND is_active = true/.test(rls));

// ---- 03 views ----
const views = read("database/03_views.sql");
check("views: checklist uses DATE(completed_at)", /DATE\(completed_at\) as date/.test(views));
check("views: no DATE(created_at) for checklist_completed", !/DATE\(created_at\) as date,\s*\n\s*'checklist_completed'/.test(views));
check("views: ack uses DATE(acknowledged_at)", /DATE\(acknowledged_at\) as date/.test(views));
check("views: course progress groups by last_lesson_id", /GROUP BY[^;]*cp\.last_lesson_id/.test(views));
check("views: certifications count distinct test ids", /COUNT\(DISTINCT ta\.test_id\)/.test(views) && !/COUNT\(DISTINCT ta\.id\)/.test(views));
check("views: all protected with security_invoker", (views.match(/WITH \(security_invoker=true\)/g) || []).length >= 15);
check("views: no SECURITY DEFINER in RPCs", !/SECURITY DEFINER/.test(views));
check("views: RPCs use SECURITY INVOKER", /SECURITY INVOKER/.test(views));

// ---- 04 migration ----
const sec = read("database/04_security.sql");
check("04: profiles escalation trigger", /prevent_profile_privilege_escalation/.test(sec) && /role\/branch_id\/is_active/.test(sec));
check("04: system_settings admin only", /settings_select/.test(sec) && /it_admin/.test(sec));
check("04: document_categories policies", /document_categories_select/.test(sec));
check("04: helpers inactive NULL", /AND is_active = true/.test(sec));
check("04: attempt score/passed trigger", /prevent_attempt_score_tampering/.test(sec) && /score\/passed/.test(sec));

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll production checks passed");
