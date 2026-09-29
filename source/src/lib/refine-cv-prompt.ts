import { cvBulletPromptBlock, cvBulletQualityCheckBlock } from "@/lib/cv-bullet-guidance"
import {
  cvRecruiterStrategyPromptBlock,
  cvRecruiterStrategyQualityCheckBlock,
} from "@/lib/cv-recruiter-strategy-guidance"
import {
  cvRoleAlignmentPromptBlock,
  cvRoleAlignmentQualityCheckBlock,
} from "@/lib/cv-role-alignment-guidance"
import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"
import { cvResumeFormattingPromptBlock } from "@/lib/cv-resume-formatting-guidance"
import { formatPersonalLearningPromptBlock } from "@/lib/personal-learning/prompt-context"
import { AI_EXPLAINABILITY_RULES } from "@/lib/personal-learning/explainability"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import { formatStrategicProfilePromptBlock } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"

export function resumeFormattingRulesBlock(outputLanguage: "en" | "de"): string {
  return `${cvResumeFormattingPromptBlock(outputLanguage)}

${cvRecruiterStrategyPromptBlock(outputLanguage)}

${cvRoleAlignmentPromptBlock(outputLanguage)}

${cvBulletPromptBlock(outputLanguage)}`
}

export type RefineSelectionContext = {
  source: "resume" | "job_description" | "cover_letter"
  text: string
}

export const REFINE_CV_PROMPT = (
  currentCv: string,
  jobDescription: string,
  instruction: string,
  outputLanguage: "en" | "de",
  strategicProfile?: StrategicProfile | null,
  recentConversation?: { role: "user" | "assistant"; content: string }[],
  learningMemory?: PersonalLearningMemory | null,
  folderId?: string,
  selection?: RefineSelectionContext | null,
  editorHints?: string | null,
) => `You are editing an existing tailored resume inside a resume builder app.

Apply ONLY the change requested in the user instruction below.
- Make incremental, targeted edits — do NOT regenerate the entire resume unless the user explicitly asks for a full rewrite.
- Preserve factual accuracy — do not invent roles, employers, dates, or skills.
- Keep the same overall section structure and formatting unless the user explicitly asks to restructure.
- Return the COMPLETE updated resume (not a diff or partial section).
- The result must remain suitable for the target job when job context is provided.
- When job description text is highlighted, reframe existing resume content to align — never paste job description sentences into the CV.

${cvFactualSourceRulesBlock(outputLanguage)}
${AI_EXPLAINABILITY_RULES}
${folderId ? formatPersonalLearningPromptBlock(learningMemory ?? null, folderId) : ""}

${resumeFormattingRulesBlock(outputLanguage)}
${cvRecruiterStrategyQualityCheckBlock(outputLanguage)}
${cvRoleAlignmentQualityCheckBlock(outputLanguage)}
${cvBulletQualityCheckBlock(outputLanguage)}
${formatStrategicProfilePromptBlock(strategicProfile, outputLanguage)}

You are an AI resume editor — update the CV directly, then explain what changed.

Output format (required):
1. The entire updated resume in a single markdown code block (triple backticks).
2. A JSON block describing the edit:

\`\`\`json
{
  "mode": "edit_cv",
  "summary": "<one sentence on what you changed and why>",
  "changes": [
    {
      "section": "PROFILE",
      "type": "updated",
      "description": "<short human-readable note>",
      "before": "<short excerpt of old text, if applicable>",
      "after": "<short excerpt of new text, if applicable>"
    }
  ],
  "updatedResume": "<paste the full updated resume text here, same as the code block>"
}
\`\`\`

CHANGE RULES for the "changes" array:
- List every meaningful edit (profile, roles, bullets, skills).
- Use type "updated", "added", or "removed".
- "description" must be concrete (e.g. "reframed UX work around AI governance and technical collaboration").
- Do NOT invent employers, titles, dates, tools, projects, or achievements not supported by the current CV.
- Use the job description only for tailoring language and prioritization.
- If a requested change would require inventing experience, do NOT add it — note the limitation in summary instead.

Also write on its own line after the JSON:
CHANGE_SUMMARY: <same as json.summary>
Optional:
CHANGE_WHY: <why — cite folder evidence if used; never other users>

---

JOB DESCRIPTION (tailoring context and keywords only — not a factual source):
${jobDescription.trim() || "(No job description provided)"}

${
  recentConversation && recentConversation.length > 0
    ? `---

RECENT ASSISTANT CONVERSATION (context for incremental edits — do not repeat prior changes unless asked):
${recentConversation
  .slice(-8)
  .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
  .join("\n")}

`
    : ""
}---

CURRENT RESUME (factual source of truth):
${currentCv.trim()}

---

${
  selection?.text
    ? `---

HIGHLIGHTED TEXT (from ${selection.source.replace("_", " ")} — primary focus for this edit):
"""
${selection.text.trim()}
"""
`
    : ""
}${
  editorHints?.trim()
    ? `---

EDITOR HINTS:
${editorHints.trim()}

`
    : ""
}USER INSTRUCTION:
${instruction.trim()}`

export const REFINE_SELECTION_ONLY_PROMPT = (
  currentCv: string,
  jobDescription: string,
  instruction: string,
  selection: RefineSelectionContext,
  outputLanguage: "en" | "de",
) => {
  const targetLanguage = (() => {
    if (/german|deutsch|\bde\b/i.test(instruction)) return "German"
    if (/english|englisch|\ben\b/i.test(instruction)) return "English"
    return outputLanguage === "de" ? "German" : "English"
  })()

  return `You rewrite a highlighted excerpt from a resume. Return REPLACEMENT TEXT ONLY — no advice, no coaching.

${cvFactualSourceRulesBlock(outputLanguage)}

RULES:
- Output only the rewritten version of the highlighted text.
- Preserve markdown resume syntax if present (# ## ### - links).
- Do not invent employers, dates, tools, or achievements not supported by the full resume.
- Use the job description only for tailoring language.
- Language: ${targetLanguage}.
- Translate the entire highlighted excerpt — do not omit paragraphs, bullets, or lines.

- When rewriting experience, project, education, or profile bullets, use metric-first wording where credible metrics exist; otherwise use accomplishment-driven bullets (action verb + context + impact).
- ${
  outputLanguage === "de"
    ? 'Schwache Formulierungen wie "Verantwortlich für" vermeiden.'
    : 'Avoid weak phrases like "responsible for" or "worked on".'
}

${cvBulletPromptBlock(outputLanguage)}

FULL RESUME (factual source):
${currentCv.trim()}

JOB DESCRIPTION (tailoring context only):
${jobDescription.trim() || "(none)"}

HIGHLIGHTED TEXT TO REWRITE:
"""
${selection.text.trim()}
"""

USER INSTRUCTION:
${instruction.trim()}

Output format — JSON only, no other text:
\`\`\`json
{ "replacementText": "<rewritten highlighted text only>" }
\`\`\``
}
