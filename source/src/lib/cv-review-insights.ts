import type { CvEditChange } from "@/lib/cv-edit-types"
import {
  buildCvSectionAuthorshipGroups,
  summaryBucket,
} from "@/lib/cv-section-authorship"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { parseResumeText, type ParsedResumeSection } from "@/lib/parse-resume-text"
import {
  parseTwoColumnSectionItems,
  resolveSectionColumnCount,
} from "@/lib/cv-two-column-section"
import { tryParseMarkdownTableAt } from "@/lib/resume-markdown-table"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"
import type { ResumeVersion } from "@/lib/types"

export type CvReviewSuggestion = {
  text: string
  tone: "positive" | "warning"
}

export type CvScoreFactor = {
  label: string
  detail: string
  points: number
  maxPoints: number
}

/** Optional readiness-adjacent note — not part of the 96-point score. */
export type CvJobAlignmentNote = {
  linked: boolean
  detail: string
  suggestion?: string
}

export type CvReviewInsights = {
  score: number
  factors: CvScoreFactor[]
  suggestions: CvReviewSuggestion[]
  recentAiActions: string[]
  aiAssistedSections: number
  userWrittenSections: number
  hasAiActivity: boolean
  jobAlignment?: CvJobAlignmentNote
}

export type CvReviewInput = {
  resumeText?: string
  contactInfo?: ResumeVersion["contactInfo"]
  jobDescription?: string
  aiAuditLog?: ResumeVersion["aiAuditLog"]
}

/** Explicit profile / summary headings beyond SECTION_ALIASES. */
const PROFILE_HEADING_RE =
  /^(PROFILE|PROFIL|SUMMARY|PROFESSIONAL\s+SUMMARY|ABOUT(?:\s+ME)?|WHAT\s+I\s+CAN\s+SOLVE\s+FOR\s+YOU|VALUE\s+PROPOSITION|VALUE\s+PROP|WERTANGEBOT|ZUSAMMENFASSUNG)\b/i

const EVIDENCE_HEADING_RE =
  /^(SELECTED\s+EVIDENCE|AUSGEW[AÄ]HLTE\s+BELEGE|ROLE\s+REQUIREMENTS)/i

/** Credible delivered-outcome signals (not invented vanity metrics). */
const QUANT_OUTCOME_RE =
  /(?:\d+(?:[.,]\d+)?\s*%|\d+(?:[.,]\d+)?\s*[kKmMbB]\+?|\d{1,3}(?:,\d{3})+|\d+\s*\+|€\s*\d|\$\s*\d|£\s*\d|\b\d+\s*(?:downloads?|users?|participants?|teams?|countries|markets|clients?|stakeholders?|interviews?|studies|sessions?|workshops?)\b)/i

const DELIVERED_OUTCOME_RE =
  /\b(?:launched|shipped|released|delivered|adopted|rolled\s+out|certified|published|informed|implemented|reduced|increased|improved|achieved|completed|established|built|created|led|drove)\b/i

const CERT_OR_MILESTONE_RE =
  /\b(?:BITV|WCAG|ISO\s*\d+|certified|certification|accreditation|milestone|framework|playbook|design\s+system|learning\s+resource)\b/i

const PROPOSED_WORK_RE =
  /\b(?:propos(?:e|ed|al)|would\s+|could\s+|should\s+|pilot\s+proposed|in\s+progress|planned|upcoming|aspirational|hypothetical)\b/i

function sectionKey(section: ParsedResumeSection): string | null {
  return normalizeCvSectionKey(stripSectionColumnModifier(section.title))
}

function plainContent(lines: string[]): string {
  return lines
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-•*]\s+/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" ")
}

function isSubstantiveContent(lines: string[], minChars = 48): boolean {
  const plain = plainContent(lines)
  if (plain.length < minChars) return false
  // Heading-only / placeholder
  if (/^(todo|tbd|placeholder|lorem ipsum)\b/i.test(plain)) return false
  return true
}

function isProfileHeading(title: string): boolean {
  const stripped = stripSectionColumnModifier(title).trim()
  if (!stripped) return false
  if (normalizeCvSectionKey(stripped) === "PROFILE") return true
  return PROFILE_HEADING_RE.test(stripped)
}

function findProfileSection(sections: ParsedResumeSection[]): ParsedResumeSection | null {
  for (const section of sections) {
    if (isProfileHeading(section.title) && isSubstantiveContent(section.content)) {
      return section
    }
  }

  // Positional intro: first non-empty section before experience/education/skills
  // that reads like a value proposition (not a job block).
  for (const section of sections) {
    const key = sectionKey(section)
    if (key === "EXPERIENCE" || key === "EDUCATION" || key === "SKILLS" || key === "PROJECTS") {
      break
    }
    if (EVIDENCE_HEADING_RE.test(stripSectionColumnModifier(section.title))) continue
    if (!isSubstantiveContent(section.content, 60)) continue
    const body = plainContent(section.content)
    const looksLikeJobBlock = /^#\s+\S/m.test(section.content.join("\n"))
    if (looksLikeJobBlock) continue
    if (
      /\b(I\s+(help|solve|design|lead|bring)|can\s+help|for\s+you|value|problem|outcome)\b/i.test(
        body,
      )
    ) {
      return section
    }
  }
  return null
}

function findSkillsSection(sections: ParsedResumeSection[]): ParsedResumeSection | null {
  for (const section of sections) {
    if (sectionKey(section) === "SKILLS") return section
  }
  return null
}

function countSkillItems(section: ParsedResumeSection): number {
  return parseTwoColumnSectionItems(section.content).length
}

function findEvidenceTable(sections: ParsedResumeSection[]): {
  section: ParsedResumeSection | null
  columns: number
  rows: number
  hasOutcomeColumn: boolean
} {
  for (const section of sections) {
    const title = stripSectionColumnModifier(section.title).trim()
    const isEvidence = EVIDENCE_HEADING_RE.test(title)
    const lines = section.content
    for (let i = 0; i < lines.length; i++) {
      const parsed = tryParseMarkdownTableAt(lines, i)
      if (!parsed) continue
      const headers = parsed.table.headers.map((h) => h.toLowerCase())
      const looksLikeEvidence =
        isEvidence ||
        headers.some((h) => /criterion|requirement|evidence|outcome|status|rolle|beleg/i.test(h))
      if (!looksLikeEvidence) continue
      return {
        section,
        columns: headers.length,
        rows: parsed.table.rows.length,
        hasOutcomeColumn: headers.some((h) => /outcome|status|ergebnis/i.test(h)),
      }
    }
    if (isEvidence && isSubstantiveContent(section.content, 30)) {
      return { section, columns: 0, rows: 0, hasOutcomeColumn: false }
    }
  }
  return { section: null, columns: 0, rows: 0, hasOutcomeColumn: false }
}

type EvidenceHit = {
  text: string
  kind: "quantitative" | "delivered" | "credential" | "proposed"
}

function collectEvidenceHits(text: string): EvidenceHit[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const hits: EvidenceHit[] = []

  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s+/, "").replace(/^#{1,6}\s+/, "").trim()
    if (!cleaned || cleaned.startsWith("|---") || /^[-|:\s]+$/.test(cleaned)) continue
    // Skip pure table header rows
    if (/^\|?\s*role\s+criterion/i.test(cleaned)) continue

    const isProposed = PROPOSED_WORK_RE.test(cleaned)
    if (isProposed) {
      hits.push({ text: cleaned, kind: "proposed" })
      continue
    }
    if (QUANT_OUTCOME_RE.test(cleaned)) {
      hits.push({ text: cleaned, kind: "quantitative" })
      continue
    }
    if (CERT_OR_MILESTONE_RE.test(cleaned)) {
      hits.push({ text: cleaned, kind: "credential" })
      continue
    }
    if (DELIVERED_OUTCOME_RE.test(cleaned) && cleaned.length > 28) {
      hits.push({ text: cleaned, kind: "delivered" })
    }
  }
  return hits
}

function scoreMeasurableAchievements(
  resumeText: string,
  evidenceTable: ReturnType<typeof findEvidenceTable>,
): { points: number; detail: string; suggestion: CvReviewSuggestion | null } {
  const hits = collectEvidenceHits(resumeText)
  const proposed = hits.filter((h) => h.kind === "proposed").length
  const quantitative = hits.filter((h) => h.kind === "quantitative").length
  const delivered = hits.filter((h) => h.kind === "delivered" || h.kind === "credential").length
  const strong = quantitative + delivered

  let points = 0
  let detail = ""
  let suggestion: CvReviewSuggestion | null = null

  if (strong >= 4 || (strong >= 2 && evidenceTable.rows >= 3)) {
    points = 12
    detail = `Detected ${quantitative} quantitative and ${delivered} delivered-outcome signals`
    if (evidenceTable.rows > 0) {
      detail += `; Selected Evidence table (${evidenceTable.columns || "n"}-col, ${evidenceTable.rows} rows)`
    }
    if (proposed > 0) {
      detail += `. ${proposed} proposed/in-progress items noted (not scored as delivered)`
    }
    suggestion = {
      text: "Strong delivered evidence — keep proposed work labelled separately",
      tone: "positive",
    }
  } else if (strong >= 2 || evidenceTable.rows >= 2) {
    points = 8
    detail = `Some credible outcomes found (${strong} delivered/quantitative)`
    if (evidenceTable.rows > 0) detail += `; evidence table with ${evidenceTable.rows} rows`
    suggestion = {
      text: "Add 1–2 more verified outcomes (adoption, certification, or shipped work) — avoid inventing metrics",
      tone: "warning",
    }
  } else if (strong >= 1 || hits.length >= 3) {
    points = 4
    detail =
      strong >= 1
        ? "Limited delivered evidence detected"
        : "Bullets present but few verified outcomes"
    suggestion = {
      text: "Strengthen evidence with verified outcomes you actually delivered (not proposed work)",
      tone: "warning",
    }
  } else {
    points = 0
    detail = "No clear quantitative or delivered outcomes detected"
    suggestion = {
      text: "Add verified achievements — downloads, certifications, launches, or adopted frameworks — only where true",
      tone: "warning",
    }
  }

  return { points, detail, suggestion }
}

function scoreSkills(
  sections: ParsedResumeSection[],
  resumeText: string,
): { points: number; detail: string; suggestion: CvReviewSuggestion | null } {
  const skillsSection = findSkillsSection(sections)
  if (!skillsSection) {
    // Skills evidenced only in experience/projects
    const experienceSkills = (
      resumeText.match(
        /\b(?:Figma|React|research|accessibility|WCAG|workshop|prototyp|facilitation|strategy)\b/gi,
      ) ?? []
    ).length
    if (experienceSkills >= 6) {
      return {
        points: 6,
        detail: "Skills appear in experience/project evidence but no dedicated skills section",
        suggestion: {
          text: "Add a SKILLS section (optionally SKILLS [columns=2|3]) for scanability",
          tone: "warning",
        },
      }
    }
    return {
      points: 0,
      detail: "No skills section detected",
      suggestion: {
        text: "Add a dedicated skills section with role-relevant capabilities",
        tone: "warning",
      },
    }
  }

  const items = countSkillItems(skillsSection)
  const columns = resolveSectionColumnCount(skillsSection)
  const heading = stripSectionColumnModifier(skillsSection.title).trim()

  if (items >= 6 || (columns > 1 && items >= 4)) {
    return {
      points: 10,
      detail: `Skills section “${heading}” with ${items} items${columns > 1 ? ` in ${columns} columns` : ""}`,
      suggestion: null,
    }
  }
  if (items >= 3 || columns > 1) {
    return {
      points: 6,
      detail: `Skills section present (${items} items${columns > 1 ? `, ${columns} columns` : ""}) — coverage is thin`,
      suggestion: {
        text: "Expand skills with role-relevant tools and methods (quality over filler)",
        tone: "warning",
      },
    }
  }
  return {
    points: 4,
    detail: "Skills heading found but little substantive content",
    suggestion: {
      text: "Add concrete skills under the skills heading",
      tone: "warning",
    },
  }
}

function humanizeAiChange(change: CvEditChange): string {
  const section = change.section?.trim() || "CV"
  const description = (change.description || "").toLowerCase()

  if (/summary|profile|about|solve/i.test(section)) {
    if (change.type === "updated" || change.type === "added") return "Rewrote Professional Summary"
  }
  if (/keyword|ats|tailor/i.test(description)) return "Added ATS keywords"
  if (/readab|clarif|concise|structure/i.test(description)) return "Improved readability"
  if (/experience|role|position/i.test(section) && change.type === "updated") {
    return "Strengthened experience section"
  }
  if (/skill/i.test(section)) return "Expanded skills section"
  if (change.description?.trim()) return change.description.trim()
  if (change.type === "added") return `Added content to ${section}`
  if (change.type === "removed") return `Removed content from ${section}`
  return `Updated ${section}`
}

function collectRecentAiActions(resume: ResumeVersion | null): string[] {
  if (!resume) return []

  const seen = new Set<string>()
  const actions: string[] = []

  const approved =
    resume.aiAuditLog?.filter((entry) => entry.approvalStatus === "approved") ?? []

  for (const entry of [...approved].reverse()) {
    if (entry.changes?.length) {
      for (const change of [...entry.changes].reverse()) {
        const label = humanizeAiChange(change)
        if (!seen.has(label)) {
          seen.add(label)
          actions.push(label)
        }
      }
    } else if (entry.action?.trim()) {
      const label = entry.action.trim()
      if (!seen.has(label)) {
        seen.add(label)
        actions.push(label)
      }
    }
    if (actions.length >= 5) break
  }

  return actions
}

function buildJobAlignmentNote(
  resumeText: string,
  jobDescription?: string,
): CvJobAlignmentNote {
  const jd = jobDescription?.trim() ?? ""
  if (!jd) {
    return {
      linked: false,
      detail: "No job description linked — readiness score does not predict job fit",
      suggestion: "Link a job advert to review evidence against role requirements separately",
    }
  }

  const evidence = findEvidenceTable(parseResumeText(resumeText))
  if (evidence.rows >= 3) {
    return {
      linked: true,
      detail: `Job linked. Selected Evidence table maps ${evidence.rows} requirements to your evidence (not a keyword match score)`,
    }
  }

  return {
    linked: true,
    detail:
      "Job description linked. Alignment is assessed via verified evidence for requirements — not keyword stuffing",
    suggestion:
      "Use Selected Evidence to map exact job criteria to delivered work (avoid keyword-only padding)",
  }
}

export function buildCvReviewInsights(
  resume: ResumeVersion | CvReviewInput | null,
): CvReviewInsights {
  const text = resume?.resumeText?.trim() ?? ""
  const groups = buildCvSectionAuthorshipGroups(
    resume && "id" in resume ? resume : null,
  )

  let aiAssistedSections = 0
  let userWrittenSections = 0
  for (const group of groups) {
    const bucket = summaryBucket(group.label)
    if (bucket === "ai_enhanced" || bucket === "ai_generated") {
      aiAssistedSections += 1
    } else {
      userWrittenSections += 1
    }
  }

  const recentAiActions = collectRecentAiActions(
    resume && "id" in resume ? resume : null,
  )
  const hasAiActivity = recentAiActions.length > 0 || aiAssistedSections > 0

  if (!text) {
    return {
      score: 0,
      factors: [],
      suggestions: [
        {
          text: "Add your experience and skills to get tailored suggestions",
          tone: "warning",
        },
      ],
      recentAiActions: [],
      aiAssistedSections: 0,
      userWrittenSections: 0,
      hasAiActivity: false,
      jobAlignment: {
        linked: false,
        detail: "No CV content yet",
      },
    }
  }

  // Same parser as preview / PDF
  const sections = parseResumeText(text)
  const factors: CvScoreFactor[] = []
  const suggestions: CvReviewSuggestion[] = []
  let score = 42

  factors.push({
    label: "Base structure",
    detail: "Starting score for a resume with content",
    points: 42,
    maxPoints: 42,
  })

  // Contact
  if (resume?.contactInfo?.email?.trim() || resume?.contactInfo?.phone?.trim()) {
    score += 8
    factors.push({
      label: "Contact details",
      detail: "Email or phone is present",
      points: 8,
      maxPoints: 8,
    })
  } else {
    factors.push({
      label: "Contact details",
      detail: "Missing — add email or phone (formatting issue: incomplete header fields)",
      points: 0,
      maxPoints: 8,
    })
    suggestions.push({
      text: "Add contact details at the top of your CV",
      tone: "warning",
    })
  }

  // Experience
  const hasExperience = sections.some((s) => sectionKey(s) === "EXPERIENCE")
  if (hasExperience) {
    score += 14
    factors.push({
      label: "Experience section",
      detail: "Work history section detected via CV parser",
      points: 14,
      maxPoints: 14,
    })
  } else {
    factors.push({
      label: "Experience section",
      detail: "Missing — add an EXPERIENCE section with roles",
      points: 0,
      maxPoints: 14,
    })
    suggestions.push({ text: "Add a clear experience section", tone: "warning" })
  }

  // Skills
  const skillsScore = scoreSkills(sections, text)
  score += skillsScore.points
  factors.push({
    label: "Skills section",
    detail: skillsScore.detail,
    points: skillsScore.points,
    maxPoints: 10,
  })
  if (skillsScore.suggestion) suggestions.push(skillsScore.suggestion)

  // Professional summary / intro
  const profile = findProfileSection(sections)
  if (profile) {
    score += 8
    const label = stripSectionColumnModifier(profile.title).trim() || "introductory section"
    factors.push({
      label: "Professional summary",
      detail: `Detected “${label}” with substantive content (${plainContent(profile.content).length} characters)`,
      points: 8,
      maxPoints: 8,
    })
  } else {
    const emptyProfile = sections.find((s) => isProfileHeading(s.title))
    factors.push({
      label: "Professional summary",
      detail: emptyProfile
        ? `Heading “${stripSectionColumnModifier(emptyProfile.title)}” found but content is too thin`
        : "No PROFILE / summary / value-proposition section with substance",
      points: 0,
      maxPoints: 8,
    })
    suggestions.push({
      text: emptyProfile
        ? "Add 2–3 substantive lines under your summary heading"
        : "Add a short profile (PROFILE, SUMMARY, or WHAT I CAN SOLVE FOR YOU)",
      tone: "warning",
    })
  }

  // Measurable / delivered achievements
  const evidenceTable = findEvidenceTable(sections)
  const achievements = scoreMeasurableAchievements(text, evidenceTable)
  score += achievements.points
  factors.push({
    label: "Measurable achievements",
    detail: achievements.detail,
    points: achievements.points,
    maxPoints: 12,
  })
  if (achievements.suggestion) suggestions.push(achievements.suggestion)

  // Content depth
  if (text.length > 1200 || sections.length >= 4) {
    score += 6
    factors.push({
      label: "Content depth",
      detail:
        text.length > 1200
          ? `Substantial detail (${text.length} characters, ${sections.length} sections)`
          : `${sections.length} parsed sections`,
      points: 6,
      maxPoints: 6,
    })
  } else {
    factors.push({
      label: "Content depth",
      detail: "CV is short — add verified experience or evidence where relevant",
      points: 0,
      maxPoints: 6,
    })
  }

  // Job targeting (readiness: linked JD only — not interview prediction)
  const jd =
    resume?.jobDescription?.trim() ||
    (resume && "jobDescription" in resume
      ? String((resume as ResumeVersion).jobDescription ?? "").trim()
      : "")
  if (jd) {
    score += 4
    factors.push({
      label: "Job targeting",
      detail: "Linked to a job description (readiness setup — not a hire prediction)",
      points: 4,
      maxPoints: 4,
    })
  } else {
    factors.push({
      label: "Job targeting",
      detail: "No job advert linked yet",
      points: 0,
      maxPoints: 4,
    })
  }

  const jobAlignment = buildJobAlignmentNote(text, jd)

  score = Math.min(96, Math.max(35, score))

  // Prefer actionable warnings; keep at most one positive if room
  const warnings = suggestions.filter((s) => s.tone === "warning")
  const positives = suggestions.filter((s) => s.tone === "positive")
  const ordered = [...warnings, ...positives].slice(0, 4)
  if (ordered.length === 0) {
    ordered.push({
      text: "CV structure looks solid — review wording before export",
      tone: "positive",
    })
  }

  return {
    score: Math.round(score),
    factors,
    suggestions: ordered,
    recentAiActions,
    aiAssistedSections,
    userWrittenSections:
      userWrittenSections || Math.max(sections.length - aiAssistedSections, 0),
    hasAiActivity,
    jobAlignment,
  }
}

export const EXPORT_REVIEW_CHECKLIST = [
  "Check dates",
  "Verify achievements",
  "Ensure wording matches your experience",
  "Review AI suggestions",
] as const
