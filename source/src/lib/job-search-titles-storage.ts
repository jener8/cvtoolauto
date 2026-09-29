const STORAGE_PREFIX = "job-search-titles"

export type JobSearchTitlesCache = {
  fingerprint: string
  jobTitles: string[]
  generatedAt: number
  source: "ai" | "fallback"
}

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

export function loadJobSearchTitlesCache(folderId: string): JobSearchTitlesCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<JobSearchTitlesCache>
    if (!parsed.fingerprint || !Array.isArray(parsed.jobTitles)) return null
    return {
      fingerprint: parsed.fingerprint,
      jobTitles: parsed.jobTitles.filter((t): t is string => typeof t === "string"),
      generatedAt: typeof parsed.generatedAt === "number" ? parsed.generatedAt : 0,
      source: parsed.source === "ai" ? "ai" : "fallback",
    }
  } catch {
    return null
  }
}

export function saveJobSearchTitlesCache(folderId: string, cache: JobSearchTitlesCache): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(cache))
}
