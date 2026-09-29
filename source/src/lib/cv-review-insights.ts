import type { CvEditChange } from "@/lib/cv-edit-types"
import {
  buildCvSectionAuthorshipGroups,
  summaryBucket,
} from "@/lib/cv-section-authorship"
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

export type CvReviewInsights = {
  score: number
  factors: CvScoreFactor[]
  suggestions: CvReviewSuggestion[]
  recentAiActions: string[]
  aiAssistedSections: number
  userWrittenSections: number
  hasAiActivity: boolean
}

export type CvReviewInput = {
  resumeText?: string
  contactInfo?: ResumeVersion["contactInfo"]
  jobDescription?: string
  aiAuditLog?: ResumeVersion["aiAuditLog"]
}

const METRIC_PATTERN = /(?:\d+%|\d+\s*(?:k|m|b|x|\+)|€|\$|£|\d{4})/i

function sectionNames(resumeText: string): string[] {
  const names: string[] = []
  resumeText.split("\n").forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (trimmed.startsWith("## ")) {
      names.push(trimmed.replace(/^##\s+/, "").trim())
      return
    }
    const isHeader =
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      !trimmed.startsWith("•") &&
      !trimmed.startsWith("-")
    if (isHeader && index > 2) names.push(trimmed)
  })
  return names
}

function hasSection(resumeText: string, keywords: string[]): boolean {
  const upper = resumeText.toUpperCase()
  return keywords.some((keyword) => upper.includes(keyword))
}

function countBullets(resumeText: string): number {
  return resumeText.split("\n").filter((line) => /^[\s•\-*]/.test(line.trim())).length
}

function bulletsWithMetrics(resumeText: string): number {
  return resumeText
    .split("\n")
    .filter((line) => /^[\s•\-*]/.test(line.trim()) && METRIC_PATTERN.test(line))
    .length
}

function humanizeAiChange(change: CvEditChange): string {
  const section = change.section?.trim() || "CV"
  const description = (change.description || "").toLowerCase()

  if (/summary|profile|about/i.test(section)) {
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

export function buildCvReviewInsights(resume: ResumeVersion | CvReviewInput | null): CvReviewInsights {
  const text = resume?.resumeText?.trim() ?? ""
  const groups = buildCvSectionAuthorshipGroups(
    resume && "id" in resume ? resume : null,
  )
  const sections = sectionNames(text)

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
        { text: "Add your experience and skills to get tailored suggestions", tone: "warning" },
      ],
      recentAiActions: [],
      aiAssistedSections: 0,
      userWrittenSections: 0,
      hasAiActivity: false,
    }
  }

  const factors: CvScoreFactor[] = []
  let score = 42
  factors.push({
    label: "Base structure",
    detail: "Starting score for a resume with content",
    points: 42,
    maxPoints: 42,
  })

  const suggestions: CvReviewSuggestion[] = []

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
      detail: "Add email or phone at the top",
      points: 0,
      maxPoints: 8,
    })
    suggestions.push({ text: "Add contact details at the top of your CV", tone: "warning" })
  }

  if (hasSection(text, ["EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT"])) {
    score += 14
    factors.push({
      label: "Experience section",
      detail: "Work history section detected",
      points: 14,
      maxPoints: 14,
    })
    suggestions.push({ text: "Strong experience section", tone: "positive" })
  } else {
    factors.push({
      label: "Experience section",
      detail: "Add a clear experience section",
      points: 0,
      maxPoints: 14,
    })
    suggestions.push({ text: "Add a clear experience section", tone: "warning" })
  }

  if (hasSection(text, ["SKILLS", "COMPETENCIES", "TECHNICAL"])) {
    const skillLines = text
      .split("\n")
      .filter((line) => /skill|competenc/i.test(line)).length
    if (skillLines < 3 && sections.length > 0) {
      score += 6
      factors.push({
        label: "Skills section",
        detail: "Present but could include more detail",
        points: 6,
        maxPoints: 10,
      })
      suggestions.push({ text: "Skills section could be expanded", tone: "warning" })
    } else {
      score += 10
      factors.push({
        label: "Skills section",
        detail: "Skills or competencies listed",
        points: 10,
        maxPoints: 10,
      })
    }
  } else {
    factors.push({
      label: "Skills section",
      detail: "Add a dedicated skills section",
      points: 0,
      maxPoints: 10,
    })
    suggestions.push({ text: "Skills section could be expanded", tone: "warning" })
  }

  if (hasSection(text, ["SUMMARY", "PROFILE", "ABOUT"])) {
    score += 8
    factors.push({
      label: "Professional summary",
      detail: "Summary or profile section found",
      points: 8,
      maxPoints: 8,
    })
  } else {
    factors.push({
      label: "Professional summary",
      detail: "Consider adding a short profile",
      points: 0,
      maxPoints: 8,
    })
    suggestions.push({ text: "Consider adding a professional summary", tone: "warning" })
  }

  const bullets = countBullets(text)
  const metricBullets = bulletsWithMetrics(text)
  if (metricBullets >= 2) {
    score += 12
    factors.push({
      label: "Measurable achievements",
      detail: `${metricBullets} bullets include numbers or metrics`,
      points: 12,
      maxPoints: 12,
    })
    suggestions.push({ text: "Good use of measurable achievements", tone: "positive" })
  } else if (bullets >= 3) {
    factors.push({
      label: "Measurable achievements",
      detail: "Bullets present — add more metrics where possible",
      points: 4,
      maxPoints: 12,
    })
    suggestions.push({ text: "Add more measurable achievements", tone: "warning" })
    score += 4
  } else {
    factors.push({
      label: "Measurable achievements",
      detail: "Use numbers, %, or outcomes in bullets",
      points: 0,
      maxPoints: 12,
    })
  }

  if (text.length > 1200) {
    score += 6
    factors.push({
      label: "Content depth",
      detail: "Resume has substantial detail",
      points: 6,
      maxPoints: 6,
    })
  } else {
    factors.push({
      label: "Content depth",
      detail: "Add more detail to strengthen your profile",
      points: 0,
      maxPoints: 6,
    })
  }

  if (resume?.jobDescription?.trim()) {
    score += 4
    factors.push({
      label: "Job targeting",
      detail: "Linked to a job description",
      points: 4,
      maxPoints: 4,
    })
  } else {
    factors.push({
      label: "Job targeting",
      detail: "Link a job advert for better alignment",
      points: 0,
      maxPoints: 4,
    })
  }

  score = Math.min(96, Math.max(35, score))

  if (suggestions.length === 0) {
    suggestions.push({ text: "CV structure looks solid — review wording before export", tone: "positive" })
  }

  return {
    score: Math.round(score),
    factors,
    suggestions: suggestions.slice(0, 4),
    recentAiActions,
    aiAssistedSections,
    userWrittenSections: userWrittenSections || Math.max(sections.length - aiAssistedSections, 0),
    hasAiActivity,
  }
}

export const EXPORT_REVIEW_CHECKLIST = [
  "Check dates",
  "Verify achievements",
  "Ensure wording matches your experience",
  "Review AI suggestions",
] as const
