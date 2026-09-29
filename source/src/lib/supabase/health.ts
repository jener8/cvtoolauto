import { getSupabaseEnv, SUPABASE_HEALTH_TIMEOUT_MS } from "./config"
import { clearSupabaseOffline, markSupabaseOffline } from "./availability"
import { isUnavailableSupabaseError } from "./errors"

export async function checkSupabaseHealth(): Promise<boolean> {
  const env = getSupabaseEnv()
  if (!env) return false

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_HEALTH_TIMEOUT_MS)

  try {
    const res = await fetch(`${env.url}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    })

    const ok = res.ok || res.status === 404 || res.status === 401
    if (ok) {
      clearSupabaseOffline()
      return true
    }

    const text = await res.text().catch(() => "")
    if (text.includes("522") || res.status >= 500) {
      markSupabaseOffline(`Supabase returned ${res.status}`)
      return false
    }

    clearSupabaseOffline()
    return true
  } catch (e) {
    if (isUnavailableSupabaseError(e)) {
      markSupabaseOffline(e instanceof Error ? e.message : "Supabase unreachable")
    }
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}
