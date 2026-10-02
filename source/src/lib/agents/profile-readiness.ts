/**
 * Profile readiness + section grouping for the guided profile UI.
 */

import type { AgentProfileFact } from "@/lib/agents/types"
import type { ProfileCopy } from "@/lib/agents/profile-copy"

export type ProfileSectionId =
  | "experience"
  | "achievements"
  | "education"
  | "skills"
  | "languages"
  | "projects"

export const PROFILE_SECTION_ORDER: ProfileSectionId[] = [
  "experience",
  "achievements",
  "education",
  "skills",
  "languages",
  "projects",
]

export function sectionForCategory(category: string): ProfileSectionId {
  switch (category) {
    case "role":
    case "employer":
    case "dates":
    case "experience":
    case "summary":
    case "identity":
      return "experience"
    case "achievement":
      return "achievements"
    case "education":
      return "education"
    case "skill":
    case "certification":
      return "skills"
    case "language":
      return "languages"
    default:
      return "projects"
  }
}

export function groupFactsBySection(
  facts: AgentProfileFact[],
): Record<ProfileSectionId, AgentProfileFact[]> {
  const out: Record<ProfileSectionId, AgentProfileFact[]> = {
    experience: [],
    achievements: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
  }
  for (const fact of facts) {
    out[sectionForCategory(fact.category)].push(fact)
  }
  return out
}

export type ProfileReadyChecklist = {
  ready: boolean
  hasCurrentRole: boolean
  achievementCount: number
  hasEducation: boolean
  hasLanguages: boolean
  missingLabels: string[]
}

function looksLikeCurrentRole(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /\b(present|current|heute|aktuell|seit)\b/i.test(t) ||
    /\b(20\d{2})\s*[–—\-]\s*$/i.test(t.trim()) ||
    /\b(20\d{2})\s*[–—\-]\s*(present|current|heute|jetzt)\b/i.test(t)
  )
}

export function evaluateProfileReadiness(
  facts: AgentProfileFact[],
  copy: ProfileCopy,
): ProfileReadyChecklist {
  const confirmed = facts.filter((f) => f.status === "confirmed")

  const hasCurrentRole = confirmed.some((f) => {
    if (f.category !== "role" && f.category !== "experience") return false
    return (
      looksLikeCurrentRole(f.factText) ||
      /\(current\)/i.test(f.factText) ||
      /· current\b/i.test(f.factText)
    )
  })

  const achievementCount = confirmed.filter((f) => f.category === "achievement").length
  const hasEducation = confirmed.some((f) => f.category === "education")
  const hasLanguages = confirmed.some((f) => f.category === "language")

  const missingLabels: string[] = []
  if (!hasCurrentRole) missingLabels.push(copy.ready.currentRole)
  if (achievementCount < 3) missingLabels.push(copy.ready.achievements)
  if (!hasEducation) missingLabels.push(copy.ready.education)
  if (!hasLanguages) missingLabels.push(copy.ready.languages)

  return {
    ready: missingLabels.length === 0,
    hasCurrentRole,
    achievementCount,
    hasEducation,
    hasLanguages,
    missingLabels,
  }
}

export type ProfileStep = 1 | 2 | 3

export function resolveProfileStep(facts: AgentProfileFact[]): ProfileStep {
  if (facts.length === 0) return 1
  const unchecked = facts.filter((f) => f.status !== "confirmed").length
  if (unchecked > 0) return 2
  return 3
}

export function sourceLabelForFact(fact: AgentProfileFact, locale: "en" | "de"): string {
  const ref = fact.sourceRef ?? {}
  if (ref.field === "career_direction") {
    return locale === "de" ? "alle Workspace-Lebensläufe" : "all workspace CVs"
  }
  const section =
    typeof ref.section === "string"
      ? ref.section
      : typeof ref.field === "string"
        ? ref.field
        : null
  if (fact.source === "manual") {
    return locale === "de" ? "von Hand hinzugefügt" : "added by hand"
  }
  if (fact.source === "qualification_profile") {
    return locale === "de" ? "Qualifikationsprofil" : "qualification profile"
  }
  if (section) {
    const cvLabel = typeof ref.label === "string" ? ref.label.trim() : ""
    if (cvLabel) {
      return locale === "de" ? `dein Lebenslauf „${cvLabel}“` : `your CV “${cvLabel}”`
    }
    return locale === "de" ? `dein Lebenslauf „${section}“` : `your CV “${section}”`
  }
  return locale === "de" ? "dein Lebenslauf" : "your CV"
}
