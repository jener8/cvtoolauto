import { getCurrentOutcome, getCurrentStage } from "@/lib/application-pipeline"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { getPipelineSummaryLabel } from "@/lib/translations"
import type { JobApplication } from "@/lib/types"

export type RoleMatchesPromptInput = {
  strategicProfile: StrategicProfile | null
  resumeExcerpt: string
  jobs: JobApplication[]
  searchQuery?: string
  outputLanguage?: "en" | "de"
}

function summarizeApplications(jobs: JobApplication[]): string {
  if (jobs.length === 0) return "(No applications tracked yet)"

  return jobs
    .slice(0, 20)
    .map((job) => {
      const stage = getCurrentStage(job)
      const outcome = getCurrentOutcome(job)
      const status = getPipelineSummaryLabel("en", stage, outcome)
      const parts = [
        job.jobTitle?.trim() || "Untitled role",
        job.company?.trim() ? `at ${job.company.trim()}` : null,
        `— ${status}`,
      ].filter(Boolean)
      return `- ${parts.join(" ")}`
    })
    .join("\n")
}

function formatProfile(profile: StrategicProfile | null): string {
  if (!profile) return "(Career story not completed yet)"
  const lines = [
    profile.careerDirection ? `Target roles: ${profile.careerDirection}` : null,
    profile.professionalStrengths ? `Strengths: ${profile.professionalStrengths}` : null,
    profile.strategicEmphasis ? `Emphasise: ${profile.strategicEmphasis}` : null,
    profile.longTermGoal ? `Long-term goal: ${profile.longTermGoal}` : null,
  ].filter(Boolean)
  return lines.length > 0 ? lines.join("\n") : "(Career story fields are empty)"
}

export function buildRoleMatchesPrompt(input: RoleMatchesPromptInput): string {
  const lang = input.outputLanguage === "de" ? "German" : "English"
  const queryLine = input.searchQuery?.trim()
    ? `\nUSER SEARCH FOCUS: "${input.searchQuery.trim()}" — prioritise titles and skills aligned with this, but stay realistic for their profile.\n`
    : ""

  return `You are a career advisor helping a skilled professional — often a migrant woman building a career in Germany — find job titles to search for and the skills that connect their background to each title.

Analyse the candidate's CV, career story, and application history. Suggest 6–8 role matches.

RULES FOR EACH MATCH:
- "title": ONLY a job title (e.g. "Accessibility Specialist", "UX Research Lead") — NEVER a company name, tagline, or sentence. Max 80 characters.
- "matchingSkills": 3–5 specific skills or strengths from THEIR actual CV/story that fit THIS title. Each match must use different skills — do not repeat the same skill list across cards.
- "fitLevel": "strong" if clear evidence in CV/applications/interviews; "growing" if a plausible stretch or early exploration.
- Skills must be grounded in their materials — do not invent certifications, employers, or tools they do not have.
- Do NOT return generic filler like "communication" on every card unless their profile emphasises it uniquely for that role.
- Titles may be in English or German as used on German job boards.

Respond in ${lang} for skill labels where natural.

Return ONLY valid JSON (no markdown fences):
{
  "matches": [
    {
      "title": "Accessibility Specialist",
      "fitLevel": "strong",
      "matchingSkills": ["WCAG 2.1 audits", "BITV certification work", "Inclusive design workshops"]
    }
  ]
}
${queryLine}
CAREER STORY:
${formatProfile(input.strategicProfile)}

APPLICATION HISTORY:
${summarizeApplications(input.jobs)}

CV EXCERPT (factual source — do not go beyond this):
${input.resumeExcerpt.trim() || "(No CV content yet)"}`
}
