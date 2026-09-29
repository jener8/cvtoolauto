import type { ResumeVersion } from "@/lib/types"

/** Normalize an application title for use as a resume name. */
export function normalizeApplicationTitle(title: string): string {
  return title.trim()
}

export type ParsedVersionedResumeName = {
  base: string
  version: number | null
}

/** Split "AI Design Leader v2" into base + version number. */
export function parseVersionedResumeName(name: string): ParsedVersionedResumeName {
  const trimmed = name.trim()
  const match = trimmed.match(/^(.+?)\s+v(\d+)$/i)
  if (match?.[1] && match[2]) {
    const version = Number.parseInt(match[2], 10)
    if (Number.isFinite(version) && version >= 2) {
      return { base: match[1].trim(), version }
    }
  }
  return { base: trimmed, version: null }
}

/**
 * True when the resume name appears auto-linked to an application title
 * (exact match or "Title v2" style), not a user-custom label.
 */
export function isAutoLinkedResumeName(
  resumeName: string,
  applicationTitle: string,
): boolean {
  const title = normalizeApplicationTitle(applicationTitle)
  const current = resumeName.trim()
  if (!title) return !current
  if (!current) return true
  if (current === title) return true
  const { base } = parseVersionedResumeName(current)
  return base === title
}

/** Default resume name for a new application resume. */
export function resumeNameFromApplicationTitle(applicationTitle: string): string {
  const title = normalizeApplicationTitle(applicationTitle)
  return title || "Untitled Resume"
}

/**
 * Next available resume name for an application title across workspace versions.
 * "AI Design Leader" → "AI Design Leader v2" if the base name already exists.
 */
export function nextApplicationResumeName(
  applicationTitle: string,
  versions: ResumeVersion[],
): string {
  const base = resumeNameFromApplicationTitle(applicationTitle)
  if (base === "Untitled Resume") return base

  const names = new Set(versions.map((v) => v.name.trim()))
  if (!names.has(base)) return base

  let version = 2
  while (names.has(`${base} v${version}`)) {
    version++
  }
  return `${base} v${version}`
}

/** Proposed resume name after an application title change (preserves v2/v3 suffix). */
export function proposedResumeNameAfterTitleChange(
  newApplicationTitle: string,
  currentResumeName: string,
): string {
  const newBase = resumeNameFromApplicationTitle(newApplicationTitle)
  const { version } = parseVersionedResumeName(currentResumeName)
  if (version != null && version >= 2) {
    return `${newBase} v${version}`
  }
  return newBase
}

export function shouldPromptResumeRenameOnTitleChange(
  oldApplicationTitle: string,
  newApplicationTitle: string,
  currentResumeName: string,
): boolean {
  const oldTitle = normalizeApplicationTitle(oldApplicationTitle)
  const newTitle = normalizeApplicationTitle(newApplicationTitle)
  if (!newTitle || oldTitle === newTitle) return false
  if (!currentResumeName.trim()) return true
  return true
}
