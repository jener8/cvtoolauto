import { getCurrentOutcome, getCurrentStage } from "@/lib/application-pipeline"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { getPipelineSummaryLabel } from "@/lib/translations"
import type { JobApplication } from "@/lib/types"

export type JobSearchCompaniesPromptInput = {
  strategicProfile: StrategicProfile | null
  resumeExcerpt: string
  jobs: JobApplication[]
  jobTitles: string[]
  outputLanguage?: "en" | "de"
}

function summarizeApplications(jobs: JobApplication[]): string {
  if (jobs.length === 0) return "(No applications tracked yet)"

  return jobs
    .slice(0, 25)
    .map((job) => {
      const stage = getCurrentStage(job)
      const outcome = getCurrentOutcome(job)
      const status = getPipelineSummaryLabel("en", stage, outcome)
      const parts = [
        job.company?.trim() || "Unknown company",
        job.jobTitle?.trim() ? `— ${job.jobTitle.trim()}` : null,
        `(${status})`,
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

export function buildJobSearchCompaniesPrompt(input: JobSearchCompaniesPromptInput): string {
  const lang = input.outputLanguage === "de" ? "German" : "English"
  const titles = input.jobTitles.length > 0 ? input.jobTitles.join(", ") : "(none yet)"

  return `You are a career research agent helping a skilled professional — often a migrant woman building a career in Germany — discover employers to explore.

Use web search to find REAL companies and organisations in Berlin and across Europe that hire for the job titles below. This is an ideas list for exploration — NOT companies they have already applied to.

SEARCH STRATEGY:
1. Search for employers in Berlin that hire for: ${titles}
2. Broaden to major European hubs (Amsterdam, Munich, Hamburg, Paris, Dublin, Zurich) when Berlin has few matches.
3. Prefer established employers (mid-size to large companies, well-known startups, public-sector bodies, NGOs) where these roles exist.
4. Cross-check that each company is real and currently active — avoid defunct startups or generic placeholders.
5. Do NOT include recruitment agencies or individual recruiter names as companies.
6. Do NOT include any company listed in APPLICATION HISTORY below.

For each employer, explain briefly why it fits this candidate's profile.

Respond in ${lang} for reasoning fields; company names stay as officially used.

Return ONLY valid JSON (no markdown fences):
{
  "companies": [
    {
      "name": "Company legal name",
      "location": "City, Country",
      "sector": "Industry label",
      "whyFit": "One sentence on why this employer is worth exploring",
      "rolesToSearch": "1–2 job titles to search on their careers page"
    }
  ]
}

Suggest 8–12 companies.

JOB TITLES TO TARGET:
${titles}

CAREER STORY:
${formatProfile(input.strategicProfile)}

APPLICATION HISTORY (exclude these employers):
${summarizeApplications(input.jobs)}

CV EXCERPT (factual source — do not go beyond this):
${input.resumeExcerpt.trim() || "(No CV content yet)"}`
}
