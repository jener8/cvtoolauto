import type { LinkedInProfileSections } from "@/lib/linkedin-profile-types"

/** Server-reported outcome of a sync attempt. */
export type LinkedInSyncStatus = "synced" | "partial" | "blocked" | "failed"

/** Granular progress labels for the application UI. */
export type LinkedInSyncUiPhase =
  | "idle"
  | "checking"
  | "reading"
  | "extracting"
  | "success"
  | "partial"
  | "blocked"
  | "failed"
  | "fallback"

export type LinkedInSyncDebug = {
  httpStatus?: number
  finalUrl?: string
  loginWall?: boolean
  emptyContent?: boolean
  parseFailed?: boolean
  htmlLength?: number
  attempt?: number
  fetchError?: string
  populatedSections?: number
  extractionSources?: string[]
  reason?: string
  retried?: boolean
}

export type LinkedInSyncApiResponse = {
  status: LinkedInSyncStatus
  profileText: string | null
  sections: LinkedInProfileSections
  url: string
  error?: string
  userMessage?: string
  debug: LinkedInSyncDebug
}
