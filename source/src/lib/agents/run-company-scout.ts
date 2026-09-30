/**
 * Phase 9 — Company Scout (weekly).
 * Creates initiative agent_jobs from target_companies (settings) or existing
 * agent_companies names — no forbidden-site scraping; no external crawl.
 * Respects COMPANY_SCOUT_WEEKLY_CAP (default 5).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { findOrCreateCompany } from "@/lib/agents/companies"
import { normalizeCompanyName } from "@/lib/agents/normalize"
import { getOrCreateSearchSettings } from "@/lib/agents/search-settings"

export function getCompanyScoutWeeklyCap(): number {
  const raw = process.env.COMPANY_SCOUT_WEEKLY_CAP?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 5
  if (!Number.isFinite(n) || n < 1) return 5
  return Math.min(n, 50)
}

/** Monday 00:00 UTC of the current ISO week (UTC). */
export function startOfUtcWeek(d = new Date()): Date {
  const day = d.getUTCDay() // 0 Sun … 6 Sat
  const daysFromMonday = (day + 6) % 7
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - daysFromMonday)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

export type RunCompanyScoutResult = {
  fetched: number
  inserted: number
  skippedCap: number
  skippedExisting: number
  weeklyCap: number
  insertedThisWeekBefore: number
  errors: string[]
  activityId: string | null
}

async function countInitiativeJobsThisWeek(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  const since = startOfUtcWeek().toISOString()
  let query = client
    .from("agent_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "initiative")
    .gte("created_at", since)
  if (signal) query = query.abortSignal(signal)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function loadExistingInitiativeNormalizedNames(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  let query = client
    .from("agent_jobs")
    .select("company_id")
    .eq("user_id", userId)
    .eq("kind", "initiative")
  if (signal) query = query.abortSignal(signal)
  const { data: jobs, error } = await query
  if (error) throw new Error(error.message)

  const companyIds = Array.from(
    new Set(
      ((jobs as Array<{ company_id: string | null }> | null) ?? [])
        .map((j) => j.company_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  if (companyIds.length === 0) return new Set()

  let companiesQuery = client
    .from("agent_companies")
    .select("id, normalized_name, name")
    .eq("user_id", userId)
    .in("id", companyIds)
  if (signal) companiesQuery = companiesQuery.abortSignal(signal)
  const { data: companies, error: cErr } = await companiesQuery
  if (cErr) throw new Error(cErr.message)

  const out = new Set<string>()
  for (const c of (companies as Array<{ normalized_name: string | null; name: string }> | null) ?? []) {
    const n = c.normalized_name || normalizeCompanyName(c.name)
    if (n) out.add(n)
  }
  return out
}

/**
 * Resolve candidate company names: settings.target_companies first;
 * else names from agent_companies (already discovered via allowed job APIs).
 */
async function resolveCandidateNames(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<string[]> {
  const settings = await getOrCreateSearchSettings(input)
  const fromSettings = (settings.targetCompanies ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
  if (fromSettings.length > 0) return fromSettings.slice(0, 40)

  let query = input.client
    .from("agent_companies")
    .select("name")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(40)
  if (input.signal) query = query.abortSignal(input.signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data as Array<{ name: string }> | null) ?? [])
    .map((r) => r.name?.trim())
    .filter(Boolean)
}

/**
 * Weekly company discovery → initiative queue rows (status=new).
 * Activity kind: company_scout. Counts only — no PII in errors beyond generic msgs.
 */
export async function runCompanyScout(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<RunCompanyScoutResult> {
  const weeklyCap = getCompanyScoutWeeklyCap()
  const errors: string[] = []
  let inserted = 0
  let skippedCap = 0
  let skippedExisting = 0

  let insertedThisWeekBefore = 0
  try {
    insertedThisWeekBefore = await countInitiativeJobsThisWeek(
      input.client,
      input.userId,
      input.signal,
    )
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Could not count weekly initiatives")
    return {
      fetched: 0,
      inserted: 0,
      skippedCap: 0,
      skippedExisting: 0,
      weeklyCap,
      insertedThisWeekBefore: 0,
      errors,
      activityId: null,
    }
  }

  const remaining = Math.max(0, weeklyCap - insertedThisWeekBefore)
  if (remaining === 0) {
    skippedCap = 1
    errors.push(`Weekly company scout cap reached (${weeklyCap})`)
  }

  let candidates: string[] = []
  let existing = new Set<string>()
  try {
    candidates = remaining > 0 ? await resolveCandidateNames(input) : []
    existing = await loadExistingInitiativeNormalizedNames(
      input.client,
      input.userId,
      input.signal,
    )
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Could not load company candidates")
  }

  const fetched = candidates.length

  for (const name of candidates) {
    if (inserted >= remaining) {
      skippedCap += 1
      break
    }
    const normalized = normalizeCompanyName(name) || name.toLowerCase()
    if (existing.has(normalized)) {
      skippedExisting += 1
      continue
    }

    try {
      const companyId = await findOrCreateCompany({
        userId: input.userId,
        client: input.client,
        name,
        signal: input.signal,
      })
      const now = new Date().toISOString()
      let insertQuery = input.client.from("agent_jobs").insert({
        user_id: input.userId,
        kind: "initiative",
        company_id: companyId,
        apply_method: null,
        status: "new",
        title: `Initiative — ${name.trim().slice(0, 120)}`,
        location: null,
        language: null,
        description:
          "Company Scout initiative target from watchlist / known companies. No listing scrape.",
        url: null,
        source: "company_scout",
        source_key: `company_scout:${normalized}`,
        posted_at: null,
        raw_listing_text: `Initiative application target: ${name.trim()}`,
        email_to: null,
        updated_at: now,
      })
      if (input.signal) insertQuery = insertQuery.abortSignal(input.signal)
      const { error } = await insertQuery
      if (error) {
        if (/duplicate|unique|source_key/i.test(error.message)) {
          skippedExisting += 1
          existing.add(normalized)
          continue
        }
        errors.push(`insert failed: ${error.message}`)
        continue
      }
      inserted += 1
      existing.add(normalized)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "company scout insert failed")
    }
  }

  let activityId: string | null = null
  try {
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: "company_scout",
      fetched,
      relevant: 0,
      drafted: 0,
      errors: errors.slice(0, 50),
      details: {
        agent: "company_scout",
        inserted,
        skipped_cap: skippedCap,
        skipped_existing: skippedExisting,
        weekly_cap: weeklyCap,
        inserted_this_week_before: insertedThisWeekBefore,
      },
    })
    if (input.signal) activityQuery = activityQuery.abortSignal(input.signal)
    const { data: activity, error: activityError } = await activityQuery.select("id").single()
    if (activityError) {
      errors.push(`activity log: ${activityError.message}`)
    } else {
      activityId = (activity?.id as string) ?? null
    }
  } catch (e) {
    errors.push(e instanceof Error ? `activity log: ${e.message}` : "activity log failed")
  }

  console.info("[agents/company-scout] complete", {
    fetched,
    inserted,
    skippedCap,
    weeklyCap,
    errors: errors.length,
  })

  return {
    fetched,
    inserted,
    skippedCap,
    skippedExisting,
    weeklyCap,
    insertedThisWeekBefore,
    errors,
    activityId,
  }
}
