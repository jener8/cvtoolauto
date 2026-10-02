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

const BA_BASE = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service"
const BA_DEFAULT_KEY = "jobboerse-jobsuche"
const FETCH_TIMEOUT_MS = 20_000
const MAX_BA_RESULTS = 25
const MAX_BA_DETAILS = 15

export type SourceFetchResult = {
  source: "arbeitsagentur"
  jobs: NormalizedJob[]
  fetched: number
  filteredOut: string[]
  errors: string[]
}

function baApiKey(): string {
  return process.env.BA_JOBSUCHE_API_KEY?.trim() || BA_DEFAULT_KEY
}

function baHeaders(): HeadersInit {
  return {
    "X-API-Key": baApiKey(),
    // BA often expects a Jobsuche-like UA (documented by bundesAPI/jobsuche-api)
    "User-Agent":
      "Jobsuche/2.9.2 (de.arbeitsagentur.jobboerse; build:1077; iOS 15.1.0) Alamofire/5.4.4",
    Accept: "application/json",
  }
}

type BaListItem = Record<string, unknown>

function listItems(payload: Record<string, unknown>): BaListItem[] {
  const a = payload.ergebnisliste
  const b = payload.stellenangebote
  if (Array.isArray(a)) return a as BaListItem[]
  if (Array.isArray(b)) return b as BaListItem[]
  return []
}

function refOf(item: BaListItem): string | null {
  const ref =
    (typeof item.referenznummer === "string" && item.referenznummer) ||
    (typeof item.refnr === "string" && item.refnr) ||
    null
  return ref?.trim() || null
}

function titleOf(item: BaListItem): string {
  return String(
    item.stellenangebotsTitel || item.titel || item.beruf || item.hauptberuf || "Untitled",
  ).trim()
}

function companyOf(item: BaListItem): string {
  return String(item.firma || item.arbeitgeber || "Unknown company").trim()
}

function locationOf(item: BaListItem): string | null {
  const locs = item.stellenlokationen
  if (Array.isArray(locs) && locs[0] && typeof locs[0] === "object") {
    const adresse = (locs[0] as { adresse?: Record<string, unknown> }).adresse
    if (adresse && typeof adresse.ort === "string") return adresse.ort
  }
  const ort = item.arbeitsort
  if (ort && typeof ort === "object" && typeof (ort as { ort?: string }).ort === "string") {
    return (ort as { ort: string }).ort
  }
  return null
}

function postedOf(item: BaListItem): string | null {
  const period = item.veroeffentlichungszeitraum
  if (period && typeof period === "object" && typeof (period as { von?: string }).von === "string") {
    return parseIsoDate((period as { von: string }).von)
  }
  return (
    parseIsoDate(item.aktuelleVeroeffentlichungsdatum) ||
    parseIsoDate(item.datumErsteVeroeffentlichung) ||
    null
  )
}

function jobUrl(ref: string): string {
  return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(ref)}`
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: baHeaders(), signal: controller.signal })
    if (!res.ok) {
      throw new Error(`BA HTTP ${res.status}`)
    }
    return (await res.json()) as Record<string, unknown>
  } finally {
    clearTimeout(timer)
  }
}

async function fetchDetails(ref: string): Promise<BaListItem | null> {
  const encoded = Buffer.from(ref, "utf8").toString("base64")
  const url = `${BA_BASE}/pc/v4/jobdetails/${encoded}`
  try {
    return await fetchJson(url)
  } catch {
    return null
  }
}

function toNormalized(
  item: BaListItem,
  details: BaListItem | null,
  settings: AgentSearchSettings,
): NormalizedJob | null {
  const ref = refOf(details ?? item) || refOf(item)
  if (!ref) return null

  const title = titleOf(details ?? item)
  const companyName = companyOf(details ?? item)
  const location = locationOf(details ?? item) || locationOf(item)
  const descriptionRaw = String(
    details?.stellenangebotsBeschreibung ||
      details?.stellenbeschreibung ||
      item.stellenangebotsBeschreibung ||
      "",
  )
  const description = descriptionRaw ? stripHtml(descriptionRaw) : null
  const partnerUrl = String(
    details?.allianzpartnerUrl || item.allianzpartnerUrl || details?.externeUrl || "",
  ).trim()
  const website =
    partnerUrl && !/arbeitsagentur\.de/i.test(partnerUrl)
      ? partnerUrl.startsWith("http")
        ? partnerUrl
        : `https://${partnerUrl}`
      : null
  const url = jobUrl(ref)
  const rawListingText = [
    title,
    companyName,
    location,
    description,
    `Referenz: ${ref}`,
    url,
  ]
    .filter(Boolean)
    .join("\n\n")

  const { applyMethod, emailTo } = inferApplyMethod({ rawText: rawListingText, url })
  const language = detectListingLanguage(rawListingText, settings.languages)

  if (!matchesSeniority(title, settings.seniority)) return null
  if (
    !matchesLocation(location, settings.location, settings.remote, false) &&
    !(settings.remote && /homeoffice|remote|telearbeit|heimarbeit/i.test(rawListingText))
  ) {
    // BA remote filter via arbeitszeit=ho is applied at query time; still allow Berlin matches
    if (!matchesLocation(location, settings.location, false, false)) return null
  }
  if (!matchesLanguageFilter(language, rawListingText, settings.languages)) return null

  return {
    source: "arbeitsagentur",
    sourceKey: `arbeitsagentur:${ref}`,
    title,
    companyName,
    companyWebsite: website,
    location,
    language,
    description,
    url,
    postedAt: postedOf(details ?? item) || postedOf(item),
    rawListingText,
    applyMethod,
    emailTo,
  }
}

/**
 * Bundesagentur für Arbeit Jobsuche API (unofficial but documented public client).
 * Docs: https://jobsuche.api.bund.dev/ / https://github.com/bundesAPI/jobsuche-api
 * Auth: X-API-Key header (public clientId `jobboerse-jobsuche`, overridable via BA_JOBSUCHE_API_KEY).
 */
export async function fetchArbeitsagenturJobs(
  settings: AgentSearchSettings,
): Promise<SourceFetchResult> {
  const errors: string[] = []
  const what = settings.keywords.join(" ").trim() || "Product Manager"
  const params = new URLSearchParams({
    was: what,
    wo: settings.location || "Berlin",
    page: "1",
    size: String(MAX_BA_RESULTS),
    angebotsart: "1",
    umkreis: "50",
  })
  if (settings.remote) {
    params.set("arbeitszeit", "ho")
  }

  let payload: Record<string, unknown>
  try {
    payload = await fetchJson(`${BA_BASE}/pc/v6/jobs?${params.toString()}`)
  } catch (e) {
    const message = e instanceof Error ? e.message : "BA search failed"
    return { source: "arbeitsagentur", jobs: [], fetched: 0, filteredOut: [], errors: [message] }
  }

  const items = listItems(payload)
  const jobs: NormalizedJob[] = []
  const filteredOut: string[] = []

  const detailTargets = items.slice(0, MAX_BA_DETAILS)
  const detailResults = await Promise.all(
    detailTargets.map(async (item) => {
      const ref = refOf(item)
      const details = ref ? await fetchDetails(ref) : null
      return { item, details }
    }),
  )

  const consider = (normalized: NormalizedJob | null) => {
    if (!normalized) return
    if (!matchesKeywords(`${normalized.title} ${normalized.description ?? ""}`, settings.keywords)) {
      filteredOut.push(normalized.title)
      return
    }
    jobs.push(normalized)
  }

  for (const { item, details } of detailResults) {
    try {
      consider(toNormalized(item, details, settings))
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "BA normalize failed")
    }
  }

  // Remaining list rows without details (still useful title/company)
  for (const item of items.slice(MAX_BA_DETAILS)) {
    try {
      consider(toNormalized(item, null, settings))
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "BA normalize failed")
    }
  }

  // Deduplicate within BA by sourceKey
  const seen = new Set<string>()
  const unique = jobs.filter((j) => {
    if (seen.has(j.sourceKey)) return false
    seen.add(j.sourceKey)
    return true
  })

  return {
    source: "arbeitsagentur",
    jobs: unique,
    fetched: items.length,
    filteredOut,
    errors,
  }
}
