import {
  coerceLinkedInSections,
  hasMeaningfulLinkedInContent,
  sectionsToGeneralCv,
} from "@/lib/linkedin-profile-sections"
import type { LinkedInProfileSections } from "@/lib/linkedin-profile-types"
import type {
  LinkedInSyncApiResponse,
  LinkedInSyncDebug,
  LinkedInSyncStatus,
  LinkedInSyncUiPhase,
} from "@/lib/linkedin-sync-types"
import {
  loadUserProfile,
  patchUserProfile,
  validateLinkedInProfileUrl,
  type UserProfile,
} from "@/lib/user-profile"

export type { LinkedInSyncUiPhase, LinkedInSyncStatus }

/** @deprecated Use LinkedInSyncUiPhase */
export type LinkedInSyncPhase = "syncing" | "success" | "partial" | "fallback" | "blocked" | "failed"

export type LinkedInSyncResult = {
  ok: boolean
  status: LinkedInSyncStatus
  uiPhase: LinkedInSyncUiPhase
  /** @deprecated Use uiPhase */
  phase: LinkedInSyncPhase
  profileText: string | null
  sections: LinkedInProfileSections
  refreshed: boolean
  scrapeBlocked: boolean
  usedCached: boolean
  lastSyncAt: number | null
  lastSyncAttemptAt: number | null
  userMessage?: string
  error?: string
  debug?: LinkedInSyncDebug
}

const MIN_SYNC_INTERVAL_MS = 15_000

let syncInFlight: Promise<LinkedInSyncResult> | null = null

function getLinkedInUrl(profile: UserProfile | null): string | null {
  return profile?.linkedInProfileUrl?.trim() || null
}

function uiPhaseFromStatus(status: LinkedInSyncStatus, meaningful: boolean): LinkedInSyncUiPhase {
  if (status === "synced") return "success"
  if (status === "partial") return meaningful ? "partial" : "fallback"
  if (status === "blocked") return "blocked"
  return meaningful ? "partial" : "failed"
}

function legacyPhase(ui: LinkedInSyncUiPhase): LinkedInSyncPhase {
  if (ui === "checking" || ui === "reading" || ui === "extracting") return "syncing"
  if (ui === "success") return "success"
  if (ui === "partial") return "partial"
  if (ui === "blocked") return "fallback"
  if (ui === "failed") return "fallback"
  return "fallback"
}

function persistSyncResult(
  result: LinkedInSyncApiResponse,
  profileText: string | null,
  sections: LinkedInProfileSections,
  now: number,
): void {
  patchUserProfile({
    linkedInLastSyncAt: profileText ? now : loadUserProfile()?.linkedInLastSyncAt ?? now,
    linkedInLastSyncAttemptAt: now,
    linkedInLastSyncStatus: result.status,
    linkedInLastSyncError: result.error ?? null,
    linkedInSyncDebug: result.debug,
    linkedInScrapeBlocked: result.status === "blocked",
    linkedInProfileSections: sections,
    ...(profileText ? { linkedInProfileText: profileText } : {}),
  })
}

async function callSyncApi(url: string): Promise<LinkedInSyncApiResponse> {
  const res = await fetch("/api/linkedin/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })

  const data = (await res.json().catch(() => ({}))) as Partial<LinkedInSyncApiResponse> & {
    error?: string
  }

  const sections = coerceLinkedInSections(data.sections, data.profileText ?? null)

  return {
    status: data.status ?? "failed",
    profileText: typeof data.profileText === "string" ? data.profileText : null,
    sections,
    url: data.url ?? url,
    error: data.error,
    userMessage: data.userMessage,
    debug: data.debug ?? { reason: data.error ?? `HTTP ${res.status}` },
  }
}

function buildResultFromApi(
  api: LinkedInSyncApiResponse,
  refreshed: boolean,
  usedCached: boolean,
  lastSyncAt: number,
  lastSyncAttemptAt: number,
): LinkedInSyncResult {
  const profileText =
    api.profileText?.trim() || sectionsToGeneralCv(api.sections) || null
  const meaningful = hasMeaningfulLinkedInContent(api.sections, profileText)
  const uiPhase = uiPhaseFromStatus(api.status, meaningful)

  return {
    ok: meaningful || api.status === "partial",
    status: api.status,
    uiPhase,
    phase: legacyPhase(uiPhase),
    profileText,
    sections: api.sections,
    refreshed,
    scrapeBlocked: api.status === "blocked",
    usedCached,
    lastSyncAt,
    lastSyncAttemptAt,
    userMessage: api.userMessage,
    error: api.error,
    debug: api.debug,
  }
}

/**
 * Attempt a fresh LinkedIn profile sync with progress callbacks and client-side retry.
 */
export async function syncLinkedInProfile(options?: {
  force?: boolean
  onProgress?: (phase: LinkedInSyncUiPhase) => void
}): Promise<LinkedInSyncResult> {
  if (syncInFlight) return syncInFlight

  const run = async (): Promise<LinkedInSyncResult> => {
    const emit = (phase: LinkedInSyncUiPhase) => options?.onProgress?.(phase)
    const profile = loadUserProfile()
    const url = getLinkedInUrl(profile)
    const cachedText = profile?.linkedInProfileText?.trim() || null
    const cachedSections = coerceLinkedInSections(
      profile?.linkedInProfileSections,
      cachedText,
    )
    const lastSyncAt = profile?.linkedInLastSyncAt ?? null
    const now = Date.now()

    if (!url) {
      emit("failed")
      return {
        ok: false,
        status: "failed",
        uiPhase: "failed",
        phase: "fallback",
        profileText: cachedText,
        sections: cachedSections,
        refreshed: false,
        scrapeBlocked: false,
        usedCached: Boolean(cachedText),
        lastSyncAt,
        lastSyncAttemptAt: now,
        error: "No LinkedIn profile URL saved",
      }
    }

    emit("checking")
    const validation = validateLinkedInProfileUrl(url)
    if (!validation.valid || !validation.normalized) {
      emit("failed")
      return {
        ok: false,
        status: "failed",
        uiPhase: "failed",
        phase: "fallback",
        profileText: cachedText,
        sections: cachedSections,
        refreshed: false,
        scrapeBlocked: false,
        usedCached: Boolean(cachedText),
        lastSyncAt,
        lastSyncAttemptAt: now,
        error: validation.error,
      }
    }

    if (validation.normalized !== url) {
      patchUserProfile({ linkedInProfileUrl: validation.normalized })
    }

    if (
      !options?.force &&
      lastSyncAt &&
      now - lastSyncAt < MIN_SYNC_INTERVAL_MS &&
      hasMeaningfulLinkedInContent(cachedSections, cachedText)
    ) {
      const text = sectionsToGeneralCv(cachedSections) || cachedText
      const status = profile?.linkedInLastSyncStatus ?? "partial"
      const uiPhase = uiPhaseFromStatus(status, true)
      emit(uiPhase)
      return {
        ok: true,
        status,
        uiPhase,
        phase: legacyPhase(uiPhase),
        profileText: text,
        sections: cachedSections,
        refreshed: false,
        scrapeBlocked: Boolean(profile?.linkedInScrapeBlocked),
        usedCached: true,
        lastSyncAt,
        lastSyncAttemptAt: profile?.linkedInLastSyncAttemptAt ?? now,
        debug: profile?.linkedInSyncDebug ?? undefined,
      }
    }

    emit("reading")
    let api = await callSyncApi(validation.normalized)

    emit("extracting")

    const firstMeaningful = hasMeaningfulLinkedInContent(
      api.sections,
      api.profileText ?? sectionsToGeneralCv(api.sections),
    )

    if (
      !firstMeaningful &&
      (api.status === "blocked" || api.status === "failed")
    ) {
      emit("reading")
      await new Promise((r) => setTimeout(r, 900))
      api = await callSyncApi(validation.normalized)
      emit("extracting")
      api.debug = { ...api.debug, retried: true }
    }

    const fetchedText =
      api.profileText?.trim() || sectionsToGeneralCv(api.sections) || null
    const hasNew = Boolean(fetchedText && fetchedText.length > 0)
    const profileText = hasNew ? fetchedText : cachedText
    const sections = hasNew ? api.sections : cachedSections
    const refreshed = hasNew

    persistSyncResult(api, profileText, sections, now)

    const result = buildResultFromApi(
      { ...api, profileText, sections },
      refreshed,
      !refreshed && Boolean(cachedText),
      profileText ? now : lastSyncAt ?? now,
      now,
    )

    emit(result.uiPhase)
    return result
  }

  syncInFlight = run().finally(() => {
    syncInFlight = null
  })

  return syncInFlight
}

export function getLinkedInProfileUrl(): string | null {
  return getLinkedInUrl(loadUserProfile())
}

export function hasLinkedInProfileUrl(): boolean {
  return Boolean(getLinkedInProfileUrl())
}

export function getCachedLinkedInSections(): LinkedInProfileSections {
  const profile = loadUserProfile()
  return coerceLinkedInSections(profile?.linkedInProfileSections, profile?.linkedInProfileText)
}

export const LINKEDIN_SYNC_UI_LABELS: Record<LinkedInSyncUiPhase, string> = {
  idle: "",
  checking: "Checking profile…",
  reading: "Reading public profile…",
  extracting: "Extracting profile sections…",
  success: "Sync successful",
  partial: "Partial sync",
  blocked: "Blocked by LinkedIn",
  failed: "Sync failed",
  fallback: "",
}
