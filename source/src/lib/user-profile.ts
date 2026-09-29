import type { LinkedInProfileSections } from "@/lib/linkedin-profile-types"
import { coerceLinkedInSections } from "@/lib/linkedin-profile-sections"
import type { LinkedInSyncDebug, LinkedInSyncStatus } from "@/lib/linkedin-sync-types"

export const PROFILE_STORAGE_KEY = "profile"

export interface UserProfile {
  name: string
  email: string
  password?: string
  /** Canonical LinkedIn profile URL for import/sync */
  linkedInProfileUrl?: string
  /** Last successfully imported profile text (CV source) */
  linkedInProfileText?: string
  /** Structured sections from last successful sync */
  linkedInProfileSections?: LinkedInProfileSections
  linkedInLastSyncAt?: number | null
  linkedInLastSyncAttemptAt?: number | null
  linkedInLastSyncError?: string | null
  linkedInLastSyncStatus?: LinkedInSyncStatus | null
  linkedInSyncDebug?: LinkedInSyncDebug | null
  linkedInScrapeBlocked?: boolean
}

const LINKEDIN_PROFILE_PATH = /^\/in\/[a-zA-Z0-9%-]+(?:\/[a-z]{2})?\/?$/i

const TRACKING_QUERY_PREFIXES = ["utm_", "trk", "trkInfo", "lipi", "refId", "ref"]

/** Strip tracking query params and hash; keep only linkedin.com/in/slug path. */
export function normalizeLinkedInProfileUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let url: URL
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    url = new URL(withProtocol)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase()
  if (host !== "linkedin.com") return null

  let path = url.pathname.replace(/\/+$/, "") || "/"
  // Drop locale suffix e.g. /in/name/en -> /in/name
  const inMatch = path.match(/^\/in\/([^/]+)(?:\/[a-z]{2})?$/i)
  if (!inMatch) {
    if (!LINKEDIN_PROFILE_PATH.test(path)) return null
  } else {
    path = `/in/${inMatch[1]}`
  }

  if (!LINKEDIN_PROFILE_PATH.test(path)) return null

  const slug = path.split("/")[2]
  if (!slug || slug.length < 2) return null

  return `https://www.linkedin.com/in/${decodeURIComponent(slug)}`
}

export function validateLinkedInProfileUrl(raw: string): {
  valid: boolean
  normalized: string | null
  error?: string
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { valid: false, normalized: null, error: "URL is required" }
  }
  if (!/linkedin\.com/i.test(trimmed)) {
    return {
      valid: false,
      normalized: null,
      error: "URL must be a linkedin.com profile link",
    }
  }
  if (!/\/in\//i.test(trimmed)) {
    return {
      valid: false,
      normalized: null,
      error: "Use a profile URL like https://www.linkedin.com/in/your-name",
    }
  }
  const normalized = normalizeLinkedInProfileUrl(trimmed)
  if (!normalized) {
    return {
      valid: false,
      normalized: null,
      error: "Invalid LinkedIn profile URL format",
    }
  }
  return { valid: true, normalized }
}

export function isValidLinkedInProfileUrl(raw: string): boolean {
  return normalizeLinkedInProfileUrl(raw) !== null
}

export function loadUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    if (typeof parsed !== "object" || parsed === null) return null
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      password: typeof parsed.password === "string" ? parsed.password : undefined,
      linkedInProfileUrl:
        typeof parsed.linkedInProfileUrl === "string"
          ? parsed.linkedInProfileUrl
          : undefined,
      linkedInProfileText:
        typeof parsed.linkedInProfileText === "string"
          ? parsed.linkedInProfileText
          : undefined,
      linkedInProfileSections:
        parsed.linkedInProfileSections != null || parsed.linkedInProfileText
          ? coerceLinkedInSections(
              parsed.linkedInProfileSections,
              typeof parsed.linkedInProfileText === "string" ? parsed.linkedInProfileText : null,
            )
          : undefined,
      linkedInLastSyncAt:
        typeof parsed.linkedInLastSyncAt === "number" ? parsed.linkedInLastSyncAt : null,
      linkedInLastSyncAttemptAt:
        typeof parsed.linkedInLastSyncAttemptAt === "number"
          ? parsed.linkedInLastSyncAttemptAt
          : null,
      linkedInLastSyncError:
        typeof parsed.linkedInLastSyncError === "string"
          ? parsed.linkedInLastSyncError
          : null,
      linkedInLastSyncStatus:
        parsed.linkedInLastSyncStatus === "synced" ||
        parsed.linkedInLastSyncStatus === "partial" ||
        parsed.linkedInLastSyncStatus === "blocked" ||
        parsed.linkedInLastSyncStatus === "failed"
          ? parsed.linkedInLastSyncStatus
          : null,
      linkedInSyncDebug:
        parsed.linkedInSyncDebug && typeof parsed.linkedInSyncDebug === "object"
          ? (parsed.linkedInSyncDebug as LinkedInSyncDebug)
          : null,
      linkedInScrapeBlocked: Boolean(parsed.linkedInScrapeBlocked),
    }
  } catch {
    return null
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return
  const normalized: UserProfile = { ...profile }
  if (profile.linkedInProfileUrl?.trim()) {
    const canonical = normalizeLinkedInProfileUrl(profile.linkedInProfileUrl)
    if (canonical) normalized.linkedInProfileUrl = canonical
  }
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized))
}

export function patchUserProfile(patch: Partial<UserProfile>): UserProfile {
  const existing = loadUserProfile() ?? { name: "", email: "" }
  const merged: UserProfile = { ...existing, ...patch }
  saveUserProfile(merged)
  return merged
}

export function formatLinkedInLastSync(timestamp: number | null | undefined): string {
  if (!timestamp) return "Never synced"
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return "Never synced"
  }
}
