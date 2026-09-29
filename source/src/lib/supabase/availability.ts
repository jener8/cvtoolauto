import { getSupabaseStorageMode, isForceLocalMode, isSupabaseConfigured } from "./config"

let reachabilityKnown = false
let supabaseReachable = true
let offlineReason: string | null = null

export function markSupabaseOffline(reason: string): void {
  reachabilityKnown = true
  supabaseReachable = false
  offlineReason = reason
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("cv_supabase_offline", reason)
    } catch {
      // ignore quota errors
    }
  }
}

export function clearSupabaseOffline(): void {
  reachabilityKnown = true
  supabaseReachable = true
  offlineReason = null
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("cv_supabase_offline")
  }
}

export function getSupabaseOfflineReason(): string | null {
  if (offlineReason) return offlineReason
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("cv_supabase_offline")
  }
  return null
}

export function isSupabaseReachable(): boolean {
  if (!isSupabaseConfigured() || isForceLocalMode()) return false
  if (reachabilityKnown) return supabaseReachable
  if (typeof window !== "undefined" && sessionStorage.getItem("cv_supabase_offline")) {
    return false
  }
  return true
}

/** Use localStorage-backed data instead of remote Supabase. */
export function shouldUseLocalFallback(): boolean {
  const mode = getSupabaseStorageMode()
  if (mode === "unconfigured" || mode === "local") return true
  return !isSupabaseReachable()
}

/**
 * When sync was previously marked offline, probe Supabase once before skipping remote saves.
 * Clears stale session flags after transient failures.
 */
export async function refreshSupabaseReachability(): Promise<boolean> {
  if (!isSupabaseConfigured() || isForceLocalMode()) return false
  const { checkSupabaseHealth } = await import("./health")
  return checkSupabaseHealth()
}

export function describeSupabaseSyncBlocker(): string {
  if (isForceLocalMode()) {
    return "Cloud sync is disabled (NEXT_PUBLIC_SUPABASE_LOCAL_MODE). Remove it from .env.local and restart the dev server."
  }
  if (!isSupabaseConfigured()) {
    return "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart npm run dev."
  }
  const offline = getSupabaseOfflineReason()
  if (offline?.trim()) return offline.trim()
  return "Supabase is unreachable. Check your connection, then retry cloud sync."
}

export function getStorageModeLabel(): string {
  const mode = getSupabaseStorageMode()
  if (mode === "unconfigured") return "unconfigured"
  if (mode === "local" || shouldUseLocalFallback()) return "local"
  return "remote"
}
