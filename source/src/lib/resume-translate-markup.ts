import {
  isManualPageBreakLine,
  MANUAL_PAGE_BREAK_MARKER,
  removeManualPageBreakMarkers,
} from "@/lib/resume-page-breaks"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { parseResumeText } from "@/lib/parse-resume-text"

const SENTINEL_PREFIX = "<<<EQUITAI_PAGE_BREAK_"
const SENTINEL_SUFFIX = ">>>"

function sentinelFor(index: number): string {
  return `${SENTINEL_PREFIX}${index}${SENTINEL_SUFFIX}`
}

const SENTINEL_RE = /<<<EQUITAI_PAGE_BREAK_(\d+)>>>/g

/** Replace manual page-break lines with stable sentinels the model must keep in place. */
export function lockManualPageBreaks(text: string): {
  lockedText: string
  breakCount: number
} {
  let breakCount = 0
  const lockedText = text
    .split(/\r?\n/)
    .map((line) => {
      if (!isManualPageBreakLine(line)) return line
      const locked = sentinelFor(breakCount)
      breakCount += 1
      return locked
    })
    .join("\n")
  return { lockedText, breakCount }
}

/** Restore sentinels (and any leftover marker variants) to the canonical marker. */
export function unlockManualPageBreaks(text: string, expectedCount: number): string {
  let unlocked = text.replace(SENTINEL_RE, MANUAL_PAGE_BREAK_MARKER)

  // Model sometimes rewrites the sentinel or invents markers — normalize known forms.
  unlocked = unlocked
    .split(/\r?\n/)
    .map((line) => (isManualPageBreakLine(line) ? MANUAL_PAGE_BREAK_MARKER : line))
    .join("\n")

  if (expectedCount <= 0) {
    return removeManualPageBreakMarkers(unlocked)
  }

  const found = unlocked.split(/\r?\n/).filter((line) => isManualPageBreakLine(line)).length
  if (found === expectedCount) return unlocked

  // Too many: keep first N. Too few: leave as-is for caller to reapply from source.
  if (found > expectedCount) {
    let kept = 0
    return unlocked
      .split(/\r?\n/)
      .filter((line) => {
        if (!isManualPageBreakLine(line)) return true
        if (kept >= expectedCount) return false
        kept += 1
        return true
      })
      .join("\n")
  }

  return unlocked
}

function pageBreakLineIndexes(text: string): number[] {
  const indexes: number[] = []
  text.split(/\r?\n/).forEach((line, index) => {
    if (isManualPageBreakLine(line)) indexes.push(index)
  })
  return indexes
}

/**
 * Re-place page breaks from the source document onto the translated body
 * using relative line positions (so markers cannot drift under PROFILE).
 */
export function reapplySourcePageBreaks(sourceText: string, translatedText: string): string {
  const sourceIndexes = pageBreakLineIndexes(sourceText)
  const withoutBreaks = removeManualPageBreakMarkers(translatedText)
  if (sourceIndexes.length === 0) return withoutBreaks.trimEnd()

  const sourceLines = sourceText.split(/\r?\n/)
  const targetLines = withoutBreaks.split(/\r?\n/)
  const sourceLen = Math.max(sourceLines.length, 1)

  const insertAt = new Set<number>()
  for (const idx of sourceIndexes) {
    insertAt.add(findTranslatedBreakInsertIndex(sourceLines, idx, targetLines, sourceLen))
  }

  const out: string[] = []
  for (let i = 0; i <= targetLines.length; i++) {
    if (insertAt.has(i)) out.push(MANUAL_PAGE_BREAK_MARKER)
    if (i < targetLines.length) out.push(targetLines[i]!)
  }
  return out.join("\n")
}

function nextNonEmptyLine(lines: string[], from: number): string {
  for (let i = from; i < lines.length; i++) {
    const t = lines[i]?.trim() ?? ""
    if (t) return t
  }
  return ""
}

function headingKind(line: string): "h1" | "h2" | "h3" | "section" | null {
  const t = line.trim()
  if (/^###\s/.test(t)) return "h3"
  if (/^##\s/.test(t)) return "h2"
  if (/^#\s/.test(t)) return "h1"
  if (/^[A-ZÄÖÜ][A-ZÄÖÜ\s/&-]{2,}$/.test(t)) return "section"
  return null
}

function findTranslatedBreakInsertIndex(
  sourceLines: string[],
  breakIdx: number,
  targetLines: string[],
  sourceLen: number,
): number {
  const ratio = breakIdx / sourceLen
  const anchor = nextNonEmptyLine(sourceLines, breakIdx + 1)
  const kind = headingKind(anchor)
  const targetLen = Math.max(targetLines.length, 1)
  const approx = Math.min(targetLines.length, Math.max(0, Math.round(ratio * targetLen)))

  if (kind) {
    const candidates: number[] = []
    for (let i = 0; i < targetLines.length; i++) {
      if (headingKind(targetLines[i]!) === kind) candidates.push(i)
    }
    // Prefer headings in the later portion of the resume (page 2).
    const late = candidates.filter((i) => i / targetLen >= Math.min(0.2, ratio * 0.5))
    const pool = late.length > 0 ? late : candidates
    if (pool.length > 0) {
      let best = pool[0]!
      let bestDist = Math.abs(best - approx)
      for (const i of pool) {
        const dist = Math.abs(i - approx)
        if (dist < bestDist) {
          best = i
          bestDist = dist
        }
      }
      return best
    }
  }

  return snapBreakToHeadingBoundary(targetLines, approx)
}

function snapBreakToHeadingBoundary(lines: string[], preferred: number): number {
  const isBoundary = (line: string | undefined) => Boolean(line && headingKind(line))

  if (isBoundary(lines[preferred])) return preferred

  const searchRadius = 16
  for (let dist = 1; dist <= searchRadius; dist++) {
    const after = preferred + dist
    if (after <= lines.length && isBoundary(lines[after])) return after
    const before = preferred - dist
    if (before >= 0 && isBoundary(lines[before])) return before
  }
  return preferred
}

/** True when a page break lands so early that page 1 is basically only the profile. */
export function hasPrematurePageBreak(text: string): boolean {
  const lines = text.split(/\r?\n/)
  const breakAt = lines.findIndex((line) => isManualPageBreakLine(line))
  if (breakAt < 0) return false

  const before = lines.slice(0, breakAt).filter((line) => line.trim().length > 0)
  if (before.length === 0) return true

  const headingLike = before.filter((line) => {
    const t = line.trim()
    return (
      /^#+\s/.test(t) ||
      /^(PROFILE|PROFIL|SUMMARY|ZUSAMMENFASSUNG|EXPERIENCE|BERUFSERFAHRUNG|EDUCATION|AUSBILDUNG|SKILLS|F[ÄA]HIGKEITEN|LANGUAGES|SPRACHEN)\b/i.test(
        t,
      )
    )
  }).length
  const bullets = before.filter((line) => /^\s*[-•]/.test(line)).length
  // Profile-only first page: few non-heading lines and a break before any real role block.
  const hasRoleMarkup = before.some((line) => /^##\s/.test(line.trim()))
  return !hasRoleMarkup && bullets <= 8 && before.length <= headingLike + bullets + 2
}

/**
 * After translation, restore source page-break placement when markers moved,
 * were dropped, or landed too early (huge white gap under PROFILE).
 */
export function alignTranslatedResumeMarkup(sourceText: string, translatedText: string): string {
  const sourceBreaks = pageBreakLineIndexes(sourceText).length
  const translatedBreaks = pageBreakLineIndexes(translatedText).length

  if (sourceBreaks === 0) {
    return removeManualPageBreakMarkers(translatedText)
  }

  if (
    translatedBreaks !== sourceBreaks ||
    hasPrematurePageBreak(translatedText)
  ) {
    return reapplySourcePageBreaks(sourceText, translatedText)
  }

  return translatedText
}

export function isLikelyTruncatedTranslation(sourceText: string, translatedText: string): boolean {
  const sourceLen = sourceText.trim().length
  const translatedLen = translatedText.trim().length
  if (sourceLen < 200) return false
  if (translatedLen < sourceLen * 0.45) return true

  const sourceHashes = (sourceText.match(/^#+\s/gm) || []).length
  const translatedHashes = (translatedText.match(/^#+\s/gm) || []).length
  if (sourceHashes >= 3 && translatedHashes < Math.max(1, Math.floor(sourceHashes * 0.4))) {
    return true
  }
  return false
}

/** Drop a page break that leaves page 1 as profile-only (huge white A4 gap). */
export function removePrematurePageBreaks(text: string): string {
  if (!hasPrematurePageBreak(text)) return text
  let removed = false
  return text
    .split(/\r?\n/)
    .filter((line) => {
      if (!isManualPageBreakLine(line)) return true
      if (removed) return true
      removed = true
      return false
    })
    .join("\n")
}

function countContentSections(text: string): number {
  return parseResumeText(text).filter((section) =>
    section.content.some((line) => line.trim() && !isManualPageBreakLine(line)),
  ).length
}

/**
 * True when the resume body collapsed to essentially PROFILE-only
 * (typical truncated translation — preview shows a half-empty A4 page).
 */
export function isProfileOnlyResumeBody(text: string): boolean {
  const sections = parseResumeText(text, { repairJobsInProfile: false }).filter((section) =>
    section.content.some((line) => line.trim() && !isManualPageBreakLine(line)),
  )
  if (sections.length === 0) return true
  if (sections.length > 1) return false
  return normalizeCvSectionKey(sections[0]!.title) === "PROFILE"
}

/** Prefer a fuller language snapshot when the active body looks truncated. */
export function shouldReplaceTruncatedTranslation(
  activeText: string,
  fullerSourceText: string,
): boolean {
  if (!isProfileOnlyResumeBody(activeText)) return false
  return countContentSections(fullerSourceText) >= 2
}
