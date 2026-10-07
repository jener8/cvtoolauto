#!/usr/bin/env node
/**
 * One-off: copy ONE workspace folder from LIVE Supabase → DEV.
 *
 * LIVE is READ-ONLY (SELECT + auth sign-in only). Never writes/deletes on LIVE.
 * DEV receives upserts only when you pass --execute.
 *
 * Folder slug = folders.name (lowercased), same as /app/workspace/[slug].
 *
 * Dry-run (default — counts only, no DEV writes):
 *
 *   export LIVE_SUPABASE_URL="https://….supabase.co"
 *   export LIVE_SUPABASE_ANON_KEY="…"
 *   export LIVE_SUPABASE_APP_USER_EMAIL="you@example.com"
 *   export LIVE_SUPABASE_APP_USER_PASSWORD="…"
 *   # optional DEV override; else uses source/src/.env.local
 *   # export DEV_SUPABASE_URL=… DEV_SUPABASE_ANON_KEY=…
 *   # export DEV_SUPABASE_APP_USER_EMAIL=… DEV_SUPABASE_APP_USER_PASSWORD=…
 *
 *   cd source/src
 *   node scripts/copy-workspace-live-to-dev.mjs
 *   node scripts/copy-workspace-live-to-dev.mjs --folder-slug=YOUR_SLUG
 *
 * Execute (writes DEV only — after you confirm the slug):
 *
 *   node scripts/copy-workspace-live-to-dev.mjs --folder-slug=YOUR_SLUG --execute
 *
 * Never prints secrets. Temp dumps (if any) go under /tmp and are removed.
 */

import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = resolve(__dirname, "..")

const TABLES = ["folders", "resume_versions", "cover_letters", "job_applications"]
const PAGE_SIZE = 500

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
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

function hostFromUrl(url) {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    const m = String(url).match(/https?:\/\/([^/]+)/i)
    return m ? m[1] : null
  }
}

function parseArgs(argv) {
  let folderSlug = null
  let execute = false
  for (const arg of argv) {
    if (arg === "--execute") {
      execute = true
      continue
    }
    if (arg.startsWith("--folder-slug=")) {
      folderSlug = arg.slice("--folder-slug=".length).trim().toLowerCase()
      continue
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/copy-workspace-live-to-dev.mjs [--folder-slug=SLUG] [--execute]

LIVE_* env vars required in the terminal. DEV uses DEV_* or .env.local.
Dry-run by default; --execute upserts into DEV only.`)
      process.exit(0)
    }
  }
  return { folderSlug, execute }
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}. Set it in the terminal (do not put LIVE secrets in repo files).`)
    process.exit(1)
  }
  return value
}

function createAuthedClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`${label} sign-in failed:`, error.message)
    process.exit(1)
  }
  const user = data.user
  if (!user?.id) {
    console.error(`${label} sign-in returned no user id.`)
    process.exit(1)
  }
  return user
}

async function fetchAll(client, table, buildQuery) {
  const rows = []
  let from = 0
  for (;;) {
    let q = client.from(table).select("*")
    q = buildQuery(q)
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

function remapUserId(row, liveUserId, devUserId) {
  const next = { ...row }
  if (next.user_id != null && next.user_id !== liveUserId) {
    throw new Error(
      `Refusing row in unexpected ownership (id=${next.id ?? "?"}): user_id does not match signed-in LIVE user.`,
    )
  }
  next.user_id = devUserId
  return next
}

async function upsertBatches(client, table, rows) {
  let written = 0
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const chunk = rows.slice(i, i + PAGE_SIZE)
    const { error } = await client.from(table).upsert(chunk, { onConflict: "id" })
    if (error) throw new Error(`DEV upsert ${table}: ${error.message}`)
    written += chunk.length
  }
  return written
}

async function main() {
  const { folderSlug, execute } = parseArgs(process.argv.slice(2))

  const liveUrl = requireEnv("LIVE_SUPABASE_URL", process.env.LIVE_SUPABASE_URL)
  const liveKey = requireEnv(
    "LIVE_SUPABASE_ANON_KEY (or LIVE_SUPABASE_PUBLISHABLE_KEY)",
    process.env.LIVE_SUPABASE_ANON_KEY || process.env.LIVE_SUPABASE_PUBLISHABLE_KEY,
  )
  const liveEmail = requireEnv(
    "LIVE_SUPABASE_APP_USER_EMAIL",
    process.env.LIVE_SUPABASE_APP_USER_EMAIL,
  )
  const livePassword = requireEnv(
    "LIVE_SUPABASE_APP_USER_PASSWORD",
    process.env.LIVE_SUPABASE_APP_USER_PASSWORD,
  )

  const localEnv = loadEnvFile(join(SRC_ROOT, ".env.local"))
  const devUrl =
    process.env.DEV_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    localEnv.NEXT_PUBLIC_SUPABASE_URL
  const devKey =
    process.env.DEV_SUPABASE_ANON_KEY ||
    process.env.DEV_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const devEmail =
    process.env.DEV_SUPABASE_APP_USER_EMAIL ||
    process.env.SUPABASE_APP_USER_EMAIL ||
    localEnv.SUPABASE_APP_USER_EMAIL
  const devPassword =
    process.env.DEV_SUPABASE_APP_USER_PASSWORD ||
    process.env.SUPABASE_APP_USER_PASSWORD ||
    localEnv.SUPABASE_APP_USER_PASSWORD

  if (!devUrl || !devKey) {
    console.error("Missing DEV Supabase URL/key (DEV_SUPABASE_* or .env.local).")
    process.exit(1)
  }
  if (!devEmail || !devPassword) {
    console.error("Missing DEV app user email/password (DEV_SUPABASE_APP_USER_* or .env.local).")
    process.exit(1)
  }

  const liveHost = hostFromUrl(liveUrl)
  const devHost = hostFromUrl(devUrl)
  if (!liveHost || !devHost) {
    console.error("Could not parse LIVE/DEV Supabase URL hosts.")
    process.exit(1)
  }
  if (liveHost === devHost) {
    console.error("LIVE and DEV resolve to the same host — refusing to run.")
    process.exit(1)
  }

  console.log("LIVE host (read-only):", liveHost)
  console.log("DEV host (write target if --execute):", devHost)
  console.log("Mode:", execute ? "EXECUTE (DEV upserts)" : "DRY-RUN (no writes)")

  const live = createAuthedClient(liveUrl, liveKey)
  const liveUser = await signIn(live, liveEmail, livePassword, "LIVE")
  console.log("LIVE user id:", liveUser.id)

  // LIVE: folders owned by signed-in user only (RLS + explicit filter)
  const liveFolders = await fetchAll(live, "folders", (q) =>
    q.eq("user_id", liveUser.id).order("created_at", { ascending: false }),
  )

  if (liveFolders.length === 0) {
    console.log("No folders for this LIVE user.")
    process.exit(0)
  }

  console.log("\nLIVE folders for this user:")
  for (const f of liveFolders) {
    const slug = String(f.name ?? "")
      .trim()
      .toLowerCase()
    console.log(`  - name=${JSON.stringify(f.name)}  slug=${JSON.stringify(slug)}  id=${f.id}`)
  }

  if (!folderSlug) {
    console.log(
      "\nPass --folder-slug=SLUG to dry-run counts for one folder (then --execute to write DEV).",
    )
    process.exit(0)
  }

  const matches = liveFolders.filter(
    (f) =>
      String(f.name ?? "")
        .trim()
        .toLowerCase() === folderSlug,
  )
  if (matches.length === 0) {
    console.error(`No LIVE folder with slug "${folderSlug}" for this user.`)
    process.exit(1)
  }
  if (matches.length > 1) {
    console.error(
      `Multiple LIVE folders match slug "${folderSlug}" (${matches.length}). Rename duplicates on LIVE or pick by cleaning names first.`,
    )
    for (const f of matches) console.error(`  id=${f.id}`)
    process.exit(1)
  }

  const folder = matches[0]
  if (folder.user_id && folder.user_id !== liveUser.id) {
    console.error("Folder user_id does not match signed-in LIVE user — refusing.")
    process.exit(1)
  }

  const folderId = folder.id
  console.log(`\nSelected folder: name=${JSON.stringify(folder.name)} id=${folderId}`)

  const [resumes, letters, jobs] = await Promise.all([
    fetchAll(live, "resume_versions", (q) =>
      q.eq("folder_id", folderId).eq("user_id", liveUser.id),
    ),
    fetchAll(live, "cover_letters", (q) =>
      q.eq("folder_id", folderId).eq("user_id", liveUser.id),
    ),
    fetchAll(live, "job_applications", (q) =>
      q.eq("folder_id", folderId).eq("user_id", liveUser.id),
    ),
  ])

  // Ownership guard on dependents
  for (const [label, rows] of [
    ["resume_versions", resumes],
    ["cover_letters", letters],
    ["job_applications", jobs],
  ]) {
    for (const row of rows) {
      if (row.user_id && row.user_id !== liveUser.id) {
        console.error(`Refusing: ${label} row ${row.id} owned by another user.`)
        process.exit(1)
      }
    }
  }

  const counts = {
    folders: 1,
    resume_versions: resumes.length,
    cover_letters: letters.length,
    job_applications: jobs.length,
  }
  console.log("\nRecord counts for this folder (LIVE read):")
  for (const t of TABLES) {
    console.log(`  ${t}: ${counts[t]}`)
  }
  console.log("  (skipped: agent_* and other tables)")

  if (!execute) {
    console.log(
      "\nDry-run complete. Nothing written to LIVE or DEV.\nRe-run with the same --folder-slug=… and --execute to upsert into DEV.",
    )
    process.exit(0)
  }

  // Optional temp dump under /tmp (cleaned in finally)
  let tmpDir = null
  try {
    tmpDir = mkdtempSync(join(tmpdir(), "cv-live-to-dev-"))
    writeFileSync(
      join(tmpDir, "counts.json"),
      JSON.stringify({ liveHost, devHost, folderId, folderSlug, counts }, null, 2),
    )

    const dev = createAuthedClient(devUrl, devKey)
    const devUser = await signIn(dev, devEmail, devPassword, "DEV")
    console.log("DEV user id:", devUser.id)

    const folderRow = remapUserId(folder, liveUser.id, devUser.id)
    const resumeRows = resumes.map((r) => remapUserId(r, liveUser.id, devUser.id))
    const letterRows = letters.map((r) => remapUserId(r, liveUser.id, devUser.id))
    const jobRows = jobs.map((r) => remapUserId(r, liveUser.id, devUser.id))

    // Folder first (FK parent), then documents, then applications
    const wFolder = await upsertBatches(dev, "folders", [folderRow])
    const wResumes = await upsertBatches(dev, "resume_versions", resumeRows)
    const wLetters = await upsertBatches(dev, "cover_letters", letterRows)
    const wJobs = await upsertBatches(dev, "job_applications", jobRows)

    console.log("\nDEV upserts complete:")
    console.log(`  folders: ${wFolder}`)
    console.log(`  resume_versions: ${wResumes}`)
    console.log(`  cover_letters: ${wLetters}`)
    console.log(`  job_applications: ${wJobs}`)
    console.log("LIVE was not modified.")
  } finally {
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
