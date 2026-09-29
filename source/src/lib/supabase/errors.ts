/** Extract every useful field from Supabase / PostgREST / fetch errors. */
export function serializeSupabaseError(error: unknown): Record<string, unknown> {
  if (error === null || error === undefined) {
    return { value: null }
  }
  if (typeof error !== "object") {
    return { value: String(error) }
  }

  const e = error as Record<string, unknown>
  const out: Record<string, unknown> = {}

  const knownKeys = [
    "message",
    "name",
    "code",
    "details",
    "hint",
    "status",
    "statusText",
    "error",
    "error_description",
    "msg",
    "cause",
  ] as const

  for (const key of knownKeys) {
    if (key in e && e[key] !== undefined && typeof e[key] !== "function") {
      out[key] = e[key]
    }
  }

  if (error instanceof Error && error.message && !out.message) {
    out.message = error.message
    out.name = error.name
  }

  try {
    for (const key of Object.getOwnPropertyNames(e)) {
      if (key in out || typeof e[key] === "function") continue
      out[key] = e[key]
    }
  } catch {
    /* ignore */
  }

  if (Object.keys(out).length === 0) {
    try {
      out.json = JSON.stringify(error)
    } catch {
      out.raw = String(error)
    }
  }

  return out
}

/** Single-line message for UI and thrown errors. */
export function formatSupabaseErrorMessage(error: unknown): string {
  const d = serializeSupabaseError(error)
  const parts: string[] = []

  if (typeof d.message === "string" && d.message.trim()) parts.push(d.message.trim())
  if (typeof d.code === "string" && d.code) parts.push(`code=${d.code}`)
  if (typeof d.details === "string" && d.details) parts.push(String(d.details))
  if (typeof d.hint === "string" && d.hint) parts.push(`hint: ${d.hint}`)
  if (typeof d.status === "number") parts.push(`HTTP ${d.status}`)
  if (typeof d.statusText === "string" && d.statusText) parts.push(d.statusText)

  if (parts.length > 0) return parts.join(" — ")

  if (typeof d.json === "string" && d.json && d.json !== "{}") return d.json
  if (typeof d.raw === "string" && d.raw) return d.raw
  if (typeof d.toString === "string" && d.toString !== "[object Object]") return d.toString

  return "Unknown Supabase error (see console for serializeSupabaseError)"
}

/** @deprecated Prefer serializeSupabaseError + formatSupabaseErrorMessage */
export function describeSupabaseError(error: unknown): Record<string, unknown> {
  return serializeSupabaseError(error)
}

export function isUnavailableSupabaseError(error: unknown): boolean {
  const msg = formatSupabaseErrorMessage(error).toLowerCase()
  return (
    msg.includes("522") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("unavailable") ||
    msg.includes("not configured") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("<!doctype html")
  )
}

/** PostgREST PGRST204: column missing from schema cache (migration not applied). */
export function parsePgrst204MissingColumn(error: unknown): string | null {
  const d = serializeSupabaseError(error)
  const code = typeof d.code === "string" ? d.code : ""
  if (code !== "PGRST204") return null
  const msg = formatSupabaseErrorMessage(error)
  const match = msg.match(/Could not find the '([^']+)' column/i)
  return match?.[1] ?? null
}

export function isRetryableSupabaseError(error: unknown): boolean {
  if (isUnavailableSupabaseError(error)) return false
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase()
    return msg.includes("fetch") || msg.includes("network") || msg.includes("failed")
  }
  if (!error || typeof error !== "object") return false

  const e = error as { message?: string; code?: string; status?: number }
  const msg = (e.message ?? "").toLowerCase()
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("connection")) {
    return true
  }

  const status = e.status
  if (status === 0 || status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true
  }

  if (e.code === "PGRST000" || e.code === "PGRST301") return true

  return false
}
