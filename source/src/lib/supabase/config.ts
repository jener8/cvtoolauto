export type SupabaseStorageMode = "remote" | "local" | "unconfigured"

export interface SupabaseEnv {
  url: string
  anonKey: string
}

/** Read public Supabase env vars (safe on client and server). */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null
}

/** When true, never call Supabase — use browser localStorage only. */
export function isForceLocalMode(): boolean {
  const flag = process.env.NEXT_PUBLIC_SUPABASE_LOCAL_MODE?.trim().toLowerCase()
  return flag === "true" || flag === "1" || flag === "yes"
}

export function getSupabaseStorageMode(): SupabaseStorageMode {
  if (!isSupabaseConfigured() || isForceLocalMode()) {
    return isSupabaseConfigured() ? "local" : "unconfigured"
  }
  return "remote"
}

export const SUPABASE_REQUEST_TIMEOUT_MS = 12_000
export const SUPABASE_HEALTH_TIMEOUT_MS = 6_000
