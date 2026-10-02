import { isResumeTemplateVersion } from "@/lib/resume-classification"
import type { ResumeVersion } from "@/lib/types"

export type ResumePersonGroup = {
  key: string
  displayName: string
  email: string | null
  versions: ResumeVersion[]
  templateCount: number
  withTextCount: number
  textChars: number
}

function normalizePersonPart(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Identity key from contact name + email (name preferred). */
export function personKeyForResume(version: ResumeVersion): string {
  const name = normalizePersonPart(version.contactInfo?.name)
  const email = normalizePersonPart(version.contactInfo?.email)
  if (name) return `name:${name}`
  if (email) return `email:${email}`
  return "unknown"
}

export function displayNameForResume(version: ResumeVersion): string {
  const name = version.contactInfo?.name?.trim()
  if (name) return name
  const email = version.contactInfo?.email?.trim()
  if (email) return email
  return "Unknown person"
}

export function groupResumesByPerson(versions: ResumeVersion[]): ResumePersonGroup[] {
  const map = new Map<string, ResumePersonGroup>()
  for (const version of versions) {
    if (!version.resumeText?.trim()) continue
    const key = personKeyForResume(version)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        displayName: displayNameForResume(version),
        email: version.contactInfo?.email?.trim() || null,
        versions: [version],
        templateCount: isResumeTemplateVersion(version) ? 1 : 0,
        withTextCount: 1,
        textChars: version.resumeText.length,
      })
      continue
    }
    existing.versions.push(version)
    existing.withTextCount += 1
    existing.textChars += version.resumeText.length
    if (isResumeTemplateVersion(version)) existing.templateCount += 1
    // Prefer a real name over "Unknown person" / email-only labels
    if (
      existing.displayName === "Unknown person" ||
      (existing.displayName.includes("@") && version.contactInfo?.name?.trim())
    ) {
      existing.displayName = displayNameForResume(version)
    }
    if (!existing.email && version.contactInfo?.email?.trim()) {
      existing.email = version.contactInfo.email.trim()
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.templateCount !== a.templateCount) return b.templateCount - a.templateCount
    if (b.withTextCount !== a.withTextCount) return b.withTextCount - a.withTextCount
    return b.textChars - a.textChars
  })
}

/**
 * Prefer an explicit owner hint; otherwise the strongest named identity
 * (most template CVs / richest text). Drops the anonymous bucket when named people exist.
 */
export function pickOwnResumePerson(
  versions: ResumeVersion[],
  ownerHint?: string | null,
): ResumePersonGroup | null {
  const groups = groupResumesByPerson(versions)
  if (groups.length === 0) return null

  const hint = normalizePersonPart(ownerHint)
  if (hint) {
    const matched = groups.find((g) => {
      const name = normalizePersonPart(g.displayName)
      const email = normalizePersonPart(g.email)
      return (
        g.key === `name:${hint}` ||
        g.key === `email:${hint}` ||
        name === hint ||
        email === hint ||
        name.includes(hint) ||
        hint.includes(name)
      )
    })
    if (matched) return matched
  }

  const named = groups.filter((g) => g.key !== "unknown")
  if (named.length > 0) return named[0]!
  return groups[0]!
}

/** Keep only CVs for one person (by group key or display-name hint). */
export function filterResumesToOwnPerson(
  versions: ResumeVersion[],
  options?: { ownerKey?: string | null; ownerHint?: string | null },
): ResumeVersion[] {
  const withText = versions.filter((v) => v.resumeText?.trim())
  if (withText.length === 0) return []

  if (options?.ownerKey) {
    const matched = withText.filter((v) => personKeyForResume(v) === options.ownerKey)
    if (matched.length > 0) return matched
  }

  const picked = pickOwnResumePerson(withText, options?.ownerHint)
  return picked?.versions ?? []
}
