import { getCurrentOutcome, getCurrentStage } from "@/lib/application-pipeline"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { getPipelineSummaryLabel } from "@/lib/translations"
import type { JobApplication } from "@/lib/types"

export type JobSearchTitlesPromptInput = {
  strategicProfile: StrategicProfile | null
  resumeExcerpt: string
  jobs: JobApplication[]
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

export function buildJobSearchTitlesPrompt(input: JobSearchTitlesPromptInput): string {
  const lang = input.outputLanguage === "de" ? "German" : "English"

  return `You are a career advisor helping a skilled professional — often a migrant woman building a career in Germany — choose what to search for on job boards.

Analyse the candidate's CV, career story, and application history. Suggest 6–8 specific JOB TITLES they should type into LinkedIn, StepStone, Indeed, and company career pages.

RULES:
- Return ONLY job titles (e.g. "UX Research Lead", "Accessibility Specialist", "Product Designer"), NOT skills, keywords, locations, or industries.
- Do NOT return single words like "agile", "leadership", "design", or city names.
- Each title must be a realistic role name someone would see on a job posting.
- Match their experience level — do not suggest C-level roles without evidence.
- Prefer titles aligned with roles where they have progressed (interviews/offers) and logical next-step roles in the same field.
- Titles may be in English or German as commonly used in the German job market.
- Never invent employers, degrees, or experience they do not have.

Respond in ${lang} for any reasoning, but job titles can stay in the language commonly used on German job boards.

Return ONLY valid JSON (no markdown fences):
{
  "jobTitles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5", "Title 6"]
}

CAREER STORY:
${formatProfile(input.strategicProfile)}

APPLICATION HISTORY:
${summarizeApplications(input.jobs)}

CV EXCERPT (factual source — do not go beyond this):
${input.resumeExcerpt.trim() || "(No CV content yet)"}`
}
