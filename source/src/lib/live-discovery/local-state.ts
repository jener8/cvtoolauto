/** Client-side save/dismiss overlays for Discover Jobs (per folder). */

const STORAGE_PREFIX = "live-discovery-local"

export type LiveDiscoveryLocalState = {
  savedIds: string[]
  dismissedIds: string[]
  updatedAt: number
}

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

export function emptyLiveDiscoveryLocalState(): LiveDiscoveryLocalState {
  return { savedIds: [], dismissedIds: [], updatedAt: Date.now() }
}

export function loadLiveDiscoveryLocalState(folderId: string): LiveDiscoveryLocalState {
  if (typeof window === "undefined" || !folderId) return emptyLiveDiscoveryLocalState()
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return emptyLiveDiscoveryLocalState()
    const parsed = JSON.parse(raw) as Partial<LiveDiscoveryLocalState>
    return {
      savedIds: Array.isArray(parsed.savedIds)
        ? parsed.savedIds.filter((id): id is string => typeof id === "string")
        : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((id): id is string => typeof id === "string")
        : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return emptyLiveDiscoveryLocalState()
  }
}

export function saveLiveDiscoveryLocalState(
  folderId: string,
  state: LiveDiscoveryLocalState,
): void {
  if (typeof window === "undefined" || !folderId) return
  try {
    localStorage.setItem(
      storageKey(folderId),
      JSON.stringify({ ...state, updatedAt: Date.now() }),
    )
  } catch {
    /* ignore quota */
  }
}

export function markJobSaved(folderId: string, jobId: string): LiveDiscoveryLocalState {
  const current = loadLiveDiscoveryLocalState(folderId)
  const next: LiveDiscoveryLocalState = {
    savedIds: current.savedIds.includes(jobId)
      ? current.savedIds
      : [...current.savedIds, jobId],
    dismissedIds: current.dismissedIds.filter((id) => id !== jobId),
    updatedAt: Date.now(),
  }
  saveLiveDiscoveryLocalState(folderId, next)
  return next
}

export function markJobDismissed(folderId: string, jobId: string): LiveDiscoveryLocalState {
  const current = loadLiveDiscoveryLocalState(folderId)
  const next: LiveDiscoveryLocalState = {
    savedIds: current.savedIds.filter((id) => id !== jobId),
    dismissedIds: current.dismissedIds.includes(jobId)
      ? current.dismissedIds
      : [...current.dismissedIds, jobId],
    updatedAt: Date.now(),
  }
  saveLiveDiscoveryLocalState(folderId, next)
  return next
}
