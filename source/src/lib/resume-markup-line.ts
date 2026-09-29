import {
  isExactCvSectionAlias,
  normalizeCvSectionKey,
} from "@/lib/import-cv-structure"
import { isManualPageBreakLine } from "@/lib/resume-page-breaks"
import {
  parseSectionColumnModifier,
  stripSectionColumnModifier,
  type SectionColumnCount,
} from "@/lib/section-column-modifier"

/** Normalize unicode lookalikes before heading / bullet detection. */
export function normalizeResumeMarkupLine(line: string): string {
  return line
    .replace(/[\uFF03\u2317\u266F\uFE5F]/g, "#")
    .replace(/[\u00A0\u2003\u2002\u2009\u200B\u202F\uFEFF]/g, " ")
    .replace(/[–—―‐‑‒−]/g, "-")
}

/**
 * Parse a complete `#` / `##` / `###` prefix.
 * Returns cleaned `text` with ZERO markup hashes — never a partial strip like
 * `### PROFILE` → `# PROFILE` (the classic `.replace("##","")` bug).
 */
export function matchResumeHeadingPrefix(
  line: string,
): { level: 1 | 2 | 3; text: string } | null {
  const trimmed = normalizeResumeMarkupLine(line).trim()
  // Prefer spaced form; also accept glued hashes (`###PROFILE`) so we never leave a `#`.
  const match = trimmed.match(/^(#{1,3})\s+(.+)$/) ?? trimmed.match(/^(#{1,3})(\S.*)$/)
  if (!match) return null
  const level = match[1].length as 1 | 2 | 3
  const text = match[2].trim()
  if (!text) return null
  return { level, text }
}

/** True when cleaned heading text is a known CV section label (PROFILE, EXPERIENCE, …). */
export function isCvSectionHeadingLabel(text: string): boolean {
  const stripped = stripSectionColumnModifier(text).trim()
  if (!stripped) return false
  // Exact / aliased section names only — NOT generic ALL-CAPS lines
  // (those would steal job titles like "# SENIOR UX DESIGNER").
  if (normalizeCvSectionKey(stripped)) return true
  if (isExactCvSectionAlias(stripped)) return true
  return false
}

export type ResumeMarkupLine =
  | { kind: "page-break" }
  | { kind: "section-heading"; text: string; level: 1 | 2 | 3; columns: SectionColumnCount }
  | { kind: "job-title"; text: string }
  | { kind: "company"; text: string }
  | { kind: "date"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "paragraph"; text: string }

/**
 * Classify one resume source line into a semantic token with cleaned display text.
 * Markup characters (`#`, `##`, `###`, leading `-` / `•`) never appear in `text`.
 */
export function parseResumeMarkupLine(line: string): ResumeMarkupLine {
  const normalized = normalizeResumeMarkupLine(line)
  const trimmed = normalized.trim()

  if (!trimmed) return { kind: "paragraph", text: "" }
  if (isManualPageBreakLine(trimmed)) return { kind: "page-break" }
  const columnBlockToken = trimmed
    .replace(/[\uFF3B【]/g, "[")
    .replace(/[\uFF3D】]/g, "]")
  if (
    /^\[\s*columns\s*=\s*[123]\s*\]$/i.test(columnBlockToken) ||
    /^\[\s*column\s*\]$/i.test(columnBlockToken) ||
    /^\[\s*\/\s*columns\s*\]$/i.test(columnBlockToken)
  ) {
    return { kind: "paragraph", text: "" }
  }

  const heading = matchResumeHeadingPrefix(trimmed)
  if (heading) {
    const { columns } = parseSectionColumnModifier(heading.text)
    const stripped = stripSectionColumnModifier(heading.text).trim()
    if (isCvSectionHeadingLabel(stripped)) {
      const key = normalizeCvSectionKey(stripped)
      return {
        kind: "section-heading",
        text: key ? stripped.toUpperCase() : stripped,
        level: heading.level,
        columns,
      }
    }
    if (heading.level === 3) return { kind: "date", text: heading.text }
    if (heading.level === 2) return { kind: "company", text: heading.text }
    return { kind: "job-title", text: stripSectionColumnModifier(heading.text).trim() }
  }

  if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
    return { kind: "bullet", text: trimmed.slice(1).trim() }
  }

  return { kind: "paragraph", text: trimmed }
}
