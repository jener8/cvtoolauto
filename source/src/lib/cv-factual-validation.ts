/**
 * Post-generation checks: experience bullets must trace to source CV;
 * block verbatim job-description copying and invented employers.
 */

const EXPERIENCE_SECTION_MARKERS = new Set([
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "berufserfahrung",
  "erfahrung",
  "projects",
  "projekte",
])

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "being",
  "both",
  "from",
  "have",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "were",
  "what",
  "when",
  "which",
  "while",
  "with",
  "would",
  "your",
  "and",
  "for",
  "the",
  "are",
  "was",
  "will",
  "our",
  "you",
  "not",
  "but",
  "can",
  "all",
  "any",
  "may",
  "new",
  "now",
  "out",
  "use",
  "how",
  "its",
  "who",
  "bei",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "und",
  "mit",
  "von",
  "zum",
  "zur",
  "auf",
  "als",
  "auch",
  "nach",
  "oder",
  "über",
  "für",
  "ist",
  "sind",
  "war",
  "wir",
  "sie",
  "ihr",
  "nicht",
  "nur",
  "noch",
  "werden",
  "wurde",
  "haben",
  "hatte",
])

export type CvFactualFlagReason =
  | "ungrounded_bullet"
  | "jd_verbatim_copy"
  | "unknown_employer"

export type FlaggedCvBullet = {
  bullet: string
  reason: CvFactualFlagReason
  company?: string
}

export type CvFactualValidationResult = {
  sanitizedCv: string
  flagged: FlaggedCvBullet[]
  removedCount: number
  unknownEmployers: string[]
  /** Employers removed from output because they were not grounded in the source CV. */
  strippedEmployers?: string[]
}

export type CvFactualValidationOptions = {
  selectionText?: string
  logTag?: string
  /** When true, do not strip unknown employer entries (Apply anyway). */
  skipEmployerRemoval?: boolean
  /** When merging/compressing roles, allow bullets that synthesize multiple source entries. */
  relaxedBulletGrounding?: boolean
}

export function formatUnknownEmployerError(employers: string[]): string {
  if (employers.length === 0) {
    return "Validation failed: the edit introduced employers not found in your CV. Your original version was not changed."
  }
  if (employers.length === 1) {
    return `Blocked because this employer was not found in your CV: ${employers[0]}`
  }
  return `Blocked because these employers were not found in your CV: ${employers.join(", ")}`
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function significantTokens(text: string): Set<string> {
  const tokens = normalizeText(text).split(" ").filter(Boolean)
  const out = new Set<string>()
  for (const t of tokens) {
    if (t.length >= 4 && !STOPWORDS.has(t)) out.add(t)
  }
  return out
}

function tokenOverlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) {
    if (b.has(t)) shared++
  }
  return shared / Math.min(a.size, b.size)
}

function extractBaseCompanyName(name: string): string {
  const trimmed = name.trim()
  const split = trimmed.split(/\s*[—–]\s*|\s*,\s*|\s+@\s+|\s+\bat\b\s+/i)
  return (split[0] ?? trimmed).trim()
}

function normalizeEmployerKey(name: string): string {
  return normalizeText(extractBaseCompanyName(name))
}

function normalizeCompany(name: string): string {
  return normalizeEmployerKey(name).replace(/\s+/g, "")
}

function companiesMatch(generated: string, source: string): boolean {
  const gKey = normalizeEmployerKey(generated)
  const sKey = normalizeEmployerKey(source)
  if (!gKey || !sKey) return true

  const gCompact = gKey.replace(/\s+/g, "")
  const sCompact = sKey.replace(/\s+/g, "")
  if (gCompact === sCompact) return true
  if (gCompact.length >= 4 && sCompact.length >= 4 && (gCompact.includes(sCompact) || sCompact.includes(gCompact))) {
    return true
  }

  const gTokens = gKey.split(" ").filter((t) => t.length >= 3)
  const sTokens = sKey.split(" ").filter((t) => t.length >= 3)
  if (gTokens.length === 0 || sTokens.length === 0) return false

  let shared = 0
  const sSet = new Set(sTokens)
  for (const token of gTokens) {
    if (sSet.has(token)) shared++
  }
  return shared >= 1 && shared / Math.min(gTokens.length, sTokens.length) >= 0.5
}

function isBlockedEmployer(company: string, blockedEmployers: string[]): boolean {
  return blockedEmployers.some((blocked) => companiesMatch(company, blocked))
}

function looksLikeCompanyLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 2 || trimmed.length > 120) return false
  if (trimmed.startsWith("- ") || trimmed.startsWith("### ")) return false
  if (/^#{1,3}\s/.test(trimmed)) return false
  if (/,/.test(trimmed) && /[A-Za-z]/.test(trimmed)) return true
  if (/^[A-Z][A-Za-z0-9&.'\s-]+$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) return true
  return false
}

function employerMentionedInText(employer: string, text: string): boolean {
  const base = normalizeEmployerKey(employer)
  if (!base || base.length < 3) return true
  const haystack = normalizeText(text)
  if (haystack.includes(base)) return true
  const compact = base.replace(/\s+/g, "")
  return compact.length >= 4 && haystack.replace(/\s+/g, "").includes(compact)
}

function extractEmployersFromCv(cv: string): string[] {
  const employers = new Set<string>()
  let activeSection: ActiveSection = "none"

  for (const line of extractAllLines(cv)) {
    if (isSectionHeader(line)) {
      if (experienceSectionKey(line)) activeSection = "experience"
      else if (educationSectionKey(line)) activeSection = "education"
      else activeSection = "other"
      continue
    }

    if (line.startsWith("## ")) {
      employers.add(line.slice(3).trim())
      continue
    }

    if (activeSection === "experience" && looksLikeCompanyLine(line)) {
      employers.add(line.trim())
    }
  }

  return [...employers]
}

function isSectionHeader(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^#{1,3}\s/.test(t)) return false
  if (/^-\s/.test(t)) return false
  if (t.startsWith("---")) return false
  return /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&-]{2,}$/.test(t) || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(t)
}

const EDUCATION_SECTION_MARKERS = new Set([
  "education",
  "ausbildung",
  "studium",
  "qualifications",
])

function experienceSectionKey(line: string): boolean {
  const key = normalizeText(line)
  for (const marker of EXPERIENCE_SECTION_MARKERS) {
    if (key === marker || key.startsWith(`${marker} `)) return true
  }
  return false
}

function educationSectionKey(line: string): boolean {
  const key = normalizeText(line)
  for (const marker of EDUCATION_SECTION_MARKERS) {
    if (key === marker || key.startsWith(`${marker} `)) return true
  }
  return false
}

type ActiveSection = "none" | "experience" | "education" | "other"

function extractAllLines(cv: string): string[] {
  return cv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function extractBullets(cv: string): string[] {
  return extractAllLines(cv)
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean)
}

function extractCompanies(cv: string): string[] {
  return extractEmployersFromCv(cv)
}

function splitEmployerParts(company: string): string[] {
  return company
    .split(/\s*&\s*|\s*,\s*|\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function allEmployerPartsKnown(
  company: string,
  sourceEmployers: string[],
  sourceCv: string,
  selectionText?: string,
): boolean {
  const parts = splitEmployerParts(company)
  if (parts.length <= 1) return false
  const selectionEmployers = selectionText ? extractEmployersFromCv(selectionText) : []
  return parts.every(
    (part) =>
      sourceEmployers.some((source) => companiesMatch(part, source)) ||
      employerMentionedInText(part, sourceCv) ||
      selectionEmployers.some((source) => companiesMatch(part, source)) ||
      (selectionText ? employerMentionedInText(part, selectionText) : false),
  )
}
function resolveUnknownEmployers(input: {
  generatedCompanies: string[]
  sourceEmployers: string[]
  sourceCv: string
  selectionText?: string
}): string[] {
  const selectionEmployers = input.selectionText
    ? extractEmployersFromCv(input.selectionText)
    : []

  return input.generatedCompanies.filter((generated) => {
    if (allEmployerPartsKnown(generated, input.sourceEmployers, input.sourceCv, input.selectionText)) {
      return false
    }
    if (input.sourceEmployers.some((source) => companiesMatch(generated, source))) return false
    if (employerMentionedInText(generated, input.sourceCv)) return false
    if (input.selectionText && employerMentionedInText(generated, input.selectionText)) return false
    if (selectionEmployers.some((source) => companiesMatch(generated, source))) return false
    return true
  })
}

function logEmployerValidation(
  logTag: string | undefined,
  payload: Record<string, unknown>,
): void {
  if (!logTag) return
  console.info(`[${logTag}] employer validation`, payload)
}

function extractJdPhrases(jobDescription: string): string[] {
  return jobDescription
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28)
    .map(normalizeText)
}

function buildSourceTokenIndex(sourceCv: string): {
  allLines: string[]
  allLineNorms: string[]
  allBullets: string[]
  bulletTokenSets: Set<string>[]
  companies: string[]
} {
  const allLines = extractAllLines(sourceCv)
  const allLineNorms = allLines.map(normalizeText)
  const allBullets = extractBullets(sourceCv)
  const bulletTokenSets = allBullets.map(significantTokens)
  const companies = extractCompanies(sourceCv)
  return { allLines, allLineNorms, allBullets, bulletTokenSets, companies }
}

function isGroundedInSource(
  bullet: string,
  sourceIndex: ReturnType<typeof buildSourceTokenIndex>,
): boolean {
  const bulletTokens = significantTokens(bullet)
  if (bulletTokens.size === 0) return true

  let maxOverlap = 0
  for (const sourceTokens of sourceIndex.bulletTokenSets) {
    maxOverlap = Math.max(maxOverlap, tokenOverlapRatio(bulletTokens, sourceTokens))
  }

  for (const lineNorm of sourceIndex.allLineNorms) {
    const lineTokens = significantTokens(lineNorm)
    maxOverlap = Math.max(maxOverlap, tokenOverlapRatio(bulletTokens, lineTokens))
  }

  if (maxOverlap >= 0.22) return true

  let sharedCount = 0
  const sourceUnion = new Set<string>()
  for (const s of sourceIndex.bulletTokenSets) {
    for (const t of s) sourceUnion.add(t)
  }
  for (const t of bulletTokens) {
    if (sourceUnion.has(t)) sharedCount++
  }
  return sharedCount >= 2
}

function isVerbatimJdCopy(
  bullet: string,
  jdPhrases: string[],
  sourceIndex: ReturnType<typeof buildSourceTokenIndex>,
): boolean {
  const bulletNorm = normalizeText(bullet)
  for (const phrase of jdPhrases) {
    if (phrase.length < 28) continue
    if (!bulletNorm.includes(phrase)) continue
    const inSource = sourceIndex.allLineNorms.some(
      (line) => line.includes(phrase) || phrase.includes(line),
    )
    if (!inSource) return true
  }
  return false
}

function bulletShouldExclude(
  bullet: string,
  company: string | undefined,
  sourceIndex: ReturnType<typeof buildSourceTokenIndex>,
  jdPhrases: string[],
  blockedEmployers: string[],
  relaxedBulletGrounding = false,
): CvFactualFlagReason | null {
  if (
    company &&
    !relaxedBulletGrounding &&
    isBlockedEmployer(company, blockedEmployers)
  ) {
    return "unknown_employer"
  }
  if (
    company &&
    relaxedBulletGrounding &&
    !allEmployerPartsKnown(company, sourceIndex.companies, sourceIndex.allLines.join("\n")) &&
    isBlockedEmployer(company, blockedEmployers)
  ) {
    return "unknown_employer"
  }
  if (isVerbatimJdCopy(bullet, jdPhrases, sourceIndex)) {
    return "jd_verbatim_copy"
  }
  if (!relaxedBulletGrounding && !isGroundedInSource(bullet, sourceIndex)) {
    return "ungrounded_bullet"
  }
  if (relaxedBulletGrounding && !isGroundedInSource(bullet, sourceIndex)) {
    const bulletTokens = significantTokens(bullet)
    if (bulletTokens.size === 0) return null
    let shared = 0
    const sourceUnion = new Set<string>()
    for (const tokenSet of sourceIndex.bulletTokenSets) {
      for (const token of tokenSet) sourceUnion.add(token)
    }
    for (const token of bulletTokens) {
      if (sourceUnion.has(token)) shared++
    }
    if (shared < 1) return "ungrounded_bullet"
  }
  return null
}

export function validateAndSanitizeTailoredCv(input: {
  sourceCv: string
  jobDescription: string
  generatedCv: string
  options?: CvFactualValidationOptions
}): CvFactualValidationResult {
  const options = input.options
  const sourceIndex = buildSourceTokenIndex(input.sourceCv)
  const jdPhrases = extractJdPhrases(input.jobDescription)
  const generatedCompanies = extractEmployersFromCv(input.generatedCv)
  const sourceEmployers = sourceIndex.companies

  const sourceHasStructuredCompanies = sourceEmployers.length > 0
  const sourceHasStructuredBullets = sourceIndex.bulletTokenSets.length > 0

  const unknownEmployers =
    options?.skipEmployerRemoval
      ? []
      : resolveUnknownEmployers({
          generatedCompanies,
          sourceEmployers,
          sourceCv: input.sourceCv,
          selectionText: options?.selectionText,
        })

  logEmployerValidation(options?.logTag, {
    allowedEmployers: sourceEmployers,
    generatedEmployers: generatedCompanies,
    flaggedNewEmployers: unknownEmployers,
    selectionTextPreview: options?.selectionText?.slice(0, 160),
    sourceCvEmployers: sourceEmployers,
  })

  const blockedEmployers = unknownEmployers
  const relaxedBulletGrounding = Boolean(options?.relaxedBulletGrounding)

  const lines = input.generatedCv.split("\n")
  const flagged: FlaggedCvBullet[] = []
  let currentCompany: string | undefined
  let activeSection: ActiveSection = "none"
  const outputLines: string[] = []

  for (const raw of lines) {
    const line = raw
    const trimmed = line.trim()

    if (trimmed && isSectionHeader(trimmed)) {
      if (experienceSectionKey(trimmed)) activeSection = "experience"
      else if (educationSectionKey(trimmed)) activeSection = "education"
      else activeSection = "other"
      currentCompany = undefined
      outputLines.push(line)
      continue
    }

    if (trimmed.startsWith("## ")) {
      currentCompany = trimmed.slice(3).trim()
      if (
        activeSection === "experience" &&
        sourceHasStructuredCompanies &&
        !allEmployerPartsKnown(currentCompany, sourceEmployers, input.sourceCv, options?.selectionText) &&
        isBlockedEmployer(currentCompany, blockedEmployers)
      ) {
        flagged.push({
          bullet: `(entry) ${currentCompany}`,
          reason: "unknown_employer",
          company: currentCompany,
        })
      }
      outputLines.push(line)
      continue
    }

    if (activeSection === "experience" && trimmed.startsWith("- ")) {
      const bullet = trimmed.slice(2).trim()
      const reason =
        sourceHasStructuredBullets || sourceHasStructuredCompanies
          ? bulletShouldExclude(
              bullet,
              currentCompany,
              sourceIndex,
              jdPhrases,
              blockedEmployers,
              relaxedBulletGrounding,
            )
          : isVerbatimJdCopy(bullet, jdPhrases, sourceIndex)
            ? "jd_verbatim_copy"
            : null
      if (reason) {
        flagged.push({ bullet, reason, company: currentCompany })
        continue
      }
    }

    if (
      activeSection === "experience" &&
      sourceHasStructuredCompanies &&
      currentCompany &&
      !allEmployerPartsKnown(currentCompany, sourceEmployers, input.sourceCv, options?.selectionText) &&
      isBlockedEmployer(currentCompany, blockedEmployers) &&
      (trimmed.startsWith("# ") || trimmed.startsWith("### "))
    ) {
      continue
    }

    outputLines.push(line)
  }

  let sanitizedCv = outputLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()

  const strippedEmployers =
    !options?.skipEmployerRemoval && unknownEmployers.length > 0 ? [...unknownEmployers] : []

  if (!options?.skipEmployerRemoval && unknownEmployers.length > 0) {
    sanitizedCv = removeEntriesForCompanies(sanitizedCv, blockedEmployers)
  }

  return {
    sanitizedCv,
    flagged,
    removedCount: flagged.length,
    unknownEmployers,
    strippedEmployers,
  }
}

function removeEntriesForCompanies(cv: string, blockedEmployers: string[]): string {
  const lines = cv.split("\n")
  const out: string[] = []
  let skipEntry = false
  let activeSection: ActiveSection = "none"

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed && isSectionHeader(trimmed)) {
      if (experienceSectionKey(trimmed)) activeSection = "experience"
      else if (educationSectionKey(trimmed)) activeSection = "education"
      else activeSection = "other"
      skipEntry = false
      out.push(line)
      continue
    }

    if (activeSection !== "experience") {
      out.push(line)
      continue
    }

    if (trimmed.startsWith("## ")) {
      const company = trimmed.slice(3).trim()
      skipEntry = isBlockedEmployer(company, blockedEmployers)
      if (!skipEntry) out.push(line)
      continue
    }
    if (skipEntry) {
      if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
        skipEntry = false
        out.push(line)
      } else if (isSectionHeader(trimmed)) {
        skipEntry = false
        out.push(line)
      }
      continue
    }
    out.push(line)
  }

  return out.join("\n")
}

/** Refine edits must not introduce bullets disconnected from the pre-edit resume. */
export function validateAndSanitizeRefinedCv(input: {
  baselineCv: string
  jobDescription: string
  refinedCv: string
  options?: CvFactualValidationOptions
}): CvFactualValidationResult {
  return validateAndSanitizeTailoredCv({
    sourceCv: input.baselineCv,
    jobDescription: input.jobDescription,
    generatedCv: input.refinedCv,
    options: input.options,
  })
}
