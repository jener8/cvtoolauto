/**
 * Count job_applications in Supabase (server credentials from .env.local).
 * Run: node scripts/count-cloud-applications.mjs
 * Prints counts only — never logs credentials.
 */
import { readFileSync, existsSync } from "fs"
import { createClient } from "@supabase/supabase-js"

function loadEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = loadEnvFile(".env.local")
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = env.SUPABASE_APP_USER_EMAIL
const password = env.SUPABASE_APP_USER_PASSWORD

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local")
  process.exit(1)
}

if (!email || !password) {
  console.error(
    "Missing SUPABASE_APP_USER_EMAIL or SUPABASE_APP_USER_PASSWORD in .env.local",
  )
  console.error("Run: vercel env pull .env.local --environment=production")
  process.exit(1)
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError) {
  console.error("Supabase sign-in failed:", authError.message)
  process.exit(1)
}

const { data, error } = await supabase
  .from("job_applications")
  .select("id, folder_id, company, role")

if (error) {
  console.error("Query failed:", error.message)
  process.exit(1)
}

const byFolder = {}
for (const row of data ?? []) {
  const key = row.folder_id ?? "(no folder)"
  byFolder[key] = (byFolder[key] ?? 0) + 1
}

console.log("TOTAL_IN_SUPABASE:", data?.length ?? 0)
console.log("BY_FOLDER:", JSON.stringify(byFolder, null, 2))
