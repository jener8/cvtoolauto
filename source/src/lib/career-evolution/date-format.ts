/**
 * Career Evolution date parsing + display formatting.
 *
 * Stored milestone values stay structured (start / end tokens such as
 * YYYY-MM, YYYY, Present). Graph display never concatenates raw ISO tokens
 * or truncates with slice/ellipsis — compact mode emits YYYY–YYYY / YYYY–Present.
 */

import type { CareerEvolutionDateDisplay } from "@/lib/career-evolution/types"

export type ParsedCeDate =
  | { kind: "present" }
  | { kind: "year"; year: number }
  | { kind: "month"; year: number; month: number } // month 1–12
  | { kind: "day"; year: number; month: number; day: number }

const PRESENT_RE = /^(present|current|now|heute|aktuell)$/i
const PRESENTISH_RE = /^(prese\w*|presnt|current|now|heute|aktuell)$/i

const MONTH_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const MONTH_SHORT_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
  januar: 1,
  februar: 2,
  maerz: 3,
  märz: 3,
  mai: 5,
  juni: 6,
  juli: 7,
  oktober: 10,
  dezember: 12,
  dez: 12,
}

function monthNameIndex(raw: string): number | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "")
  return MONTH_NAME_TO_INDEX[key] ?? null
}

/** Map truncated present fragments to a canonical token; keep authored Present/Heute. */
function coercePresentToken(raw: string): string {
  const t = raw.trim()
  if (PRESENT_RE.test(t)) return t
  if (/^(prese\w*|presnt)$/i.test(t)) return "present"
  return t
}

/** Parse one date token. Does not invent missing months/years. */
export function parseCareerEvolutionDateToken(raw: string): ParsedCeDate | null {
  const t = coercePresentToken(raw).replace(/\s+/g, " ")
  if (!t) return null
  if (PRESENT_RE.test(t) || t.toLowerCase() === "present") return { kind: "present" }

  // YYYY-MM-DD
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return { kind: "day", year, month, day }
  }

  // YYYY-MM
  const ym = t.match(/^(\d{4})-(\d{1,2})$/)
  if (ym) {
    const year = Number(ym[1])
    const month = Number(ym[2])
    if (month < 1 || month > 12) return null
    return { kind: "month", year, month }
  }

  // YYYY/MM or MM/YYYY
  const numeric =
    t.match(/^(\d{1,2})[/](\d{4})$/) || t.match(/^(\d{4})[/](\d{1,2})$/)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    if (a > 31) {
      if (b < 1 || b > 12) return null
      return { kind: "month", year: a, month: b }
    }
    if (a < 1 || a > 12) return null
    return { kind: "month", year: b, month: a }
  }

  // Month name + year
  const named = t.match(/^([A-Za-zÄÖÜäöüß.]+)\s+(\d{4})$/u)
  if (named) {
    const month = monthNameIndex(named[1]!)
    const year = Number(named[2])
    if (!month || !Number.isFinite(year)) return null
    return { kind: "month", year, month }
  }

  // Year only
  const yearOnly = t.match(/^(\d{4})$/)
  if (yearOnly) {
    const year = Number(yearOnly[1])
    if (!Number.isFinite(year) || year < 1900 || year > 2100) return null
    return { kind: "year", year }
  }

  return null
}

/**
 * Split a range without breaking ISO tokens like 2016-12.
 * Prefer en/em dashes or spaced hyphens; only then consider bare-hyphen ISO ranges.
 */
export function splitCareerEvolutionDateRange(raw: string): {
  start: string
  end: string
} | null {
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text) return null

  // 1) En/em dash, " - ", or " to " — never bare hyphen inside YYYY-MM
  const fancy = text.split(/\s*[–—−]\s*|\s+-\s+|\s+to\s+/i)
  if (fancy.length >= 2) {
    const start = fancy[0]!.trim()
    const end = fancy.slice(1).join(" - ").trim()
    if (start && end) return { start, end }
  }

  // 2) Year–year: 2016-2019
  const yearYear = text.match(/^(\d{4})\s*-\s*(\d{4})$/)
  if (yearYear) return { start: yearYear[1]!, end: yearYear[2]! }

  // 3) ISO start - ISO end (bare hyphen between complete tokens)
  const isoIso = text.match(
    /^(\d{4}-\d{2}(?:-\d{2})?)\s*-\s*(\d{4}-\d{2}(?:-\d{2})?)$/,
  )
  if (isoIso) return { start: isoIso[1]!, end: isoIso[2]! }

  // 4) ISO / year - present (including truncated "prese")
  const isoPresent = text.match(
    /^(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*-\s*(prese\w*|present|current|now|heute|aktuell)$/i,
  )
  if (isoPresent) return { start: isoPresent[1]!, end: "present" }

  // 5) Glued ISO without spaces: 2016-12-2019-08 / 2016-12-2019-
  const gluedIso = text.match(
    /^(\d{4}-\d{2}(?:-\d{2})?)-(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?-?$/,
  )
  if (gluedIso) {
    const endMonth = gluedIso[3]
    const endDay = gluedIso[4]
    const end = endDay
      ? `${gluedIso[2]}-${endMonth}-${endDay}`
      : endMonth
        ? `${gluedIso[2]}-${endMonth}`
        : gluedIso[2]!
    return { start: gluedIso[1]!, end }
  }

  // 6) Glued ISO + present fragment: 2023-11-prese / 2023-11-present
  const gluedPresent = text.match(
    /^(\d{4}(?:-\d{2}(?:-\d{2})?)?)-?(prese\w*|present|current|now|heute|aktuell)$/i,
  )
  if (gluedPresent) return { start: gluedPresent[1]!, end: "present" }

  return null
}

/** Parse range text into start/end tokens for storage (does not invent months). */
export function parseCareerEvolutionDateRange(raw: string): {
  start?: string
  end?: string
  error?: string
} {
  const text = raw.trim()
  if (!text) return {}

  const split = splitCareerEvolutionDateRange(text)
  if (!split) {
    if (!parseCareerEvolutionDateToken(text)) {
      return {
        error: `Unrecognised date “${text}”. Use YYYY-MM, YYYY, or Present.`,
      }
    }
    return { start: text, end: text }
  }

  const startToken = coercePresentToken(split.start)
  const endToken = coercePresentToken(split.end)
  const startOk = parseCareerEvolutionDateToken(startToken)
  const endOk = parseCareerEvolutionDateToken(endToken)
  if (!startOk || !endOk) {
    const bad = !startOk ? split.start : split.end
    return {
      start: startToken,
      end: endToken,
      error: `Unrecognised date “${bad}”. Use YYYY-MM, YYYY, or Present.`,
    }
  }
  return { start: startToken, end: endToken }
}

/**
 * Repair corrupted stored start/end pairs for display and (optionally) normalize.
 * Handles glued ISO ranges and truncated “prese” fragments from older renderers.
 */
export function repairCareerEvolutionStoredDates(
  start?: string,
  end?: string,
): { start?: string; end?: string; repaired: boolean } {
  const aRaw = (start || "").trim()
  const bRaw = (end || "").trim()
  if (!aRaw && !bRaw) return { repaired: false }

  const aOk = aRaw ? parseCareerEvolutionDateToken(aRaw) : null
  const bOk = bRaw ? parseCareerEvolutionDateToken(bRaw) : null
  if ((!aRaw || aOk) && (!bRaw || bOk)) {
    return {
      start: aRaw || undefined,
      end: bRaw || aRaw || undefined,
      repaired: false,
    }
  }

  // Prefer splitting the worse side as a full range string
  for (const candidate of [aRaw, bRaw, aRaw && bRaw ? `${aRaw} – ${bRaw}` : ""]) {
    if (!candidate) continue
    const split = splitCareerEvolutionDateRange(candidate)
    if (!split) continue
    const s = coercePresentToken(split.start)
    const e = coercePresentToken(split.end)
    if (parseCareerEvolutionDateToken(s) && parseCareerEvolutionDateToken(e)) {
      return { start: s, end: e, repaired: true }
    }
  }

  // Truncated end alone: start OK, end "prese"
  if (aOk && bRaw && PRESENTISH_RE.test(bRaw)) {
    return { start: aRaw, end: "present", repaired: true }
  }

  return { start: aRaw || undefined, end: bRaw || undefined, repaired: false }
}

function formatTokenFull(
  parsed: ParsedCeDate,
  language: "en" | "de",
): string {
  if (parsed.kind === "present") {
    return language === "de" ? "Heute" : "Present"
  }
  if (parsed.kind === "year") return String(parsed.year)
  const months = language === "de" ? MONTH_SHORT_DE : MONTH_SHORT_EN
  const mon = months[parsed.month - 1] ?? String(parsed.month)
  return `${mon} ${parsed.year}`
}

export type FormatCeDateRangeResult = {
  /** Label drawn on the graph — never ellipsised or mid-token truncated. */
  display: string
  /** Always the full human-readable form (tooltips / a11y). */
  full: string
  /** Set when a side could not be parsed — caller may surface in the editor. */
  parseError?: string
  modeUsed: "full" | "compact"
}

/** True when a display string looks like the old concat+slice bug. */
export function isBrokenCareerEvolutionDateDisplay(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/prese$/i.test(t) && !/^present$/i.test(t)) return true
  if (/\d{4}-\d{2}-\d{4}-?$/.test(t)) return true
  if (/\d{4}-\d{2}-prese/i.test(t)) return true
  if (/^\d{4}-\d{2}-\d{4}-$/.test(t)) return true
  return false
}

/**
 * Format stored start/end for graph display.
 * Compact mode always uses full years: 2016–2019 or 2023–Present.
 * Never concatenates raw ISO tokens or truncates with slice.
 */
export function formatCareerEvolutionDateRange(
  start?: string,
  end?: string,
  options?: {
    mode?: CareerEvolutionDateDisplay
    /** When mode is auto, prefer compact if full would exceed this. */
    maxChars?: number
    language?: "en" | "de"
  },
): FormatCeDateRangeResult {
  const language = options?.language === "de" ? "de" : "en"
  const mode = options?.mode ?? "auto"
  const maxChars = options?.maxChars ?? 18

  const repaired = repairCareerEvolutionStoredDates(start, end)
  const aRaw = (repaired.start || "").trim()
  const bRaw = (repaired.end || "").trim()
  if (!aRaw && !bRaw) {
    return { display: "", full: "", modeUsed: "full" }
  }

  const aFinal = aRaw ? parseCareerEvolutionDateToken(aRaw) : null
  const bFinal = bRaw ? parseCareerEvolutionDateToken(bRaw) : null

  if ((aRaw && !aFinal) || (bRaw && !bFinal)) {
    const bad = aRaw && !aFinal ? aRaw : bRaw
    return {
      display: "",
      full: "",
      parseError: `Unrecognised date “${bad}”.`,
      modeUsed: "full",
    }
  }

  const same =
    aFinal &&
    bFinal &&
    ((aFinal.kind === "present" && bFinal.kind === "present") ||
      (aFinal.kind !== "present" &&
        bFinal.kind !== "present" &&
        aFinal.kind === bFinal.kind &&
        "year" in aFinal &&
        "year" in bFinal &&
        aFinal.year === bFinal.year &&
        (!("month" in aFinal) ||
          !("month" in bFinal) ||
          aFinal.month === bFinal.month)))

  const fullAlone = (p: ParsedCeDate) => formatTokenFull(p, language)
  const full =
    aFinal && bFinal && !same
      ? `${fullAlone(aFinal)} – ${fullAlone(bFinal)}`
      : fullAlone(aFinal || bFinal!)

  const presentWord = language === "de" ? "Heute" : "Present"

  const compactRange = (): string => {
    if (!aFinal || !bFinal || same) {
      const p = aFinal || bFinal!
      if (p.kind === "present") return presentWord
      return String(p.year)
    }
    if (aFinal.kind === "present" || bFinal.kind === "present") {
      const other = aFinal.kind === "present" ? bFinal : aFinal
      if (other.kind === "present") return presentWord
      // Always complete: 2023–Present — never 2023-11-prese
      return `${other.year}–${presentWord}`
    }
    const y0 = aFinal.year
    const y1 = bFinal.year
    if (y0 === y1) return String(y0)
    // Full years on both sides (acceptance: 2016–2019, not 2016–19)
    return `${y0}–${y1}`
  }

  let modeUsed: "full" | "compact" = "full"
  if (mode === "compact") {
    modeUsed = "compact"
  } else if (mode === "auto") {
    modeUsed = full.length > maxChars ? "compact" : "full"
  }

  let display = modeUsed === "compact" ? compactRange() : full

  // Hard guard: never emit the historical concat+slice fragments
  if (isBrokenCareerEvolutionDateDisplay(display)) {
    display = compactRange()
  }
  if (isBrokenCareerEvolutionDateDisplay(display)) {
    return {
      display: "",
      full: "",
      parseError: `Unrecognised date “${aRaw}${bRaw ? ` – ${bRaw}` : ""}”.`,
      modeUsed: "compact",
    }
  }

  return { display, full, modeUsed }
}

/**
 * Resolve preference from config.
 * Compact density defaults to compact dates (years only) so four A4 cards
 * never overflow into truncated ISO concatenations.
 */
export function resolveCareerEvolutionDateDisplay(
  preference: CareerEvolutionDateDisplay | undefined,
  density: "compact" | "standard" | undefined,
): CareerEvolutionDateDisplay {
  if (preference === "full" || preference === "compact" || preference === "auto") {
    return preference
  }
  // Compact density → compact years (not auto→full that overflows cards)
  return density === "standard" ? "full" : "compact"
}
