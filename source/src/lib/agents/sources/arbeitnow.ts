import type { AgentSearchSettings, NormalizedJob } from "@/lib/agents/types"
import {
  detectListingLanguage,
  inferApplyMethod,
  matchesKeywords,
  matchesLanguageFilter,
  matchesLocation,
  matchesSeniority,
  parseIsoDate,
  stripHtml,
} from "@/lib/agents/normalize"

const ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api"
const FETCH_TIMEOUT_MS = 20_000
const MAX_PAGES = 2

export type ArbeitnowFetchResult = {
  source: "arbeitnow"
  jobs: NormalizedJob[]
  fetched: number
  /** Titles dropped by keyword pre-filter (not a target role). */
  filteredOut: string[]
  errors: string[]
}

type ArbeitnowJob = {
  slug?: string
  company_name?: string
  title?: string
  description?: string
  remote?: boolean
  location?: string
  url?: string
  tags?: string[]
  job_types?: string[]
  created_at?: number | string
}

function isRemote(job: ArbeitnowJob): boolean {
  if (job.remote === true) return true
  const loc = (job.location ?? "").toLowerCase()
  return /\bremote\b|homeoffice|home office/.test(loc)
}

function listingUrl(job: ArbeitnowJob): string | null {
  const url = job.url?.trim()
  if (url && /^https?:\/\//i.test(url)) return url
  if (job.slug) return `https://www.arbeitnow.com/view/job/${encodeURIComponent(job.slug)}`
  return null
}

function toNormalized(job: ArbeitnowJob, settings: AgentSearchSettings): NormalizedJob | null {
  const title = (job.title ?? "").trim()
  const companyName = (job.company_name ?? "").trim()
  const slug = (job.slug ?? "").trim()
  if (!title || !companyName || !slug) return null

  const descriptionHtml = job.description ?? ""
  const description = descriptionHtml ? stripHtml(descriptionHtml) : null
  const location = (job.location ?? "").trim() || null
  const url = listingUrl(job)
  const tags = Array.isArray(job.tags) ? job.tags.join(", ") : ""
  const rawListingText = [title, companyName, location, tags, description, url]
    .filter(Boolean)
    .join("\n\n")

  if (!matchesSeniority(title, settings.seniority)) return null
  if (!matchesLocation(location, settings.location, settings.remote, isRemote(job))) return null

  const language = detectListingLanguage(rawListingText, settings.languages)
  if (!matchesLanguageFilter(language, rawListingText, settings.languages)) return null

  const { applyMethod, emailTo } = inferApplyMethod({ rawText: rawListingText, url })
  const companyWebsite =
    url && !/arbeitnow\.com/i.test(url) ? url : null

  return {
    source: "arbeitnow",
    sourceKey: `arbeitnow:${slug}`,
    title,
    companyName,
    companyWebsite,
    location,
    language,
    description,
    url,
    postedAt: parseIsoDate(job.created_at),
    rawListingText,
    applyMethod,
    emailTo,
  }
}

/**
 * Arbeitnow free job board API — no API key.
 * Docs: https://www.arbeitnow.com/blog/job-board-api
 * Endpoint: GET https://www.arbeitnow.com/api/job-board-api?page=
 */
export async function fetchArbeitnowJobs(
  settings: AgentSearchSettings,
): Promise<ArbeitnowFetchResult> {
  const errors: string[] = []
  const jobs: NormalizedJob[] = []
  const filteredOut: string[] = []
  let fetched = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(`${ARBEITNOW_URL}?page=${page}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
      if (!res.ok) {
        errors.push(`Arbeitnow HTTP ${res.status}`)
        break
      }
      const payload = (await res.json()) as { data?: ArbeitnowJob[] }
      const rows = Array.isArray(payload.data) ? payload.data : []
      fetched += rows.length
      if (!rows.length) break

      for (const row of rows) {
        try {
          const normalized = toNormalized(row, settings)
          if (!normalized) continue
          const tags = Array.isArray(row.tags) ? row.tags.join(", ") : ""
          const haystack = `${normalized.title} ${normalized.description ?? ""} ${tags}`
          if (!matchesKeywords(haystack, settings.keywords)) {
            filteredOut.push(normalized.title)
            continue
          }
          jobs.push(normalized)
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Arbeitnow normalize failed")
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Arbeitnow fetch failed")
      break
    } finally {
      clearTimeout(timer)
    }
  }

  const seen = new Set<string>()
  const unique = jobs.filter((j) => {
    if (seen.has(j.sourceKey)) return false
    seen.add(j.sourceKey)
    return true
  })

  return { source: "arbeitnow", jobs: unique, fetched, filteredOut, errors }
}
