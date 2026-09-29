import { SUPABASE_REQUEST_TIMEOUT_MS } from "./config"

/** Fetch wrapper that aborts after a timeout (used by the Supabase client). */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const userSignal = init?.signal
  if (userSignal) {
    if (userSignal.aborted) controller.abort()
    else userSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId)
  })
}
