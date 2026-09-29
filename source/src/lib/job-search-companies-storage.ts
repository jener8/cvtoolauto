import type { CompanySearchTarget } from "@/lib/job-search-focus"

const STORAGE_PREFIX = "job-search-companies"

export type JobSearchCompaniesCache = {
  fingerprint: string
  companies: CompanySearchTarget[]
  generatedAt: number
  source: "ai" | "fallback"
}

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

export function loadJobSearchCompaniesCache(folderId: string): JobSearchCompaniesCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<JobSearchCompaniesCache>
    if (!parsed.fingerprint || !Array.isArray(parsed.companies)) return null
    return {
      fingerprint: parsed.fingerprint,
      companies: parsed.companies.filter(
        (c): c is CompanySearchTarget =>
          typeof c === "object" &&
          c !== null &&
          typeof c.id === "string" &&
          typeof c.company === "string" &&
          typeof c.area === "string",
      ),
      generatedAt: typeof parsed.generatedAt === "number" ? parsed.generatedAt : 0,
      source: parsed.source === "ai" ? "ai" : "fallback",
    }
  } catch {
    return null
  }
}

export function saveJobSearchCompaniesCache(folderId: string, cache: JobSearchCompaniesCache): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(cache))
}
