import {
  CAREER_EVOLUTION_CAPABILITY_MAX,
  CAREER_EVOLUTION_FENCE,
  CAREER_EVOLUTION_SECTION_TITLE,
  emptyCareerEvolutionConfig,
  newCareerEvolutionId,
  type CareerEvolutionAlignment,
  type CareerEvolutionAlignmentMatch,
  type CareerEvolutionCapability,
  type CareerEvolutionConfig,
  type CareerEvolutionConnection,
  type CareerEvolutionMilestone,
  type CareerEvolutionTrack,
} from "@/lib/career-evolution/types"
import { repairCareerEvolutionStoredDates } from "@/lib/career-evolution/date-format"
import { normalizeCareerEvolutionLayout } from "@/lib/career-evolution/layout-catalog"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"

const FENCE_RE = new RegExp(
  String.raw`^\x60{3}\s*${CAREER_EVOLUTION_FENCE}\s*$`,
  "i",
)
const FENCE_END_RE = /^\x60{3}\s*$/

function isCareerEvolutionHeading(line: string): boolean {
  const t = stripSectionColumnModifier(line)
    .replace(/^#{1,6}\s+/, "")
    .trim()
    .toUpperCase()
  return (
    t === "CAREER EVOLUTION" ||
    t === "CAREEREVOLUTION" ||
    t === "KARRIEREENTWICKLUNG" ||
    t === "KARRIERE-EVOLUTION"
  )
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function normalizeMilestone(raw: unknown): CareerEvolutionMilestone | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = asString(o.id).trim()
  const label = asString(o.label).trim()
  if (!id || !label) return null
  const fit = asString(o.evidenceFit)
  const kind = asString(o.milestoneKind)
  const repaired = repairCareerEvolutionStoredDates(
    asString(o.start).trim() || undefined,
    asString(o.end).trim() || undefined,
  )
  const displayOrigin = asString(o.displayLabelOrigin).trim()
  return {
    id,
    label,
    displayLabel: asString(o.displayLabel).trim() || undefined,
    displayLabelOrigin:
      displayOrigin === "auto" || displayOrigin === "user" ? displayOrigin : undefined,
    description: asString(o.description).trim() || undefined,
    officialTitle: asString(o.officialTitle).trim() || undefined,
    start: repaired.start,
    end: repaired.end,
    trackId: asString(o.trackId).trim() || undefined,
    relevanceNote: asString(o.relevanceNote).trim() || undefined,
    jobRequirementAddressed: asString(o.jobRequirementAddressed).trim() || undefined,
    evidenceRef: asString(o.evidenceRef).trim() || undefined,
    evidenceFit:
      fit === "direct" || fit === "transferable" || fit === "partial" ? fit : undefined,
    milestoneKind: kind === "formal-role" || kind === "career-stage" ? kind : undefined,
    approved: o.approved === true,
  }
}

function normalizeTrack(raw: unknown): CareerEvolutionTrack | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = asString(o.id).trim()
  const label = asString(o.label).trim()
  if (!id || !label) return null
  return { id, label }
}

function normalizeConnection(raw: unknown): CareerEvolutionConnection | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = asString(o.id).trim()
  const fromMilestoneId = asString(o.fromMilestoneId).trim()
  const toMilestoneId = asString(o.toMilestoneId).trim()
  if (!id || !fromMilestoneId || !toMilestoneId) return null
  return {
    id,
    fromMilestoneId,
    toMilestoneId,
    label: asString(o.label).trim() || undefined,
    approved: o.approved === true,
    evidenceRef: asString(o.evidenceRef).trim() || undefined,
  }
}

export function normalizeCareerEvolutionConfig(
  raw: unknown,
): CareerEvolutionConfig {
  const base = emptyCareerEvolutionConfig()
  if (!raw || typeof raw !== "object") {
    return emptyCareerEvolutionConfig({ visible: false })
  }
  const o = raw as Record<string, unknown>
  const milestones = Array.isArray(o.milestones)
    ? o.milestones.map(normalizeMilestone).filter(Boolean)
    : []
  const rawTracks = Array.isArray(o.tracks)
    ? (o.tracks.map(normalizeTrack).filter(Boolean) as CareerEvolutionTrack[])
    : []
  // Deduplicate by normalised label so stored duplicates cannot multiply SVG rows.
  const tracks: CareerEvolutionTrack[] = []
  const seenTrackKeys = new Map<string, string>() // key -> kept track id
  const trackIdRemap = new Map<string, string>()
  for (const track of rawTracks) {
    const key = track.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || track.id
    const keptId = seenTrackKeys.get(key)
    if (keptId) {
      trackIdRemap.set(track.id, keptId)
      continue
    }
    seenTrackKeys.set(key, track.id)
    tracks.push(track)
  }
  const remappedMilestones = (milestones as CareerEvolutionMilestone[]).map((m) => {
    if (!m.trackId) return m
    const nextId = trackIdRemap.get(m.trackId)
    return nextId ? { ...m, trackId: nextId } : m
  })
  const milestoneIds = new Set(
    (remappedMilestones as CareerEvolutionMilestone[]).map((m) => m.id),
  )
  const connections = Array.isArray(o.connections)
    ? (o.connections
        .map(normalizeConnection)
        .filter(Boolean) as CareerEvolutionConnection[]).filter(
        (c) =>
          milestoneIds.has(c.fromMilestoneId) &&
          milestoneIds.has(c.toMilestoneId) &&
          c.fromMilestoneId !== c.toMilestoneId,
      )
    : []
  const position =
    o.position === "after-experience" ? "after-experience" : "before-experience"
  const originRaw = asString(o.origin)
  const pending =
    o.pendingSuggestion != null && typeof o.pendingSuggestion === "object"
      ? normalizeCareerEvolutionConfig({
          ...(o.pendingSuggestion as object),
          pendingSuggestion: undefined,
        })
      : undefined

  return {
    v: 1,
    // Opt-in only — missing/undefined visible must stay Off for existing CVs.
    visible: o.visible === true,
    userDisabled: o.userDisabled === true,
    layout: normalizeCareerEvolutionLayout(o.layout),
    density: o.density === "standard" ? "standard" : "compact",
    dateDisplay:
      o.dateDisplay === "full" ||
      o.dateDisplay === "compact" ||
      o.dateDisplay === "auto"
        ? o.dateDisplay
        : "auto",
    position,
    showParallelWork: o.showParallelWork !== false,
    showConnectionIcon: o.showConnectionIcon !== false,
    showConnectionLabels: o.showConnectionLabels !== false,
    tracks: tracks.length > 0 ? tracks : base.tracks,
    milestones: remappedMilestones,
    connections: connections as CareerEvolutionConnection[],
    capabilities: Array.isArray(o.capabilities)
      ? (o.capabilities
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null
            const c = raw as Record<string, unknown>
            // Keep empty labels during edit — renderer filters; ids stay stable.
            const label = asString(c.label)
            const id = asString(c.id).trim() || newCareerEvolutionId("cap")
            if (!id) return null
            return {
              id,
              label,
              evidenceRef: asString(c.evidenceRef).trim() || undefined,
            } satisfies CareerEvolutionCapability
          })
          .filter(Boolean) as CareerEvolutionCapability[])
          .slice(0, CAREER_EVOLUTION_CAPABILITY_MAX)
      : [],
    convergenceTarget: asString(o.convergenceTarget).trim() || undefined,
    convergenceTargetOrigin: (() => {
      const origin = asString(o.convergenceTargetOrigin).trim()
      return origin === "auto" || origin === "user" ? origin : undefined
    })(),
    alignments: Array.isArray(o.alignments)
      ? (o.alignments
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null
            const a = raw as Record<string, unknown>
            const evidenceLabel = asString(a.evidenceLabel).trim()
            const requirementLabel = asString(a.requirementLabel).trim()
            if (!evidenceLabel || !requirementLabel) return null
            const matchRaw = asString(a.matchType).trim().toLowerCase()
            const matchType: CareerEvolutionAlignmentMatch | undefined =
              matchRaw === "direct" || matchRaw === "transferable"
                ? matchRaw
                : undefined
            return {
              id: asString(a.id).trim() || newCareerEvolutionId("al"),
              evidenceLabel,
              requirementLabel,
              evidenceRef: asString(a.evidenceRef).trim() || undefined,
              matchType,
              approved: a.approved !== false,
            } satisfies CareerEvolutionAlignment
          })
          .filter(Boolean) as CareerEvolutionAlignment[])
      : [],
    alignmentSourceText:
      typeof o.alignmentSourceText === "string" ? o.alignmentSourceText : undefined,
    graphTitle: asString(o.graphTitle).trim() || undefined,
    sourceText: typeof o.sourceText === "string" ? o.sourceText : undefined,
    generatedForRole: asString(o.generatedForRole).trim() || undefined,
    generatedAt: typeof o.generatedAt === "number" ? o.generatedAt : undefined,
    omitReason: asString(o.omitReason).trim() || undefined,
    origin:
      originRaw === "ai" || originRaw === "user" || originRaw === "mixed"
        ? originRaw
        : undefined,
    userEditedAt: typeof o.userEditedAt === "number" ? o.userEditedAt : undefined,
    pendingSuggestion: pending,
  }
}

export function serializeCareerEvolutionConfig(config: CareerEvolutionConfig): string {
  const normalized = normalizeCareerEvolutionConfig(config)
  return JSON.stringify(normalized, null, 2)
}

export function serializeCareerEvolutionSection(config: CareerEvolutionConfig): string {
  const json = serializeCareerEvolutionConfig(config)
  return [
    CAREER_EVOLUTION_SECTION_TITLE,
    `\`\`\`${CAREER_EVOLUTION_FENCE}`,
    json,
    "```",
    "",
  ].join("\n")
}

export type CareerEvolutionExtract = {
  config: CareerEvolutionConfig | null
  /** Resume text with the CAREER EVOLUTION section removed. */
  resumeWithoutBlock: string
  /** Original section start/end line indexes if found. */
  range: { start: number; end: number } | null
}

/**
 * Find and parse a CAREER EVOLUTION block. Leaves all other CV content untouched.
 */
export function extractCareerEvolution(resumeText: string): CareerEvolutionExtract {
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n")
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (isCareerEvolutionHeading(lines[i] ?? "")) {
      start = i
      break
    }
  }
  if (start < 0) {
    return { config: null, resumeWithoutBlock: resumeText, range: null }
  }

  let end = start + 1
  let jsonStart = -1
  let jsonEnd = -1
  while (end < lines.length) {
    const t = (lines[end] ?? "").trim()
    if (jsonStart < 0 && FENCE_RE.test(t)) {
      jsonStart = end + 1
      end++
      continue
    }
    if (jsonStart >= 0 && FENCE_END_RE.test(t)) {
      jsonEnd = end
      end++
      break
    }
    // Stop at next major ALL-CAPS section if no fence closed
    if (
      jsonStart < 0 &&
      t &&
      !t.startsWith("#") &&
      !t.startsWith("|") &&
      !t.startsWith("-") &&
      /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s&/()-]{2,}$/.test(t) &&
      !isCareerEvolutionHeading(t)
    ) {
      break
    }
    end++
    if (end - start > 400) break
  }

  let config: CareerEvolutionConfig | null = null
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const raw = lines.slice(jsonStart, jsonEnd).join("\n")
    try {
      config = normalizeCareerEvolutionConfig(JSON.parse(raw))
    } catch {
      config = null
    }
  }

  const before = lines.slice(0, start)
  const after = lines.slice(end)
  while (before.length && !before[before.length - 1]?.trim()) before.pop()
  while (after.length && !after[0]?.trim()) after.shift()
  const resumeWithoutBlock = [...before, ...(after.length ? ["", ...after] : [])]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")

  return {
    config,
    resumeWithoutBlock,
    range: { start, end },
  }
}

/** Insert or replace the CAREER EVOLUTION section in resume text. */
export function upsertCareerEvolutionSection(
  resumeText: string,
  config: CareerEvolutionConfig,
): string {
  const block = serializeCareerEvolutionSection(config).trimEnd()
  const extracted = extractCareerEvolution(resumeText)
  if (!extracted.range) {
    const base = resumeText.trimEnd()
    // Place after PROFILE-like intro when possible: after first blank following first section
    return base ? `${base}\n\n${block}\n` : `${block}\n`
  }
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n")
  const next = [
    ...lines.slice(0, extracted.range.start),
    ...block.split("\n"),
    ...lines.slice(extracted.range.end),
  ]
  return next.join("\n").replace(/\n{3,}/g, "\n\n")
}

export function removeCareerEvolutionSection(resumeText: string): string {
  return extractCareerEvolution(resumeText).resumeWithoutBlock
}
