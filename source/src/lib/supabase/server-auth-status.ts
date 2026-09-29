import { getSupabaseEnv } from "./config"
import {
  SUPABASE_CONNECTION_FAILED_BANNER,
  SUPABASE_SERVER_AUTH_RATE_LIMIT_HINT,
  SUPABASE_SERVER_AUTH_SETUP_HINT,
  SUPABASE_SERVER_AUTH_INVALID_CREDENTIALS_HINT,
  supabaseServerAuthFailureHint,
} from "./connection-messages"

export {
  SUPABASE_CONNECTION_FAILED_BANNER,
  SUPABASE_SERVER_AUTH_INVALID_CREDENTIALS_HINT,
  SUPABASE_SERVER_AUTH_RATE_LIMIT_HINT,
  SUPABASE_SERVER_AUTH_SETUP_HINT,
  supabaseServerAuthFailureHint,
}

export type SupabaseServerAuthMissingVar =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_APP_USER_EMAIL"
  | "SUPABASE_APP_USER_PASSWORD"

export type SupabaseServerAuthStatus = {
  configured: boolean
  missing: SupabaseServerAuthMissingVar[]
  invalidPasswordLooksLikeApiKey: boolean
}

/** Server-only: which Supabase auth env vars are missing (never returns secret values). */
export function getSupabaseServerAuthStatus(): SupabaseServerAuthStatus {
  const missing: SupabaseServerAuthMissingVar[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  const email = process.env.SUPABASE_APP_USER_EMAIL?.trim()
  const password = process.env.SUPABASE_APP_USER_PASSWORD?.trim()
  if (!email) missing.push("SUPABASE_APP_USER_EMAIL")
  if (!password) missing.push("SUPABASE_APP_USER_PASSWORD")

  const invalidPasswordLooksLikeApiKey = Boolean(
    password?.startsWith("sb_secret_") || password?.startsWith("sb_publishable_"),
  )

  const configured =
    Boolean(getSupabaseEnv()) &&
    Boolean(email && password) &&
    !invalidPasswordLooksLikeApiKey

  return { configured, missing, invalidPasswordLooksLikeApiKey }
}

export function isSupabaseServerAuthConfigured(): boolean {
  return getSupabaseServerAuthStatus().configured
}

/** Log missing server auth configuration once at startup (no secret values). */
export function logSupabaseServerAuthStatusOnce(): void {
  const g = globalThis as typeof globalThis & { __cvSupabaseAuthLogged?: boolean }
  if (g.__cvSupabaseAuthLogged) return
  g.__cvSupabaseAuthLogged = true

  const status = getSupabaseServerAuthStatus()
  if (status.configured) {
    console.info("[supabase] Server app auth configured (SUPABASE_APP_USER_EMAIL set).")
    return
  }

  if (status.missing.length > 0) {
    console.warn(
      "[supabase] Server app auth not configured — missing env:",
      status.missing.join(", "),
    )
  }
  if (status.invalidPasswordLooksLikeApiKey) {
    console.error(
      "[supabase] SUPABASE_APP_USER_PASSWORD looks like an API key. Use the Auth user's login password, not sb_secret_.",
    )
  }
}
