import type { AssistantSelectionContext } from "@/lib/assistant-selection-context"
import type { AssistantIntent } from "@/lib/unified-assistant/intent"
import { isConsolidateExperienceInstruction } from "@/lib/cv-experience-consolidation"
import { cvBulletPromptBlock } from "@/lib/cv-bullet-guidance"
import { cvRecruiterStrategyPromptBlock } from "@/lib/cv-recruiter-strategy-guidance"
import { cvRoleAlignmentPromptBlock } from "@/lib/cv-role-alignment-guidance"

export type AssistantWorkflowMode =
  | "career_advice"
  | "resume_edit"
  | "application_analysis"
  | "chat"

const SELECTION_EDIT_PATTERN =
  /rewrite|make (it |this |the )?(shorter|longer|more senior|more strategic|stronger|more relevant)|reframe (this|the|it)/i

const TRANSLATE_INSTRUCTION_PATTERN =
  /translate|übersetz|übersetze|in (german|english|deutsch|englisch)|to (german|english|deutsch|englisch)|into (german|english|deutsch|englisch)/i

const FULL_DOCUMENT_TRANSLATE_PATTERN =
  /translate (the )?(whole|entire|full|complete)|translate (my )?(cv|resume|lebenslauf)|whole (cv|resume)|entire (cv|resume)|full (cv|resume)|gesamten lebenslauf|kompletten lebenslauf/i

const FULL_CV_EDIT_PATTERN =
  /tailor|apply|ats|keyword|leadership focus|ai focus|entire|whole (cv|resume)|full (cv|resume)|translate (the )?(whole|entire|full|complete)|translate (my )?(cv|resume)/i

export function isTranslateInstruction(message: string): boolean {
  return TRANSLATE_INSTRUCTION_PATTERN.test(message)
}

export function isFullDocumentTranslateInstruction(message: string): boolean {
  return FULL_DOCUMENT_TRANSLATE_PATTERN.test(message.toLowerCase().trim())
}

const FULL_COVER_LETTER_EDIT_PATTERN =
  /entire|whole (cover )?letter|full (cover )?letter|complete letter|rewrite (my |the )?(cover )?letter/i

const EDIT_ACTION_PATTERN =
  /rewrite|make (it |this |the )?(shorter|longer|more senior|more strategic|stronger|more relevant)|reframe|improve|edit|shorten|condense|tailor/i

export function isSelectionOnlyEdit(
  message: string,
  selection?: AssistantSelectionContext | null,
): boolean {
  if (!selection?.text?.trim()) return false
  if (selection.source !== "resume") return false
  if (isConsolidateExperienceInstruction(message)) return false
  const m = message.toLowerCase().trim()
  if (FULL_CV_EDIT_PATTERN.test(m)) return false
  if (isFullDocumentTranslateInstruction(m)) return false
  if (isTranslateInstruction(m)) return true
  return SELECTION_EDIT_PATTERN.test(m)
}

export function isCoverLetterSelectionOnlyEdit(
  message: string,
  selection?: AssistantSelectionContext | null,
): boolean {
  if (!selection?.text?.trim()) return false
  if (selection.source !== "cover_letter") return false
  const m = message.toLowerCase().trim()
  if (FULL_COVER_LETTER_EDIT_PATTERN.test(m)) return false
  if (isFullDocumentTranslateInstruction(m)) return false
  if (isTranslateInstruction(m)) return true
  return SELECTION_EDIT_PATTERN.test(m) || EDIT_ACTION_PATTERN.test(m)
}

export function getWorkflowMode(
  intent: AssistantIntent,
  message: string,
  selection?: AssistantSelectionContext | null,
  hasResume?: boolean,
): AssistantWorkflowMode {
  if (intent === "resume_edit") {
    return "resume_edit"
  }
  if (intent === "application_analysis") {
    return "application_analysis"
  }
  if (
    hasResume &&
    (intent === "job_match" || intent === "ats" || intent === "general")
  ) {
    return "career_advice"
  }
  return "chat"
}

export function canOfferCvApply(mode: AssistantWorkflowMode, hasResume: boolean): boolean {
  if (!hasResume) return false
  return mode === "career_advice" || mode === "application_analysis"
}

export function canOfferCoverLetterApply(
  mode: AssistantWorkflowMode,
  hasCoverLetter: boolean,
): boolean {
  if (!hasCoverLetter) return false
  return mode === "career_advice" || mode === "application_analysis"
}

export function buildApplyRecommendationsInstruction(
  adviceContent: string,
  outputLanguage: "en" | "de" = "en",
): string {
  return `Apply the following resume recommendations to my CV. Make concrete edits only — reframe existing content, do not invent experience. Return the full updated CV.

Optimize for the hiring company's needs in the job description — not my current job title. Rank strongest role-relevant evidence first. Max 7 bullets per role, max 4 profile bullets.

Rewrite experience bullets using metric-first wording (metric + context + impact) where credible metrics exist in the CV or profile; otherwise use action verb + context + impact. Each bullet must answer why I am suitable for the target role. Aim for roughly 25–40% metric-first bullets where evidence supports it. Avoid task-only phrasing such as "responsible for" or "worked on". Never invent numbers.

${cvRecruiterStrategyPromptBlock(outputLanguage)}

${cvRoleAlignmentPromptBlock(outputLanguage)}

${cvBulletPromptBlock(outputLanguage)}

RECOMMENDATIONS TO APPLY:
${adviceContent.trim()}`
}

export function buildApplyCoverLetterRecommendationsInstruction(adviceContent: string): string {
  return `Apply the following recommendations to my cover letter. Make concrete edits only — reframe existing content, do not invent experience. Return the full updated cover letter.

RECOMMENDATIONS TO APPLY:
${adviceContent.trim()}`
}

export function buildExplainRecommendationsInstruction(adviceContent: string): string {
  return `Explain step-by-step what specific CV changes you would make based on these recommendations. Name sections, employers, and bullets. Do not edit the CV yet.

RECOMMENDATIONS:
${adviceContent.trim()}`
}

export function buildExplainCoverLetterRecommendationsInstruction(adviceContent: string): string {
  return `Explain step-by-step what specific cover letter changes you would make based on these recommendations. Quote or reference the paragraphs you would change. Do not edit the cover letter yet.

RECOMMENDATIONS:
${adviceContent.trim()}`
}
