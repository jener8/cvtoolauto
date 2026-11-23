/**
 * Human-readable Career Evolution text syntax.
 *
 * TRACK: <name>
 * - <dates> | <stage label> | <employer or project>
 *   (leading "-" / "•" / "*" optional; employer optional)
 *
 * CONNECTION:
 * <free-text note>
 * or
 * - <from label> -> <to label> | <note>
 */

import { parseCareerEvolutionDateRange } from "@/lib/career-evolution/date-format"
import {
  emptyCareerEvolutionConfig,
  newCareerEvolutionId,
  type CareerEvolutionConfig,
  type CareerEvolutionConnection,
  type CareerEvolutionMilestone,
  type CareerEvolutionTrack,
} from "@/lib/career-evolution/types"

export type CareerEvolutionParseResult = {
  config: CareerEvolutionConfig
  errors: string[]
  warnings: string[]
}

const TRACK_RE = /^TRACK:\s*(.+)$/i
const CONNECTION_HEADER_RE = /^CONNECTION:\s*(.*)$/i
/** Optional bullet, then rest of line */
const BULLET_PREFIX_RE = /^[-•*–—]\s+/
/** from -> to | note */
const LINK_RE = /^(.+?)\s*->\s*(.+?)(?:\s*\|\s*(.+))?$/i

function slugTrackId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
  return `track-${slug || index}`
}

/** Normalize fancy spaces / pipes before parsing. */
export function normalizeCareerEvolutionSourceText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[｜¦]/g, "|")
    .replace(/\t/g, " ")
}

function parseDateRange(
  raw: string,
): { start?: string; end?: string; error?: string } {
  return parseCareerEvolutionDateRange(raw)
}

/**
 * Parse a milestone body into dates | label | employer.
 * Accepts 2 fields (dates | label) or 3 fields (dates | label | employer).
 */
export function parseMilestoneFields(
  body: string,
): { dates: string; label: string; employer: string } | null {
  const normalized = body
    .replace(/[｜¦]/g, "|")
    .replace(/\u00a0/g, " ")
    .trim()
  if (!normalized) return null

  const parts = normalized.split("|").map((p) => p.trim())
  if (parts.length < 2) return null
  if (parts.length === 2) {
    const [dates, label] = parts
    if (!dates || !label) return null
    return { dates, label, employer: "" }
  }
  // 3+ segments: dates | label | employer (employer may contain |)
  const dates = parts[0]!
  const label = parts[1]!
  const employer = parts.slice(2).join(" | ").trim()
  if (!dates || !label) return null
  return { dates, label, employer }
}

function looksLikeMilestoneLine(line: string): boolean {
  const body = line.replace(BULLET_PREFIX_RE, "").trim()
  if (!body || TRACK_RE.test(line) || CONNECTION_HEADER_RE.test(line)) return false
  return body.includes("|")
}

/**
 * Map free-text CONNECTION notes to two milestones (prefer different tracks).
 * Avoids the old first↔last pairing that drew page-long diagonals.
 */
function inferConnectionFromFreeText(
  text: string,
  milestones: CareerEvolutionMilestone[],
  tracks: CareerEvolutionTrack[],
): { fromId: string; toId: string } {
  const label = text.toLowerCase()
  const scored = milestones
    .map((m) => {
      let score = 0
      if (m.label && label.includes(m.label.toLowerCase())) score += m.label.length + 10
      if (m.description && label.includes(m.description.toLowerCase())) {
        score += m.description.length + 5
      }
      const trackLabel = tracks.find((t) => t.id === m.trackId)?.label
      if (trackLabel && label.includes(trackLabel.toLowerCase())) {
        score += trackLabel.length
      }
      return { m, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length >= 2) {
    const first = scored[0]!.m
    const second =
      scored.find((x) => x.m.trackId && x.m.trackId !== first.trackId)?.m ||
      scored[1]!.m
    return { fromId: first.id, toId: second.id }
  }

  if (scored.length === 1) {
    const anchor = scored[0]!.m
    const other =
      milestones.find((m) => m.trackId && m.trackId !== anchor.trackId) ||
      milestones.find((m) => m.id !== anchor.id)
    if (other) return { fromId: anchor.id, toId: other.id }
  }

  // Default: last milestone on a secondary track → last on primary
  if (tracks.length >= 2) {
    const primary = milestones.filter((m) => m.trackId === tracks[0]!.id)
    const secondary = milestones.filter((m) => m.trackId === tracks[1]!.id)
    if (primary.length && secondary.length) {
      return {
        fromId: secondary[secondary.length - 1]!.id,
        toId: primary[primary.length - 1]!.id,
      }
    }
  }

  const last = milestones[milestones.length - 1]
  const prev = milestones[Math.max(0, milestones.length - 2)]
  return {
    fromId: last?.id ?? newCareerEvolutionId("c-from"),
    toId: prev?.id ?? last?.id ?? newCareerEvolutionId("c-to"),
  }
}

/**
 * Parse TRACK / CONNECTION text into a CareerEvolutionConfig.
 * Preserves presentation fields from `base` when provided.
 * Always keeps `sourceText` as the raw editor contents.
 */
export function parseCareerEvolutionText(
  sourceText: string,
  base?: Partial<CareerEvolutionConfig>,
): CareerEvolutionParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const tracks: CareerEvolutionTrack[] = []
  const milestones: CareerEvolutionMilestone[] = []
  const connections: CareerEvolutionConnection[] = []

  let currentTrack: CareerEvolutionTrack | null = null
  let inConnectionBlock = false
  const normalizedSource = normalizeCareerEvolutionSourceText(sourceText)
  const lines = normalizedSource.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ""
    const line = raw.trim()
    if (!line) continue

    const trackMatch = line.match(TRACK_RE)
    if (trackMatch) {
      inConnectionBlock = false
      const label = trackMatch[1]!.trim()
      if (!label) {
        errors.push(`Line ${i + 1}: TRACK needs a name.`)
        continue
      }
      // Reuse an existing track with the same label — never duplicate rows.
      const existing = tracks.find(
        (t) => t.label.toLowerCase() === label.toLowerCase(),
      )
      if (existing) {
        currentTrack = existing
      } else {
        currentTrack = { id: slugTrackId(label, tracks.length), label }
        tracks.push(currentTrack)
      }
      continue
    }

    const connHeader = line.match(CONNECTION_HEADER_RE)
    if (connHeader) {
      inConnectionBlock = true
      currentTrack = null
      const rest = connHeader[1]!.trim()
      if (rest) {
        const link = rest.match(LINK_RE)
        if (link) {
          const fromLabel = link[1]!.trim()
          const toLabel = link[2]!.trim()
          const note = link[3]?.trim()
          const from = milestones.find(
            (m) => m.label.toLowerCase() === fromLabel.toLowerCase(),
          )
          const to = milestones.find(
            (m) => m.label.toLowerCase() === toLabel.toLowerCase(),
          )
          if (!from || !to) {
            warnings.push(
              `Line ${i + 1}: connection “${fromLabel} → ${toLabel}” — match stage labels exactly, or add milestones first.`,
            )
          }
          connections.push({
            id: newCareerEvolutionId("c"),
            fromMilestoneId: from?.id ?? newCareerEvolutionId("pending-from"),
            toMilestoneId: to?.id ?? newCareerEvolutionId("pending-to"),
            label: note || `${fromLabel} → ${toLabel}`,
            approved: true,
          })
        } else {
          const ends = inferConnectionFromFreeText(rest, milestones, tracks)
          connections.push({
            id: newCareerEvolutionId("c"),
            fromMilestoneId: ends.fromId,
            toMilestoneId: ends.toId,
            label: rest,
            approved: true,
          })
          if (milestones.length < 2) {
            warnings.push(
              `Line ${i + 1}: CONNECTION text saved; add at least two milestones to link them on the graph.`,
            )
          }
        }
      }
      continue
    }

    if (/^(LAYOUT|DENSITY|POSITION|VISIBLE):/i.test(line)) {
      warnings.push(
        `Line ${i + 1}: layout options are set with the controls below the editor, not in the text.`,
      )
      continue
    }

    // Connection block free-text / bullets
    if (inConnectionBlock) {
      const body = line.replace(BULLET_PREFIX_RE, "").trim()
      const link = body.match(LINK_RE)
      if (link) {
        const fromLabel = link[1]!.trim()
        const toLabel = link[2]!.trim()
        const note = link[3]?.trim()
        const from = milestones.find(
          (m) => m.label.toLowerCase() === fromLabel.toLowerCase(),
        )
        const to = milestones.find(
          (m) => m.label.toLowerCase() === toLabel.toLowerCase(),
        )
        connections.push({
          id: newCareerEvolutionId("c"),
          fromMilestoneId: from?.id ?? newCareerEvolutionId("pending-from"),
          toMilestoneId: to?.id ?? newCareerEvolutionId("pending-to"),
          label: note || `${fromLabel} → ${toLabel}`,
          approved: true,
        })
        if (!from || !to) {
          warnings.push(
            `Line ${i + 1}: could not resolve connection endpoints to milestone labels.`,
          )
        }
      } else {
        const ends = inferConnectionFromFreeText(body, milestones, tracks)
        connections.push({
          id: newCareerEvolutionId("c"),
          fromMilestoneId: ends.fromId,
          toMilestoneId: ends.toId,
          label: body,
          approved: true,
        })
      }
      continue
    }

    // Milestone lines: with or without leading hyphen
    if (looksLikeMilestoneLine(line) || BULLET_PREFIX_RE.test(line)) {
      if (!currentTrack) {
        errors.push(
          `Line ${i + 1}: milestone needs a TRACK: heading above it.`,
        )
        continue
      }
      const body = line.replace(BULLET_PREFIX_RE, "").trim()
      const fields = parseMilestoneFields(body)
      if (!fields) {
        errors.push(
          `Line ${i + 1}: use “dates | stage label | employer” (employer optional). Example: 2021–2023 | UX Research | Acme`,
        )
        continue
      }
      const dates = parseDateRange(fields.dates)
      if (dates.error) {
        errors.push(`Line ${i + 1}: ${dates.error}`)
        continue
      }
      milestones.push({
        id: newCareerEvolutionId("m"),
        label: fields.label,
        description: fields.employer || undefined,
        officialTitle: fields.label,
        start: dates.start,
        end: dates.end,
        trackId: currentTrack.id,
        approved: true,
      })
      continue
    }

    errors.push(
      `Line ${i + 1}: unrecognised line. Use TRACK:, CONNECTION:, or “dates | label | employer” (optional leading -).`,
    )
  }

  if (tracks.length === 0 && milestones.length === 0 && !normalizedSource.trim()) {
    // empty editor is valid
  } else if (tracks.length === 0 && milestones.length > 0) {
    errors.push("Add at least one TRACK: heading.")
  }

  // Preserve presentation from base; never invent visibility on.
  // Omit undefined presentation fields so defaults are not wiped to undefined.
  const presentationDefaults = emptyCareerEvolutionConfig()
  const merged = emptyCareerEvolutionConfig({
    ...base,
    visible: base?.visible === true,
    userDisabled: base?.userDisabled === true ? true : base?.userDisabled,
    layout: base?.layout ?? presentationDefaults.layout,
    density: base?.density ?? presentationDefaults.density,
    dateDisplay: base?.dateDisplay ?? presentationDefaults.dateDisplay,
    position: base?.position ?? presentationDefaults.position,
    showParallelWork:
      base?.showParallelWork !== undefined
        ? base.showParallelWork
        : presentationDefaults.showParallelWork,
    showConnectionIcon:
      base?.showConnectionIcon !== undefined
        ? base.showConnectionIcon
        : presentationDefaults.showConnectionIcon,
    showConnectionLabels:
      base?.showConnectionLabels !== undefined
        ? base.showConnectionLabels
        : presentationDefaults.showConnectionLabels,
    graphTitle: base?.graphTitle,
    generatedForRole: base?.generatedForRole,
    generatedAt: base?.generatedAt,
    origin: base?.origin,
    userEditedAt: base?.userEditedAt,
    pendingSuggestion: base?.pendingSuggestion,
    omitReason: base?.omitReason,
    capabilities: base?.capabilities,
    alignments: base?.alignments,
    alignmentSourceText: base?.alignmentSourceText,
    convergenceTarget: base?.convergenceTarget,
    // Keep the author's exact editor string (not only normalized) for round-trip
    sourceText,
    tracks: tracks.length
      ? tracks
      : base?.tracks?.length
        ? base.tracks
        : presentationDefaults.tracks,
    milestones,
    connections,
  })

  return { config: merged, errors, warnings }
}

/** Serialize structured config back to TRACK / CONNECTION text. */
export function serializeCareerEvolutionText(config: CareerEvolutionConfig): string {
  const lines: string[] = []
  const tracks =
    config.tracks.length > 0
      ? config.tracks
      : [{ id: "track-employment", label: "Professional Experience" }]

  for (const track of tracks) {
    const items = config.milestones.filter((m) => (m.trackId || tracks[0]!.id) === track.id)
    if (items.length === 0 && config.milestones.length > 0) continue
    lines.push(`TRACK: ${track.label}`)
    for (const m of items) {
      const dates =
        m.start && m.end && m.start !== m.end
          ? `${m.start}–${m.end}`
          : m.start || m.end || ""
      const employer = m.description || m.officialTitle || ""
      lines.push(`- ${dates || "—"} | ${m.label} | ${employer || "—"}`)
    }
    lines.push("")
  }

  const tracked = new Set(tracks.map((t) => t.id))
  const orphans = config.milestones.filter((m) => m.trackId && !tracked.has(m.trackId))
  if (orphans.length) {
    lines.push("TRACK: Other")
    for (const m of orphans) {
      const dates =
        m.start && m.end ? `${m.start}–${m.end}` : m.start || m.end || ""
      lines.push(`- ${dates} | ${m.label} | ${m.description || ""}`)
    }
    lines.push("")
  }

  const conns = config.connections.filter((c) => c.label || c.approved)
  if (conns.length) {
    lines.push("CONNECTION:")
    for (const c of conns) {
      const from = config.milestones.find((m) => m.id === c.fromMilestoneId)?.label
      const to = config.milestones.find((m) => m.id === c.toMilestoneId)?.label
      if (from && to) {
        lines.push(`- ${from} -> ${to}${c.label ? ` | ${c.label}` : ""}`)
      } else if (c.label) {
        lines.push(`- ${c.label}`)
      }
    }
  }

  return lines.join("\n").trim() + (lines.length ? "\n" : "")
}

/** Canonical example — must stay parseable by parseCareerEvolutionText. */
export const CAREER_EVOLUTION_SYNTAX_HELP = `TRACK: Professional Experience
- 2016–2019 | UX Design | SolarWinds
- 2021–2023 | UX Research & Product Design | Bundesdruckerei
- 2023–Present | UX & AI Strategy | Bundesdruckerei

TRACK: Independent Research
- 2024–Present | Responsible AI | TrustBridge / TrustAudit.tools

CONNECTION:
Independent research informed strategic AI discussions at Bundesdruckerei.
`
