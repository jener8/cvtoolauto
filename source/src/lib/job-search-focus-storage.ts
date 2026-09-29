const STORAGE_PREFIX = "job-search-focus-checklist"

export type JobSearchFocusChecklist = Record<string, boolean>

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

export function loadJobSearchFocusChecklist(folderId: string): JobSearchFocusChecklist {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== "object" || parsed === null) return {}
    const out: JobSearchFocusChecklist = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function saveJobSearchFocusChecklist(
  folderId: string,
  checklist: JobSearchFocusChecklist,
): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(checklist))
}
