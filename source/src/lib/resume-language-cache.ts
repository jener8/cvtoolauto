import { detectResumeBodyLanguage } from "@/lib/resume-language"

export type ResumeLanguage = "en" | "de"

export type ResumeLanguageSnapshot = {
  resumeText: string
  professionalTitle: string
  targetRole: string
}

export type ResumeLanguageCache = {
  en?: ResumeLanguageSnapshot
  de?: ResumeLanguageSnapshot
  updatedAt: number
}

const KEY_PREFIX = "resume-language-cache:"

function storageKey(versionId: string): string {
  return `${KEY_PREFIX}${versionId}`
}

export function emptyLanguageSnapshot(
  resumeText = "",
  professionalTitle = "",
  targetRole = "",
): ResumeLanguageSnapshot {
  return { resumeText, professionalTitle, targetRole }
}

export function loadResumeLanguageCache(versionId: string): ResumeLanguageCache | null {
  if (typeof window === "undefined" || !versionId) return null
  try {
    const raw = localStorage.getItem(storageKey(versionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ResumeLanguageCache
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

export function saveResumeLanguageCache(versionId: string, cache: ResumeLanguageCache): void {
  if (typeof window === "undefined" || !versionId) return
  try {
    localStorage.setItem(
      storageKey(versionId),
      JSON.stringify({ ...cache, updatedAt: Date.now() }),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function snapshotFromCurrent(input: {
  resumeText: string
  professionalTitle?: string
  targetRole?: string
}): ResumeLanguageSnapshot {
  return {
    resumeText: input.resumeText,
    professionalTitle: input.professionalTitle?.trim() ?? "",
    targetRole: input.targetRole?.trim() ?? "",
  }
}

export function hasUsableSnapshot(snapshot?: ResumeLanguageSnapshot | null): boolean {
  return Boolean(snapshot?.resumeText?.trim())
}

/**
 * Snapshot is usable only when its body language matches the expected slot
 * (avoids reusing English text that was wrongly cached under `de`, etc.).
 */
export function hasMatchingLanguageSnapshot(
  snapshot: ResumeLanguageSnapshot | null | undefined,
  expectedLanguage: ResumeLanguage,
): boolean {
  if (!hasUsableSnapshot(snapshot)) return false
  return detectResumeBodyLanguage(snapshot!.resumeText, expectedLanguage) === expectedLanguage
}

/** True when the live resume differs from the last cached snapshot for that language. */
export function sourceLanguageWasEdited(
  cachedSource: ResumeLanguageSnapshot | null | undefined,
  current: {
    resumeText: string
    professionalTitle?: string
    targetRole?: string
  },
): boolean {
  if (!cachedSource?.resumeText?.trim()) return true
  const title = current.professionalTitle?.trim() ?? ""
  const role = current.targetRole?.trim() ?? ""
  return (
    cachedSource.resumeText !== current.resumeText ||
    cachedSource.professionalTitle !== title ||
    cachedSource.targetRole !== role
  )
}
