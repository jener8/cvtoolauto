/**
 * EquitAI sidebar visibility — Step 1 repositioning.
 *
 * Hide removed sections behind this flag so components/routes/data stay in the
 * codebase and can be re-enabled later. Do not delete user data or tables.
 *
 * Applications-flow views (resume, yourStory, cover letters, etc.) are not
 * gated here — they stay reachable from My applications.
 */

import type { AppSectionView, WorkspaceNavId } from "@/lib/workspace-navigation"

/** Default landing after login / bare `/app` / unknown or retired `view=`. */
export const DEFAULT_WORKSPACE_LANDING_VIEW: AppSectionView = "dashboard"

/**
 * Sidebar nav ids that remain visible.
 * Re-enable a removed section by adding its id back here.
 */
export const ENABLED_WORKSPACE_NAV_IDS: ReadonlySet<WorkspaceNavId> = new Set([
  "applications",
  "careerProfile", // Career Profile — prefs, direction, Automate settings
  "careerBrain", // My story — strategic-profile feeds CV / cover letter / app flow
  "roleMatches", // Role Strategy — career directions from story + CV
  // "careerHome",
  // "recognitionPathways",
  // "workplaceGerman",
  // "bureaucracyNavigator",
  // "mentoringSupport",
  // "progress",
  // "scenarioLab",
  // "aiCoach",
  // "agents",
])

/** `?view=` values that belong to retired sidebar sections (redirect to landing). */
const RETIRED_SIDEBAR_VIEWS: ReadonlySet<string> = new Set([
  "careerHome",
  "recognitionPathways",
  "workplaceGerman",
  "bureaucracyNavigator",
  "mentoringSupport",
  "statistics",
  "scenarioLab",
  "aiCoach",
  "opportunities",
  "programme",
  "aiJobSearchGuide",
])

export function isWorkspaceNavIdEnabled(id: WorkspaceNavId): boolean {
  return ENABLED_WORKSPACE_NAV_IDS.has(id)
}

/**
 * True when a restorable `view=` is a retired sidebar section and should
 * redirect to My applications. Application-flow views are never retired here.
 */
export function isRetiredSidebarView(view: string | null | undefined): boolean {
  if (!view) return false
  return RETIRED_SIDEBAR_VIEWS.has(view)
}

/** Map URL / navigation view onto an allowed landing when the section is retired. */
export function coerceWorkspaceLandingView(
  view: string | null | undefined,
): AppSectionView {
  if (!view) {
    return DEFAULT_WORKSPACE_LANDING_VIEW
  }
  // Workspace picker must stay reachable.
  if (view === "folders") {
    return "folders"
  }
  if (isRetiredSidebarView(view)) {
    return DEFAULT_WORKSPACE_LANDING_VIEW
  }
  return view as AppSectionView
}
