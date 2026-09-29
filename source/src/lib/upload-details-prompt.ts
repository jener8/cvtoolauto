import { appendStrategicProfileToPrompt } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { UploadDetailsFieldKey } from "@/lib/upload-details"

export type BuildUploadDetailsPromptInput = {
  jobTitle: string
  company: string
  location?: string
  jobDescription: string
  resumeContent: string
  strategicProfile?: StrategicProfile | null
  existingNotes?: string
  existingSalaryExpectation?: string
  employmentType?: string
  outputLanguage?: "en" | "de"
  fields?: UploadDetailsFieldKey[]
}

const FIELD_LABELS: Record<UploadDetailsFieldKey, string> = {
  salaryExpectation: "salaryExpectation — paste-ready salary answer for application forms",
  availability: "availability — notice period / start date (use user profile notice period when provided)",
  whyRole: "whyRole — why the candidate wants this specific role",
  whyCompany: "whyCompany — what interests them about this company",
  fitStatement: "fitStatement — why they are a good fit (evidence-based)",
  shortMotivation: "shortMotivation — 2–4 sentence motivation for short form fields",
  locationPreference: "locationPreference — remote/hybrid/onsite preference",
  additionalNotes: "additionalNotes — other useful form talking points",
}

function buildFieldList(fields?: UploadDetailsFieldKey[]): string {
  const keys = fields?.length
    ? fields
    : (Object.keys(FIELD_LABELS) as UploadDetailsFieldKey[])
  return keys.map((key) => `- ${FIELD_LABELS[key]}`).join("\n")
}

export function buildUploadDetailsPrompt(input: BuildUploadDetailsPromptInput): string {
  const {
    jobTitle,
    company,
    location,
    jobDescription,
    resumeContent,
    strategicProfile,
    existingNotes,
    existingSalaryExpectation,
    employmentType,
    outputLanguage,
    fields,
  } = input

  const lang = outputLanguage === "de" ? "de" : "en"
  const languageRule =
    lang === "de"
      ? "OUTPUT LANGUAGE: Write every field value in German (Deutsch). Use professional German suitable for employer application portals."
      : "OUTPUT LANGUAGE: Write every field value in English."

  const noticePeriod = strategicProfile?.noticePeriod?.trim()
  const noticeLine =
    noticePeriod
      ? lang === "de"
        ? `Kündigungsfrist / frühestes Startdatum (vom Nutzerprofil): ${noticePeriod}`
        : `Notice period / earliest start date (from user profile): ${noticePeriod}`
      : lang === "de"
        ? "Kündigungsfrist / Startdatum: nicht im Profil angegeben — vorsichtig formulieren und Annahmen notieren."
        : "Notice period / start date: not set in user profile — draft cautiously and note assumptions."

  const regenOnly = Boolean(fields?.length)
  const fieldBlock = buildFieldList(fields)

  let prompt = `You draft practical answers for online job application forms. The user will review and edit every answer before submitting — nothing is sent automatically.

${languageRule}

VOICE & STYLE:
- Professional, honest, specific — not exaggerated
- Suitable for ATS and employer application portals
- Concise enough for typical form character limits
- First person ("I"), natural but polished
- Do NOT invent employers, degrees, dates, metrics, or skills not supported by the CV
- If information is missing, write a cautious draft and note the assumption in salaryGuidance.assumptions or additionalNotes

FACTUAL RULES:
- The CV/resume is the only factual source for experience and skills
- Job description is context for tailoring, not a source of candidate facts
- Do not claim salary history or current compensation unless stated in notes

APPLICATION CONTEXT:
Job title: ${jobTitle || "Not specified"}
Company: ${company || "Not specified"}
Location: ${location?.trim() || "Not specified"}
Employment type: ${employmentType || "Not specified"}
Existing salary expectation on file: ${existingSalaryExpectation?.trim() || "Not specified"}
${noticeLine}

JOB DESCRIPTION:
${jobDescription.trim() || "(No job description provided — keep answers general and flag assumptions.)"}

CANDIDATE CV (excerpt):
${resumeContent.trim().slice(0, 6000) || "(No CV text provided — keep answers cautious and flag missing CV.)"}

EXISTING APPLICATION NOTES:
${existingNotes?.trim() || "(None)"}

${regenOnly ? `Regenerate ONLY these fields:\n${fieldBlock}` : `Generate ALL of these fields:\n${fieldBlock}`}

Also include salaryGuidance (even when regenerating a single non-salary field, preserve or lightly refresh if relevant):
- suggestedRange: realistic range with currency, e.g. "€80,000–€95,000"
- conservativeAnswer: lower-safe phrasing for forms
- confidentAnswer: assertive but professional phrasing
- flexibleAnswer: open to discussion phrasing
- assumptions: array of strings explaining market/level/location assumptions

For salaryExpectation field: provide ONE balanced paste-ready answer (not the range itself unless the form asks for a range).

OUTPUT FORMAT — return ONLY valid JSON, no markdown outside the JSON:
{
  "salaryExpectation": "...",
  "availability": "...",
  "whyRole": "...",
  "whyCompany": "...",
  "fitStatement": "...",
  "shortMotivation": "...",
  "locationPreference": "...",
  "additionalNotes": "...",
  "salaryGuidance": {
    "suggestedRange": "...",
    "conservativeAnswer": "...",
    "confidentAnswer": "...",
    "flexibleAnswer": "...",
    "assumptions": ["...", "..."]
  }
}

${regenOnly ? "Include only the requested top-level keys plus salaryGuidance if salaryExpectation was requested." : "Include every key listed above."}`

  prompt = appendStrategicProfileToPrompt(prompt, strategicProfile, lang)
  return prompt
}

export function buildUploadDetailsFieldPrompt(
  input: BuildUploadDetailsPromptInput & { field: UploadDetailsFieldKey },
): string {
  return buildUploadDetailsPrompt({ ...input, fields: [input.field] })
}
