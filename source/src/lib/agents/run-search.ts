import type { SupabaseClient } from "@supabase/supabase-js"
import type { AgentSearchSettings, NormalizedJob } from "@/lib/agents/types"
import { findOrCreateCompany } from "@/lib/agents/companies"
import { dedupeNormalizedJobs, loadExistingJobIndex } from "@/lib/agents/dedupe"
import { getOrCreateSearchSettings } from "@/lib/agents/search-settings"
import {
  fetchAdzunaJobs,
  fetchArbeitnowJobs,
  fetchArbeitsagenturJobs,
} from "@/lib/agents/sources"

export type RunSearchResult = {
  settings: AgentSearchSettings
  fetched: number
  inserted: number
  duplicates: number
  bySource: Record<string, { fetched: number; matched: number; skipped?: boolean }>
  errors: string[]
  activityId: string | null
}

async function upsertListing(input: {
  userId: string
  client: SupabaseClient
  job: NormalizedJob
  signal?: AbortSignal
}): Promise<"inserted" | "updated"> {
  const companyId = await findOrCreateCompany({
    userId: input.userId,
    client: input.client,
    name: input.job.companyName,
    website: input.job.companyWebsite,
    signal: input.signal,
  })

  const now = new Date().toISOString()
  const row = {
    user_id: input.userId,
    kind: "listing" as const,
    company_id: companyId,
    apply_method: input.job.applyMethod,
    status: "new" as const,
    title: input.job.title,
    location: input.job.location,
    language: input.job.language,
    description: input.job.description,
    url: input.job.url,
    source: input.job.source,
    source_key: input.job.sourceKey,
    posted_at: input.job.postedAt,
    raw_listing_text: input.job.rawListingText,
    email_to: input.job.emailTo,
    updated_at: now,
  }

  // Prefer insert; if unique source_key conflict, skip (already counted as duplicate upstream)
  let insertQuery = input.client.from("agent_jobs").insert(row)
  if (input.signal) insertQuery = insertQuery.abortSignal(input.signal)
  const { error } = await insertQuery

  if (!error) return "inserted"

  // Unique violation on source_key → treat as existing
  if (/duplicate|unique|source_key/i.test(error.message)) {
    return "updated"
  }
  throw new Error(error.message)
}

export async function runJobSearch(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<RunSearchResult> {
  const settings = await getOrCreateSearchSettings({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })

  const [ba, arbeitnow, adzuna] = await Promise.all([
    fetchArbeitsagenturJobs(settings),
    fetchArbeitnowJobs(settings),
    fetchAdzunaJobs(settings),
  ])

  const errors = [...ba.errors, ...arbeitnow.errors, ...adzuna.errors]
  const allJobs: NormalizedJob[] = [...ba.jobs, ...arbeitnow.jobs, ...adzuna.jobs]
  const fetched = ba.fetched + arbeitnow.fetched + adzuna.fetched

  const existing = await loadExistingJobIndex({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  const { unique: deduped, duplicateCount } = dedupeNormalizedJobs(allJobs, existing)
  // Soft cap per manual run to keep upserts bounded
  const MAX_INSERTS = 60
  const unique = deduped.slice(0, MAX_INSERTS)
  const capped = deduped.length - unique.length
  const duplicates = duplicateCount + capped

  let inserted = 0
  let conflictDupes = 0
  for (const job of unique) {
    try {
      const result = await upsertListing({
        userId: input.userId,
        client: input.client,
        job,
        signal: input.signal,
      })
      if (result === "inserted") inserted += 1
      else conflictDupes += 1
    } catch (e) {
      errors.push(
        `${job.source}:${job.sourceKey} — ${e instanceof Error ? e.message : "upsert failed"}`,
      )
    }
  }

  const duplicatesTotal = duplicates + conflictDupes
  const bySource = {
    arbeitsagentur: { fetched: ba.fetched, matched: ba.jobs.length },
    arbeitnow: { fetched: arbeitnow.fetched, matched: arbeitnow.jobs.length },
    adzuna: {
      fetched: adzuna.fetched,
      matched: adzuna.jobs.length,
      skipped: Boolean(adzuna.skipped),
    },
  }

  let activityId: string | null = null
  try {
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: "search",
      fetched,
      relevant: 0,
      drafted: 0,
      errors: errors.slice(0, 50),
      details: {
        agent: "job_scout",
        inserted,
        duplicates: duplicatesTotal,
        bySource,
        location: settings.location,
        keywords: settings.keywords,
        remote: settings.remote,
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

  return {
    settings,
    fetched,
    inserted,
    duplicates: duplicatesTotal,
    bySource,
    errors,
    activityId,
  }
}
