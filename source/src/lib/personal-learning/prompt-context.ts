import { AI_EXPLAINABILITY_RULES, formatInsightForPrompt } from "@/lib/personal-learning/explainability"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"

export function formatPersonalLearningPromptBlock(
  memory: PersonalLearningMemory | null,
  folderId: string,
): string {
  if (!memory || memory.folderId !== folderId) return ""

  const activeInsights = memory.insights.filter((i) => !i.dismissed && !i.userCorrection)
  const corrected = memory.insights.filter((i) => i.userCorrection?.trim())

  if (activeInsights.length === 0 && corrected.length === 0 && memory.stats.totalApplications === 0) {
    return ""
  }

  const m = memory.metrics
  const statsBlock = `
PERSONAL LEARNING — workspace folder only (never other users):
Documents analyzed in this folder: ${m.documentsAnalyzed.resumes} resumes, ${m.documentsAnalyzed.jobDescriptions} job descriptions, ${m.documentsAnalyzed.coverLetters} cover letters, ${m.documentsAnalyzed.interviewNotes} interview note sets.
Applications: ${memory.stats.totalApplications} total, ${memory.stats.interviewOrOfferCount} interview/offer.
${m.interviewRate != null ? `Interview rate (this folder): ~${Math.round(m.interviewRate * 100)}%.` : ""}
${m.rejectionCount > 0 ? `Rejections tracked: ${m.rejectionCount}.` : ""}
${m.applicationsExcludedFromLearning > 0 ? `${m.applicationsExcludedFromLearning} application(s) excluded from learning by user.` : ""}
`

  const insightLines = [
    ...corrected.map((i) => formatInsightForPrompt({ ...i, text: i.userCorrection! })),
    ...activeInsights.map((i) => formatInsightForPrompt(i)),
  ]

  return `
${statsBlock}
${AI_EXPLAINABILITY_RULES}

Learned patterns (evidence from this user's folder only):
${insightLines.length ? insightLines.join("\n") : "(No patterns yet — encourage user to track application outcomes.)"}
`
}

export { AI_EXPLAINABILITY_RULES }
