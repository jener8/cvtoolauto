import type { AgentSearchSettings, NormalizedJob } from "@/lib/agents/types"
import {
  detectListingLanguage,
  inferApplyMethod,
  matchesKeywords,
  matchesLanguageFilter,
  matchesSeniority,
  parseIsoDate,
  stripHtml,
} from "@/lib/agents/normalize"

const ADZUNA_BASE = "https://api.adzuna.com/v1/api"
const FETCH_TIMEOUT_MS = 20_000
const RESULTS_PER_PAGE = 25

export type AdzunaFetchResult = {
  source: "adzuna"
  jobs: NormalizedJob[]
  fetched: number
  errors: string[]
  skipped?: boolean
}

type AdzunaJob = {
  id?: string | number
  title?: string
  description?: string
  created?: string
  redirect_url?: string
  company?: { display_name?: string }
  location?: { display_name?: string }
}

function credentials(): { appId: string; appKey: string } | null {
  const appId = process.env.ADZUNA_APP_ID?.trim()
  const appKey = process.env.ADZUNA_APP_KEY?.trim()
  if (!appId || !appKey) return null
  return { appId, appKey }
}

function toNormalized(job: AdzunaJob, settings: AgentSearchSettings): NormalizedJob | null {
  const id = job.id != null ? String(job.id) : null
  const title = (job.title ?? "").trim()
  const companyName = (job.company?.display_name ?? "").trim()
  if (!id || !title || !companyName) return null

  const description = job.description ? stripHtml(job.description) : null
  const location = job.location?.display_name?.trim() || settings.location || null
  const url = job.redirect_url?.trim() || null
  const rawListingText = [title, companyName, location, description, url]
    .filter(Boolean)
    .join("\n\n")

  if (!matchesKeywords(`${title} ${description ?? ""}`, settings.keywords)) return null
  if (!matchesSeniority(title, settings.seniority)) return null

  const language = detectListingLanguage(rawListingText, settings.languages)
  if (!matchesLanguageFilter(language, rawListingText, settings.languages)) return null

  const { applyMethod, emailTo } = inferApplyMethod({ rawText: rawListingText, url })

  return {
    source: "adzuna",
    sourceKey: `adzuna:${id}`,
    title,
    companyName,
    companyWebsite: null,
    location,
    language,
    description,
    url,
    postedAt: parseIsoDate(job.created),
    rawListingText,
    applyMethod,
    emailTo,
  }
}

/**
 * Adzuna Job Search API (requires app_id + app_key).
 * Docs: https://developer.adzuna.com/docs/search
 * Germany: GET /v1/api/jobs/de/search/{page}
 * Skipped gracefully when ADZUNA_APP_ID / ADZUNA_APP_KEY are unset.
 */
export async function fetchAdzunaJobs(
  settings: AgentSearchSettings,
): Promise<AdzunaFetchResult> {
  const creds = credentials()
  if (!creds) {
    return {
      source: "adzuna",
      jobs: [],
      fetched: 0,
      errors: [],
      skipped: true,
    }
  }

  const what = settings.keywords.join(" ").trim() || "Product Manager"
  const params = new URLSearchParams({
    app_id: creds.appId,
    app_key: creds.appKey,
    results_per_page: String(RESULTS_PER_PAGE),
    what,
    where: settings.location || "Berlin",
    "content-type": "application/json",
  })
  // Adzuna has no dedicated remote flag; bias query when remote is requested
  if (settings.remote) {
    params.set("what", `${what} remote`.trim())
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${ADZUNA_BASE}/jobs/de/search/1?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        source: "adzuna",
        jobs: [],
        fetched: 0,
        errors: [`Adzuna HTTP ${res.status}`],
      }
    }
    const payload = (await res.json()) as { results?: AdzunaJob[] }
    const rows = Array.isArray(payload.results) ? payload.results : []
    const jobs: NormalizedJob[] = []
    const errors: string[] = []
    for (const row of rows) {
      try {
        const normalized = toNormalized(row, settings)
        if (normalized) jobs.push(normalized)
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Adzuna normalize failed")
      }
    }
    return { source: "adzuna", jobs, fetched: rows.length, errors }
  } catch (e) {
    return {
      source: "adzuna",
      jobs: [],
      fetched: 0,
      errors: [e instanceof Error ? e.message : "Adzuna fetch failed"],
    }
  } finally {
    clearTimeout(timer)
  }
}
