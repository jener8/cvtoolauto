import type { SupabaseClient } from "@supabase/supabase-js"
import type { NormalizedJob } from "@/lib/agents/types"
import { jobFingerprint, normalizeMatchText } from "@/lib/agents/normalize"

export type ExistingJobIndex = {
  sourceKeys: Set<string>
  urls: Set<string>
  fingerprints: Set<string>
}

export async function loadExistingJobIndex(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<ExistingJobIndex> {
  let jobsQuery = input.client
    .from("agent_jobs")
    .select("source_key, url, title, location, company_id")
    .eq("user_id", input.userId)
    .eq("kind", "listing")
  if (input.signal) jobsQuery = jobsQuery.abortSignal(input.signal)

  const { data, error } = await jobsQuery

  if (error) throw new Error(error.message)

  const sourceKeys = new Set<string>()
  const urls = new Set<string>()
  const fingerprints = new Set<string>()

  const companyIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.company_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const companyNames = new Map<string, string>()
  if (companyIds.length) {
    let companiesQuery = input.client
      .from("agent_companies")
      .select("id, name")
      .eq("user_id", input.userId)
      .in("id", companyIds)
    if (input.signal) companiesQuery = companiesQuery.abortSignal(input.signal)
    const { data: companies, error: companyError } = await companiesQuery
    if (companyError) throw new Error(companyError.message)
    for (const c of companies ?? []) {
      companyNames.set(c.id as string, String(c.name ?? ""))
    }
  }

  for (const row of data ?? []) {
    if (row.source_key) sourceKeys.add(String(row.source_key))
    if (row.url) urls.add(normalizeUrl(String(row.url)))
    const companyName = row.company_id ? companyNames.get(row.company_id as string) : ""
    if (row.title && companyName) {
      fingerprints.add(
        jobFingerprint({
          title: String(row.title),
          companyName,
          location: row.location ? String(row.location) : null,
        }),
      )
    }
  }

  return { sourceKeys, urls, fingerprints }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ""
    ;["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "v"].forEach((k) =>
      u.searchParams.delete(k),
    )
    return u.toString().replace(/\/$/, "").toLowerCase()
  } catch {
    return normalizeMatchText(url)
  }
}

/**
 * Deduplicate within a fetch batch and against existing agent_jobs.
 * Order of preference: source_key → url → title+company+location fingerprint.
 */
export function dedupeNormalizedJobs(
  jobs: NormalizedJob[],
  existing: ExistingJobIndex,
): { unique: NormalizedJob[]; duplicateCount: number } {
  const batchKeys = new Set<string>()
  const batchUrls = new Set<string>()
  const batchFp = new Set<string>()
  const unique: NormalizedJob[] = []
  let duplicateCount = 0

  for (const job of jobs) {
    const fp = jobFingerprint({
      title: job.title,
      companyName: job.companyName,
      location: job.location,
    })
    const urlKey = job.url ? normalizeUrl(job.url) : null

    const isDup =
      existing.sourceKeys.has(job.sourceKey) ||
      batchKeys.has(job.sourceKey) ||
      (urlKey != null && (existing.urls.has(urlKey) || batchUrls.has(urlKey))) ||
      existing.fingerprints.has(fp) ||
      batchFp.has(fp)

    if (isDup) {
      duplicateCount += 1
      continue
    }

    batchKeys.add(job.sourceKey)
    if (urlKey) batchUrls.add(urlKey)
    batchFp.add(fp)
    unique.push(job)
  }

  return { unique, duplicateCount }
}
