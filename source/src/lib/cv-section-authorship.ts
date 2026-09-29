import type { CvEditChange } from "@/lib/cv-edit-types"
import type { AiAuthorshipLabel } from "@/lib/ai-transparency"
import type { ResumeVersion } from "@/lib/types"

export type CvSectionAuthorship = {
  section: string
  label: AiAuthorshipLabel
}

export type CvSectionAuthorshipItem = {
  label: string
  authorship: AiAuthorshipLabel
}

export type CvSectionAuthorshipGroup = {
  section: string
  label: AiAuthorshipLabel
  isMixed: boolean
  items?: CvSectionAuthorshipItem[]
}

export type AuthorshipSummaryBucket = "user_authored" | "ai_enhanced" | "ai_generated"

export type AuthorshipSummary = {
  counts: Record<AuthorshipSummaryBucket, number>
  total: number
  percentages: Record<AuthorshipSummaryBucket, number>
}

const CV_SECTION_AUTHORSHIP_PANEL_STORAGE_KEY = "cv-tool:cv-section-authorship-panel-expanded"
const SHOW_AUTHORSHIP_DETAILS_STORAGE_KEY = "cv-tool:show-authorship-details"

function parseResumeSections(resumeText: string): string[] {
  const sections: string[] = []
  const commonSections = [
    "EXPERIENCE",
    "EDUCATION",
    "SKILLS",
    "PROJECTS",
    "CERTIFICATIONS",
    "SUMMARY",
    "ABOUT",
    "PROFILE",
    "PROFESSIONAL SUMMARY",
  ]

  resumeText.split("\n").forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return

    if (trimmed.startsWith("## ")) {
      sections.push(trimmed.replace(/^##\s+/, "").trim())
      return
    }

    const isHeader =
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      !trimmed.startsWith("•") &&
      !trimmed.startsWith("-")
    const isSectionHeader =
      isHeader || commonSections.some((s) => trimmed.toUpperCase().includes(s))

    if (isSectionHeader && index > 2) {
      sections.push(trimmed)
    }
  })

  return sections
}

function matchSection(changeSection: string, resumeSection: string): boolean {
  const a = changeSection.toLowerCase()
  const b = resumeSection.toLowerCase()
  return a.includes(b) || b.includes(a) || a === b
}

function labelFromChange(change: CvEditChange): AiAuthorshipLabel {
  return change.authorship ?? "ai_enhanced"
}

function changesForSection(section: string, changes: CvEditChange[]): CvEditChange[] {
  return changes.filter((c) => matchSection(c.section, section))
}

function describeChange(change: CvEditChange): string {
  const text = change.description?.trim() || change.after?.trim() || change.before?.trim()
  if (!text) return "Edited content"
  const singleLine = text.replace(/\s+/g, " ")
  return singleLine.length > 88 ? `${singleLine.slice(0, 85)}…` : singleLine
}

function dominantAuthorshipLabel(labels: AiAuthorshipLabel[]): AiAuthorshipLabel {
  if (labels.length === 0) return "user_authored"
  const tally = new Map<AiAuthorshipLabel, number>()
  for (const label of labels) {
    tally.set(label, (tally.get(label) ?? 0) + 1)
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export function summaryBucket(label: AiAuthorshipLabel): AuthorshipSummaryBucket {
  if (label === "ai_generated") return "ai_generated"
  if (label === "ai_enhanced") return "ai_enhanced"
  return "user_authored"
}

function collectCvAuthorshipChanges(resume: ResumeVersion | null): CvEditChange[] {
  if (!resume) return []

  const approvedChanges =
    resume.aiAuditLog
      ?.filter((e) => e.approvalStatus === "approved")
      .flatMap((e) => e.changes ?? []) ?? []

  const historyChanges =
    resume.versionHistory
      ?.filter((s) => s.source === "ai_edit")
      .flatMap((s) => s.aiMetadata?.changes ?? []) ?? []

  return [...approvedChanges, ...historyChanges]
}

function authorshipFromChanges(
  section: string,
  changes: CvEditChange[],
): AiAuthorshipLabel {
  const hits = changesForSection(section, changes)
  if (hits.length === 0) return "user_authored"
  return dominantAuthorshipLabel(hits.map(labelFromChange))
}

/** Map CV ## sections to authorship labels from approved AI audit history. */
export function buildCvSectionAuthorship(resume: ResumeVersion | null): CvSectionAuthorship[] {
  if (!resume?.resumeText?.trim()) return []

  const sections = parseResumeSections(resume.resumeText)
  if (sections.length === 0) {
    return [{ section: "Full CV", label: "user_authored" }]
  }

  const allChanges = collectCvAuthorshipChanges(resume)

  if (allChanges.length === 0) {
    return sections.map((section) => ({ section, label: "user_authored" as const }))
  }

  return sections.map((section) => ({
    section,
    label: authorshipFromChanges(section, allChanges),
  }))
}

/** Section-level authorship with line detail only when labels differ within a section. */
export function buildCvSectionAuthorshipGroups(
  resume: ResumeVersion | null,
): CvSectionAuthorshipGroup[] {
  if (!resume?.resumeText?.trim()) return []

  const sections = parseResumeSections(resume.resumeText)
  const allChanges = collectCvAuthorshipChanges(resume)

  if (sections.length === 0) {
    const label =
      allChanges.length === 0 ? "user_authored" : dominantAuthorshipLabel(allChanges.map(labelFromChange))
    return [{ section: "Full CV", label, isMixed: false }]
  }

  if (allChanges.length === 0) {
    return sections.map((section) => ({
      section,
      label: "user_authored" as const,
      isMixed: false,
    }))
  }

  return sections.map((section) => {
    const hits = changesForSection(section, allChanges)
    if (hits.length === 0) {
      return { section, label: "user_authored" as const, isMixed: false }
    }

    const labels = hits.map(labelFromChange)
    const unique = new Set(labels)

    if (unique.size === 1) {
      return { section, label: labels[0], isMixed: false }
    }

    return {
      section,
      label: dominantAuthorshipLabel(labels),
      isMixed: true,
      items: hits.map((change) => ({
        label: describeChange(change),
        authorship: labelFromChange(change),
      })),
    }
  })
}

export function buildAuthorshipSummary(groups: CvSectionAuthorshipGroup[]): AuthorshipSummary {
  const counts: Record<AuthorshipSummaryBucket, number> = {
    user_authored: 0,
    ai_enhanced: 0,
    ai_generated: 0,
  }

  for (const group of groups) {
    if (group.isMixed && group.items?.length) {
      for (const item of group.items) {
        counts[summaryBucket(item.authorship)] += 1
      }
    } else {
      counts[summaryBucket(group.label)] += 1
    }
  }

  const total = counts.user_authored + counts.ai_enhanced + counts.ai_generated
  const percentages: Record<AuthorshipSummaryBucket, number> = {
    user_authored: 0,
    ai_enhanced: 0,
    ai_generated: 0,
  }

  if (total > 0) {
    percentages.user_authored = Math.round((counts.user_authored / total) * 100)
    percentages.ai_enhanced = Math.round((counts.ai_enhanced / total) * 100)
    percentages.ai_generated = Math.round((counts.ai_generated / total) * 100)
    const sum =
      percentages.user_authored + percentages.ai_enhanced + percentages.ai_generated
    if (sum !== 100) {
      const largest = (["user_authored", "ai_enhanced", "ai_generated"] as const).sort(
        (a, b) => counts[b] - counts[a],
      )[0]
      percentages[largest] += 100 - sum
    }
  }

  return { counts, total, percentages }
}

export function readCvSectionAuthorshipPanelExpanded(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(CV_SECTION_AUTHORSHIP_PANEL_STORAGE_KEY) === "true"
}

export function writeCvSectionAuthorshipPanelExpanded(expanded: boolean): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CV_SECTION_AUTHORSHIP_PANEL_STORAGE_KEY, expanded ? "true" : "false")
}

export function readShowAuthorshipDetails(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(SHOW_AUTHORSHIP_DETAILS_STORAGE_KEY) === "true"
}

export function writeShowAuthorshipDetails(show: boolean): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SHOW_AUTHORSHIP_DETAILS_STORAGE_KEY, show ? "true" : "false")
}

export function getSectionAuthorshipLabel(
  sectionTitle: string,
  resume: ResumeVersion | null,
): AiAuthorshipLabel {
  const sections = buildCvSectionAuthorship(resume)
  const hit = sections.find((s) => matchSection(s.section, sectionTitle))
  return hit?.label ?? "user_authored"
}

