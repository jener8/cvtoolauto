/** True when value is a usable millisecond timestamp for application dates. */
export function isValidApplicationTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/** Parse DB / JSON date values without defaulting to "now". */
export function coerceApplicationTimestamp(value: unknown): number | undefined {
  if (isValidApplicationTimestamp(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }
  return undefined
}

/** Format a timestamp for `<input type="date">` in local calendar (avoids UTC off-by-one). */
export function formatDateInputValue(timestamp?: number | null): string {
  if (!isValidApplicationTimestamp(timestamp)) return ""
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Parse `<input type="date">` value as local midnight. */
export function parseDateInputValue(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const [year, month, day] = trimmed.split("-").map((part) => Number(part))
  if (!year || !month || !day) return undefined
  const parsed = new Date(year, month - 1, day).getTime()
  return Number.isFinite(parsed) ? parsed : undefined
}
