/**
 * Employment date-range duration for CV display.
 *
 * Convention (month-precision ranges):
 * - Parse start/end as year + month (day ignored / not invented).
 * - Duration months = (endYear − startYear) × 12 + (endMonth − startMonth).
 * - Do not add +1 for inclusive endpoints (matches “Jan 2021 – Feb 2024 → 3 years, 1 month”).
 * - Year-only values use January (month 1) for both ends so “2021 – 2024” → 3 years.
 * - “Present” / German equivalents use the current calendar month.
 */

export type EmploymentDurationLanguage = "en" | "de"

export type ParsedEmploymentMonth = {
  year: number
  /** 1–12 */
  month: number
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  januar: 1,
  february: 2,
  feb: 2,
  februar: 2,
  march: 3,
  mar: 3,
  märz: 3,
  marz: 3,
  april: 4,
  apr: 4,
  may: 5,
  mai: 5,
  june: 6,
  jun: 6,
  juni: 6,
  july: 7,
  jul: 7,
  juli: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  okt: 10,
  oktober: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
  dez: 12,
  dezember: 12,
}

const PRESENT_RE = /^(present|current|now|heute|aktuell|jetzt|ongoing)$/i

/** Already has a parenthetical duration — do not append another. */
export function dateTextAlreadyHasDuration(text: string): boolean {
  return /\(\s*\d+\s*(years?|months?|jahre?|monate?)\b/i.test(text)
}

function normalizeMonthToken(raw: string): number | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
  return MONTH_NAME_TO_INDEX[key] ?? null
}

/**
 * Parse one side of a range: "January 2021", "Jan 2021", "01/2021", "2021-01", "2021".
 * Returns null when unparseable. Does not invent a day.
 */
export function parseEmploymentMonthToken(
  token: string,
  options?: { assumeMonth?: number },
): ParsedEmploymentMonth | "present" | null {
  const t = token.trim().replace(/\s+/g, " ")
  if (!t) return null
  if (PRESENT_RE.test(t)) return "present"

  // 01/2021 or 1.2021 or 2021-01 or 2021/01
  const numeric = t.match(/^(\d{1,2})[/.\-](\d{4})$/) || t.match(/^(\d{4})[/.\-](\d{1,2})$/)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    if (a > 31) {
      // year first
      const month = b
      if (month < 1 || month > 12) return null
      return { year: a, month }
    }
    const month = a
    const year = b
    if (month < 1 || month > 12) return null
    return { year, month }
  }

  // Month name + year
  const named = t.match(/^([A-Za-zÄÖÜäöüß.]+)\s+(\d{4})$/u)
  if (named) {
    const month = normalizeMonthToken(named[1].replace(/\./g, ""))
    const year = Number(named[2])
    if (!month || !Number.isFinite(year)) return null
    return { year, month }
  }

  // Year only
  const yearOnly = t.match(/^(\d{4})$/)
  if (yearOnly) {
    const year = Number(yearOnly[1])
    if (!Number.isFinite(year)) return null
    return { year, month: options?.assumeMonth ?? 1 }
  }

  return null
}

/**
 * Split a date-range line into start/end tokens.
 * Supports en/em dashes and hyphen.
 */
export function splitEmploymentDateRange(text: string): { start: string; end: string } | null {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (!cleaned) return null
  const parts = cleaned.split(/\s*[–—−-]\s*/)
  if (parts.length < 2) return null
  const start = parts[0]?.trim()
  const end = parts.slice(1).join(" - ").trim()
  if (!start || !end) return null
  return { start, end }
}

export function monthsBetweenEmployment(
  start: ParsedEmploymentMonth,
  end: ParsedEmploymentMonth,
): number {
  return (end.year - start.year) * 12 + (end.month - start.month)
}

export function formatEmploymentDurationLabel(
  totalMonths: number,
  language: EmploymentDurationLanguage = "en",
): string | null {
  if (!Number.isFinite(totalMonths) || totalMonths < 1) return null

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const parts: string[] = []

  if (language === "de") {
    if (years === 1) parts.push("1 Jahr")
    else if (years > 1) parts.push(`${years} Jahre`)
    if (months === 1) parts.push("1 Monat")
    else if (months > 1) parts.push(`${months} Monate`)
  } else {
    if (years === 1) parts.push("1 year")
    else if (years > 1) parts.push(`${years} years`)
    if (months === 1) parts.push("1 month")
    else if (months > 1) parts.push(`${months} months`)
  }

  return parts.length > 0 ? parts.join(", ") : null
}

export function calculateEmploymentDurationMonths(
  dateRangeText: string,
  now: Date = new Date(),
): number | null {
  if (dateTextAlreadyHasDuration(dateRangeText)) return null
  const split = splitEmploymentDateRange(dateRangeText)
  if (!split) return null

  const start = parseEmploymentMonthToken(split.start, { assumeMonth: 1 })
  const endRaw = parseEmploymentMonthToken(split.end, { assumeMonth: 1 })
  if (!start || start === "present" || !endRaw) return null

  const end: ParsedEmploymentMonth =
    endRaw === "present"
      ? { year: now.getFullYear(), month: now.getMonth() + 1 }
      : endRaw

  const months = monthsBetweenEmployment(start, end)
  if (months < 1) return null
  return months
}

/**
 * Append "(duration)" when calculable. Returns original text when not.
 * Screen-reader friendly: duration is plain text in the same string.
 */
export function formatEmploymentDateWithDuration(
  dateRangeText: string,
  options?: {
    language?: EmploymentDurationLanguage
    now?: Date
  },
): string {
  const text = dateRangeText.trim()
  if (!text || dateTextAlreadyHasDuration(text)) return dateRangeText

  const months = calculateEmploymentDurationMonths(text, options?.now ?? new Date())
  if (months == null) return dateRangeText

  const label = formatEmploymentDurationLabel(months, options?.language ?? "en")
  if (!label) return dateRangeText
  return `${text} (${label})`
}
