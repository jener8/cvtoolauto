import {
  DEFAULT_AUTOMATE_PREFS,
  type AutomatePrefs,
  type AutomateStatus,
  type CareerProfilePrefs,
  type EmploymentPreference,
  type RemotePreference,
} from "@/lib/career-profile/types"

export const CAREER_PROFILE_PREFS_KEY = "career-profile-prefs"
export const AUTOMATE_PREFS_KEY = "career-automate-prefs"

const REMOTE_VALUES = new Set<RemotePreference>(["onsite", "hybrid", "remote", "any"])
const EMPLOYMENT_VALUES = new Set<EmploymentPreference>([
  "full_time",
  "part_time",
  "contract",
  "freelance",
  "internship",
])
const STATUS_VALUES = new Set<AutomateStatus>(["off", "paused", "active"])

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function emptyCareerProfilePrefs(): CareerProfilePrefs {
  return {}
}

export function loadCareerProfilePrefs(): CareerProfilePrefs {
  if (typeof window === "undefined") return emptyCareerProfilePrefs()
  try {
    const raw = localStorage.getItem(CAREER_PROFILE_PREFS_KEY)
    if (!raw) return emptyCareerProfilePrefs()
    const parsed = JSON.parse(raw) as Partial<CareerProfilePrefs>
    if (typeof parsed !== "object" || parsed === null) return emptyCareerProfilePrefs()

    const employment = Array.isArray(parsed.employmentPreferences)
      ? parsed.employmentPreferences.filter(
          (item): item is EmploymentPreference =>
            typeof item === "string" && EMPLOYMENT_VALUES.has(item as EmploymentPreference),
        )
      : undefined

    const remote =
      typeof parsed.remotePreference === "string" &&
      REMOTE_VALUES.has(parsed.remotePreference as RemotePreference)
        ? (parsed.remotePreference as RemotePreference)
        : undefined

    const use = parsed.useForRecommendations
    const useForRecommendations =
      use && typeof use === "object"
        ? {
            story: typeof use.story === "boolean" ? use.story : undefined,
            preferences: typeof use.preferences === "boolean" ? use.preferences : undefined,
            roleStrategy: typeof use.roleStrategy === "boolean" ? use.roleStrategy : undefined,
          }
        : undefined

    return {
      currentPositioning: asOptionalString(parsed.currentPositioning),
      rolesOfInterest: asOptionalString(parsed.rolesOfInterest),
      industriesOfInterest: asOptionalString(parsed.industriesOfInterest),
      problemsToSolve: asOptionalString(parsed.problemsToSolve),
      preferredOrganisations: asOptionalString(parsed.preferredOrganisations),
      professionalValues: asOptionalString(parsed.professionalValues),
      careerTransitionGoals: asOptionalString(parsed.careerTransitionGoals),
      preferredLocations: asOptionalString(parsed.preferredLocations),
      remotePreference: remote,
      salaryMin: asOptionalString(parsed.salaryMin),
      salaryMax: asOptionalString(parsed.salaryMax),
      salaryCurrency: asOptionalString(parsed.salaryCurrency) ?? "EUR",
      workingHours: asOptionalString(parsed.workingHours),
      employmentPreferences: employment?.length ? employment : undefined,
      useForRecommendations,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
    }
  } catch {
    return emptyCareerProfilePrefs()
  }
}

export function saveCareerProfilePrefs(prefs: CareerProfilePrefs): CareerProfilePrefs {
  if (typeof window === "undefined") return prefs
  const normalized: CareerProfilePrefs = { ...prefs, updatedAt: Date.now() }
  localStorage.setItem(CAREER_PROFILE_PREFS_KEY, JSON.stringify(normalized))
  return normalized
}

export function patchCareerProfilePrefs(patch: Partial<CareerProfilePrefs>): CareerProfilePrefs {
  const merged = { ...loadCareerProfilePrefs(), ...patch }
  return saveCareerProfilePrefs(merged)
}

export function hasCareerProfilePrefsContent(prefs: CareerProfilePrefs | null | undefined): boolean {
  if (!prefs) return false
  return Boolean(
    prefs.currentPositioning?.trim() ||
      prefs.rolesOfInterest?.trim() ||
      prefs.industriesOfInterest?.trim() ||
      prefs.problemsToSolve?.trim() ||
      prefs.preferredOrganisations?.trim() ||
      prefs.professionalValues?.trim() ||
      prefs.careerTransitionGoals?.trim() ||
      prefs.preferredLocations?.trim() ||
      prefs.remotePreference ||
      prefs.salaryMin?.trim() ||
      prefs.salaryMax?.trim() ||
      prefs.workingHours?.trim() ||
      (prefs.employmentPreferences && prefs.employmentPreferences.length > 0),
  )
}

export function loadAutomatePrefs(): AutomatePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_AUTOMATE_PREFS }
  try {
    const raw = localStorage.getItem(AUTOMATE_PREFS_KEY)
    if (!raw) return { ...DEFAULT_AUTOMATE_PREFS }
    const parsed = JSON.parse(raw) as Partial<AutomatePrefs>
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_AUTOMATE_PREFS }

    const status =
      typeof parsed.status === "string" && STATUS_VALUES.has(parsed.status as AutomateStatus)
        ? (parsed.status as AutomateStatus)
        : DEFAULT_AUTOMATE_PREFS.status

    return {
      status,
      discoverJobs: typeof parsed.discoverJobs === "boolean" ? parsed.discoverJobs : true,
      discoverCompanies:
        typeof parsed.discoverCompanies === "boolean" ? parsed.discoverCompanies : false,
      discoverPeople: typeof parsed.discoverPeople === "boolean" ? parsed.discoverPeople : false,
      frequency:
        parsed.frequency === "daily" || parsed.frequency === "weekly" || parsed.frequency === "manual"
          ? parsed.frequency
          : DEFAULT_AUTOMATE_PREFS.frequency,
      relevanceThreshold:
        parsed.relevanceThreshold === "low" ||
        parsed.relevanceThreshold === "medium" ||
        parsed.relevanceThreshold === "high"
          ? parsed.relevanceThreshold
          : DEFAULT_AUTOMATE_PREFS.relevanceThreshold,
      delivery:
        parsed.delivery === "in_app_and_email" ? "in_app_and_email" : "in_app",
      notificationEmail: asOptionalString(parsed.notificationEmail),
      consentToUseProfile:
        typeof parsed.consentToUseProfile === "boolean" ? parsed.consentToUseProfile : false,
      lastSuccessfulSearchAt:
        typeof parsed.lastSuccessfulSearchAt === "number"
          ? parsed.lastSuccessfulSearchAt
          : parsed.lastSuccessfulSearchAt === null
            ? null
            : null,
      newRecommendationCount:
        typeof parsed.newRecommendationCount === "number" ? parsed.newRecommendationCount : 0,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
    }
  } catch {
    return { ...DEFAULT_AUTOMATE_PREFS }
  }
}

export function saveAutomatePrefs(prefs: AutomatePrefs): AutomatePrefs {
  if (typeof window === "undefined") return prefs
  const normalized: AutomatePrefs = { ...prefs, updatedAt: Date.now() }
  localStorage.setItem(AUTOMATE_PREFS_KEY, JSON.stringify(normalized))
  return normalized
}

export function patchAutomatePrefs(patch: Partial<AutomatePrefs>): AutomatePrefs {
  const merged = { ...loadAutomatePrefs(), ...patch }
  return saveAutomatePrefs(merged)
}

export function formatLastSearchLabel(timestamp: number | null | undefined): string {
  if (!timestamp) return "No successful search yet"
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}
