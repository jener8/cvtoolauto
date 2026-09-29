/**
 * Section analysis and merge helpers for tailored CV generation.
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

const EDUCATION_SECTION_MARKERS = new Set([
  "education",
  "ausbildung",
  "studium",
  "qualifications",
])

export type CvSectionKind = "experience" | "education" | "other"

export type CvSectionStats = {
  experienceJobTitles: number
  experienceBullets: number
  educationEntries: number
  educationBullets: number
}

export type CvSectionValidation = {
  source: CvSectionStats
  generated: CvSectionStats
  missingExperience: boolean
  missingEducation: boolean
  warnings: string[]
}

function normalizeSectionKey(line: string): string {
  return line.trim().toLowerCase()
}

function isSectionHeaderLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^#{1,3}\s/.test(t)) return false
  if (/^-\s/.test(t)) return false
  if (t.startsWith("---")) return false
  return /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&-]{2,}$/.test(t) || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(t)
}

function sectionKindForHeader(line: string): CvSectionKind {
  const key = normalizeSectionKey(line)
  for (const marker of EXPERIENCE_SECTION_MARKERS) {
    if (key === marker || key.startsWith(`${marker} `)) return "experience"
  }
  for (const marker of EDUCATION_SECTION_MARKERS) {
    if (key === marker || key.startsWith(`${marker} `)) return "education"
  }
  return "other"
}

function isJobTitleLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith("#") && !t.startsWith("##") && !t.startsWith("###")
}

export function analyzeCvSections(cv: string): CvSectionStats {
  let section: CvSectionKind = "other"
  const stats: CvSectionStats = {
    experienceJobTitles: 0,
    experienceBullets: 0,
    educationEntries: 0,
    educationBullets: 0,
  }

  for (const raw of cv.split("\n")) {
    const line = raw.trim()
    if (!line) continue

    if (isSectionHeaderLine(line)) {
      section = sectionKindForHeader(line)
      continue
    }

    if (section === "experience") {
      if (isJobTitleLine(line)) stats.experienceJobTitles += 1
      if (line.startsWith("- ")) stats.experienceBullets += 1
    }

    if (section === "education") {
      if (isJobTitleLine(line) || /^##\s/.test(line)) stats.educationEntries += 1
      if (line.startsWith("- ")) stats.educationBullets += 1
    }
  }

  return stats
}

export function validateGeneratedCvSections(input: {
  sourceCv: string
  generatedCv: string
}): CvSectionValidation {
  const source = analyzeCvSections(input.sourceCv)
  const generated = analyzeCvSections(input.generatedCv)
  const warnings: string[] = []

  const sourceExperienceLines =
    parseSections(input.sourceCv).find((section) => section.kind === "experience")?.lines ?? []
  const generatedExperienceLines =
    parseSections(input.generatedCv).find((section) => section.kind === "experience")?.lines ?? []
  const sourceEducationLines =
    parseSections(input.sourceCv).find((section) => section.kind === "education")?.lines ?? []
  const generatedEducationLines =
    parseSections(input.generatedCv).find((section) => section.kind === "education")?.lines ?? []

  const missingExperience =
    sectionHasSubstance("experience", sourceExperienceLines) &&
    !sectionHasSubstance("experience", generatedExperienceLines)

  const missingEducation =
    sectionHasSubstance("education", sourceEducationLines) &&
    !sectionHasSubstance("education", generatedEducationLines)

  if (missingExperience) {
    warnings.push("Experience bullets were removed or not generated.")
  }
  if (missingEducation) {
    warnings.push("Education details were removed or not generated.")
  }

  return { source, generated, missingExperience, missingEducation, warnings }
}

type ParsedSection = {
  header: string
  kind: CvSectionKind
  lines: string[]
}

function parseSections(cv: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null

  for (const raw of cv.split("\n")) {
    const line = raw
    const trimmed = line.trim()
    if (!trimmed) {
      if (current) current.lines.push(line)
      continue
    }

    if (isSectionHeaderLine(trimmed)) {
      if (current) sections.push(current)
      current = { header: trimmed, kind: sectionKindForHeader(trimmed), lines: [] }
      continue
    }

    if (!current) continue
    current.lines.push(line)
  }

  if (current) sections.push(current)
  return sections
}

function rebuildCv(sections: ParsedSection[]): string {
  return sections
    .map((section) => [section.header, ...section.lines].join("\n"))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function countBulletsInLines(lines: string[]): number {
  return lines.filter((line) => line.trim().startsWith("- ")).length
}

function sectionHasSubstance(kind: CvSectionKind, lines: string[]): boolean {
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean)
  if (nonEmpty.length === 0) return false

  if (kind === "experience" || kind === "education") {
    if (countBulletsInLines(lines) > 0) return true
    return nonEmpty.some(
      (line) =>
        line.startsWith("#") ||
        line.startsWith("## ") ||
        (!line.startsWith("###") && line.length > 2 && !isSectionHeaderLine(line)),
    )
  }

  return nonEmpty.length > 0
}

function shouldRestoreSectionFromSource(
  kind: CvSectionKind,
  sourceLines: string[],
  generatedLines: string[],
): boolean {
  if (sourceLines.length === 0) return false
  if (!sectionHasSubstance(kind, sourceLines)) return false

  const sourceBullets = countBulletsInLines(sourceLines)
  const generatedBullets = countBulletsInLines(generatedLines)
  if (sourceBullets > 0 && generatedBullets < sourceBullets) return true

  return !sectionHasSubstance(kind, generatedLines)
}

/** When AI output hollows out experience/education, restore those sections from the source CV. */
export function mergeMissingCvSectionsFromSource(input: {
  sourceCv: string
  generatedCv: string
}): { mergedCv: string; restoredSections: CvSectionKind[] } {
  const generatedTrimmed = input.generatedCv.trim()
  const generatedSections = parseSections(input.generatedCv)

  // Markdown-only CVs (# titles, ## companies) have no ALL-CAPS section headers — keep as-is.
  if (generatedSections.length === 0) {
    return {
      mergedCv: generatedTrimmed,
      restoredSections: [],
    }
  }

  const sourceSections = parseSections(input.sourceCv)
  const restoredSections: CvSectionKind[] = []

  const sourceByKind = new Map<CvSectionKind, ParsedSection>()
  for (const section of sourceSections) {
    if (section.kind === "experience" || section.kind === "education") {
      if (!sourceByKind.has(section.kind)) sourceByKind.set(section.kind, section)
    }
  }

  const nextGenerated = generatedSections.map((section) => {
    if (section.kind !== "experience" && section.kind !== "education") return section
    const sourceSection = sourceByKind.get(section.kind)
    if (!sourceSection) return section
    if (
      !shouldRestoreSectionFromSource(section.kind, sourceSection.lines, section.lines)
    ) {
      return section
    }

    restoredSections.push(section.kind)
    return {
      ...section,
      lines: [...sourceSection.lines],
    }
  })

  const generatedKinds = new Set(nextGenerated.map((s) => s.kind))
  for (const kind of ["experience", "education"] as const) {
    if (generatedKinds.has(kind)) continue
    const sourceSection = sourceByKind.get(kind)
    if (!sourceSection || sourceSection.lines.length === 0) continue
    restoredSections.push(kind)
    nextGenerated.push({ ...sourceSection })
  }

  return {
    mergedCv: rebuildCv(nextGenerated),
    restoredSections,
  }
}

function normalizeCvFragment(fragment: string, preferredSection = "EXPERIENCE"): string {
  const trimmed = fragment.trim()
  if (!trimmed) return trimmed
  if (parseSections(trimmed).length > 0) return trimmed
  if (/^(PROFILE|EXPERIENCE|EDUCATION|SKILLS|LANGUAGES|PROJECTS|CERTIFICATIONS)\b/i.test(trimmed)) {
    return trimmed
  }
  if (/^-\s/m.test(trimmed) || /^#{1,3}\s/m.test(trimmed)) {
    return `${preferredSection}\n${trimmed}`
  }
  return trimmed
}

function findReplacementSection(
  baselineSection: ParsedSection,
  fragmentSections: ParsedSection[],
): ParsedSection | undefined {
  const headerKey = baselineSection.header.trim().toUpperCase()
  const byHeader = fragmentSections.find(
    (section) =>
      section.header.trim().toUpperCase() === headerKey &&
      sectionHasSubstance(section.kind, section.lines),
  )
  if (byHeader) return byHeader

  if (baselineSection.kind === "experience" || baselineSection.kind === "education") {
    return fragmentSections.find(
      (section) =>
        section.kind === baselineSection.kind &&
        sectionHasSubstance(section.kind, section.lines),
    )
  }

  return undefined
}

/** Merge a partial AI reply (e.g. EXPERIENCE only) into the baseline CV. */
export function mergePartialCvEdit(
  baselineCv: string,
  fragmentCv: string,
  options?: { preferredSection?: string },
): string | null {
  const normalizedFragment = normalizeCvFragment(
    fragmentCv,
    options?.preferredSection ?? "EXPERIENCE",
  )
  const baselineSections = parseSections(baselineCv)
  const fragmentSections = parseSections(normalizedFragment)
  if (baselineSections.length === 0 || fragmentSections.length === 0) return null

  let changed = false
  const nextSections = baselineSections.map((section) => {
    const replacement = findReplacementSection(section, fragmentSections)
    if (!replacement) return section
    if (replacement.lines.join("\n") === section.lines.join("\n")) return section
    changed = true
    return { ...section, lines: [...replacement.lines] }
  })

  const baselineHeaders = new Set(
    baselineSections.map((section) => section.header.trim().toUpperCase()),
  )
  for (const fragmentSection of fragmentSections) {
    const headerKey = fragmentSection.header.trim().toUpperCase()
    if (baselineHeaders.has(headerKey)) continue
    if (!sectionHasSubstance(fragmentSection.kind, fragmentSection.lines)) continue
    nextSections.push(fragmentSection)
    changed = true
  }

  if (!changed) return null
  return rebuildCv(nextSections)
}

export function finalizeTailoredCv(input: {
  sourceCv: string
  generatedCv: string
}): {
  resumeText: string
  validation: CvSectionValidation
  restoredSections: CvSectionKind[]
} {
  const generatedTrimmed = input.generatedCv.trim()
  const { mergedCv, restoredSections } = mergeMissingCvSectionsFromSource(input)
  const resumeText = mergedCv.trim() || generatedTrimmed
  const validation = validateGeneratedCvSections({
    sourceCv: input.sourceCv,
    generatedCv: resumeText,
  })

  return {
    resumeText,
    validation,
    restoredSections,
  }
}
