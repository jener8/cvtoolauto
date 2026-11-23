/**
 * Evidence-to-Role Alignment text syntax (independent of TRACK / CONNECTION).
 *
 * ALIGNMENT: Evidence-to-Role
 *
 * - Verified evidence | Target job requirement
 */

import {
  emptyCareerEvolutionConfig,
  newCareerEvolutionId,
  type CareerEvolutionAlignment,
  type CareerEvolutionConfig,
} from "@/lib/career-evolution/types"

export type CareerEvolutionAlignmentParseResult = {
  alignments: CareerEvolutionAlignment[]
  errors: string[]
  warnings: string[]
  /** Author’s exact editor string (for round-trip). */
  alignmentSourceText: string
}

const ALIGNMENT_HEADER_RE = /^ALIGNMENT:\s*(.*)$/i
const BULLET_PREFIX_RE = /^[-•*–—]\s+/
/** evidence | requirement — pipe required */
const PAIR_RE = /^(.+?)\s*\|\s*(.+)$/

export function normalizeAlignmentSourceText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u2013|\u2014/g, "–")
}

/**
 * Serialize structured alignment pairs to the editable text format.
 */
export function serializeCareerEvolutionAlignmentText(
  alignments: CareerEvolutionAlignment[],
  opts?: { title?: string },
): string {
  const title = (opts?.title || "Evidence-to-Role").trim() || "Evidence-to-Role"
  const lines: string[] = [`ALIGNMENT: ${title}`, ""]
  const rows = alignments.filter(
    (a) => a.evidenceLabel.trim() && a.requirementLabel.trim() && a.approved !== false,
  )
  for (const a of rows) {
    lines.push(`- ${a.evidenceLabel.trim()} | ${a.requirementLabel.trim()}`)
  }
  return `${lines.join("\n").trim()}\n`
}

/**
 * Parse ALIGNMENT text into evidence→requirement pairs.
 * Rejects TRACK/CONNECTION and other unsupported Career Evolution syntax.
 */
export function parseCareerEvolutionAlignmentText(
  raw: string,
  baseAlignments?: CareerEvolutionAlignment[],
): CareerEvolutionAlignmentParseResult {
  const alignmentSourceText = raw
  const text = normalizeAlignmentSourceText(raw)
  const errors: string[] = []
  const warnings: string[] = []
  const alignments: CareerEvolutionAlignment[] = []

  if (!text.trim()) {
    return { alignments: [], errors: [], warnings: [], alignmentSourceText }
  }

  const lines = text.split("\n")
  let sawHeader = false
  let headerTitle = "Evidence-to-Role"
  let pairIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const rawLine = lines[i] ?? ""
    const line = rawLine.trim()
    if (!line) continue

    if (/^TRACK:/i.test(line) || /^CONNECTION:/i.test(line)) {
      errors.push(
        `Line ${lineNum}: TRACK / CONNECTION belong in Graph text, not Evidence-to-Role. Use “- evidence | requirement”.`,
      )
      continue
    }

    const header = line.match(ALIGNMENT_HEADER_RE)
    if (header) {
      sawHeader = true
      const rest = (header[1] || "").trim()
      if (rest) headerTitle = rest
      continue
    }

    if (!BULLET_PREFIX_RE.test(line) && !line.includes("|")) {
      errors.push(
        `Line ${lineNum}: unsupported syntax “${line.slice(0, 48)}${line.length > 48 ? "…" : ""}”. Expected “- evidence | requirement”.`,
      )
      continue
    }

    const body = line.replace(BULLET_PREFIX_RE, "").trim()
    const pair = body.match(PAIR_RE)
    if (!pair) {
      errors.push(
        `Line ${lineNum}: each mapping needs a pipe separator — “- Verified evidence | Target job requirement”.`,
      )
      continue
    }

    const evidenceLabel = pair[1]!.trim()
    const requirementLabel = pair[2]!.trim()
    if (!evidenceLabel || !requirementLabel) {
      errors.push(
        `Line ${lineNum}: both evidence and requirement are required on each side of “|”.`,
      )
      continue
    }

    const prev = baseAlignments?.[pairIndex]
    alignments.push({
      id: prev?.id || newCareerEvolutionId("al"),
      evidenceLabel,
      requirementLabel,
      evidenceRef: prev?.evidenceRef,
      matchType: prev?.matchType,
      approved: prev?.approved !== false,
    })
    pairIndex += 1
  }

  if (!sawHeader && alignments.length > 0) {
    warnings.push(
      `Add a header line “ALIGNMENT: ${headerTitle}” so this dataset is clearly Evidence-to-Role (not TRACK timeline text).`,
    )
  }

  if (sawHeader && alignments.length === 0 && errors.length === 0) {
    warnings.push("No evidence | requirement pairs yet. Add lines like “- Verified evidence | Target job requirement”.")
  }

  if (alignments.length > 4) {
    warnings.push("Only the first 4 pairs are shown on the graph.")
  }

  return { alignments, errors, warnings, alignmentSourceText }
}

/** Ensure config has alignmentSourceText when structured alignments exist. */
export function ensureAlignmentSourceText(
  config: CareerEvolutionConfig,
): CareerEvolutionConfig {
  const existing = config.alignmentSourceText?.trim()
  if (existing) return config
  const rows = (config.alignments || []).filter(
    (a) => a.evidenceLabel.trim() && a.requirementLabel.trim(),
  )
  if (rows.length === 0) return config
  return {
    ...config,
    alignmentSourceText: serializeCareerEvolutionAlignmentText(rows),
  }
}

/** Resolve rows used by the Evidence-to-Role renderer — never TRACK milestones. */
export function resolveAlignmentsFromConfig(
  config: CareerEvolutionConfig,
): CareerEvolutionAlignment[] {
  const source = config.alignmentSourceText
  if (typeof source === "string" && source.trim()) {
    const parsed = parseCareerEvolutionAlignmentText(source, config.alignments)
    if (parsed.errors.length === 0 && parsed.alignments.length > 0) {
      return parsed.alignments.filter((a) => a.approved !== false)
    }
    // Invalid text: fall through to last good structured rows if any
    if (parsed.errors.length > 0 && (config.alignments?.length || 0) > 0) {
      return (config.alignments || []).filter((a) => a.approved !== false)
    }
    if (parsed.alignments.length > 0) {
      return parsed.alignments.filter((a) => a.approved !== false)
    }
  }
  return (config.alignments || []).filter(
    (a) =>
      a.approved !== false &&
      a.evidenceLabel.trim() &&
      a.requirementLabel.trim(),
  )
}

export const CAREER_EVOLUTION_ALIGNMENT_SYNTAX_HELP = `ALIGNMENT: Evidence-to-Role

- Mixed-methods discovery at Bundesdruckerei | Strategic UX research
- Responsible AI assessment workshops | AI-native research practice
- Cross-functional facilitation with Product & Compliance | Stakeholder alignment
`

/** Empty starter so the editor always has a valid skeleton. */
export function emptyAlignmentSourceText(): string {
  return `ALIGNMENT: Evidence-to-Role

`
}

/** Apply parsed alignments onto a config without touching TRACK sourceText. */
export function applyAlignmentParseToConfig(
  config: CareerEvolutionConfig,
  parsed: CareerEvolutionAlignmentParseResult,
): CareerEvolutionConfig {
  if (parsed.errors.length > 0) {
    return {
      ...config,
      alignmentSourceText: parsed.alignmentSourceText,
    }
  }
  return {
    ...config,
    alignmentSourceText: parsed.alignmentSourceText,
    alignments: parsed.alignments,
  }
}

export function emptyConfigPreservingAlignment(
  config: CareerEvolutionConfig,
): CareerEvolutionConfig {
  return emptyCareerEvolutionConfig({
    ...config,
    alignmentSourceText: config.alignmentSourceText,
    alignments: config.alignments,
  })
}
