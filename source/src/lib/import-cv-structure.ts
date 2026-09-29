/**
 * Validates and repairs imported CV text before save.
 * Shared between upload preview and format pipeline.
 */

import { diagnoseCvMarkdown, isUsableCvMarkdown } from "@/lib/ai-cv-response"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"

export type ImportCvConfidence = "high" | "low"

/** Application being imported into — used to strip target role/company from EXPERIENCE. */
export type ImportCvApplicationContext = {
  targetRole?: string
  targetCompany?: string
  professionalTitle?: string
}

export type ImportCvValidationOptions = {
  applicationContext?: ImportCvApplicationContext
}

export type ImportCvValidation = {
  text: string
  confidence: ImportCvConfidence
  warnings: string[]
  issues: string[]
  score: number
  needsReview: boolean
}

export type ImportCvSection = {
  title: string
  key: SectionKey
  lines: string[]
}

const SECTION_ALIASES: Record<string, string> = {
  PROFILE: "PROFILE",
  PROFIL: "PROFILE",
  SUMMARY: "PROFILE",
  ZUSAMMENFASSUNG: "PROFILE",
  ABOUT: "PROFILE",
  EXPERIENCE: "EXPERIENCE",
  BERUFSERFAHRUNG: "EXPERIENCE",
  /** Common shorter DE heading used by translators / writers */
  ERFAHRUNG: "EXPERIENCE",
  PRAXISERFAHRUNG: "EXPERIENCE",
  WERDEGANG: "EXPERIENCE",
  "WORK EXPERIENCE": "EXPERIENCE",
  "PROFESSIONAL EXPERIENCE": "EXPERIENCE",
  EDUCATION: "EDUCATION",
  AUSBILDUNG: "EDUCATION",
  SKILLS: "SKILLS",
  FÄHIGKEITEN: "SKILLS",
  FAEHIGKEITEN: "SKILLS",
  COMPETENCIES: "SKILLS",
  TOOLS: "SKILLS",
  METHODEN: "SKILLS",
  "METHODEN & TOOLS": "SKILLS",
  "METHODS & TOOLS": "SKILLS",
  "TOOLS & METHODS": "SKILLS",
  "TOOLS & METHODEN": "SKILLS",
  LANGUAGES: "LANGUAGES",
  SPRACHEN: "LANGUAGES",
  PROJECTS: "PROJECTS",
  PROJEKTE: "PROJECTS",
  CERTIFICATIONS: "CERTIFICATIONS",
  ZERTIFIKATE: "CERTIFICATIONS",
}

const SECTION_ORDER = [
  "PROFILE",
  "EXPERIENCE",
  "EDUCATION",
  "PROJECTS",
  "SKILLS",
  "CERTIFICATIONS",
  "LANGUAGES",
] as const

type SectionKey = (typeof SECTION_ORDER)[number] | "OTHER"

const PROFILE_SENTENCE_START =
  /^(experienced|experience in|skilled|proven|demonstrated|strong|knowledge|ability|proficient|background|track record|results[- ]oriented|passionate|expertise|competent|adept|familiar|working knowledge|in[- ]depth|hands[- ]on|extensive|solid|deep understanding|specializing|specialised|specializing in|responsible for|committed to)/i

const EDUCATION_TITLE_PATTERN =
  /\b(bachelor|master|mba|phd|b\.sc|m\.sc|b\.a|m\.a|degree|diploma|university|hochschule|college|studium|abschluss|promotion|dissertation)\b/i

const ROLE_TITLE_ENDING =
  /(?:Specialist|Manager|Engineer|Consultant|Analyst|Developer|Designer|Director|Lead|Architect|Officer|Coordinator|Administrator|Associate|Intern|Partner|Advisor|Scientist|Researcher|Strategist|Executive|Supervisor|Technician|Programmer)$/i

/**
 * True for short heading-like labels — not prose sentences that happen to
 * contain words like "experience" / "projects".
 */
function looksLikeCompactSectionLabel(trimmedUpper: string): boolean {
  if (!trimmedUpper || trimmedUpper.length > 56) return false
  // Sentence punctuation → body copy, not a section title.
  if (/[.!?;:]/.test(trimmedUpper)) return false
  const words = trimmedUpper.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 8) return false
  // Leading pronoun / article / common sentence starters.
  if (
    /^(I|ICH|MY|MEIN[EI]?|WE|WIR|OUR|UNSER|A|AN|THE|DIE|DER|DAS|EIN[EI]?|WITH|HAVING|OVER|YEARS|MIT|IN|IM|FOR|FÜR)\b/.test(
      trimmedUpper,
    )
  ) {
    return false
  }
  return true
}

/** Single-token aliases that often appear inside normal CV sentences. */
const TRAILING_ALIAS_UNSAFE = new Set([
  "EXPERIENCE",
  "ERFAHRUNG",
  "PROJECTS",
  "PROJEKTE",
  "SUMMARY",
  "ABOUT",
  "PROFILE",
  "PROFIL",
])

export function normalizeCvSectionKey(line: string): SectionKey | null {
  const trimmed = stripSectionColumnModifier(line).trim().toUpperCase()
  if (!trimmed) return null
  if (SECTION_ALIASES[trimmed]) return SECTION_ALIASES[trimmed] as SectionKey

  for (const [alias, key] of Object.entries(SECTION_ALIASES)) {
    if (trimmed === alias) return key as SectionKey
    if (!looksLikeCompactSectionLabel(trimmed)) continue
    if (trimmed.startsWith(`${alias} `)) return key as SectionKey
    // "ADDITIONAL SKILLS" is fine; "DESIGNER WITH EXPERIENCE" is not.
    if (trimmed.endsWith(` ${alias}`)) {
      if (TRAILING_ALIAS_UNSAFE.has(alias) && !alias.includes(" ")) continue
      return key as SectionKey
    }
  }

  if (!looksLikeCompactSectionLabel(trimmed)) return null

  // Compound headers only (not prose containing these words).
  // e.g. "SELECTED PROJECTS" / "AUSGEWÄHLTE KI-PROJEKTE"
  if (
    /^(SELECTED|RELEVANT|ADDITIONAL|KEY|FEATURED|AUSGEW[AÄ]HLTE|WEITERE|WICHTIGE)\b/.test(trimmed) &&
    (/\bPROJECTS\b/.test(trimmed) || /\bPROJEKTE\b/.test(trimmed))
  ) {
    return "PROJECTS"
  }
  if (/^(PROJECTS|PROJEKTE)\b/.test(trimmed)) return "PROJECTS"

  if (
    /^(PROFESSIONAL|WORK|RELEVANT|ADDITIONAL|PRACTICAL|BERUFLICHE|PRAXIS)\b/.test(trimmed) &&
    (/\bEXPERIENCE\b/.test(trimmed) || /\bERFAHRUNG\b/.test(trimmed))
  ) {
    return "EXPERIENCE"
  }
  if (/^(EXPERIENCE|ERFAHRUNG|BERUFSERFAHRUNG|PRAXISERFAHRUNG|WERDEGANG)\b/.test(trimmed)) {
    return "EXPERIENCE"
  }

  return null
}

/**
 * True only for exact known section labels (e.g. SKILLS, FÄHIGKEITEN, ZERTIFIKATE).
 * Does NOT match job titles like "Senior Experience Designer".
 */
export function isExactCvSectionAlias(line: string): boolean {
  const trimmed = stripSectionColumnModifier(line).trim().toUpperCase()
  if (!trimmed || trimmed.length > 48) return false
  if (SECTION_ALIASES[trimmed]) return true
  // Multi-word aliases already in the map ("WORK EXPERIENCE", etc.)
  return false
}


function isBulletLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith("-") || t.startsWith("•")
}

function isJobTitleLine(line: string): boolean {
  return /^#\s+/.test(line.trim()) && !/^##/.test(line.trim())
}

function isCompanyLine(line: string): boolean {
  return /^##\s+/.test(line.trim()) && !/^###/.test(line.trim())
}

function isDateLine(line: string): boolean {
  return /^###\s+/.test(line.trim())
}

function isMarkdownStructureLine(line: string): boolean {
  const t = line.trim()
  return (
    isJobTitleLine(t) ||
    isCompanyLine(t) ||
    isDateLine(t) ||
    isBulletLine(t)
  )
}

function isSectionHeaderLine(line: string): boolean {
  const t = line.trim()
  if (!t || isMarkdownStructureLine(t)) return false
  if (normalizeCvSectionKey(t)) return true
  const hasLetters = /[A-Za-zÄÖÜäöü]/.test(t)
  return (
    hasLetters &&
    t === t.toUpperCase() &&
    t.length >= 3 &&
    t.length <= 72 &&
    !t.includes("@")
  )
}

/** Known section alias or ALL CAPS custom section title (no `#` prefix). */
export function isResumeSectionHeaderLine(line: string): boolean {
  return isSectionHeaderLine(line)
}

function sectionContentLines(lines: string[]): string[] {
  return lines.filter((l) => l.trim().length > 0)
}

function sectionHasBullets(lines: string[]): boolean {
  return lines.some(isBulletLine)
}

function sectionIsEmpty(lines: string[]): boolean {
  return sectionContentLines(lines).length === 0
}

function firstJobIndex(lines: string[]): number {
  return lines.findIndex((line, index) =>
    isJobTitleLine(line) && isPlausibleJobTitle(line, lines, index),
  )
}

function jobTitleText(line: string): string {
  return line.trim().replace(/^#\s+/, "").trim()
}

function companyText(line: string): string {
  return line.trim().replace(/^##\s+/, "").trim()
}

function dateText(line: string): string {
  return line.trim().replace(/^###\s+/, "").trim()
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function textsSimilar(a: string, b: string): boolean {
  const left = normalizeMatchText(a)
  const right = normalizeMatchText(b)
  if (!left || !right) return false
  if (left === right) return true
  if (left.length >= 8 && right.length >= 8 && (left.includes(right) || right.includes(left))) {
    return true
  }
  const leftToken = left.split(" ").find((token) => token.length > 2)
  const rightToken = right.split(" ").find((token) => token.length > 2)
  return Boolean(leftToken && rightToken && leftToken === rightToken)
}

function getJobBlock(lines: string[], startIdx: number): string[] {
  const nextJob = lines.findIndex((line, index) => index > startIdx && isJobTitleLine(line))
  return lines.slice(startIdx, nextJob >= 0 ? nextJob : lines.length)
}

function isPresentOnlyDate(line: string | undefined): boolean {
  if (!line) return false
  const value = dateText(line).toLowerCase()
  return /^(present|current|now|heute|aktuell)$/.test(value)
}

function isLikelyTargetLeadInBlock(block: string[]): boolean {
  const dateLine = block.find(isDateLine)
  const companyLine = block.find(isCompanyLine)
  if (!dateLine || !isPresentOnlyDate(dateLine) || !companyLine) return false

  const company = companyText(companyLine)
  const hasLocation =
    /,/.test(company) ||
    /\b(germany|deutschland|berlin|munich|münchen|london|remote|hybrid)\b/i.test(company)
  const bullets = block.filter(isBulletLine)
  return !hasLocation && bullets.length <= 3
}

function isApplicationTargetJobBlock(
  block: string[],
  ctx?: ImportCvApplicationContext,
): boolean {
  const titleLine = block.find(isJobTitleLine)
  if (!titleLine) return false

  const title = jobTitleText(titleLine)
  const companyLine = block.find(isCompanyLine)
  const company = companyLine ? companyText(companyLine) : ""

  if (ctx) {
    const roleMatches = ctx.targetRole ? textsSimilar(title, ctx.targetRole) : false
    const companyMatches = ctx.targetCompany ? textsSimilar(company, ctx.targetCompany) : false
    const professionalMatches = ctx.professionalTitle
      ? textsSimilar(title, ctx.professionalTitle)
      : false

    if (roleMatches && companyMatches) return true
    if (professionalMatches && companyMatches) return true
    if (roleMatches && isLikelyTargetLeadInBlock(block)) return true
  }

  return isLikelyTargetLeadInBlock(block)
}

function moveJobBlockBulletsToProfile(block: string[], profile: ImportCvSection) {
  for (const line of block) {
    if (isBulletLine(line)) {
      profile.lines.push(line)
    } else if (
      !isJobTitleLine(line) &&
      !isCompanyLine(line) &&
      !isDateLine(line) &&
      line.trim()
    ) {
      profile.lines.push(`- ${line.trim()}`)
    }
  }
}

/** Remove application target role/company blocks mistakenly placed in EXPERIENCE. */
function repairApplicationTargetInExperience(
  sections: ImportCvSection[],
  warnings: string[],
  ctx?: ImportCvApplicationContext,
): ImportCvSection[] {
  const expIdx = sections.findIndex((s) => s.key === "EXPERIENCE")
  if (expIdx < 0) return sections

  const experience = sections[expIdx]
  const profile = findOrCreateSection(sections, "PROFILE", "PROFILE", "EXPERIENCE")
  const kept: string[] = []
  let removed = false
  let sawRealJob = false

  for (let i = 0; i < experience.lines.length; ) {
    const line = experience.lines[i]
    if (!isJobTitleLine(line)) {
      kept.push(line)
      i++
      continue
    }

    const block = getJobBlock(experience.lines, i)
    const shouldRemove =
      isApplicationTargetJobBlock(block, ctx) ||
      (!sawRealJob && !ctx?.targetRole && isLikelyTargetLeadInBlock(block))

    if (shouldRemove) {
      moveJobBlockBulletsToProfile(block, profile)
      removed = true
      i += block.length
      continue
    }

    sawRealJob = true
    kept.push(...block)
    i += block.length
  }

  experience.lines = kept
  if (removed) {
    warnings.push(
      "Removed application target role/company from EXPERIENCE — it belongs in the header target box, not work history.",
    )
  }

  return sections
}

function hashtagToBullet(line: string): string {
  const text = jobTitleText(line)
  return text ? `- ${text}` : line
}

function isEducationTitleLine(line: string): boolean {
  if (!isJobTitleLine(line)) return false
  return EDUCATION_TITLE_PATTERN.test(jobTitleText(line))
}

/** True when a # line is a real job title, not a profile summary sentence. */
export function isPlausibleJobTitle(
  line: string,
  contextLines: string[],
  index: number,
): boolean {
  const text = jobTitleText(line)
  if (!text) return false
  if (isEducationTitleLine(line)) return false
  if (PROFILE_SENTENCE_START.test(text)) return false
  if (text.length > 90) return false

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > 14) return false

  const following = contextLines.slice(index + 1, index + 4).map((l) => l.trim())
  if (following.some(isCompanyLine) || following.some(isDateLine)) return true

  if (words.length <= 8 && ROLE_TITLE_ENDING.test(text)) return true
  if (words.length <= 6 && !PROFILE_SENTENCE_START.test(text) && !text.includes(";")) {
    return true
  }

  return false
}

function parseIntoSections(text: string): ImportCvSection[] {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n")
  const sections: ImportCvSection[] = []
  let current: ImportCvSection | null = null

  for (const raw of rawLines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) continue

    if (isSectionHeaderLine(trimmed)) {
      if (current) sections.push(current)
      const key = normalizeCvSectionKey(trimmed) ?? "OTHER"
      current = { title: trimmed, key, lines: [] }
      continue
    }

    if (!current) {
      current = { title: "", key: "OTHER", lines: [line] }
      continue
    }
    current.lines.push(line)
  }

  if (current) sections.push(current)
  return sections
}

/** Parse imported CV text into sections for review UI and repair. */
export function parseImportedCvSections(text: string): ImportCvSection[] {
  return parseIntoSections(text.trim())
}

function serializeSections(sections: ImportCvSection[]): string {
  const blocks: string[] = []
  for (const section of sections) {
    const lines = sectionContentLines(section.lines)
    if (section.title.trim()) {
      if (lines.length === 0) continue
      blocks.push([section.title.trim(), ...lines].join("\n"))
    } else if (lines.length > 0) {
      blocks.push(lines.join("\n"))
    }
  }
  return blocks.join("\n\n").trim()
}

function findOrCreateSection(
  sections: ImportCvSection[],
  key: SectionKey,
  title: string,
  insertBeforeKey?: SectionKey,
): ImportCvSection {
  const existing = sections.find((s) => s.key === key)
  if (existing) return existing

  const section: ImportCvSection = { title, key, lines: [] }
  if (insertBeforeKey) {
    const idx = sections.findIndex((s) => s.key === insertBeforeKey)
    if (idx >= 0) {
      sections.splice(idx, 0, section)
      return section
    }
  }
  sections.push(section)
  return section
}

/** Remove consecutive empty section headers (common PDF artifact). */
function collapseEmptySectionHeaders(sections: ImportCvSection[]): ImportCvSection[] {
  return sections.filter((section) => !sectionIsEmpty(section.lines))
}

/** Split EXPERIENCE/OTHER when EDUCATION, SKILLS, etc. appear inline. */
function repairInlineSectionHeaders(
  sections: ImportCvSection[],
  warnings: string[],
): ImportCvSection[] {
  const result: ImportCvSection[] = []

  for (const section of sections) {
    if (section.key !== "EXPERIENCE" && section.key !== "OTHER") {
      result.push(section)
      continue
    }

    let current: ImportCvSection = { ...section, lines: [] }
    let split = false

    for (const line of section.lines) {
      const trimmed = line.trim()
      if (isSectionHeaderLine(trimmed)) {
        split = true
        if (sectionContentLines(current.lines).length > 0 || current.title) {
          result.push(current)
        }
        const key = normalizeCvSectionKey(trimmed) ?? "OTHER"
        current = { title: trimmed, key, lines: [] }
      } else {
        current.lines.push(line)
      }
    }

    if (sectionContentLines(current.lines).length > 0 || current.title) {
      result.push(current)
    }

    if (split) {
      warnings.push("Split embedded section headings found inside EXPERIENCE.")
    }
  }

  return result
}

/** Move bullets and false job titles before the first real job into PROFILE. */
function repairProfileBeforeExperience(
  sections: ImportCvSection[],
  warnings: string[],
): ImportCvSection[] {
  const expIdx = sections.findIndex((s) => s.key === "EXPERIENCE")
  if (expIdx < 0) return sections

  let profileIdx = sections.findIndex((s) => s.key === "PROFILE")
  if (profileIdx < 0) {
    const profile: ImportCvSection = { title: "PROFILE", key: "PROFILE", lines: [] }
    sections.splice(expIdx, 0, profile)
    profileIdx = expIdx
    warnings.push("Created missing PROFILE section.")
  }

  const profile = sections[profileIdx]
  const experience = sections[sections.findIndex((s) => s.key === "EXPERIENCE")]
  if (!experience || !sectionIsEmpty(profile.lines)) {
    return repairOrphanedExperienceLeadIn(sections, warnings)
  }

  const jobIdx = firstJobIndex(experience.lines)
  if (jobIdx <= 0) {
    return repairOrphanedExperienceLeadIn(sections, warnings)
  }

  const orphaned = experience.lines.slice(0, jobIdx)
  const hasOrphanContent = orphaned.some(
    (l) =>
      isBulletLine(l) ||
      (isJobTitleLine(l) && !isPlausibleJobTitle(l, experience.lines, experience.lines.indexOf(l))) ||
      (!isMarkdownStructureLine(l) && l.trim().length > 0),
  )
  if (!hasOrphanContent) return sections

  profile.lines = [
    ...profile.lines,
    ...orphaned.map((line) => (isJobTitleLine(line) ? hashtagToBullet(line) : line)),
  ]
  experience.lines = experience.lines.slice(jobIdx)
  warnings.push("Moved profile content from EXPERIENCE into PROFILE.")
  return sections
}

/** When PROFILE already has content, still demote false # titles at the start of EXPERIENCE. */
function repairOrphanedExperienceLeadIn(
  sections: ImportCvSection[],
  warnings: string[],
): ImportCvSection[] {
  const expIdx = sections.findIndex((s) => s.key === "EXPERIENCE")
  if (expIdx < 0) return sections

  const experience = sections[expIdx]
  const profile = findOrCreateSection(sections, "PROFILE", "PROFILE", "EXPERIENCE")

  const newLines: string[] = []
  let moved = false
  let seenValidJob = false

  for (let i = 0; i < experience.lines.length; i++) {
    const line = experience.lines[i]
    if (isJobTitleLine(line)) {
      if (isPlausibleJobTitle(line, experience.lines, i)) {
        seenValidJob = true
        newLines.push(line)
      } else if (!seenValidJob) {
        profile.lines.push(hashtagToBullet(line))
        moved = true
      } else {
        newLines.push(hashtagToBullet(line))
        moved = true
      }
    } else if (!seenValidJob && (isBulletLine(line) || (!isMarkdownStructureLine(line) && line.trim()))) {
      profile.lines.push(isBulletLine(line) ? line : `- ${line.trim()}`)
      moved = true
    } else {
      newLines.push(line)
    }
  }

  if (moved) {
    experience.lines = newLines
    warnings.push("Moved summary-style lines from EXPERIENCE into PROFILE.")
  }

  return sections
}

/** Convert false # job titles inside EXPERIENCE into bullets; move education blocks out. */
function repairFalseJobsAndEducationInExperience(
  sections: ImportCvSection[],
  warnings: string[],
): ImportCvSection[] {
  const expIdx = sections.findIndex((s) => s.key === "EXPERIENCE")
  if (expIdx < 0) return sections

  const experience = sections[expIdx]
  const profile = sections.find((s) => s.key === "PROFILE")
  const education = findOrCreateSection(sections, "EDUCATION", "EDUCATION", "SKILLS")

  const kept: string[] = []
  let movedProfile = false
  let movedEducation = false

  for (let i = 0; i < experience.lines.length; i++) {
    const line = experience.lines[i]
    if (isJobTitleLine(line) && isEducationTitleLine(line)) {
      const nextJob = experience.lines.findIndex(
        (l, idx) => idx > i && isJobTitleLine(l),
      )
      const block = experience.lines.slice(i, nextJob >= 0 ? nextJob : experience.lines.length)
      education.lines.push(...block)
      i = nextJob >= 0 ? nextJob - 1 : experience.lines.length
      movedEducation = true
      continue
    }

    if (isJobTitleLine(line) && !isPlausibleJobTitle(line, experience.lines, i)) {
      const bullet = hashtagToBullet(line)
      if (profile && kept.filter(isJobTitleLine).length === 0) {
        profile.lines.push(bullet)
        movedProfile = true
      } else {
        kept.push(bullet)
      }
      continue
    }

    kept.push(line)
  }

  experience.lines = kept
  if (movedProfile) {
    warnings.push("Converted profile-style headings in EXPERIENCE into PROFILE bullets.")
  }
  if (movedEducation) {
    warnings.push("Moved education entries from EXPERIENCE into EDUCATION.")
  }

  return sections
}

/** Pull misplaced job blocks from PROFILE into EXPERIENCE. */
function repairJobsInProfile(sections: ImportCvSection[], warnings: string[]): ImportCvSection[] {
  const profileIdx = sections.findIndex((s) => s.key === "PROFILE")
  if (profileIdx < 0) return sections

  const profile = sections[profileIdx]
  const jobStart = profile.lines.findIndex(
    (line, index) => isJobTitleLine(line) && isPlausibleJobTitle(line, profile.lines, index),
  )
  if (jobStart < 0) return sections

  const profileOnly = profile.lines.slice(0, jobStart)
  const jobLines = profile.lines.slice(jobStart)
  profile.lines = profileOnly

  const expIdx = sections.findIndex((s) => s.key === "EXPERIENCE")
  if (expIdx >= 0) {
    sections[expIdx].lines = [...jobLines, ...sections[expIdx].lines]
  } else {
    sections.splice(profileIdx + 1, 0, {
      title: "EXPERIENCE",
      key: "EXPERIENCE",
      lines: jobLines,
    })
  }
  warnings.push("Moved job entries from PROFILE into EXPERIENCE.")
  return sections
}

/** Move skill/language bullets from the tail of EXPERIENCE into their sections. */
function repairTrailingListSections(
  sections: ImportCvSection[],
  warnings: string[],
): ImportCvSection[] {
  const expIdx = sections.findIndex((s) => s.key === "EXPERIENCE")
  if (expIdx < 0) return sections

  const experience = sections[expIdx]
  const lines = experience.lines
  if (lines.length === 0) return sections

  const trailingBullets: string[] = []
  let cutIndex = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isBulletLine(lines[i])) break
    trailingBullets.unshift(lines[i])
    cutIndex = i
  }

  if (trailingBullets.length < 2) return sections

  const langLines: string[] = []
  const skillLines: string[] = []
  for (const line of trailingBullets) {
    const upper = line.toUpperCase()
    if (
      /GERMAN|ENGLISH|FRENCH|SPANISH|DEUTSCH|ENGLISCH|FRANZÖSISCH|SPANISCH|NATIVE|FLUENT|\(C1\)|\(C2\)|\(B1\)|\(B2\)|\(A1\)|\(A2\)/.test(
        upper,
      )
    ) {
      langLines.push(line)
    } else if (!/\d{4}/.test(line) && line.length < 120) {
      skillLines.push(line)
    }
  }

  if (langLines.length === 0 && skillLines.length === 0) return sections
  if (langLines.length + skillLines.length < trailingBullets.length) return sections

  experience.lines = lines.slice(0, cutIndex)

  if (skillLines.length > 0) {
    const skills = findOrCreateSection(sections, "SKILLS", "SKILLS", "LANGUAGES")
    skills.lines.push(...skillLines)
    warnings.push("Moved skill list items from the end of EXPERIENCE into SKILLS.")
  }

  if (langLines.length > 0) {
    const langs = findOrCreateSection(sections, "LANGUAGES", "LANGUAGES")
    langs.lines.push(...langLines)
    warnings.push("Moved language items from the end of EXPERIENCE into LANGUAGES.")
  }

  return sections
}

function sortSectionsCanonically(sections: ImportCvSection[]): ImportCvSection[] {
  const orderIndex = (key: SectionKey) => {
    const idx = SECTION_ORDER.indexOf(key as (typeof SECTION_ORDER)[number])
    return idx >= 0 ? idx : SECTION_ORDER.length + 1
  }
  const header = sections.filter((s) => !s.title && s.key === "OTHER")
  const body = sections.filter((s) => s.title || s.key !== "OTHER")
  body.sort((a, b) => orderIndex(a.key) - orderIndex(b.key))
  return [...header, ...body]
}

function scoreImport(text: string, sections: ImportCvSection[], warnings: string[]): number {
  let score = 100
  const diag = diagnoseCvMarkdown(text)

  if (!diag.usable) score -= 35
  if (diag.bulletCount < 2) score -= 20

  const profile = sections.find((s) => s.key === "PROFILE")
  const experience = sections.find((s) => s.key === "EXPERIENCE")

  if (profile && sectionIsEmpty(profile.lines)) score -= 25
  if (experience) {
    const jobs = experience.lines.filter(
      (line, index) => isJobTitleLine(line) && isPlausibleJobTitle(line, experience.lines, index),
    ).length
    const bullets = experience.lines.filter(isBulletLine).length
    const falseJobs = experience.lines.filter(
      (line, index) => isJobTitleLine(line) && !isPlausibleJobTitle(line, experience.lines, index),
    ).length
    if (jobs > 0 && bullets === 0) score -= 20
    if (jobs === 0 && experience.lines.length > 0) score -= 15
    if (falseJobs > 0) score -= falseJobs * 8
  }

  if (warnings.length > 0) score -= Math.min(15, warnings.length * 5)

  const emptyNamed = sections.filter((s) => s.title && sectionIsEmpty(s.lines))
  score -= emptyNamed.length * 10

  return Math.max(0, Math.min(100, score))
}

const REVIEW_WARNING =
  "Import needs review — some sections may have been detected incorrectly."

/**
 * Repair common PDF import structure mistakes and score confidence.
 */
export function validateAndRepairImportedCv(
  text: string,
  options?: ImportCvValidationOptions,
): ImportCvValidation {
  const warnings: string[] = []
  const issues: string[] = []
  const applicationContext = options?.applicationContext

  let sections = parseIntoSections(text.trim())
  sections = collapseEmptySectionHeaders(sections)
  sections = repairInlineSectionHeaders(sections, warnings)
  sections = repairProfileBeforeExperience(sections, warnings)
  sections = repairFalseJobsAndEducationInExperience(sections, warnings)
  sections = repairApplicationTargetInExperience(sections, warnings, applicationContext)
  sections = repairJobsInProfile(sections, warnings)
  sections = repairTrailingListSections(sections, warnings)
  sections = sortSectionsCanonically(sections)

  const repaired = serializeSections(sections)

  const profile = sections.find((s) => s.key === "PROFILE")
  const experience = sections.find((s) => s.key === "EXPERIENCE")

  if (profile && sectionIsEmpty(profile.lines)) {
    issues.push("PROFILE section has no content.")
  }
  if (experience) {
    const jobs = experience.lines.filter(
      (line, index) => isJobTitleLine(line) && isPlausibleJobTitle(line, experience.lines, index),
    )
    for (const jobLine of jobs) {
      const jobIdx = experience.lines.indexOf(jobLine)
      const nextJob = experience.lines.findIndex(
        (l, i) => i > jobIdx && isJobTitleLine(l) && isPlausibleJobTitle(l, experience.lines, i),
      )
      const block = experience.lines.slice(
        jobIdx,
        nextJob >= 0 ? nextJob : experience.lines.length,
      )
      if (!block.some(isBulletLine)) {
        issues.push(`Job "${jobTitleText(jobLine)}" has no bullet points.`)
      }
    }
    const falseJobs = experience.lines.filter(
      (line, index) => isJobTitleLine(line) && !isPlausibleJobTitle(line, experience.lines, index),
    )
    if (falseJobs.length > 0) {
      issues.push("Some lines in EXPERIENCE still look like profile text, not job titles.")
    }
  }

  const emptyHeaders = sections.filter((s) => s.title && sectionIsEmpty(s.lines))
  if (emptyHeaders.length > 0) {
    issues.push("One or more section headings have no content.")
  }

  const score = scoreImport(repaired, sections, warnings)
  const needsReview =
    score < 70 ||
    warnings.length > 0 ||
    issues.length > 0 ||
    !isUsableCvMarkdown(repaired)

  if (needsReview && !warnings.includes(REVIEW_WARNING)) {
    warnings.unshift(REVIEW_WARNING)
  }

  return {
    text: repaired || text.trim(),
    confidence: score >= 70 && issues.length === 0 ? "high" : "low",
    warnings,
    issues,
    score,
    needsReview,
  }
}

export const IMPORT_CV_SECTION_LABELS: Record<SectionKey, string> = {
  OTHER: "Contact / header",
  PROFILE: "Profile",
  EXPERIENCE: "Experience",
  EDUCATION: "Education",
  PROJECTS: "Projects",
  SKILLS: "Skills",
  CERTIFICATIONS: "Certifications",
  LANGUAGES: "Languages",
}
