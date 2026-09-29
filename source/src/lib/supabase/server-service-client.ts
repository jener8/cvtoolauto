import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseEnv } from "./config"
import {
  getSupabaseServerAuthStatus,
  logSupabaseServerAuthStatusOnce,
} from "./server-auth-status"

let lastSignInWarningAt = 0
let cachedClient: SupabaseClient | null = null
let cachedSessionValidUntilMs = 0
let lastSignInErrorMessage: string | null = null

logSupabaseServerAuthStatusOnce()

export function getLastServerServiceSignInError(): string | null {
  return lastSignInErrorMessage
}

/** Server-side Supabase client signed in as the shared app service user (for RLS). */
export async function createServerServiceSupabaseClient(): Promise<SupabaseClient | null> {
  const now = Date.now()
  if (cachedClient && cachedSessionValidUntilMs > now) {
    return cachedClient
  }
  cachedClient = null

  const env = getSupabaseEnv()
  const status = getSupabaseServerAuthStatus()
  if (!env || !status.configured) {
    if (status.missing.length > 0) {
      const now = Date.now()
      if (now - lastSignInWarningAt > 60_000) {
        lastSignInWarningAt = now
        console.warn(
          "[supabase] Service user sign-in skipped — missing env:",
          status.missing.join(", "),
        )
      }
    }
    if (status.invalidPasswordLooksLikeApiKey) {
      console.error(
        "[supabase] SUPABASE_APP_USER_PASSWORD looks like an API key. Use the Auth user's login password.",
      )
    }
    return null
  }

  const email = process.env.SUPABASE_APP_USER_EMAIL!.trim()
  const password = process.env.SUPABASE_APP_USER_PASSWORD!.trim()

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    lastSignInErrorMessage = error?.message ?? "no session"
    if (now - lastSignInWarningAt > 60_000) {
      lastSignInWarningAt = now
      console.warn("[supabase] Service user sign-in failed:", lastSignInErrorMessage)
    }
    return null
  }

  lastSignInErrorMessage = null
  cachedClient = supabase
  const expiresAtMs = (data.session.expires_at ?? 0) * 1000
  cachedSessionValidUntilMs =
    expiresAtMs > now ? expiresAtMs - 5 * 60_000 : now + 55 * 60_000

  return supabase
}
