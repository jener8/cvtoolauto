export const LOCAL_STORE_KEYS = {
  folders: "cv_local_folders",
  resumeVersions: "cv_local_resume_versions",
  currentResumeDraft: "cv_current_resume_draft",
  jobApplications: "cv_local_job_applications",
  coverLetters: "cv_local_cover_letters",
  deletedApplicationTombstones: "cv_deleted_application_tombstones",
} as const

export type LocalStoreKey = (typeof LOCAL_STORE_KEYS)[keyof typeof LOCAL_STORE_KEYS]

export function readLocalStore<T>(key: LocalStoreKey): T[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    localStorage.removeItem(key)
    return []
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  if (name === "QuotaExceededError") return true
  const dom = error as DOMException
  return dom.code === 22 || dom.code === 1014
}

export function readLocalStoreJson<T>(key: LocalStoreKey): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function writeLocalStoreJson<T>(key: LocalStoreKey, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    if (isQuotaExceededError(e)) throw e
    const message = e instanceof Error ? e.message : String(e)
    console.error("[cv] Local store write failed:", key, message, e)
    throw new Error(`Could not save data locally (${message}). Try freeing browser storage.`)
  }
}

export function writeLocalStore<T>(key: LocalStoreKey, items: T[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch (e) {
    if (isQuotaExceededError(e)) throw e
    const message = e instanceof Error ? e.message : String(e)
    console.error("[cv] Local store write failed:", key, message, e)
    throw new Error(`Could not save data locally (${message}). Try freeing browser storage.`)
  }
}
