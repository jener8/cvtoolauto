import { getSupabaseClient } from "@/lib/supabase/client"
import {
  clearSupabaseAuthBlock,
  isSupabaseAuthBlocked,
  logSupabaseAuthFailureOnce,
  markSupabaseAuthBlocked,
} from "@/lib/supabase/client-auth-cache"

const SUPABASE_SESSION_BOOTSTRAP_TIMEOUT_MS = 8_000

type SupabaseSessionErrorBody = {
  code?: string
  error?: string
  hint?: string
}

/** Supabase Auth session for database RLS (separate from CV username/password cookie). */
export async function ensureSupabaseAuthSession(): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  if (isSupabaseAuthBlocked()) {
    return false
  }

  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) {
    clearSupabaseAuthBlock()
    return true
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_SESSION_BOOTSTRAP_TIMEOUT_MS)

  try {
    const res = await fetch("/api/auth/supabase-session", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    })

    if (!res.ok) {
      let body: SupabaseSessionErrorBody = {}
      try {
        body = (await res.json()) as SupabaseSessionErrorBody
      } catch {
        // ignore parse errors
      }
      logSupabaseAuthFailureOnce(body.error ?? `HTTP ${res.status}`, body.code)
      if (
        body.code === "SUPABASE_SERVER_AUTH_MISSING" ||
        body.code === "SUPABASE_SERVER_AUTH_FAILED"
      ) {
        markSupabaseAuthBlocked(body.error ?? body.code ?? "auth_failed", { code: body.code })
      }
      return false
    }

    const payload = (await res.json()) as {
      access_token?: string
      refresh_token?: string
    }
    if (!payload.access_token || !payload.refresh_token) {
      logSupabaseAuthFailureOnce("Session tokens missing from server response")
      return false
    }

    const { error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    })
    if (error) {
      logSupabaseAuthFailureOnce(error.message)
      return false
    }

    clearSupabaseAuthBlock()
    return true
  } catch (error) {
    logSupabaseAuthFailureOnce(
      error instanceof Error ? error.message : "Supabase session bootstrap failed",
    )
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getAuthenticatedSupabaseUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
