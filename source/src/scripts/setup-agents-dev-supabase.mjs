#!/usr/bin/env node
/**
 * Unblock local job-agents testing WITHOUT applying 020–023 to live Supabase.
 *
 * Prefer a free remote *dev* project (Docker + supabase CLI are often unavailable).
 * This script never posts SQL to any Supabase project.
 *
 * Usage (from source/src):
 *   node scripts/setup-agents-dev-supabase.mjs              # print steps
 *   node scripts/setup-agents-dev-supabase.mjs steps
 *   node scripts/setup-agents-dev-supabase.mjs bundle-sql   # write paste-ready SQL
 *   node scripts/setup-agents-dev-supabase.mjs scaffold-env # create .env.agents-dev.local
 *   node scripts/setup-agents-dev-supabase.mjs check        # probe agent_jobs on current .env.local
 *   node scripts/setup-agents-dev-supabase.mjs use-agents-dev  # swap agents-dev → .env.local
 *   node scripts/setup-agents-dev-supabase.mjs restore-live    # swap .env.live.local → .env.local
 *
 * Docs: docs/agents-local-dev.md
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.resolve(__dirname, "..")
const LIVE_REF = "gpbqlxowvwosonatiuac"

const ENV_LOCAL = path.join(SRC_ROOT, ".env.local")
const ENV_AGENTS_DEV = path.join(SRC_ROOT, ".env.agents-dev.local")
const ENV_LIVE_BACKUP = path.join(SRC_ROOT, ".env.live.local")
const BUNDLE_OUT = path.join(__dirname, "agents-dev-schema-bundle.sql")

/**
 * Ordered SQL for a fresh agents-dev project (base app + agents).
 * Skips live-only data migrations (007, 014*, 015, 017–019) and interview-questions leftovers.
 */
const BASE_SQL = [
  "001_create_tables.sql",
  "002_profile_trigger.sql",
  "004_create_folders.sql",
  "005_create_cover_letters.sql",
  "006_add_user_id_and_rls.sql", // folders + cover_letters user_id (required before 013 policies)
  "008_add_cover_letter_id_to_jobs.sql",
  "009_add_fit_scores_and_red_flags.sql",
  "010_add_resume_style_columns.sql",
  "010_add_upload_details.sql",
  "011_add_resume_embedded_cover_letter.sql",
  "012_add_resume_version_history.sql",
  "add-folder-contact-info.sql", // folders.profile_image + contact_info
  "013_enable_rls_security.sql",
  "016_add_your_story.sql",
  "apply-missing-supabase-schema.sql",
]

const AGENT_SQL = [
  "020_agent_tables.sql",
  "021_agent_jobs_source_key.sql",
  "022_agent_jobs_not_relevant_status.sql",
  "023_agent_controls_scheduling.sql",
  "025_agent_jobs_three_gates.sql",
]

const cmd = (process.argv[2] || "steps").trim()

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
  for (const raw of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const i = line.indexOf("=")
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function projectRefFromUrl(url) {
  if (!url) return null
  const m = String(url).match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m ? m[1] : null
}

function isLiveRef(ref) {
  return ref === LIVE_REF
}

/**
 * Transform source migration SQL into a DEV-safe re-runnable slice.
 * Leaves numbered migration files untouched (one-shot deploy checklist).
 */
function makeBundleSqlIdempotent(sql) {
  let s = sql

  // Tables / indexes: add IF NOT EXISTS when missing
  s = s.replace(/\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "CREATE TABLE IF NOT EXISTS ")
  s = s.replace(
    /\bCREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    "CREATE UNIQUE INDEX IF NOT EXISTS ",
  )
  s = s.replace(/\bCREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/gi, "CREATE INDEX IF NOT EXISTS ")

  // Policies: DROP IF EXISTS immediately before each CREATE POLICY
  s = s.replace(
    /\bCREATE\s+POLICY\s+("([^"]+)"|([^\s"(;]+))([\s\S]*?)\bON\s+((?:[\w]+\.)?[\w]+)/gi,
    (match, nameToken, quotedName, bareName, between, table, offset, full) => {
      const name = quotedName ?? bareName
      const drop = `DROP POLICY IF EXISTS "${name}" ON ${table};`
      const before = full.slice(Math.max(0, offset - 240), offset)
      const already =
        new RegExp(
          `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+ON\\s+${table.replace(/\./g, "\\.")}\\s*;\\s*$`,
          "i",
        ).test(before.trimEnd())
      if (already) return match
      return `${drop}\nCREATE POLICY ${nameToken}${between}ON ${table}`
    },
  )

  // Triggers: DROP IF EXISTS immediately before each CREATE TRIGGER
  s = s.replace(
    /\bCREATE\s+TRIGGER\s+([a-zA-Z_][\w$]*)([\s\S]*?)\bON\s+((?:[\w]+\.)?[\w]+)/gi,
    (match, name, between, table, offset, full) => {
      const drop = `DROP TRIGGER IF EXISTS ${name} ON ${table};`
      const before = full.slice(Math.max(0, offset - 240), offset)
      const already = new RegExp(
        `DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${name}\\s+ON\\s+${table.replace(/\./g, "\\.")}\\s*;\\s*$`,
        "i",
      ).test(before.trimEnd())
      if (already) return match
      return `${drop}\nCREATE TRIGGER ${name}${between}ON ${table}`
    },
  )

  return s
}

function printSteps() {
  const env = loadEnvFile(ENV_LOCAL)
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  console.log(`
Job agents — safe local unblock (no live migrations)
====================================================

Current .env.local project ref: ${ref || "(missing URL)"}
Points at live (${LIVE_REF}): ${isLiveRef(ref) ? "YES — do NOT run 020–023 here" : "no"}

Local Supabase (Docker) was not assumed available. Use a free *dev* Supabase project.

1) Create a project
   https://supabase.com/dashboard → New project
   Name e.g. equitai-agents-dev (free tier is fine).

2) Apply schema (SQL Editor → New query → paste → Run)
   From source/src:
     node scripts/setup-agents-dev-supabase.mjs bundle-sql
   Then open:
     scripts/agents-dev-schema-bundle.sql
   Paste the whole file into the *dev* project's SQL Editor and Run.
   Bundle is idempotent (safe to re-run after a partial apply).
   (Agents-only slice is scripts 020–023; the bundle also includes base app tables.)

3) Create the Auth app user
   Dashboard → Authentication → Users → Add user
   Use email/password you will put in SUPABASE_APP_USER_* below.

4) Scaffold / fill env (keeps live credentials out of the agents-dev file until you paste)
     node scripts/setup-agents-dev-supabase.mjs scaffold-env
   Edit .env.agents-dev.local:
     NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEV-REF.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=…   (Settings → API)
     SUPABASE_APP_USER_EMAIL=…
     SUPABASE_APP_USER_PASSWORD=…
     JOB_AGENT_ENABLED=true
     NEXT_PUBLIC_JOB_AGENT_ENABLED=true

5) Point the app at the dev project (backs up current .env.local → .env.live.local)
     node scripts/setup-agents-dev-supabase.mjs use-agents-dev
     npm run dev

6) Verify agent tables
     node scripts/setup-agents-dev-supabase.mjs check
   Expect: project is NOT live, and agent_jobs is readable (empty is OK).

7) Restore live URL/keys when done testing agents
     node scripts/setup-agents-dev-supabase.mjs restore-live

NEVER: apply 020–023 (or the bundle) to live ${LIVE_REF} without an explicit
"apply to live" approval in chat.
`)
}

function bundleSql() {
  const files = [...BASE_SQL, ...AGENT_SQL]
  const parts = [
    `-- AUTO-GENERATED by setup-agents-dev-supabase.mjs — paste into a DEV Supabase SQL Editor only.`,
    `-- Do NOT run on live project ${LIVE_REF}.`,
    `-- Idempotent for DEV re-runs (DROP POLICY/TRIGGER IF EXISTS + IF NOT EXISTS on tables/indexes).`,
    `-- Numbered migration files are left unchanged for one-shot deploy; transform happens here only.`,
    `-- Generated: ${new Date().toISOString()}`,
    "",
  ]
  for (const name of files) {
    const p = path.join(__dirname, name)
    if (!fs.existsSync(p)) {
      console.error(`Missing SQL file: ${name}`)
      process.exit(1)
    }
    const raw = fs.readFileSync(p, "utf8").trimEnd()
    parts.push(`\n-- ========== ${name} ==========\n`)
    parts.push(makeBundleSqlIdempotent(raw))
    parts.push("")
  }
  fs.writeFileSync(BUNDLE_OUT, parts.join("\n") + "\n")
  console.log(`Wrote ${path.relative(SRC_ROOT, BUNDLE_OUT)}`)
  console.log(`Files (${files.length}): ${files.join(", ")}`)
  console.log(`Open that file, paste into the DEV project SQL Editor, Run (safe to re-run).`)
  console.log(`Do NOT paste into live ${LIVE_REF}.`)
}

function upsertEnvLines(content, updates) {
  const lines = content.split("\n")
  const keys = new Set(Object.keys(updates))
  const seen = new Set()
  const out = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return line
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim()
    if (keys.has(key)) {
      seen.add(key)
      return `${key}=${updates[key]}`
    }
    return line
  })
  for (const key of keys) {
    if (!seen.has(key)) out.push(`${key}=${updates[key]}`)
  }
  return out.join("\n").replace(/\n*$/, "\n")
}

function scaffoldEnv() {
  const base = fs.existsSync(ENV_LOCAL)
    ? fs.readFileSync(ENV_LOCAL, "utf8")
    : fs.existsSync(path.join(SRC_ROOT, ".env.example"))
      ? fs.readFileSync(path.join(SRC_ROOT, ".env.example"), "utf8")
      : ""

  let next = base
  next = upsertEnvLines(next, {
    NEXT_PUBLIC_SUPABASE_URL: "https://YOUR-DEV-PROJECT.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-dev-anon-key",
    SUPABASE_APP_USER_EMAIL: "cv-app-agents-dev@example.com",
    SUPABASE_APP_USER_PASSWORD: "replace-with-dev-auth-password",
    JOB_AGENT_ENABLED: "true",
    NEXT_PUBLIC_JOB_AGENT_ENABLED: "true",
  })

  const header = `# Agents DEV Supabase — fill URL/anon/app-user from the free project you create.
# Swap in with: node scripts/setup-agents-dev-supabase.mjs use-agents-dev
# Never put live (${LIVE_REF}) credentials here for agent Run now testing.
`
  if (!next.startsWith("# Agents DEV")) {
    next = header + "\n" + next.replace(/^\uFEFF/, "")
  }

  fs.writeFileSync(ENV_AGENTS_DEV, next)
  console.log(`Wrote ${path.relative(SRC_ROOT, ENV_AGENTS_DEV)}`)
  console.log("Replace YOUR-DEV-PROJECT / anon key / app user with the new project's values.")
  console.log("Then: node scripts/setup-agents-dev-supabase.mjs use-agents-dev && npm run dev")
}

function useAgentsDev() {
  if (!fs.existsSync(ENV_AGENTS_DEV)) {
    console.error("Missing .env.agents-dev.local — run scaffold-env first and fill keys.")
    process.exit(1)
  }
  const agentsEnv = loadEnvFile(ENV_AGENTS_DEV)
  const ref = projectRefFromUrl(agentsEnv.NEXT_PUBLIC_SUPABASE_URL)
  if (!ref || ref === "YOUR-DEV-PROJECT" || String(agentsEnv.NEXT_PUBLIC_SUPABASE_URL).includes("YOUR-DEV")) {
    console.error(".env.agents-dev.local still has placeholder URL. Paste the real dev project URL/keys first.")
    process.exit(1)
  }
  if (isLiveRef(ref)) {
    console.error(`Refusing: .env.agents-dev.local points at live ${LIVE_REF}. Use a separate free project.`)
    process.exit(1)
  }
  if (String(agentsEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").includes("your-dev-anon")) {
    console.error(".env.agents-dev.local still has placeholder anon key.")
    process.exit(1)
  }
  if (fs.existsSync(ENV_LOCAL)) {
    fs.copyFileSync(ENV_LOCAL, ENV_LIVE_BACKUP)
    console.log(`Backed up current .env.local → .env.live.local`)
  }
  fs.copyFileSync(ENV_AGENTS_DEV, ENV_LOCAL)
  console.log(`Installed .env.agents-dev.local → .env.local (ref=${ref})`)
  console.log("Restart: npm run dev")
  console.log("Verify: node scripts/setup-agents-dev-supabase.mjs check")
}

function restoreLive() {
  if (!fs.existsSync(ENV_LIVE_BACKUP)) {
    console.error("Missing .env.live.local (no backup from use-agents-dev). Restore .env.local manually.")
    process.exit(1)
  }
  fs.copyFileSync(ENV_LIVE_BACKUP, ENV_LOCAL)
  const ref = projectRefFromUrl(loadEnvFile(ENV_LOCAL).NEXT_PUBLIC_SUPABASE_URL)
  console.log(`Restored .env.live.local → .env.local (ref=${ref || "?"})`)
  console.log("Restart: npm run dev")
}

async function check() {
  const env = loadEnvFile(ENV_LOCAL)
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = env.SUPABASE_APP_USER_EMAIL
  const password = env.SUPABASE_APP_USER_PASSWORD
  const ref = projectRefFromUrl(url)

  console.log("Agents Supabase check (.env.local)")
  console.log(`  project ref: ${ref || "(missing)"}`)
  console.log(`  is live (${LIVE_REF}): ${isLiveRef(ref) ? "YES" : "no"}`)
  console.log(`  JOB_AGENT_ENABLED: ${env.JOB_AGENT_ENABLED || "(unset)"}`)

  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
    process.exit(1)
  }
  if (isLiveRef(ref)) {
    console.error(`
Still pointing at live. Agent tables are intentionally not on live.
Create a free DEV project, apply the SQL bundle there, fill .env.agents-dev.local,
then: node scripts/setup-agents-dev-supabase.mjs use-agents-dev
`)
    process.exit(2)
  }
  if (!email || !password) {
    console.error("Missing SUPABASE_APP_USER_EMAIL / SUPABASE_APP_USER_PASSWORD (needed to probe tables).")
    process.exit(1)
  }

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: authError } = await client.auth.signInWithPassword({ email, password })
  if (authError) {
    console.error("Auth failed:", authError.message)
    console.error("Create the Auth user in the DEV project (Dashboard → Authentication → Users).")
    process.exit(1)
  }

  const { error: tableError } = await client.from("agent_jobs").select("id", { count: "exact", head: true })
  if (tableError) {
    const msg = tableError.message || String(tableError)
    console.error("agent_jobs probe failed:", msg)
    if (/could not find the table|schema cache/i.test(msg)) {
      console.error("Apply scripts/agents-dev-schema-bundle.sql (or 020–023) on this DEV project, then retry.")
    }
    process.exit(1)
  }

  console.log("  agent_jobs: OK (table exists)")
  console.log("\n✅ Dev project looks ready for agents. Restart npm run dev if you just swapped env.")
}

const handlers = {
  steps: () => {
    printSteps()
  },
  "bundle-sql": () => {
    bundleSql()
  },
  "scaffold-env": () => {
    scaffoldEnv()
  },
  "use-agents-dev": () => {
    useAgentsDev()
  },
  "restore-live": () => {
    restoreLive()
  },
  check: () => {
    check().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  },
}

if (!handlers[cmd]) {
  console.error(`Unknown command: ${cmd}`)
  console.error("Commands: steps | bundle-sql | scaffold-env | use-agents-dev | restore-live | check")
  process.exit(1)
}

handlers[cmd]()
