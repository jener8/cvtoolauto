/** User-level career preferences — complements My story (StrategicProfile). */

export type RemotePreference = "onsite" | "hybrid" | "remote" | "any"

export type EmploymentPreference =
  | "full_time"
  | "part_time"
  | "contract"
  | "freelance"
  | "internship"

export type AutomateStatus = "off" | "paused" | "active"

export type AutomateFrequency = "daily" | "weekly" | "manual"

export type RelevanceThreshold = "low" | "medium" | "high"

export type AutomateDelivery = "in_app" | "in_app_and_email"

/** Preference fields edited on Career Profile (not the narrative My story fields). */
export type CareerProfilePrefs = {
  /** How you describe your current professional positioning. */
  currentPositioning?: string
  /** Roles you want to explore (free text / comma-separated). */
  rolesOfInterest?: string
  /** Industries you want to explore. */
  industriesOfInterest?: string
  /** Types of problems you want to solve. */
  problemsToSolve?: string
  /** Preferred organisations or working environments. */
  preferredOrganisations?: string
  /** Professional values and interests. */
  professionalValues?: string
  /** Career-transition goals. */
  careerTransitionGoals?: string
  /** Preferred work locations (cities, countries, regions). */
  preferredLocations?: string
  remotePreference?: RemotePreference
  salaryMin?: string
  salaryMax?: string
  salaryCurrency?: string
  /** Working hours preference (e.g. standard, flexible, reduced). */
  workingHours?: string
  employmentPreferences?: EmploymentPreference[]
  /**
   * Which profile areas may inform recommendations.
   * Missing keys default to true when content exists.
   */
  useForRecommendations?: {
    story?: boolean
    preferences?: boolean
    roleStrategy?: boolean
  }
  updatedAt?: number
}

export type AutomatePrefs = {
  status: AutomateStatus
  discoverJobs: boolean
  discoverCompanies: boolean
  discoverPeople: boolean
  frequency: AutomateFrequency
  relevanceThreshold: RelevanceThreshold
  delivery: AutomateDelivery
  /** Optional email when delivery includes email — never used without consent. */
  notificationEmail?: string
  /** Explicit consent that automation may use Career Profile + Role Strategy. */
  consentToUseProfile: boolean
  lastSuccessfulSearchAt?: number | null
  newRecommendationCount?: number
  updatedAt?: number
}

export const DEFAULT_AUTOMATE_PREFS: AutomatePrefs = {
  status: "off",
  discoverJobs: true,
  discoverCompanies: false,
  discoverPeople: false,
  frequency: "manual",
  relevanceThreshold: "medium",
  delivery: "in_app",
  consentToUseProfile: false,
  lastSuccessfulSearchAt: null,
  newRecommendationCount: 0,
}

export function automateStatusLabel(status: AutomateStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "paused":
      return "Paused"
    default:
      return "Off"
  }
}

export function remotePreferenceLabel(value: RemotePreference | undefined): string {
  switch (value) {
    case "onsite":
      return "On-site"
    case "hybrid":
      return "Hybrid"
    case "remote":
      return "Remote"
    case "any":
      return "Any"
    default:
      return "Not set"
  }
}
