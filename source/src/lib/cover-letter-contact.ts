import type { ContactInfo, ResumeVersion } from "@/lib/types"
import type { UserProfile } from "@/lib/user-profile"

export type CoverLetterApplicantContact = {
  applicantName: string
  applicantAddress: string
  applicantEmail: string
  applicantPhone: string
  letterDate: string
}

export type CoverLetterContactSources = {
  coverLetter?: Partial<CoverLetterApplicantContact> | null
  userProfile?: Pick<UserProfile, "name" | "email"> | null
  resumeContact?: Partial<ContactInfo> | null
  language?: "en" | "de"
}

const BRACKET_PLACEHOLDER = /^\[[^\]]+\]$/

const KNOWN_PLACEHOLDER_PATTERNS = [
  /^\[your\s+name\]$/i,
  /^\[your\s+address\]$/i,
  /^\[city[,\s].*\]$/i,
  /^\[email\s+address\]$/i,
  /^\[phone\s+number\]$/i,
  /^\[date\]$/i,
  /^\[datum\]$/i,
  /^\[ihr\s+name\]$/i,
  /^\[ihre\s+adresse\]$/i,
  /^\[e-?mail\]$/i,
  /^\[telefon\]$/i,
]

export function isCoverLetterPlaceholder(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (BRACKET_PLACEHOLDER.test(trimmed)) return true
  return KNOWN_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function sanitizeCoverLetterField(value: string | undefined | null): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed || isCoverLetterPlaceholder(trimmed)) return ""
  return trimmed
}

function pickField(...values: (string | undefined | null)[]): string {
  for (const value of values) {
    const sanitized = sanitizeCoverLetterField(value)
    if (sanitized) return sanitized
  }
  return ""
}

export function formatCoverLetterDate(language: "en" | "de", date: Date = new Date()): string {
  return date.toLocaleDateString(language === "en" ? "en-US" : "de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * True when the letter body already opens with a greeting so the template
 * must not insert a second "Dear Sir or Madam," / "Sehr geehrte …".
 */
export function letterBodyStartsWithSalutation(body: string): boolean {
  const firstLine =
    body
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  if (!firstLine) return false
  return /^(dear|hello|hi|to\s+the|sehr\s+geehrte|hallo|guten\s+tag)\b/i.test(firstLine)
}

/**
 * Template salutation from recipient fields — used only when the body does
 * not already include its own greeting.
 */
export function resolveCoverLetterSalutation(options: {
  hiringManager?: string | null
  language: "en" | "de"
  bodyText?: string | null
}): string | null {
  if (letterBodyStartsWithSalutation(options.bodyText ?? "")) return null
  const manager = sanitizeCoverLetterField(options.hiringManager)
  if (manager) {
    return options.language === "en"
      ? `Dear ${manager},`
      : `Sehr geehrte/r ${manager},`
  }
  return options.language === "en" ? "Dear Sir or Madam," : "Sehr geehrte Damen und Herren,"
}

function pickSavedOrFallback(
  coverLetter: Partial<CoverLetterApplicantContact> | null | undefined,
  key: keyof CoverLetterApplicantContact,
  ...fallbacks: (string | undefined | null)[]
): string {
  if (coverLetter && key in coverLetter) {
    return sanitizeCoverLetterField(coverLetter[key])
  }
  return pickField(...fallbacks)
}


export type PrefillResumeSource = Pick<
  ResumeVersion,
  "id" | "contactInfo" | "updatedAt" | "createdAt" | "timestamp"
>

function resumeEditTime(version: PrefillResumeSource): number {
  return version.updatedAt ?? version.createdAt ?? version.timestamp ?? 0
}

/**
 * Prefer the linked CV's contactInfo; if missing, use the most recently edited
 * CV in the provided workspace list.
 */
export function resolvePrefillResumeContact(options: {
  linkedResumeId?: string | null
  resumeVersions: PrefillResumeSource[]
  contactInfoProp?: Partial<ContactInfo> | null
}): Partial<ContactInfo> | null {
  const { linkedResumeId, resumeVersions, contactInfoProp } = options
  const linked = linkedResumeId
    ? resumeVersions.find((version) => version.id === linkedResumeId)
    : undefined
  if (linked?.contactInfo) return linked.contactInfo
  if (contactInfoProp) return contactInfoProp
  if (resumeVersions.length === 0) return null
  const sorted = [...resumeVersions].sort((a, b) => resumeEditTime(b) - resumeEditTime(a))
  return sorted[0]?.contactInfo ?? null
}

/**
 * Prefill sender fields for a NEW cover letter from CV contact only.
 * Empty / placeholder CV values stay empty — never invent placeholders as values.
 */
export function buildNewCoverLetterApplicantPrefill(options: {
  resumeContact?: Partial<ContactInfo> | null
  language?: "en" | "de"
}): CoverLetterApplicantContact {
  const language = options.language ?? "en"
  const resume = options.resumeContact
  return {
    applicantName: sanitizeCoverLetterField(resume?.name),
    applicantAddress: sanitizeCoverLetterField(resume?.address),
    applicantEmail: sanitizeCoverLetterField(resume?.email),
    applicantPhone: sanitizeCoverLetterField(resume?.phone),
    letterDate: formatCoverLetterDate(language),
  }
}

/** True when the letter already stores any real applicant field (do not re-prefill). */
export function coverLetterHasSavedApplicantDetails(
  coverLetter?: Partial<CoverLetterApplicantContact> | null,
): boolean {
  if (!coverLetter) return false
  return Boolean(
    sanitizeCoverLetterField(coverLetter.applicantName) ||
      sanitizeCoverLetterField(coverLetter.applicantAddress) ||
      sanitizeCoverLetterField(coverLetter.applicantEmail) ||
      sanitizeCoverLetterField(coverLetter.applicantPhone),
  )
}

export const COVER_LETTER_PREFILL_NOTE = {
  en: "Filled in from your CV. You can change anything here.",
  de: "Aus Ihrem Lebenslauf übernommen. Sie können hier alles ändern.",
} as const

/** Fallback: cover letter details → user profile → resume contact. */
export function resolveCoverLetterApplicantContact(
  sources: CoverLetterContactSources,
): CoverLetterApplicantContact {
  const language = sources.language ?? "en"
  const coverLetter = sources.coverLetter
  const profile = sources.userProfile
  const resume = sources.resumeContact

  const letterDate = pickSavedOrFallback(coverLetter, "letterDate")

  return {
    applicantName: pickSavedOrFallback(
      coverLetter,
      "applicantName",
      profile?.name,
      resume?.name,
    ),
    applicantAddress: pickSavedOrFallback(coverLetter, "applicantAddress", resume?.address),
    applicantEmail: pickSavedOrFallback(
      coverLetter,
      "applicantEmail",
      profile?.email,
      resume?.email,
    ),
    applicantPhone: pickSavedOrFallback(coverLetter, "applicantPhone", resume?.phone),
    letterDate: letterDate || formatCoverLetterDate(language),
  }
}

const SALUTATION_START =
  /^(dear|sehr\s+geehrte|to\s+whom|hello|hi)\b/i

function isLikelyHeaderLine(line: string, language: "en" | "de"): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (isCoverLetterPlaceholder(trimmed)) return true
  if (SALUTATION_START.test(trimmed)) return false
  if (/^(sincerely|mit\s+freundlichen|best\s+regards|kind\s+regards)/i.test(trimmed)) {
    return true
  }
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(trimmed)) return true
  if (
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(
      trimmed,
    )
  ) {
    return true
  }
  if (
    /^\d{1,2}\.\s*(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/i.test(
      trimmed,
    )
  ) {
    return true
  }
  if (language === "de" && /^\d{1,2}\.\s+\w+\s+\d{4}$/.test(trimmed)) return true
  return false
}

/** Remove placeholder lines and common AI header blocks from generated body text. */
export function stripCoverLetterContactFromBody(text: string, language: "en" | "de" = "en"): string {
  const lines = text.replace(/^\uFEFF/, "").split("\n")
  const cleaned: string[] = []
  let inLeadingHeader = true

  for (const line of lines) {
    const trimmed = line.trim()

    if (inLeadingHeader) {
      if (!trimmed) continue
      if (isLikelyHeaderLine(trimmed, language)) continue
      if (SALUTATION_START.test(trimmed)) {
        inLeadingHeader = false
        cleaned.push(line)
        continue
      }
      inLeadingHeader = false
    }

    if (isCoverLetterPlaceholder(trimmed)) continue
    cleaned.push(line)
  }

  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function cleanCoverLetterBody(text: string, language: "en" | "de" = "en"): string {
  let cleaned = text.trim()
  const fenced = cleaned.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/m)
  if (fenced?.[1]) cleaned = fenced[1].trim()
  return stripCoverLetterContactFromBody(cleaned.replace(/^\uFEFF/, "").trim(), language)
}
