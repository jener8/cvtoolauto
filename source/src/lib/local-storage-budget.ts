import { FOLDERS_CACHE_KEY } from "./folders-cache"
import { LOCAL_STORE_KEYS, isQuotaExceededError } from "./supabase/local-store"

/** Skip parsing keys larger than this (legacy blob dumps). */
export const LOCAL_STORAGE_MAX_READ_BYTES = 2_500_000

const CV_KEY_PREFIXES = ["cv_local_", "cv_current_", "cv_folders_", "cv_authenticated"]

/** Drop embedded images only — never truncate job descriptions or other text. */
function stripDataUrls(value: unknown, keyHint = ""): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return null
    const key = keyHint.toLowerCase()
    const looksLikeImageField =
      key.includes("image") ||
      key.includes("logo") ||
      key.includes("photo") ||
      key.includes("avatar")
    // Legacy blobs sometimes lack a data: prefix; only trim those image-like fields.
    if (looksLikeImageField && value.length > 12_000 && !/\s/.test(value.slice(0, 200))) {
      return null
    }
    return value
  }
  if (Array.isArray(value)) return value.map((item) => stripDataUrls(item, keyHint))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = stripDataUrls(v, k)
      if (next !== null && next !== undefined && next !== "") out[k] = next
    }
    return out
  }
  return value
}

/** Best-effort removal of base64 blobs from cached folder / job / cover-letter rows. */
export function compactCvLocalStoreRows(): void {
  if (typeof window === "undefined") return

  const keys = [
    LOCAL_STORE_KEYS.folders,
    LOCAL_STORE_KEYS.jobApplications,
    LOCAL_STORE_KEYS.coverLetters,
    FOLDERS_CACHE_KEY,
  ] as const

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw || raw.length < 50_000) continue
      const parsed = JSON.parse(raw)
      const cleaned = stripDataUrls(parsed)
      localStorage.setItem(key, JSON.stringify(cleaned))
    } catch {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
  }
}

export function readRawLocalKey(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function readLocalJsonSafe<T>(key: string, asArray: boolean): T | T[] | null {
  const raw = readRawLocalKey(key)
  if (!raw) return asArray ? ([] as T[]) : null
  if (raw.length > LOCAL_STORAGE_MAX_READ_BYTES) {
    console.warn("[cv] Clearing oversized localStorage key:", key, raw.length)
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    return asArray ? ([] as T[]) : null
  }
  try {
    return JSON.parse(raw) as T | T[]
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    return asArray ? ([] as T[]) : null
  }
}

/** Free space before resume writes: drop snapshots, compact other CV keys. */
export function enforceLocalStorageBudget(options?: { clearSnapshots?: boolean }): void {
  if (typeof window === "undefined") return
  const clearSnapshots = options?.clearSnapshots ?? false

  if (clearSnapshots) {
    try {
      localStorage.removeItem(LOCAL_STORE_KEYS.resumeVersions)
    } catch {
      /* ignore */
    }
  } else {
    const raw = readRawLocalKey(LOCAL_STORE_KEYS.resumeVersions)
    if (raw && raw.length > LOCAL_STORAGE_MAX_READ_BYTES) {
      try {
        localStorage.removeItem(LOCAL_STORE_KEYS.resumeVersions)
      } catch {
        /* ignore */
      }
    }
  }

  compactCvLocalStoreRows()
}

export type ClearLocalStorageResult = {
  removedKeys: string[]
  hadResumeSnapshots: boolean
  hadDraft: boolean
}

/** Clear all CV tool offline caches (not auth profile). */
export function clearAllCvLocalStorage(): ClearLocalStorageResult {
  const result: ClearLocalStorageResult = {
    removedKeys: [],
    hadResumeSnapshots: false,
    hadDraft: false,
  }
  if (typeof window === "undefined") return result

  const hadSnap = Boolean(readRawLocalKey(LOCAL_STORE_KEYS.resumeVersions))
  const hadDraft = Boolean(readRawLocalKey(LOCAL_STORE_KEYS.currentResumeDraft))
  result.hadResumeSnapshots = hadSnap
  result.hadDraft = hadDraft

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key) continue
    if (CV_KEY_PREFIXES.some((p) => key.startsWith(p)) || key === FOLDERS_CACHE_KEY) {
      try {
        localStorage.removeItem(key)
        result.removedKeys.push(key)
      } catch {
        /* ignore */
      }
    }
  }

  return result
}

export function writeJsonWithQuotaRecovery<T>(
  key: string,
  value: T,
  onQuota: () => void,
): { ok: boolean; warning?: string } {
  if (typeof window === "undefined") return { ok: false }

  const attempt = (): void => {
    localStorage.setItem(key, JSON.stringify(value))
  }

  try {
    attempt()
    return { ok: true }
  } catch (e) {
    if (!isQuotaExceededError(e)) throw e
    onQuota()
    try {
      attempt()
      return {
        ok: true,
        warning: "Browser storage was full. Older local data was removed to complete this save.",
      }
    } catch (e2) {
      if (!isQuotaExceededError(e2)) throw e2
      return {
        ok: false,
        warning:
          "Storage is full. Please export your data, then clear saved versions.",
      }
    }
  }
}
