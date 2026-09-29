import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"
import { appendStrategicProfileToPrompt } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"

export type BuildYourStoryPromptInput = {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  strategicProfile?: StrategicProfile | null
}

const OUTPUT_SCHEMA = `Return ONLY a single JSON object (no markdown fences, no commentary) with this shape:
{
  "story": "Full narrative in 4–8 short paragraphs. First person (I/my) unless the resume is clearly third-person.",
  "cvEvidence": [
    {
      "id": "evidence-1",
      "storyExcerpt": "Short quote or paraphrase from the story this row supports",
      "cvSection": "Profile | EXPERIENCE employer name | Skills | Education | Projects | etc.",
      "cvReference": "Specific CV bullet or section text that supports the story excerpt",
      "supportLevel": "strong | needs_stronger_cv_evidence | could_be_added_to_cv | risk_story_stronger_than_cv_proof"
    }
  ]
}`

export function buildYourStoryPrompt(input: BuildYourStoryPromptInput): string {
  const langLabel = input.language === "de" ? "German" : "English"
  const base = `You are an application intelligence strategist — NOT a cover letter writer.

Create an internal "Your Story" narrative for the candidate. This helps them understand their strongest fit for a specific role. It is NOT a cover letter and will not be sent to the employer.

PURPOSE:
- Explain what the candidate brings to this company and role
- Why their background is relevant
- What employer problems they can solve
- How CV evidence supports the positioning
- What makes any career transition or fit credible

RULES:
- Ground every claim in the provided CV — never invent roles, employers, dates, metrics, or achievements
- Do not overclaim or keyword-stuff
- Be recruiter-aware, clear, and strategic
- Translate the candidate's background into the employer's problem context
- Flag weak evidence in cvEvidence.supportLevel — do not hide gaps
- Write in ${langLabel}
- Useful for later CV tailoring, cover letters, interviews, and application forms

${cvFactualSourceRulesBlock(input.language)}

${OUTPUT_SCHEMA}

TARGET ROLE: ${input.jobTitle || "(not specified)"}
COMPANY: ${input.company || "(not specified)"}

JOB DESCRIPTION:
${input.jobDescription.trim() || "(none)"}

CV (factual source of truth):
${input.resumeContent.trim() || "(none)"}`

  return appendStrategicProfileToPrompt(base, input.strategicProfile, input.language)
}

export type RefineYourStoryMode =
  | "more_strategic"
  | "more_human"
  | "more_confident"
  | "more_concise"
  | "align_to_job"
  | "custom"

const REFINE_MODE_HINTS: Record<Exclude<RefineYourStoryMode, "custom">, string> = {
  more_strategic: "Make the narrative more strategic — sharper problem/solution framing for this employer.",
  more_human: "Make the tone warmer and more human while staying professional and evidence-based.",
  more_confident: "Increase confidence and clarity of fit without overclaiming or inventing experience.",
  more_concise: "Shorten the story — tighter paragraphs, same evidence, less repetition.",
  align_to_job: "Align more closely to the job description using only verified CV evidence.",
}

export function buildRefineYourStoryPrompt(input: {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  currentStory: string
  mode: RefineYourStoryMode
  customInstruction?: string
  strategicProfile?: StrategicProfile | null
}): string {
  const modeHint =
    input.mode === "custom"
      ? (input.customInstruction?.trim() || "Improve the story while preserving truthfulness.")
      : REFINE_MODE_HINTS[input.mode]

  return `${buildYourStoryPrompt({
    language: input.language,
    jobTitle: input.jobTitle,
    company: input.company,
    jobDescription: input.jobDescription,
    resumeContent: input.resumeContent,
    strategicProfile: input.strategicProfile,
  })}

CURRENT STORY (revise this — do not start from scratch unless necessary):
${input.currentStory.trim()}

REVISION TASK:
${modeHint}

Return the same JSON object shape with updated story and refreshed cvEvidence mapping.`
}

export function buildSuggestCvFromStoryPrompt(input: {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  storyContent: string
}): string {
  const langLabel = input.language === "de" ? "German" : "English"
  return `You are a CV editor suggesting improvements based on an internal positioning story.

Suggest concrete CV edits that would strengthen alignment between the story and the CV. Do NOT apply edits — only recommend.

RULES:
- Preserve truthfulness — only use verified experience from the CV
- Never invent employers, roles, dates, or metrics
- Name specific sections (Profile, employer names, Skills, etc.)
- Prioritize gaps flagged as weak evidence in the story
- Write suggestions in ${langLabel} as markdown with numbered items

Return ONLY markdown (no JSON):
## Suggested CV improvements
Numbered list of specific edits.

## Sections to strengthen
Bullets naming CV sections and what to add/reframe.

STORY:
${input.storyContent.trim()}

JOB DESCRIPTION:
${input.jobDescription.trim()}

CURRENT CV:
${input.resumeContent.trim()}

ROLE: ${input.jobTitle} at ${input.company}`
}
