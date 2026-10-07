import { escapeHtmlText } from "./resume-inline-links"
import { loadUserProfile } from "./user-profile"
import type { FolderContactInfo, ResumeVersion } from "./types"

export type ResumeContactInfo = ResumeVersion["contactInfo"]

export const MAX_PORTFOLIO_URLS = 3

const PORTFOLIO_PLACEHOLDER_VALUES = new Set([
  "",
  "yourportfolio.com",
  "www.johndoe.com",
  "example.com",
  "https://example.com",
  "http://example.com",
])

/** True when a trimmed portfolio field value should be treated as empty. */
export function isMeaningfulPortfolioUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  if (PORTFOLIO_PLACEHOLDER_VALUES.has(lower)) return false
  if (/^(https?:\/\/)?(yourportfolio|example)\./i.test(trimmed)) return false
  return true
}

/** Collect up to 3 unique non-empty portfolio / website URLs (trimmed). */
export function normalizePortfolioUrls(...sources: unknown[]): string[] {
  const urls: string[] = []
  const push = (value: unknown) => {
    if (!isMeaningfulPortfolioUrl(value)) return
    const trimmed = value.trim()
    if (urls.includes(trimmed) || urls.length >= MAX_PORTFOLIO_URLS) return
    urls.push(trimmed)
  }

  for (const source of sources) {
    if (Array.isArray(source)) {
      source.forEach(push)
    } else {
      push(source)
    }
  }

  return urls
}

/** Show links on resume unless user explicitly turned them off; default on when URLs exist. */
export function resolveShowPortfolio(
  source: { showPortfolio?: unknown },
  portfolios: string[],
): boolean {
  if (source.showPortfolio === false) return false
  if (portfolios.length === 0) return false
  if (source.showPortfolio === true) return true
  return true
}

export function shouldShowPortfolioOnResume(
  contact: Pick<ResumeContactInfo, "portfolios" | "portfolio" | "showPortfolio">,
): boolean {
  return (
    contact.showPortfolio === true &&
    normalizePortfolioUrls(contact.portfolios, contact.portfolio).length > 0
  )
}

export function visiblePortfolioUrls(
  contact: Pick<ResumeContactInfo, "portfolios" | "portfolio" | "showPortfolio">,
): string[] {
  if (!shouldShowPortfolioOnResume(contact)) return []
  return normalizePortfolioUrls(contact.portfolios, contact.portfolio)
}

/** Missing/undefined showLinkedInOnCv means ON (existing CVs unchanged). */
export function resolveShowLinkedInOnCv(source: {
  showLinkedInOnCv?: unknown
}): boolean {
  return source.showLinkedInOnCv !== false
}

/** Show LinkedIn in header/PDF only when URL is set and not explicitly hidden. */
export function shouldShowLinkedInOnResume(
  contact: Pick<ResumeContactInfo, "linkedin" | "showLinkedInOnCv">,
): boolean {
  if (!contact.linkedin?.trim()) return false
  return resolveShowLinkedInOnCv(contact)
}

export function visibleLinkedInUrl(
  contact: Pick<ResumeContactInfo, "linkedin" | "showLinkedInOnCv">,
): string {
  if (!shouldShowLinkedInOnResume(contact)) return ""
  return contact.linkedin.trim()
}

/** Display label in header (no scheme, trimmed trailing slash). */
export function formatPortfolioUrlForDisplay(url: string): string {
  const trimmed = url.trim()
  if (!isMeaningfulPortfolioUrl(trimmed)) return ""

  try {
    const parsed = new URL(portfolioHref(trimmed))
    if (parsed.protocol === "mailto:") {
      return parsed.pathname || trimmed
    }
    const path =
      parsed.pathname && parsed.pathname !== "/"
        ? parsed.pathname.replace(/\/$/, "")
        : ""
    return `${parsed.host}${path}`
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/$/, "")
  }
}

export function portfolioHref(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`
}

/** True when the value looks like a web URL (with or without protocol). */
export function looksLikeJobAdvertUrl(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  return /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)
}

/** Prefer an existing advert field; otherwise use the application job posting URL. */
export function resolveJobAdvertSource(
  jobAdvertSource: string | null | undefined,
  jobDescriptionUrl?: string | null,
): string {
  const fromContact = jobAdvertSource?.trim() ?? ""
  if (fromContact) return fromContact
  return jobDescriptionUrl?.trim() ?? ""
}

/**
 * Fill empty `jobAdvertSource` from the linked application's posting URL
 * so Resume Tools shows the same link as application Edit.
 */
export function withJobAdvertFromApplication<
  T extends { jobAdvertSource?: string },
>(contact: T, jobDescriptionUrl?: string | null): T {
  const resolved = resolveJobAdvertSource(contact.jobAdvertSource, jobDescriptionUrl)
  if (!resolved || contact.jobAdvertSource?.trim() === resolved) return contact
  return { ...contact, jobAdvertSource: resolved }
}

/** Three form slots; empty strings are not stored in `portfolios`. */
export function portfolioInputSlots(
  portfolios?: string[] | null,
  legacyPortfolio?: string,
): [string, string, string] {
  const urls = normalizePortfolioUrls(portfolios, legacyPortfolio)
  return [urls[0] ?? "", urls[1] ?? "", urls[2] ?? ""]
}

export function applyPortfolioSlotUpdate<
  T extends { portfolios?: string[]; portfolio?: string; showPortfolio?: boolean },
>(contact: T, index: number, value: string): T & { portfolios: string[]; portfolio: string } {
  const slots = portfolioInputSlots(contact.portfolios, contact.portfolio)
  slots[index] = value
  const portfolios = normalizePortfolioUrls(slots)
  const next = {
    ...contact,
    portfolios,
    portfolio: portfolios[0] ?? "",
  } as T & { portfolios: string[]; portfolio: string }
  if ("showPortfolio" in contact) {
    return {
      ...next,
      showPortfolio:
        contact.showPortfolio === false
          ? false
          : resolveShowPortfolio(contact, portfolios),
    }
  }
  return next
}

export function defaultResumeContactInfo(
  overrides?: Partial<ResumeContactInfo>,
): ResumeContactInfo {
  const merged = {
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    showLinkedInOnCv: true as boolean | undefined,
    portfolio: "",
    portfolios: [] as string[],
    address: "",
    citizenship: "",
    showPortfolio: false,
    professionalTitle: "",
    language: "en" as const,
    targetCompany: "",
    targetRole: "",
    jobAdvertSource: "",
    ...overrides,
  }
  const portfolios = normalizePortfolioUrls(merged.portfolios, merged.portfolio)
  return {
    ...merged,
    portfolios,
    portfolio: portfolios[0] ?? "",
    showPortfolio: resolveShowPortfolio(merged, portfolios),
    showLinkedInOnCv: resolveShowLinkedInOnCv(merged),
  }
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

/** Normalize DB/local/contact_info blobs and merge optional folder defaults for missing fields. */
export function normalizeContactInfo(
  raw?: Partial<ResumeContactInfo> | Record<string, unknown> | null,
  folderFallback?: Partial<FolderContactInfo> | null,
): ResumeContactInfo {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const folder =
    folderFallback && typeof folderFallback === "object"
      ? (folderFallback as Record<string, unknown>)
      : {}

  const hasSourceFields = Object.keys(source).length > 0
  const portfolios = hasSourceFields
    ? normalizePortfolioUrls(source.portfolios, source.portfolio, source.website)
    : normalizePortfolioUrls(
        folder.portfolios,
        folder.portfolio,
        source.portfolios,
        source.portfolio,
        source.website,
      )

  return defaultResumeContactInfo({
    name: pickString(source.name, source.fullName, source.full_name, folder.name),
    email: pickString(source.email, folder.email),
    phone: pickString(source.phone, folder.phone),
    linkedin: pickString(source.linkedin, folder.linkedin),
    showLinkedInOnCv:
      source.showLinkedInOnCv === false || source.show_linkedin_on_cv === false
        ? false
        : true,
    address: pickString(source.address, source.location, folder.address),
    citizenship: pickString(source.citizenship, folder.citizenship),
    portfolios,
    portfolio: portfolios[0] ?? "",
    showPortfolio: resolveShowPortfolio(source, portfolios),
    professionalTitle: pickString(
      source.professionalTitle,
      source.professional_title,
      source.title,
      folder.professionalTitle,
    ),
    language:
      source.language === "de" || folder.language === "de" ? "de" : "en",
    targetCompany: pickString(source.targetCompany, source.target_company),
    targetRole: pickString(source.targetRole, source.target_role),
    jobAdvertSource: pickString(source.jobAdvertSource, source.job_advert_source),
  })
}

export function contactInfoFromResumeRecord(
  record: Record<string, unknown>,
  folderFallback?: Partial<FolderContactInfo> | null,
): ResumeContactInfo {
  const embedded = record.contactInfo ?? record.contact_info
  return normalizeContactInfo(
    embedded as Partial<ResumeContactInfo> | Record<string, unknown> | null,
    folderFallback,
  )
}

export function hasResumeContactContent(info: ResumeContactInfo): boolean {
  return Boolean(
    info.name.trim() ||
      info.email.trim() ||
      info.phone.trim() ||
      info.linkedin.trim() ||
      info.address.trim() ||
      info.professionalTitle.trim() ||
      normalizePortfolioUrls(info.portfolios, info.portfolio).length > 0,
  )
}

export function portfolioAnchorHtml(
  url: string,
  accentColor: string,
  linkStyle?: string,
): string {
  if (!isMeaningfulPortfolioUrl(url)) return ""
  const style =
    linkStyle ?? `color: ${accentColor}; text-decoration: underline;word-break:break-word;overflow-wrap:anywhere;`
  const label = formatPortfolioUrlForDisplay(url) || url.trim()
  return `<a href="${portfolioHref(url.trim())}" target="_blank" rel="noopener noreferrer" style="${style}">${escapeHtmlText(label)}</a>`
}

export function toFolderContactInfo(
  raw?: Partial<FolderContactInfo> | null,
): FolderContactInfo {
  const portfolios = normalizePortfolioUrls(raw?.portfolios, raw?.portfolio)
  return {
    name: raw?.name?.trim() ?? "",
    email: raw?.email?.trim() ?? "",
    phone: raw?.phone?.trim() ?? "",
    address: raw?.address?.trim() ?? "",
    linkedin: raw?.linkedin?.trim() ?? "",
    citizenship: raw?.citizenship?.trim() ?? "",
    portfolios,
    portfolio: portfolios[0] ?? "",
    professionalTitle: raw?.professionalTitle?.trim() ?? "",
    language: raw?.language === "de" ? "de" : "en",
  }
}

export function portfolioLinksJoinedHtml(
  urls: string[],
  accentColor: string,
  linkStyle?: string,
  separator = " | ",
): string {
  return normalizePortfolioUrls(urls)
    .map((url) => portfolioAnchorHtml(url, accentColor, linkStyle))
    .filter(Boolean)
    .join(separator)
}

/** Header fragment: optional "Portfolio:" label + joined links (nothing when no valid URLs). */
export function portfolioHeaderHtml(
  contact: Pick<ResumeContactInfo, "portfolios" | "portfolio" | "showPortfolio">,
  accentColor: string,
  options?: { label?: string; linkStyle?: string; prefix?: string },
): string {
  const urls = visiblePortfolioUrls(contact)
  if (urls.length === 0) return ""

  const links = portfolioLinksJoinedHtml(urls, accentColor, options?.linkStyle)
  if (!links) return ""

  const label = options?.label?.trim()
  const prefix = options?.prefix ?? ""
  if (label) {
    return `${prefix}${label}: ${links}`
  }
  return `${prefix}${links}`
}

function profileStorageContactFallback(): Partial<FolderContactInfo> | null {
  if (typeof window === "undefined") return null
  try {
    const profile = loadUserProfile()
    if (!profile?.name?.trim() && !profile?.email?.trim()) return null
    return {
      name: profile.name?.trim() || "",
      email: profile.email?.trim() || "",
    }
  } catch {
    return null
  }
}

/** Defaults for a new resume: workspace profile → latest saved resume in folder → app profile. */
export function getWorkspaceContactDefaults(
  folderContact?: Partial<FolderContactInfo> | null,
  versions: ResumeVersion[] = [],
): ResumeContactInfo {
  const fromFolder = normalizeContactInfo(undefined, folderContact)
  if (hasResumeContactContent(fromFolder)) {
    return fromFolder
  }

  const sorted = [...versions].sort(
    (a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0),
  )
  for (const version of sorted) {
    const fromResume = normalizeContactInfo(version.contactInfo, folderContact)
    if (hasResumeContactContent(fromResume)) {
      return fromResume
    }
  }

  return normalizeContactInfo(undefined, profileStorageContactFallback())
}
