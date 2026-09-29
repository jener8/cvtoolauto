/**
 * URL query helpers for the authenticated /app workspace shell.
 * Section navigation is client-side; these params survive refresh / share / open-in-new-tab.
 */

export const APP_WORKSPACE_PATH = "/app"

/** Views that can be restored from the URL after a refresh. */
export const RESTORABLE_APP_VIEWS = [
  "careerHome",
  "opportunities",
  "careerBrain",
  "roleMatches",
  "scenarioLab",
  "aiCoach",
  "settings",
  "recognitionPathways",
  "workplaceGerman",
  "mentoringSupport",
  "bureaucracyNavigator",
  "aiJobSearchGuide",
  "programme",
  "dashboard",
  "statistics",
  "resume",
  "yourStory",
  "coverLetter",
  "jobCoverLetter",
  "interviewPrep",
  "companyInfo",
  "contacts",
  "jobStrategy",
] as const

export type RestorableAppView = (typeof RESTORABLE_APP_VIEWS)[number]

export type AppWorkspaceSort = "newest" | "oldest"

export type AppWorkspaceUrlState = {
  view: RestorableAppView | "folders" | null
  folderId: string | null
  applicationId: string | null
  resumeId: string | null
  sort: AppWorkspaceSort | null
}

const RESTORABLE_SET = new Set<string>(RESTORABLE_APP_VIEWS)

/** Views that keep an application id in the URL. */
const APPLICATION_SCOPED_VIEWS = new Set<string>([
  "dashboard",
  "resume",
  "yourStory",
  "jobCoverLetter",
  "coverLetter",
  "interviewPrep",
  "companyInfo",
  "contacts",
  "jobStrategy",
])

export function isRestorableAppView(value: string | null | undefined): value is RestorableAppView {
  return Boolean(value && RESTORABLE_SET.has(value))
}

export function parseAppWorkspaceSearch(
  search: string | URLSearchParams | null | undefined,
): AppWorkspaceUrlState {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : new URLSearchParams()

  const rawView = params.get("view")?.trim() || null
  const sortRaw = params.get("sort")?.trim() || null

  return {
    view: isRestorableAppView(rawView)
      ? rawView
      : rawView === "folders"
        ? "folders"
        : null,
    folderId: params.get("folder")?.trim() || null,
    applicationId: params.get("application")?.trim() || null,
    resumeId: params.get("resume")?.trim() || null,
    sort: sortRaw === "newest" || sortRaw === "oldest" ? sortRaw : null,
  }
}

export function readAppWorkspaceUrlFromWindow(): AppWorkspaceUrlState {
  if (typeof window === "undefined") {
    return {
      view: null,
      folderId: null,
      applicationId: null,
      resumeId: null,
      sort: null,
    }
  }
  return parseAppWorkspaceSearch(window.location.search)
}

export function buildAppWorkspaceHref(state: {
  view?: string | null
  folderId?: string | null
  applicationId?: string | null
  resumeId?: string | null
  sort?: AppWorkspaceSort | null
  pathname?: string
}): string {
  const pathname = state.pathname || APP_WORKSPACE_PATH
  const view = state.view?.trim() || null
  const clean = new URLSearchParams()

  if (view && view !== "folders") {
    clean.set("view", view)
  }
  if (state.folderId?.trim()) {
    clean.set("folder", state.folderId.trim())
  }
  if (state.applicationId?.trim() && view && APPLICATION_SCOPED_VIEWS.has(view)) {
    clean.set("application", state.applicationId.trim())
  }
  if (view === "resume" && state.resumeId?.trim()) {
    clean.set("resume", state.resumeId.trim())
  }
  if (view === "dashboard" && (state.sort === "newest" || state.sort === "oldest")) {
    clean.set("sort", state.sort)
  }

  const qs = clean.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
