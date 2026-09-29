/**
 * Resume-generation response parsing — separate from chat markdown and analysis JSON.
 */

const RESUME_SECTION_MARKERS =
  /^(PROFILE|EXPERIENCE|EDUCATION|SKILLS|LANGUAGES|PROJECTS|CERTIFICATIONS|SUMMARY|CONTACT|PROFIL|BERUFSERFAHRUNG|AUSBILDUNG|FÄHIGKEITEN|SPRACHEN|PROJEKTE|ZERTIFIKATE|ZUSAMMENFASSUNG|KONTAKT)\b/m

const SECTION_HEADER_RE = /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&().-]{2,}$/mu

export type CvParseDiagnostics = {
  length: number
  hasCodeFence: boolean
  hasHeading: boolean
  hasCompanyLine: boolean
  hasDateLine: boolean
  hasSectionHeader: boolean
  bulletCount: number
  lineCount: number
  looksLikeJson: boolean
  looksLikeChat: boolean
  usable: boolean
  recoveryAttempted: boolean
  recoveryMethod?: string
  preview: string
  validationError?: string
}

export type CvRecoveryResult = {
  text: string
  diagnostics: CvParseDiagnostics
  recoveryMethod?: string
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return trimmed.includes('"whatWorked"') || trimmed.includes('"summary"')
  }
}

function looksLikeChatResponse(text: string): boolean {
  const lower = text.toLowerCase()
  const chatMarkers = [
    "here is your tailored",
    "here's your tailored",
    "i've tailored",
    "i have tailored",
    "let me know if",
    "hope this helps",
    "as an ai",
    "certainly!",
    "sure!",
    "hier ist dein",
    "ich habe deinen",
  ]
  const firstLines = text.split("\n").slice(0, 4).join(" ").toLowerCase()
  return chatMarkers.some((m) => lower.includes(m) || firstLines.includes(m))
}

function stripChatPreamble(text: string): string {
  const lines = text.split("\n")
  const startIdx = lines.findIndex((line) => {
    const t = line.trim()
    if (!t) return false
    return (
      /^#{1,3}\s/.test(t) ||
      SECTION_HEADER_RE.test(t) ||
      RESUME_SECTION_MARKERS.test(t) ||
      (t.startsWith("- ") && t.length > 4)
    )
  })
  if (startIdx <= 0) return text.trim()
  return lines.slice(startIdx).join("\n").trim()
}

function stripChatPostamble(text: string): string {
  const lines = text.split("\n")
  const endMarkers = [
    /^let me know/i,
    /^feel free/i,
    /^i hope/i,
    /^hope this/i,
    /^if you('d| would) like/i,
    /^bitte lass/i,
    /^lass mich wissen/i,
  ]

  let endIdx = lines.length
  for (let i = Math.max(0, lines.length - 8); i < lines.length; i++) {
    const t = lines[i]?.trim() ?? ""
    if (endMarkers.some((re) => re.test(t))) {
      endIdx = i
      break
    }
  }

  return lines.slice(0, endIdx).join("\n").trim()
}

/** Remove markdown bold/italic noise the resume builder does not use. */
export function cleanupCvMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{4,6}\s+/gm, "### ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractCodeFenceBlocks(raw: string): string[] {
  const blocks: string[] = []
  const re = /```(?:markdown|md|text|txt)?\s*\n?([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const body = match[1]?.trim()
    if (body) blocks.push(body)
  }

  // Unclosed fence (model truncated output)
  const openFence = raw.match(/```(?:markdown|md|text|txt)?\s*\n([\s\S]+)$/i)
  if (openFence?.[1]?.trim()) {
    blocks.push(openFence[1].trim())
  }

  return blocks
}

function scoreCvCandidate(text: string): number {
  const t = cleanupCvMarkdown(text)
  if (!t) return 0
  if (looksLikeJson(t)) return -100

  let score = 0
  if (/^#\s+.+/m.test(t)) score += 3
  if (/^##\s+.+/m.test(t)) score += 3
  if (/^###\s+.+/m.test(t)) score += 2
  if (SECTION_HEADER_RE.test(t) || RESUME_SECTION_MARKERS.test(t)) score += 3
  score += Math.min((t.match(/^-\s/gm) ?? []).length, 10)
  score += Math.min(t.length / 200, 5)
  if (looksLikeChatResponse(t)) score -= 4
  return score
}

function pickBestCandidate(candidates: string[]): string {
  let best = ""
  let bestScore = -Infinity
  for (const candidate of candidates) {
    const score = scoreCvCandidate(candidate)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return cleanupCvMarkdown(best)
}

/** Extract resume markdown from an AI response (code fence or raw body). */
export function extractCvMarkdownFromAiResponse(raw: string): string {
  return recoverCvFromAiResponse(raw).text
}

/** Full recovery pipeline: extract → cleanup → repair. */
export function recoverCvFromAiResponse(raw: string): CvRecoveryResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      text: "",
      diagnostics: diagnoseCvMarkdown(""),
    }
  }

  const candidates: string[] = []
  const fences = extractCodeFenceBlocks(trimmed)

  // Prefer non-JSON fences; include all for scoring
  for (const block of fences) {
    if (!looksLikeJson(block)) candidates.push(block)
  }
  if (fences.length === 0) candidates.push(trimmed)

  const stripped = stripChatPostamble(stripChatPreamble(trimmed))
  candidates.push(stripped)

  const headingStart = stripped.split("\n")
  const startIdx = headingStart.findIndex((line) => {
    const t = line.trim()
    return (
      /^#{1,3}\s/.test(t) ||
      SECTION_HEADER_RE.test(t) ||
      RESUME_SECTION_MARKERS.test(t)
    )
  })
  if (startIdx >= 0) {
    candidates.push(headingStart.slice(startIdx).join("\n"))
  }

  const best = pickBestCandidate(candidates)
  const cleaned = cleanupCvMarkdown(best)
  const diagnostics = diagnoseCvMarkdown(cleaned)

  return {
    text: cleaned,
    diagnostics: {
      ...diagnostics,
      recoveryAttempted: true,
      recoveryMethod: fences.length > 0 ? "code_fence" : "raw_extraction",
    },
  }
}

export function isUsableCvMarkdown(text: string): boolean {
  return diagnoseCvMarkdown(text).usable
}

export function diagnoseCvMarkdown(text: string): CvParseDiagnostics {
  const t = cleanupCvMarkdown(text.trim())
  const hasCodeFence = /```/.test(text)
  const hasHeading = /^#\s+.+/m.test(t)
  const hasCompanyLine = /^##\s+.+/m.test(t)
  const hasDateLine = /^###\s+.+/m.test(t)
  const hasSectionHeader =
    SECTION_HEADER_RE.test(t) || RESUME_SECTION_MARKERS.test(t)
  const bulletCount = (t.match(/^-\s/gm) ?? []).length
  const lineCount = t.split("\n").filter((l) => l.trim().length > 0).length
  const jsonLike = looksLikeJson(t)
  const chatLike = looksLikeChatResponse(t)

  let usable = false
  let validationError: string | undefined

  if (!t) {
    validationError = "Empty response after extraction."
  } else if (jsonLike) {
    validationError = "Response looks like JSON analysis, not resume syntax."
  } else if (t.length < 60) {
    validationError = "Extracted content is too short."
  } else if (chatLike && !hasHeading && !hasSectionHeader) {
    validationError = "Response looks like a chat message, not resume syntax."
  } else if (hasHeading && (hasCompanyLine || hasSectionHeader) && bulletCount >= 1) {
    usable = true
  } else if (hasSectionHeader && bulletCount >= 2) {
    usable = true
  } else if (hasHeading && bulletCount >= 3) {
    usable = true
  } else if (hasSectionHeader && bulletCount >= 1 && lineCount >= 8) {
    usable = true
  } else if (lineCount >= 6 && bulletCount >= 2 && (hasHeading || hasSectionHeader)) {
    usable = true
  } else {
    validationError = "Missing required resume structure (# titles, ## companies, or section headers with bullets)."
  }

  return {
    length: t.length,
    hasCodeFence,
    hasHeading,
    hasCompanyLine,
    hasDateLine,
    hasSectionHeader,
    bulletCount,
    lineCount,
    looksLikeJson: jsonLike,
    looksLikeChat: chatLike,
    usable,
    recoveryAttempted: false,
    preview: t.slice(0, 200),
    validationError,
  }
}
