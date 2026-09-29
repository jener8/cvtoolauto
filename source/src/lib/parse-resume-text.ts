import {
  isExactCvSectionAlias,
  isPlausibleJobTitle,
  isResumeSectionHeaderLine,
  normalizeCvSectionKey,
} from "@/lib/import-cv-structure"
import {
  isCvSectionHeadingLabel,
  matchResumeHeadingPrefix,
  normalizeResumeMarkupLine,
} from "@/lib/resume-markup-line"
import {
  isManualPageBreakLine,
  stripLeadingManualPageBreaks,
} from "@/lib/resume-page-breaks"
import {
  parseSectionColumnModifier,
  stripSectionColumnModifier,
  type SectionColumnCount,
} from "@/lib/section-column-modifier"

export type ParsedResumeSection = {
  title: string
  content: string[]
  /** Layout columns for list-heavy sections (from `[columns=n]` heading modifier). */
  columns?: SectionColumnCount
}

function normalizeResumeParseText(text: string): string {
  return normalizeResumeMarkupLine(text).replace(/\f/g, "\n")
}

/** Strip markdown wrappers and trailing colons from pasted section titles. */
function normalizeSectionHeaderCandidate(line: string): string {
  let trimmed = line.trim()
  // Consume the full `#` / `##` / `###` prefix (optional space) — never leave a leftover `#`.
  const heading = matchResumeHeadingPrefix(trimmed)
  if (heading) {
    trimmed = heading.text
  } else {
    trimmed = trimmed.replace(/^#{1,6}\s*/, "")
  }
  const bold = trimmed.match(/^\*{1,2}(.+?)\*{1,2}$/)
  if (bold) trimmed = bold[1].trim()
  trimmed = trimmed.replace(/[:：]\s*$/, "")
  return trimmed.trim()
}

function sectionHeaderMeta(line: string): { title: string; columns: SectionColumnCount } {
  const candidate = normalizeSectionHeaderCandidate(line)
  const { columns } = parseSectionColumnModifier(candidate)
  const titleForKey = stripSectionColumnModifier(candidate)
  const key = normalizeCvSectionKey(titleForKey)
  const title = key ? titleForKey.toUpperCase() : titleForKey
  return { title, columns }
}

function sectionHeaderTitle(line: string): string {
  return sectionHeaderMeta(line).title
}

function isJobTitleLine(line: string): boolean {
  const heading = matchResumeHeadingPrefix(line)
  return heading?.level === 1 && !isCvSectionHeadingLabel(heading.text)
}

function isProfileLikeSection(title: string): boolean {
  const key = normalizeCvSectionKey(title)
  if (key === "PROFILE") return true
  if (!title.trim()) return true
  const upper = title.toUpperCase().trim()
  return upper.includes("PROFILE") || upper.includes("PROFIL") || upper.includes("SUMMARY")
}

/**
 * Job-first pastes (or PROFILE that contains `#` / `##` / `###` roles) land as one
 * giant PROFILE block. Pagination then can't fit it under the header → empty page 1.
 * Move those roles into EXPERIENCE so each job can paginate separately.
 */
export function repairJobsNestedInProfile(
  sections: ParsedResumeSection[],
): ParsedResumeSection[] {
  const result = sections.map((section) => ({
    ...section,
    content: [...section.content],
  }))

  const profileIdx = result.findIndex((section) => isProfileLikeSection(section.title))
  if (profileIdx < 0) return result

  const profile = result[profileIdx]
  const jobStart = profile.content.findIndex(
    (line, index) => isJobTitleLine(line) && isPlausibleJobTitle(line, profile.content, index),
  )
  if (jobStart < 0) return result

  const jobs = profile.content.slice(jobStart)
  profile.content = profile.content.slice(0, jobStart)

  const expIdx = result.findIndex(
    (section) => normalizeCvSectionKey(section.title) === "EXPERIENCE",
  )
  if (expIdx >= 0) {
    // If EXPERIENCE already has roles, do not prepend PROFILE's copy —
    // that duplicated every job whenever PROFILE still mirrored EXPERIENCE.
    if (result[expIdx].content.length === 0) {
      result[expIdx].content = jobs
    }
  } else {
    result.splice(profileIdx + 1, 0, { title: "EXPERIENCE", content: jobs })
  }

  if (profile.content.length === 0) {
    result.splice(profileIdx, 1)
  }

  return result
}

/**
 * Rescue `# SKILLS [columns=2]` / `# METHODEN & TOOLS [columns=3]` (or plain
 * `SKILLS [columns=2]`) when it was left inside EXPERIENCE/PROFILE as a fake
 * job title — that shows the modifier and skips the multi-column layout.
 */
export function repairMisplacedSectionHeadersInContent(
  sections: ParsedResumeSection[],
): ParsedResumeSection[] {
  const result: ParsedResumeSection[] = []

  for (const section of sections) {
    let current: ParsedResumeSection = {
      ...section,
      content: [],
      ...(section.columns ? { columns: section.columns } : {}),
    }
    let emittedCurrent = false

    const pushCurrent = () => {
      if (emittedCurrent) return
      if (current.content.length > 0 || current.title.trim()) {
        result.push(current)
        emittedCurrent = true
      }
    }

    for (const line of section.content) {
      const headerCandidate = normalizeSectionHeaderCandidate(line)
      const stripped = stripSectionColumnModifier(headerCandidate)
      const heading = matchResumeHeadingPrefix(line)
      // Hash lines: only known section aliases (PROFILE / EXPERIENCE / …), never
      // ALL-CAPS job titles like "# SENIOR UX DESIGNER".
      const looksLikeHashSection = heading !== null && isCvSectionHeadingLabel(heading.text)
      const looksLikePlainSection =
        !line.trim().startsWith("#") &&
        !line.trim().startsWith("-") &&
        !line.trim().startsWith("•") &&
        (isExactCvSectionAlias(stripped) || isResumeSectionHeaderLine(stripped))

      if (looksLikeHashSection || looksLikePlainSection) {
        pushCurrent()
        const { title, columns } = sectionHeaderMeta(line)
        current = {
          title,
          content: [],
          ...(columns > 1 ? { columns } : {}),
        }
        emittedCurrent = false
        continue
      }

      current.content.push(line)
    }

    pushCurrent()
  }

  return result.length > 0 ? result : sections
}

/** Serialize parsed sections back to builder markup (for paste/repair rewrites). */
export function serializeParsedResumeSections(sections: ParsedResumeSection[]): string {
  const blocks: string[] = []
  for (const section of sections) {
    const body = section.content.filter((line) => line.trim().length > 0)
    if (!section.title.trim()) {
      if (body.length > 0) blocks.push(body.join("\n"))
      continue
    }
    if (body.length === 0) continue
    const title =
      section.columns && section.columns > 1
        ? `${section.title} [columns=${section.columns}]`
        : section.title
    blocks.push([title, ...body].join("\n"))
  }
  return blocks.join("\n\n").trim()
}

/**
 * Strip leading page breaks and pull misplaced jobs out of PROFILE.
 * Safe to run on paste / open so the preview and editor stay consistent.
 */
export function normalizeResumeBuilderText(text: string): string {
  const stripped = stripLeadingManualPageBreaks(text)
  const sections = parseResumeText(stripped)
  return serializeParsedResumeSections(sections)
}

/** True when PROFILE (or preamble) contains job blocks that should live under EXPERIENCE. */
export function resumeBuilderTextNeedsNormalize(text: string): boolean {
  const stripped = stripLeadingManualPageBreaks(text)
  const raw = parseResumeTextRaw(stripped)
  const repaired = repairJobsNestedInProfile(raw)
  if (raw.length !== repaired.length) return true
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].title !== repaired[i].title) return true
    if (raw[i].content.join("\n") !== repaired[i].content.join("\n")) return true
  }
  // Leading page-break markers only (blank lines alone should not rewrite while typing).
  const lines = text.split(/\r?\n/)
  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  return i < lines.length && isManualPageBreakLine(lines[i])
}

/** e.g. "PROFILE - Summary text" → { title: "PROFILE", remainder: "Summary text" } */
function tryParseInlineSectionHeader(
  line: string,
): { title: string; remainder: string; columns: SectionColumnCount } | null {
  const trimmed = line.trim()
  const separator = trimmed.match(/\s+-\s+/)
  if (!separator || separator.index === undefined || separator.index < 1) return null

  const headerPart = trimmed.slice(0, separator.index).trim()
  const remainder = trimmed.slice(separator.index + separator[0].length).trim()
  if (!remainder) return null

  const key = normalizeCvSectionKey(stripSectionColumnModifier(headerPart))
  if (!key || key === "OTHER") return null

  const { title: titleWithoutModifier, columns } = parseSectionColumnModifier(headerPart)
  return {
    title: key ? titleWithoutModifier.toUpperCase() : titleWithoutModifier,
    remainder,
    columns,
  }
}

function isProfileSectionTitle(title: string): boolean {
  return normalizeCvSectionKey(title) === "PROFILE"
}

function flushPreambleAsProfileSection(sections: ParsedResumeSection[], preamble: string[]) {
  if (preamble.length === 0) return
  sections.push({ title: "PROFILE", content: [...preamble] })
  preamble.length = 0
}

/**
 * Split resume builder text into sections (no PROFILE→EXPERIENCE repair).
 */
function parseResumeTextRaw(
  text: string,
  options?: { allowSectionHeaderAtStart?: boolean; carryoverSectionTitle?: string },
): ParsedResumeSection[] {
  const normalizedText = normalizeResumeParseText(text)
  const lines = normalizedText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const sections: ParsedResumeSection[] = []
  let currentSection: ParsedResumeSection | null = null
  const preamble: string[] = []

  const closeCurrentSection = () => {
    if (!currentSection) return
    sections.push(currentSection)
    currentSection = null
  }

  for (const line of lines) {
    if (isManualPageBreakLine(line)) {
      if (currentSection) currentSection.content.push(line)
      else preamble.push(line)
      continue
    }

    const isMarkdownFormatted = line.trim().startsWith("#")
    const isBulletPoint = line.startsWith("-") || line.startsWith("•")

    const inlineSection =
      !isMarkdownFormatted && !isBulletPoint ? tryParseInlineSectionHeader(line) : null
    if (inlineSection) {
      closeCurrentSection()
      if (preamble.length > 0 && isProfileSectionTitle(inlineSection.title)) {
        currentSection = {
          title: inlineSection.title,
          content: [...preamble, inlineSection.remainder],
          ...(inlineSection.columns > 1 ? { columns: inlineSection.columns } : {}),
        }
        preamble.length = 0
      } else {
        flushPreambleAsProfileSection(sections, preamble)
        currentSection = {
          title: inlineSection.title,
          content: [inlineSection.remainder],
          ...(inlineSection.columns > 1 ? { columns: inlineSection.columns } : {}),
        }
      }
      continue
    }

    const headerCandidate = normalizeSectionHeaderCandidate(line)
    const strippedHeader = stripSectionColumnModifier(headerCandidate)
    const sectionKey = normalizeCvSectionKey(strippedHeader)
    // `# PROFILE`, `## EXPERIENCE`, `### SKILLS [columns=2]` — any heading level
    // with a known section label. Job titles like "# Senior Designer" stay content.
    const heading = matchResumeHeadingPrefix(line)
    const isHashSectionHeader =
      heading !== null && isCvSectionHeadingLabel(heading.text)
    const isCustomCapsSectionHeader =
      sectionKey === null &&
      !isMarkdownFormatted &&
      !isBulletPoint &&
      isResumeSectionHeaderLine(strippedHeader)
    const isKnownSectionHeader =
      sectionKey !== null && !isMarkdownFormatted && !isBulletPoint
    const isSectionHeader =
      isKnownSectionHeader || isCustomCapsSectionHeader || isHashSectionHeader

    const shouldCreateSection =
      isSectionHeader &&
      (options?.allowSectionHeaderAtStart === true ||
        sectionKey !== null ||
        isCustomCapsSectionHeader ||
        isHashSectionHeader)

    if (shouldCreateSection) {
      const { title: headerTitle, columns } = sectionHeaderMeta(line)
      closeCurrentSection()
      if (preamble.length > 0) {
        if (isProfileSectionTitle(headerTitle)) {
          currentSection = {
            title: headerTitle,
            content: [...preamble],
            ...(columns > 1 ? { columns } : {}),
          }
        } else {
          flushPreambleAsProfileSection(sections, preamble)
          currentSection = {
            title: headerTitle,
            content: [],
            ...(columns > 1 ? { columns } : {}),
          }
        }
        preamble.length = 0
      } else {
        currentSection = {
          title: headerTitle,
          content: [],
          ...(columns > 1 ? { columns } : {}),
        }
      }
      continue
    }

    if (currentSection) {
      currentSection.content.push(line)
      continue
    }

    if (options?.carryoverSectionTitle) {
      currentSection = { title: options.carryoverSectionTitle, content: [line] }
      continue
    }

    preamble.push(line)
  }

  closeCurrentSection()
  flushPreambleAsProfileSection(sections, preamble)

  return sections
}

/**
 * Split resume builder text into sections for preview/PDF rendering.
 * Tolerates pasted freeform content (preamble lines, inline "PROFILE - …" headers).
 * Also moves misplaced job blocks out of PROFILE so pagination can fill page 1.
 */
export function parseResumeText(
  text: string,
  options?: {
    allowSectionHeaderAtStart?: boolean
    carryoverSectionTitle?: string
    /** When false, skip PROFILE→EXPERIENCE job repair (for structure diagnostics). Default true. */
    repairJobsInProfile?: boolean
  },
): ParsedResumeSection[] {
  const stripped = stripLeadingManualPageBreaks(text)
  const raw = parseResumeTextRaw(stripped, options)
  if (options?.repairJobsInProfile === false) return raw
  return repairMisplacedSectionHeadersInContent(repairJobsNestedInProfile(raw))
}
