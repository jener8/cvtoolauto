import type { CareerProfilePrefs } from "@/lib/career-profile/types"
import { getCurrentOutcome, getCurrentStage } from "@/lib/application-pipeline"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { getPipelineSummaryLabel } from "@/lib/translations"
import type { JobApplication } from "@/lib/types"

export type RoleMatchesPromptInput = {
  strategicProfile: StrategicProfile | null
  careerProfilePrefs?: CareerProfilePrefs | null
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
    profile.careerDirection ? `Direction / interests: ${profile.careerDirection}` : null,
    profile.professionalStrengths ? `Strengths: ${profile.professionalStrengths}` : null,
    profile.strategicEmphasis ? `Emphasise: ${profile.strategicEmphasis}` : null,
    profile.longTermGoal ? `Long-term goal: ${profile.longTermGoal}` : null,
  ].filter(Boolean)
  return lines.length > 0 ? lines.join("\n") : "(Career story fields are empty)"
}

function formatCareerPrefs(prefs: CareerProfilePrefs | null | undefined): string {
  if (!prefs) return "(No Career Profile preferences yet)"
  if (prefs.useForRecommendations?.preferences === false) {
    return "(User opted out of using Career Profile preferences for recommendations)"
  }
  const lines = [
    prefs.currentPositioning ? `Current positioning: ${prefs.currentPositioning}` : null,
    prefs.rolesOfInterest ? `Roles of interest: ${prefs.rolesOfInterest}` : null,
    prefs.industriesOfInterest ? `Industries: ${prefs.industriesOfInterest}` : null,
    prefs.problemsToSolve ? `Problems to solve: ${prefs.problemsToSolve}` : null,
    prefs.preferredOrganisations ? `Preferred organisations / environments: ${prefs.preferredOrganisations}` : null,
    prefs.professionalValues ? `Values & interests: ${prefs.professionalValues}` : null,
    prefs.careerTransitionGoals ? `Transition goals: ${prefs.careerTransitionGoals}` : null,
    prefs.preferredLocations ? `Location prefs: ${prefs.preferredLocations}` : null,
    prefs.remotePreference ? `Remote preference: ${prefs.remotePreference}` : null,
    prefs.workingHours ? `Working hours: ${prefs.workingHours}` : null,
    prefs.employmentPreferences?.length
      ? `Employment prefs: ${prefs.employmentPreferences.join(", ")}`
      : null,
  ].filter(Boolean)
  return lines.length > 0 ? lines.join("\n") : "(Career Profile preference fields are empty)"
}

export function buildRoleMatchesPrompt(input: RoleMatchesPromptInput): string {
  const lang = input.outputLanguage === "de" ? "German" : "English"
  const queryLine = input.searchQuery?.trim()
    ? `\nUSER EXPLORATION FOCUS: "${input.searchQuery.trim()}" — prioritise directions aligned with this interest, while staying grounded in their evidence.\n`
    : ""

  return `You are a career strategist helping a professional understand where their experience creates value — including adjacent, emerging, and transition roles, not only titles they have already held.

Analyse the candidate's CV, career story, and application history. Suggest 6–8 Role Strategy directions.

Each suggestion should help them see:
- Professional strengths and achievements that transfer
- Capabilities that open doors beyond their current job title
- Adjacent or emerging roles where they could create value
- Problems they are particularly well placed to solve
- Plausible career-transition opportunities (without inventing credentials)

RULES FOR EACH MATCH:
- "title": A concrete role or career direction label people actually search for or aspire to (e.g. "Product Operations Lead", "Accessibility Programme Manager") — NEVER a company name, tagline, or sentence. Max 80 characters.
- Do NOT restrict matches to their current or past job titles. Include stretch and adjacent directions when the evidence supports them.
- "matchingSkills": 3–5 specific strengths, achievements, or transferable capabilities from THEIR materials that explain why this direction is worth considering. Each match must use a different mix — do not repeat the same list across cards.
- Phrase skills as evidence of value (what they can do / have done), not generic soft-skill filler.
- "fitLevel": "strong" when CV/story/applications clearly support the direction; "growing" when it is a plausible stretch or early exploration with partial evidence.
- Ground every skill in their materials — do not invent certifications, employers, tools, languages, or degrees they do not have.
- Do NOT return generic filler like "communication" or "teamwork" on every card unless their profile uniquely emphasises it for that direction.
- Titles may be in English or German as used in European / German-speaking job markets.

Respond in ${lang} for skill labels where natural.

Return ONLY valid JSON (no markdown fences):
{
  "matches": [
    {
      "title": "Accessibility Programme Manager",
      "fitLevel": "strong",
      "matchingSkills": ["Led WCAG remediation across product squads", "Facilitated inclusive design workshops", "Translated compliance into roadmap priorities"]
    }
  ]
}
${queryLine}
CAREER STORY:
${formatProfile(
    input.strategicProfile && input.careerProfilePrefs?.useForRecommendations?.story === false
      ? null
      : input.strategicProfile,
  )}

CAREER PROFILE PREFERENCES:
${formatCareerPrefs(input.careerProfilePrefs)}

APPLICATION HISTORY:
${summarizeApplications(input.jobs)}

CV EXCERPT (factual source — do not go beyond this):
${input.resumeExcerpt.trim() || "(No CV content yet)"}`
}
