import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseEnv } from "./config"
import { describeSupabaseError } from "./errors"

let serverClient: SupabaseClient | null | undefined

/** Server-side Supabase client (API routes, RSC). Returns null if env is missing or init fails. */
export function getServerSupabaseClient(): SupabaseClient | null {
  if (serverClient !== undefined) return serverClient

  try {
    const env = getSupabaseEnv()
    if (!env) {
      serverClient = null
      return null
    }

    serverClient = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return serverClient
  } catch (e) {
    console.error("[supabase] Server client init failed:", describeSupabaseError(e))
    serverClient = null
    return null
  }
}
