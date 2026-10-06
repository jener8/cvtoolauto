#!/usr/bin/env node
/**
 * Post-024 RLS probe against DEV only (dulpeyutmkhertwrwbqz).
 * Usage: node scripts/test-024-rls-dev.mjs
 * Reads source/src/.env.local — never prints secrets.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const DEV_REF = "dulpeyutmkhertwrwbqz"
const LIVE_REF = "gpbqlxowvwosonatiuac"
const SRC = path.dirname(fileURLToPath(import.meta.url))
const ENV_PATH = path.join(SRC, "../.env.local")

function loadEnv(filePath) {
  const env = {}
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#") || !t.includes("=")) continue
    const i = t.indexOf("=")
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function refFromUrl(url) {
  return (url || "").replace("https://", "").split(".")[0] || ""
}

function row(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
  return ok
}

async function main() {
  const env = loadEnv(ENV_PATH)
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = env.SUPABASE_APP_USER_EMAIL
  const password = env.SUPABASE_APP_USER_PASSWORD
  const ref = refFromUrl(url)

  console.log(`Target ref: ${ref}`)
  if (ref !== DEV_REF) {
    console.error(`Refusing: expected DEV ${DEV_REF}, got ${ref}`)
    process.exit(2)
  }
  if (ref === LIVE_REF) {
    console.error("Refusing: live project")
    process.exit(2)
  }

  let failures = 0
  const mark = (ok, label, detail) => {
    if (!row(label, ok, detail)) failures++
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Anon: interview_questions should be blocked ---
  {
    const { data, error } = await anon
      .from("interview_questions")
      .select("id")
      .limit(5)
    const blocked =
      (error && (error.code === "42501" || /permission|policy|RLS/i.test(error.message))) ||
      (!error && Array.isArray(data) && data.length === 0 && false) // empty alone is not enough
    // With RLS and no policy for anon, PostgREST typically returns empty array OR error
    const ok =
      Boolean(error) ||
      (Array.isArray(data) && data.length === 0)
    // Prefer explicit: if table missing, fail clearly
    if (error?.code === "PGRST205") {
      mark(false, "anon SELECT interview_questions", "table missing — apply 024 first")
    } else {
      mark(
        Boolean(error) || data?.length === 0,
        "anon SELECT interview_questions blocked/empty",
        error ? `${error.code || ""} ${error.message}` : `rows=${data?.length ?? 0}`,
      )
    }
  }

  // --- Sign in ---
  const { data: sign, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signErr || !sign.session || !sign.user) {
    mark(false, "app user sign-in", signErr?.message || "no session")
    console.log("\nCannot continue authenticated tests. Fix SUPABASE_APP_USER_* for DEV.")
    process.exit(1)
  }
  mark(true, "app user sign-in", `uid=${sign.user.id}`)
  const uid = sign.user.id

  // --- Auth: IQ select all ---
  {
    const { data, error } = await anon.from("interview_questions").select("id,user_id").limit(20)
    mark(!error, "auth SELECT interview_questions", error?.message || `rows=${data?.length ?? 0}`)
  }

  // --- Auth: IQ insert gets user_id = auth.uid() ---
  let insertedId = null
  {
    const { data, error } = await anon
      .from("interview_questions")
      .insert({ question: `024-test ${Date.now()}`, category: "General", author_name: "024-test" })
      .select("id,user_id")
      .single()
    const ok = !error && data?.user_id === uid
    mark(ok, "auth INSERT interview_questions sets user_id=auth.uid()", error?.message || `user_id=${data?.user_id}`)
    insertedId = data?.id ?? null
  }

  // --- Auth: update/delete own ---
  if (insertedId) {
    const { error: upErr } = await anon
      .from("interview_questions")
      .update({ author_name: "024-test-updated" })
      .eq("id", insertedId)
    mark(!upErr, "auth UPDATE own interview_questions", upErr?.message || "ok")

    const { error: delErr } = await anon
      .from("interview_questions")
      .delete()
      .eq("id", insertedId)
    mark(!delErr, "auth DELETE own interview_questions", delErr?.message || "ok")
  }

  // --- Product tables: owner-only + default user_id on insert ---
  for (const table of ["folders"]) {
    const payload =
      table === "folders"
        ? { name: `024-test-${Date.now()}` }
        : {}
    const { data, error } = await anon.from(table).insert(payload).select("id,user_id").single()
    const ok = !error && data?.user_id === uid
    mark(ok, `auth INSERT ${table} default user_id`, error?.message || `user_id=${data?.user_id}`)
    if (data?.id) {
      await anon.from(table).delete().eq("id", data.id)
    }
  }

  for (const table of ["folders", "cover_letters", "job_applications", "resume_versions"]) {
    const { error } = await anon.from(table).select("id").limit(1)
    mark(!error, `auth SELECT ${table}`, error?.message || "ok")
  }

  await anon.auth.signOut()
  console.log(`\nDone. failures=${failures}`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
