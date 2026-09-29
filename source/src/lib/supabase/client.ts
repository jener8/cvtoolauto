import { createBrowserClient, type SupabaseClient } from "@supabase/ssr"
import { getSupabaseEnv } from "./config"
import { describeSupabaseError } from "./errors"
import { fetchWithTimeout } from "./fetch"

let client: SupabaseClient | null | undefined
let initError: string | null = null

function createClientSafe(): SupabaseClient | null {
  try {
    const env = getSupabaseEnv()
    if (!env) {
      initError = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      return null
    }

    return createBrowserClient(env.url, env.anonKey, {
      global: { fetch: fetchWithTimeout },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (e) {
    initError = e instanceof Error ? e.message : "Failed to initialize Supabase client"
    console.error("[supabase] Client init failed:", describeSupabaseError(e))
    return null
  }
}

/** Returns the browser Supabase client, or null if env is missing or init failed. */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client
  client = createClientSafe()
  return client
}

export function getSupabaseInitError(): string | null {
  if (client === undefined) getSupabaseClient()
  return initError
}

/**
 * Legacy export — may be null. Prefer getSupabaseClient() and check before use.
 * @deprecated Use getSupabaseClient() with a null check.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getSupabaseClient()
    if (!c) {
      throw new Error(
        initError ?? "Supabase is unavailable. Enable local mode or fix environment variables.",
      )
    }
    const value = (c as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === "function" ? value.bind(c) : value
  },
})
