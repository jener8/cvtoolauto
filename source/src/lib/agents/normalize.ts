import type { AgentApplyMethod, AgentSearchSettingsInput } from "@/lib/agents/types"

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

/** Strip HTML and collapse whitespace for raw listing storage / matching. */
export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(gmbh|ag|kg|ug|ltd|llc|inc|co|corp|company|se|mbh)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Cross-source fingerprint: title + company + location */
export function jobFingerprint(input: {
  title: string
  companyName: string
  location?: string | null
}): string {
  return [
    normalizeMatchText(input.title),
    normalizeCompanyName(input.companyName),
    normalizeMatchText(input.location ?? ""),
  ].join("|")
}

export function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_RE)
  if (!match) return null
  const email = match[0].toLowerCase()
  // Skip common non-apply addresses
  if (/(noreply|no-reply|example\.com|sentry|wixpress)/i.test(email)) return null
  return email
}

/**
 * Infer apply_method:
 * - email when a plausible contact address appears in listing text
 * - portal when a URL is present
 * - null otherwise (schema allows NULL)
 */
export function inferApplyMethod(input: {
  rawText: string
  url?: string | null
}): { applyMethod: AgentApplyMethod | null; emailTo: string | null } {
  const emailTo = extractEmail(input.rawText)
  if (emailTo) return { applyMethod: "email", emailTo }
  if (input.url?.trim()) return { applyMethod: "portal", emailTo: null }
  return { applyMethod: null, emailTo: null }
}

/** Rough listing language from text (+ preferred settings languages). */
export function detectListingLanguage(
  text: string,
  preferred: string[] = [],
): string | null {
  const lower = text.toLowerCase()
  const germanHits =
    (lower.match(/\b(und|oder|mit|für|bitte|bewerbung|stellenbeschreibung|aufgaben|wir)\b/g) ?? [])
      .length
  const englishHits =
    (lower.match(/\b(and|or|with|for|please|application|responsibilities|we)\b/g) ?? []).length

  let detected: string | null = null
  if (germanHits >= 3 && germanHits > englishHits) detected = "de"
  else if (englishHits >= 3 && englishHits > germanHits) detected = "en"

  if (preferred.length > 0) {
    const normalized = preferred.map((l) => l.trim().toLowerCase()).filter(Boolean)
    if (detected && normalized.some((l) => l === detected || l.startsWith(detected))) {
      return detected
    }
    if (!detected) return normalized[0] ?? null
  }
  return detected
}

export function parseIsoDate(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    // Arbeitnow created_at is unix seconds
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    const d = new Date(trimmed)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  return null
}

const SENIORITY_PATTERNS: Record<string, RegExp[]> = {
  intern: [/\bintern\b/i, /\bpraktikum\b/i, /\btrainee\b/i, /\bwerkstudent\b/i],
  junior: [/\bjunior\b/i, /\bentry[- ]?level\b/i, /\beinsteiger\b/i],
  mid: [/\bmid[- ]?level\b/i, /\bmedior\b/i],
  senior: [/\bsenior\b/i, /\bsr\.?\b/i],
  lead: [/\blead\b/i, /\bprincipal\b/i, /\bstaff\b/i, /\bhead of\b/i, /\bdirector\b/i],
}

export function matchesSeniority(title: string, seniority: string | null | undefined): boolean {
  if (!seniority?.trim()) return true
  const key = seniority.trim().toLowerCase()
  const patterns = SENIORITY_PATTERNS[key]
  if (!patterns) {
    // Free-text seniority: require substring in title
    return title.toLowerCase().includes(key)
  }
  return patterns.some((re) => re.test(title))
}

export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords.length) return true
  const hay = text.toLowerCase()
  return keywords.some((kw) => {
    const needle = kw.trim().toLowerCase()
    return needle.length > 0 && hay.includes(needle)
  })
}

export function matchesLocation(
  jobLocation: string | null | undefined,
  wanted: string,
  remoteWanted: boolean,
  isRemote: boolean,
): boolean {
  if (remoteWanted && isRemote) return true
  if (!wanted.trim()) return true
  const loc = (jobLocation ?? "").toLowerCase()
  const want = wanted.trim().toLowerCase()
  if (!loc) return remoteWanted ? isRemote : true
  return loc.includes(want) || want.includes(loc)
}

export function matchesLanguageFilter(
  listingLanguage: string | null,
  rawText: string,
  languages: string[],
): boolean {
  if (!languages.length) return true
  const prefs = languages.map((l) => l.trim().toLowerCase()).filter(Boolean)
  if (!prefs.length) return true
  const detected = (listingLanguage ?? detectListingLanguage(rawText) ?? "").toLowerCase()
  if (!detected) return true
  return prefs.some(
    (p) =>
      detected === p ||
      detected.startsWith(p) ||
      p.startsWith(detected) ||
      (p === "german" && detected === "de") ||
      (p === "english" && detected === "en") ||
      (p === "deutsch" && detected === "de"),
  )
}

export function sanitizeSearchSettingsInput(
  body: AgentSearchSettingsInput,
): {
  keywords: string[]
  location: string
  remote: boolean
  languages: string[]
  seniority: string | null
  targetCompanies: string[]
} {
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 40)
    : []
  const languages = Array.isArray(body.languages)
    ? body.languages.map((l) => String(l).trim()).filter(Boolean).slice(0, 20)
    : []
  const location =
    typeof body.location === "string" && body.location.trim()
      ? body.location.trim().slice(0, 120)
      : "Berlin"
  const remote = Boolean(body.remote)
  const seniority =
    typeof body.seniority === "string" && body.seniority.trim()
      ? body.seniority.trim().slice(0, 60)
      : null
  const targetCompanies = Array.isArray(body.targetCompanies)
    ? body.targetCompanies.map((c) => String(c).trim()).filter(Boolean).slice(0, 40)
    : []
  return { keywords, location, remote, languages, seniority, targetCompanies }
}
