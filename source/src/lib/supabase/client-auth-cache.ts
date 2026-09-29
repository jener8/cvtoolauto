const AUTH_BLOCK_STORAGE_KEY = "cv_supabase_auth_blocked_until"
const DEFAULT_BLOCK_MS = 5 * 60_000

let authBlockedUntil = 0
let lastAuthFailureLogAt = 0

function readStoredBlockUntil(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = sessionStorage.getItem(AUTH_BLOCK_STORAGE_KEY)
    if (!raw) return 0
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function writeStoredBlockUntil(until: number): void {
  if (typeof window === "undefined") return
  try {
    if (until > Date.now()) {
      sessionStorage.setItem(AUTH_BLOCK_STORAGE_KEY, String(until))
    } else {
      sessionStorage.removeItem(AUTH_BLOCK_STORAGE_KEY)
    }
  } catch {
    // ignore quota errors
  }
}

/** True when recent server auth failures should block repeated sign-in attempts. */
export function isSupabaseAuthBlocked(): boolean {
  const stored = readStoredBlockUntil()
  if (stored > authBlockedUntil) authBlockedUntil = stored
  return Date.now() < authBlockedUntil
}

export function clearSupabaseAuthBlock(): void {
  authBlockedUntil = 0
  writeStoredBlockUntil(0)
}

export function markSupabaseAuthBlocked(
  reason: string,
  options?: { durationMs?: number; code?: string },
): void {
  const durationMs = options?.durationMs ?? DEFAULT_BLOCK_MS
  authBlockedUntil = Date.now() + durationMs
  writeStoredBlockUntil(authBlockedUntil)

  const now = Date.now()
  if (now - lastAuthFailureLogAt > 60_000) {
    lastAuthFailureLogAt = now
    console.warn("[supabase-auth] Blocking repeated sign-in attempts:", {
      reason,
      code: options?.code,
      retryAfterSec: Math.round(durationMs / 1000),
    })
  }
}

export function logSupabaseAuthFailureOnce(message: string, code?: string): void {
  const now = Date.now()
  if (now - lastAuthFailureLogAt > 60_000) {
    lastAuthFailureLogAt = now
    console.warn("[supabase-auth] Auth session failed:", { message, code })
  }
}
