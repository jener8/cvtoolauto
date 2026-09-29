import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseClient } from "./client"
import { shouldUseLocalFallback, markSupabaseOffline } from "./availability"
import { isUnavailableSupabaseError } from "./errors"
import { SUPABASE_REQUEST_TIMEOUT_MS } from "./config"

export async function runSupabaseQuery<T>(
  label: string,
  query: (client: SupabaseClient) => Promise<T>,
  options?: { fallback?: () => T | Promise<T>; timeoutMs?: number },
): Promise<T> {
  if (shouldUseLocalFallback()) {
    if (options?.fallback) return options.fallback()
    throw new Error(`${label}: Supabase unavailable (local fallback mode)`)
  }

  const client = getSupabaseClient()
  if (!client) {
    if (options?.fallback) return options.fallback()
    throw new Error(`${label}: Supabase client not configured`)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    return await query(client)
  } catch (e) {
    if (isUnavailableSupabaseError(e)) {
      markSupabaseOffline(e instanceof Error ? e.message : `${label} failed`)
    }
    if (options?.fallback) return options.fallback()
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function supabaseWithAbort<T>(
  run: (signal: AbortSignal) => Promise<T>,
  label: string,
  ms = SUPABASE_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : ""
    if (controller.signal.aborted || msg.includes("abort")) {
      const err = new Error(`${label} timed out after ${ms}ms`)
      markSupabaseOffline(err.message)
      throw err
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}
