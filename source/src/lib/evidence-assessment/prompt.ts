import type { StrategicProfile } from "@/lib/strategic-profile"
import { formatStrategicProfilePromptBlock } from "@/lib/strategic-profile-prompt"

/**
 * Structured evidence assessment — qualitative fit + maturity.
 * Output is JSON only (for review UI). Never percentages.
 */
export function buildEvidenceAssessmentPrompt(input: {
  jobDescription: string
  cvContent: string
  outputLanguage: "en" | "de"
  strategicProfile?: StrategicProfile | null
}): string {
  const lang = input.outputLanguage === "de" ? "de" : "en"
  const profileBlock = formatStrategicProfilePromptBlock(input.strategicProfile, lang)

  return `You are an evidence analyst for CV-by-Design.
Assess how the candidate's verified experience supports important requirements from the job description.

Return ONLY valid JSON (no markdown fences, no commentary) with this shape:
{
  "employerProblemSummary": "1-2 sentences on the employer's underlying problem",
  "layoutHint": "optional note if a three-column outcome table may crowd two A4 pages",
  "rows": [
    {
      "requirementPhrase": "short exact phrase from the job description",
      "requirementSourceText": "optional longer JD span",
      "evidenceText": "verified candidate achievement or empty if not evidenced",
      "evidenceSource": "experience" | "project" | "research" | "other",
      "evidenceSourceRef": "optional employer/role/project label from the CV",
      "fit": "direct" | "transferable" | "partial" | "not_evidenced",
      "fitRationale": "why this fit, citing candidate evidence",
      "maturity": "delivered" | "in_progress" | "proposed",
      "maturityRationale": "optional",
      "outcomeLabel": "short verifiable outcome or status, or omit",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

RULES
- Select approximately 3–5 important job criteria (prefer 3–5 rows).
- Preserve short, exact phrases from the job description in requirementPhrase.
- Match each criterion to the strongest verified evidence from the CV (experience, research, projects).
- Front-load contributions and outcomes in evidenceText. Concise professional language. Optional **bold** on a lead phrase only.
- Fit categories (qualitative — NEVER invent percentages such as 95% or 80%):
  - direct: substantially the same capability or responsibility
  - transferable: relevant capability in another context
  - partial: evidence supports only part of the requirement
  - not_evidenced: no reliable supporting evidence — leave evidenceText empty or minimal; do not invent
- Maturity is independent of fit:
  - delivered: completed work with identifiable outputs/results
  - in_progress: currently being developed or implemented
  - proposed: concept, recommendation, or planned activity not yet implemented
- Distinguish: proposed a pilot ≠ developed a prototype ≠ implemented a solution ≠ measured an outcome.
- outcomeLabel: short verifiable labels only (e.g. "BITV certified", "Prototype developed", "Pilot proposed", "In progress"). Never match scores or invented metrics.
- Do not invent employers, metrics, certifications, or outcomes absent from the CV.
- These classifications help the candidate — they are not objective job-fit scores.
- Output language for human-readable strings: ${lang === "de" ? "German" : "English"}.
- JSON keys must remain English as specified above.
${profileBlock}

---

JOB DESCRIPTION:
${input.jobDescription.trim()}

CANDIDATE CV (factual source):
${input.cvContent.trim()}`
}

/**
 * Inject approved evidence into the tailored-CV generation prompt.
 * Employer-facing table uses only requirement + evidence (+ optional outcome).
 */
export function formatApprovedEvidenceForCvPrompt(
  rows: Array<{
    requirementPhrase: string
    evidenceText: string
    fit: string
    maturity: string
    outcomeLabel?: string
    fitRationale?: string
  }>,
  options: {
    outputLanguage: "en" | "de"
    tableMarkdown: string
    layout: "two_column" | "three_column"
  },
): string {
  if (rows.length === 0) return ""

  const lang = options.outputLanguage
  const internal = rows
    .map(
      (r, i) =>
        `${i + 1}. [${r.fit} / ${r.maturity}] ${r.requirementPhrase} ← ${r.evidenceText}${
          r.outcomeLabel ? ` (outcome: ${r.outcomeLabel})` : ""
        }${r.fitRationale ? `\n   Why: ${r.fitRationale}` : ""}`,
    )
    .join("\n")

  if (lang === "de") {
    return `
APPROVED EVIDENCE ASSESSMENT (user-reviewed — use to guide the CV; do not print fit/maturity labels on the CV)
${internal}

SELECTED EVIDENCE TABLE (include this section verbatim after PROFILE / PROFIL, before EXPERIENCE / BERUFSERFAHRUNG)
Use layout: ${options.layout === "three_column" ? "three columns" : "two columns (default)"}.
Do not invent additional rows. Do not add percentage scores.
Exact Markdown to include:

${options.tableMarkdown}
`
  }

  return `
APPROVED EVIDENCE ASSESSMENT (user-reviewed — guides generation; do NOT print fit/maturity labels on the employer-facing CV)
${internal}

SELECTED EVIDENCE TABLE (include this section verbatim after PROFILE, before EXPERIENCE)
Layout: ${options.layout === "three_column" ? "three columns with Outcome / Status" : "two columns (default)"}.
Do not invent additional rows. Do not add percentage match scores.
Exact Markdown to include:

${options.tableMarkdown}
`
}
