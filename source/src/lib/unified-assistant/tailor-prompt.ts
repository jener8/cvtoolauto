import { cvBulletPromptBlock } from "@/lib/cv-bullet-guidance"
import { cvRecruiterStrategyPromptBlock } from "@/lib/cv-recruiter-strategy-guidance"
import { cvRoleAlignmentPromptBlock } from "@/lib/cv-role-alignment-guidance"
import type { AssistantSelectionContext } from "@/lib/assistant-selection-context"
import { selectionSourceLabel } from "@/lib/assistant-selection-context"
import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"
import { AI_EXPLAINABILITY_RULES } from "@/lib/personal-learning/explainability"
import { formatPersonalLearningPromptBlock } from "@/lib/personal-learning/prompt-context"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import { formatStrategicProfilePromptBlock } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"

export function buildTailorSelectionPrompt(input: {
  message: string
  resumeExcerpt: string
  jobDescription: string
  selection: AssistantSelectionContext
  strategicProfile: StrategicProfile
  learningMemory: PersonalLearningMemory | null
  folderId: string
  selectedJobTitle?: string
  selectedCompany?: string
  conversation?: { role: "user" | "assistant"; content: string }[]
  outputLanguage: "en" | "de"
}): string {
  const lang = input.outputLanguage === "de" ? "German" : "English"
  const sourceLabel = selectionSourceLabel(input.selection.source)

  return `You are a resume tailoring specialist inside a CV application tool.

The user highlighted text from the ${sourceLabel} and wants CONCRETE resume changes — not generic career coaching.

${AI_EXPLAINABILITY_RULES}
${cvFactualSourceRulesBlock(input.outputLanguage)}
${cvRecruiterStrategyPromptBlock(input.outputLanguage)}
${cvRoleAlignmentPromptBlock(input.outputLanguage)}
${cvBulletPromptBlock(input.outputLanguage)}
${formatStrategicProfilePromptBlock(input.strategicProfile, input.outputLanguage)}
${formatPersonalLearningPromptBlock(input.learningMemory, input.folderId)}

TASK:
1. Read the HIGHLIGHTED TEXT (what the user selected).
2. Read the FULL JOB DESCRIPTION and FULL RESUME.
3. Compare all three — identify what the highlight emphasizes and what the resume already covers or misses.
4. Recommend specific, actionable resume edits grounded in real experience from the resume.

REQUIRED RESPONSE FORMAT (${lang}, markdown):

## What this excerpt emphasizes
2–4 bullets on requirements, themes, or language in the highlighted text.

## Already strong in your resume
Bullets naming real roles, projects, or bullets from the resume that align.

## Gaps and opportunities
Bullets naming what is missing or under-emphasized.

## Specific changes to make
Numbered list. Each item MUST:
- Name a concrete section, employer, role, or project from the resume (e.g. "Bundesdruckerei bullet 2", "Trust by Design project", "Profile summary")
- Explain why, citing words or themes from the highlighted text
- Give exact rewrite guidance or suggested bullet wording using metric-first structure (metric + context + impact) where credible metrics exist, otherwise action verb + context + impact — not vague advice

BAD: "Highlight your AI experience."
GOOD: "Move your Responsible AI MA higher in Education because Fin emphasizes AI model behaviour."
GOOD: "Add your Trust by Design project under Projects — it demonstrates AI governance and systems thinking Fin asks for."

Do not invent employers, roles, dates, or achievements not in the resume.
Do not wrap the response in a code block.

${
  input.conversation?.length
    ? `RECENT CONVERSATION:\n${input.conversation
        .slice(-6)
        .map((c) => `${c.role}: ${c.content}`)
        .join("\n")}\n`
    : ""
}

APPLICATION: ${input.selectedJobTitle || "(not set)"}${input.selectedCompany ? ` at ${input.selectedCompany}` : ""}

HIGHLIGHTED TEXT (from ${sourceLabel}):
"""
${input.selection.text.trim()}
"""

FULL JOB DESCRIPTION:
${input.jobDescription.trim() || "(none)"}

FULL RESUME (source of truth):
${input.resumeExcerpt.trim().slice(0, 6000) || "(none)"}

USER MESSAGE:
${input.message.trim()}`
}
