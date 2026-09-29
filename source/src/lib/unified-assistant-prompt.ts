import {
  AI_EXPLAINABILITY_RULES,
  formatPersonalLearningPromptBlock,
} from "@/lib/personal-learning/prompt-context"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import { cvBulletPromptBlock } from "@/lib/cv-bullet-guidance"
import {
  cvCareerCoachPromptBlock,
  hasResumeCoachingContext,
} from "@/lib/cv-career-coach-guidance"
import { cvRecruiterStrategyPromptBlock } from "@/lib/cv-recruiter-strategy-guidance"
import { cvRoleAlignmentPromptBlock } from "@/lib/cv-role-alignment-guidance"
import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"
import { formatStrategicProfilePromptBlock } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type {
  AssistantDocumentContext,
  AssistantSelectionContext,
} from "@/lib/assistant-selection-context"
import { selectionSourceLabel } from "@/lib/assistant-selection-context"
import type { AssistantIntent } from "@/lib/unified-assistant/intent"

export type UnifiedAdvisoryContext = {
  intent: AssistantIntent
  message: string
  resumeExcerpt: string
  coverLetterExcerpt?: string
  documentContext?: AssistantDocumentContext
  jobDescription: string
  strategicProfile: StrategicProfile
  learningMemory: PersonalLearningMemory | null
  folderId: string
  selectedJobTitle?: string
  selectedCompany?: string
  conversation?: { role: "user" | "assistant"; content: string }[]
  outputLanguage: "en" | "de"
  selection?: AssistantSelectionContext | null
}

const COVER_LETTER_APPLY_FOOTER =
  "End with ## Recommended cover letter changes — numbered list of specific paragraph-level edits the user can apply with one click — only if cover letter edits are warranted now; otherwise say the letter should stay unchanged."

const CV_APPLY_FOOTER =
  "End with ## Recommended CV changes — numbered list of specific edits the user can apply with one click — only if CV edits are warranted now after coaching; otherwise say the CV should stay unchanged and focus on interview examples, understanding, or strategy."

export function buildUnifiedAdvisoryPrompt(ctx: UnifiedAdvisoryContext): string {
  const editingCoverLetter = ctx.documentContext === "cover_letter"
  const hasResume = hasResumeCoachingContext(ctx.resumeExcerpt)
  const modeHint = (() => {
    switch (ctx.intent) {
      case "ats":
        return editingCoverLetter
          ? `Focus on ATS-friendly language in the cover letter. Coach first if terminology cannot be defended. ${COVER_LETTER_APPLY_FOOTER}`
          : `Focus on ATS-friendly keywords, structure, and clarity grounded in real experience. Coach before rewriting; never invent keywords the candidate cannot defend. ${CV_APPLY_FOOTER}`
      case "cover_letter":
        return `Help draft or improve the cover letter. Provide body paragraphs only unless asked otherwise. Base claims on the resume excerpt. Prefer coaching questions when evidence is thin. ${COVER_LETTER_APPLY_FOOTER}`
      case "interview":
        return "Help with interview preparation: stress-test claims, build STAR stories, and talking points from their real experience. Prefer coaching and practice questions over CV rewrites unless the user asks for edits."
      case "application_analysis":
        return editingCoverLetter
          ? `Analyze fit, gaps, and risks for this application. Be honest and practical. Distinguish direct vs transferable vs developing vs gap. ${COVER_LETTER_APPLY_FOOTER}`
          : `Analyze fit, gaps, and risks for this application. Be honest and practical. Distinguish direct vs transferable vs developing vs gap. Recommend CV changes only when clearly warranted. ${CV_APPLY_FOOTER}`
      case "job_match":
        return editingCoverLetter
          ? `Compare the cover letter to the job description. Name specific paragraphs and phrases to change when evidence supports them. Never give vague advice. ${COVER_LETTER_APPLY_FOOTER}`
          : `Compare the resume to the job description. Investigate before inferring gaps. Name specific sections, roles, projects and bullets only when evidence-backed. Never give vague advice. ${CV_APPLY_FOOTER}`
      case "resume_edit":
        return editingCoverLetter
          ? `The user wants cover letter edits. Still protect accuracy — ask when evidence is missing. ${COVER_LETTER_APPLY_FOOTER}`
          : `The user wants resume edits. Still protect accuracy — ask when evidence is missing; do not invent experience. ${CV_APPLY_FOOTER}`
      default:
        return editingCoverLetter
          ? "Act as a personal career coach for this application workspace. The user is editing their cover letter. Coach before rewriting."
          : "Act as a personal Career & CV Coach for this application workspace. Coach, question, and strategise before offering CV rewrites."
    }
  })()

  const applyTarget = editingCoverLetter ? "cover letter" : "CV"

  return `You are a unified AI Career & CV Coach inside a CV application tool.

${modeHint}
- Never access or reference data outside this user's workspace folder.
- Do not invent employers, roles, or achievements not supported by the resume excerpt.
- Be concise and practical.
- Format replies with markdown: headings, bullet lists, bold for emphasis, and tables when comparing options. Do not wrap the entire response in a code block.
- Prefer coaching, evidence discovery, and strategy over automatic ${applyTarget} rewrites.
- When recommending ${applyTarget} changes, be specific enough to apply with one click — never generic "consider highlighting".
- Explicitly say when the ${applyTarget} should remain unchanged.

${AI_EXPLAINABILITY_RULES}

${cvFactualSourceRulesBlock(ctx.outputLanguage)}
${
  hasResume
    ? `
${cvCareerCoachPromptBlock(ctx.outputLanguage)}
`
    : ""
}${
  editingCoverLetter
    ? ""
    : `${cvRecruiterStrategyPromptBlock(ctx.outputLanguage)}

${cvRoleAlignmentPromptBlock(ctx.outputLanguage)}

${cvBulletPromptBlock(ctx.outputLanguage)}

When suggesting CV bullet rewrites (only if warranted), show problems solved with evidence — not task lists. Optimize for the hiring company's needs. Each bullet should answer why the candidate is suitable for the target role. Prefer metric-first wording where credible metrics exist. Max 7 bullets per role, max 4 profile bullets. Chronological format only.
`
}${formatStrategicProfilePromptBlock(ctx.strategicProfile, ctx.outputLanguage)}
${formatPersonalLearningPromptBlock(ctx.learningMemory, ctx.folderId)}

${
  ctx.conversation?.length
    ? `RECENT CONVERSATION:\n${ctx.conversation
        .slice(-8)
        .map((c) => `${c.role}: ${c.content}`)
        .join("\n")}\n`
    : ""
}

CURRENT APPLICATION CONTEXT:
${ctx.selectedJobTitle ? `Role: ${ctx.selectedJobTitle}${ctx.selectedCompany ? ` at ${ctx.selectedCompany}` : ""}` : "(No specific job selected)"}

JOB DESCRIPTION:
${ctx.jobDescription.trim() || "(none provided)"}

RESUME EXCERPT (source of truth for experience):
${ctx.resumeExcerpt.trim().slice(0, 6000) || "(none)"}

${
  editingCoverLetter
    ? `COVER LETTER (document being edited):
${(ctx.coverLetterExcerpt ?? "").trim().slice(0, 8000) || "(none)"}

`
    : ""
}
${
  ctx.selection?.text
    ? `HIGHLIGHTED TEXT (from ${selectionSourceLabel(ctx.selection.source)} — user is asking about this specifically):
"""
${ctx.selection.text.trim()}
"""
`
    : ""
}
USER MESSAGE:
${ctx.message.trim()}`
}
