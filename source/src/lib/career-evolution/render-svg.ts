/**
 * Career Evolution SVG — five distinct compact templates sharing one content model.
 * Print-safe; max ~45 mm height; CV accent colour; at most one merge icon where needed.
 */

import { resolveAlignmentsFromConfig } from "@/lib/career-evolution/alignment-text"
import {
  formatCareerEvolutionDateRange,
  isBrokenCareerEvolutionDateDisplay,
  resolveCareerEvolutionDateDisplay,
} from "@/lib/career-evolution/date-format"
import { careerEvolutionTextAlternative } from "@/lib/career-evolution/suggest"
import { normalizeCareerEvolutionLayout } from "@/lib/career-evolution/layout-catalog"
import {
  CAREER_EVOLUTION_INDEPENDENT_TRACK_ID,
  careerEvolutionShowParallelWork,
  isParallelCareerEvolutionTrack,
  prepareCareerEvolutionParallelVisibility,
} from "@/lib/career-evolution/parallel-visibility"
import {
  CAREER_EVOLUTION_CAPABILITY_DEFAULT,
  CAREER_EVOLUTION_CAPABILITY_MAX,
  type CareerEvolutionAlignment,
  type CareerEvolutionCapability,
  type CareerEvolutionConfig,
  type CareerEvolutionConnection,
  type CareerEvolutionLayout,
  type CareerEvolutionMilestone,
  type CareerEvolutionTrack,
} from "@/lib/career-evolution/types"
import { escapeHtmlText } from "@/lib/resume-inline-links"

export const CAREER_EVOLUTION_MAX_HEIGHT_PX = 170
export const CAREER_EVOLUTION_STANDARD_MAX_HEIGHT_PX = 196
export const CAREER_EVOLUTION_COMPACT_TWO_TRACK_HEIGHT_PX = 152
export const CAREER_EVOLUTION_STANDARD_TWO_TRACK_HEIGHT_PX = 184
export const CAREER_EVOLUTION_MAX_PARALLEL_TRACKS = 2

/**
 * Typography + spacing for Compact vs Standard.
 *
 * Print-oriented sizes (SVG user units ≈ pt on A4 preview):
 * - Track headings: 9 pt semibold (Compact 8.5 / Standard 9)
 * - Dates: 8–8.5 pt
 * - Milestone labels: 9–10 pt semibold
 * - Connection labels: 8 pt (Compact 7.5 / Standard 8)
 * - Secondary descriptions: 8–9 pt
 * Compact uses the lower end; Standard the upper. Padding scales with type
 * so the graph stays a small infographic under Experience (~13–14 px titles).
 */
export type CareerEvolutionDensityMetrics = {
  density: "compact" | "standard"
  // Progression cards
  gap: number
  padX: number
  padY: number
  minCardH: number
  titleSize: number
  titleSizeMin: number
  dateSize: number
  titleLineHeight: number
  dateToTitleGap: number
  rx: number
  // Parallel tracks
  capsuleH: number
  trackLabelSize: number
  parallelTitleMax: number
  parallelTitleMin: number
  parallelGap: number
  parallelRelGap: number
  // Shared secondary / connection type
  connectionLabelSize: number
  secondarySize: number
  // Convergence
  convRowH: number
  convGap: number
  convFont: number
  convTargetH: number
  convTargetFont: number
  // Branching
  branchLabelFont: number
  branchLabelLineH: number
  branchMainY: number
  branchY: number
  // Alignment
  alignRowMinH: number
  alignRowPadY: number
  alignGap: number
  alignFontSize: number
  alignLineHeight: number
  // Caps (print-aware)
  maxHeightPx: number
  maxHeightMm: number
  twoTrackMaxPx: number
}

export function careerEvolutionDensityMetrics(
  density: CareerEvolutionConfig["density"] | undefined,
): CareerEvolutionDensityMetrics {
  if (density === "standard") {
    return {
      density: "standard",
      gap: 7,
      padX: 8,
      padY: 6,
      minCardH: 44,
      titleSize: 10,
      titleSizeMin: 9,
      dateSize: 8.5,
      titleLineHeight: 1.25,
      dateToTitleGap: 3,
      rx: 4,
      capsuleH: 46,
      trackLabelSize: 9,
      parallelTitleMax: 10,
      parallelTitleMin: 9,
      parallelGap: 8,
      parallelRelGap: 14,
      connectionLabelSize: 8,
      secondarySize: 9,
      convRowH: 22,
      convGap: 6,
      convFont: 9,
      convTargetH: 40,
      convTargetFont: 10,
      branchLabelFont: 10,
      branchLabelLineH: 11,
      branchMainY: 38,
      branchY: 76,
      alignRowMinH: 22,
      alignRowPadY: 6,
      alignGap: 6,
      alignFontSize: 9,
      alignLineHeight: 1.28,
      maxHeightPx: CAREER_EVOLUTION_STANDARD_MAX_HEIGHT_PX,
      maxHeightMm: 52,
      twoTrackMaxPx: CAREER_EVOLUTION_STANDARD_TWO_TRACK_HEIGHT_PX,
    }
  }
  return {
    density: "compact",
    gap: 5,
    padX: 6,
    padY: 4,
    minCardH: 36,
    titleSize: 9,
    titleSizeMin: 8,
    dateSize: 8,
    titleLineHeight: 1.2,
    dateToTitleGap: 2,
    rx: 3,
    capsuleH: 38,
    trackLabelSize: 8.5,
    parallelTitleMax: 9,
    parallelTitleMin: 8,
    parallelGap: 5,
    parallelRelGap: 12,
    connectionLabelSize: 7.5,
    secondarySize: 8,
    convRowH: 18,
    convGap: 4,
    convFont: 8,
    convTargetH: 34,
    convTargetFont: 9,
    branchLabelFont: 9,
    branchLabelLineH: 9.5,
    branchMainY: 32,
    branchY: 64,
    alignRowMinH: 18,
    alignRowPadY: 4,
    alignGap: 4,
    alignFontSize: 8,
    alignLineHeight: 1.22,
    maxHeightPx: CAREER_EVOLUTION_MAX_HEIGHT_PX,
    maxHeightMm: 45,
    twoTrackMaxPx: CAREER_EVOLUTION_COMPACT_TWO_TRACK_HEIGHT_PX,
  }
}

// ─── shared helpers ─────────────────────────────────────────────────────────

function parseMonthIndex(value?: string): number | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (v === "present" || v === "heute" || v === "current" || v === "now" || v === "aktuell") {
    const now = new Date()
    return now.getFullYear() * 12 + now.getMonth()
  }
  const ymd = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) return Number(ymd[1]) * 12 + (Number(ymd[2]) - 1)
  const iso = v.match(/^(\d{4})-(\d{1,2})$/)
  if (iso) return Number(iso[1]) * 12 + (Number(iso[2]) - 1)
  const year = v.match(/^(\d{4})$/)
  if (year) return Number(year[1]) * 12
  return null
}

function formatDateLabel(
  start?: string,
  end?: string,
  options?: {
    maxChars?: number
    language?: "en" | "de"
    density?: "compact" | "standard"
    dateDisplay?: import("@/lib/career-evolution/types").CareerEvolutionDateDisplay
    /**
     * Prefer year-only (2016–2019 / 2023–Present) so narrow cards never clip
     * mid-token — even when the user preference is Full (full stays in tooltip).
     */
    forceCompact?: boolean
  },
): { display: string; full: string } {
  const resolved = resolveCareerEvolutionDateDisplay(
    options?.dateDisplay,
    options?.density,
  )
  // forceCompact always wins for graph ink — Full preference is preserved via `full`.
  const mode = options?.forceCompact ? "compact" : resolved
  const result = formatCareerEvolutionDateRange(start, end, {
    mode,
    maxChars: options?.maxChars ?? 16,
    language: options?.language,
  })
  // Never show raw/broken ISO concatenations; omit unparseable dates on the graph.
  if (result.parseError) return { display: "", full: "" }
  if (isBrokenCareerEvolutionDateDisplay(result.display)) {
    return { display: "", full: "" }
  }
  return { display: result.display, full: result.full || result.display }
}

/** Approximate rendered width of a date string at the progression date font size. */
function progressionDateFits(display: string, innerWidth: number, fontSize: number): boolean {
  if (!display) return true
  // Tabular-ish digits + en-dash; Inter ≈ 0.56em for this mix
  return display.length * fontSize * 0.56 <= innerWidth + 0.5
}

export function abbreviateStageLabel(label: string | null | undefined, maxChars = 22): string {
  const t = safeText(label)
  if (!t) return ""
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(4, maxChars - 1))}…`
}

/**
 * Wrap label text for compact cards. Prefer natural word wraps.
 * Ellipsis only on the final line when content still overflows (and a full
 * label can be exposed separately via displayLabel / SVG <title>).
 */
export function safeText(value: unknown, fallback = ""): string {
  if (value == null) return fallback
  const s = String(value).trim().replace(/\s+/g, " ")
  return s || fallback
}

function wrapLabelLines(
  text: string,
  maxChars: number,
  maxLines = 2,
  options?: { allowEllipsis?: boolean },
): string[] {
  const allowEllipsis = options?.allowEllipsis !== false
  const words = safeText(text).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const limit = Math.max(4, maxChars)
  const lines: string[] = []
  let current = ""
  let wordIndex = 0

  const pushWord = (word: string) => {
    if (word.length <= limit) {
      current = word
      return
    }
    // Prefer keeping the whole word (wrap to its own line) over mid-word cuts.
    // Ellipsis truncate only when explicitly allowed as a last resort.
    current = allowEllipsis
      ? `${word.slice(0, Math.max(3, limit - 1))}…`
      : word
  }

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex]!
    const next = current ? `${current} ${word}` : word
    if (next.length <= limit) {
      current = next
      wordIndex += 1
      continue
    }
    if (current) {
      lines.push(current)
      current = ""
      if (lines.length >= maxLines) break
      continue
    }
    pushWord(word)
    wordIndex += 1
    lines.push(current)
    current = ""
  }
  if (current && lines.length < maxLines) lines.push(current)

  // Remaining words after max lines → ellipsis on last line when allowed
  if (wordIndex < words.length && lines.length > 0 && allowEllipsis) {
    const last = lines[lines.length - 1]!
    if (!last.endsWith("…")) {
      const base = last.length <= limit - 1 ? last : last.slice(0, Math.max(3, limit - 1))
      lines[lines.length - 1] = `${base.replace(/\s+$/, "")}…`
    }
  }

  return lines.slice(0, maxLines)
}

const CE_SVG_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"

/**
 * Estimate how many characters fit in `innerWidth` at `fontSize`.
 * Default 0.52em suits regular Inter; bold / uppercase-heavy labels need
 * a wider factor or Standard density pills overflow the rounded rect.
 */
function estimateCharsForWidth(
  innerWidth: number,
  fontSize: number,
  avgGlyphEm = 0.52,
): number {
  const factor = Math.max(0.45, avgGlyphEm)
  return Math.max(5, Math.floor(innerWidth / (fontSize * factor)))
}

function estimateLineWidthPx(
  text: string,
  fontSize: number,
  avgGlyphEm: number,
): number {
  return safeText(text).length * fontSize * avgGlyphEm
}

/** Prefer optional displayLabel; never rewrite the stored milestone label. */
export function milestoneCardLabel(m: CareerEvolutionMilestone | null | undefined): {
  linesSource: string
  fullLabel: string
  hasShortDisplay: boolean
} {
  // Never throw — missing labels used to white-screen ResumePreview via trim().
  const fullLabel = safeText(m?.label, "Milestone")
  const short = safeText(m?.displayLabel)
  if (short) {
    return { linesSource: short, fullLabel, hasShortDisplay: true }
  }
  return { linesSource: fullLabel, fullLabel, hasShortDisplay: false }
}

function normalizeTrackKey(label: unknown): string {
  return safeText(label).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function uniqueTracksForRender(
  config: CareerEvolutionConfig,
  options?: { keepEmptyParallelTracks?: boolean },
): {
  tracks: CareerEvolutionTrack[]
  milestones: CareerEvolutionMilestone[]
} {
  const byKey = new Map<string, CareerEvolutionTrack>()
  const idRemap = new Map<string, string>()
  for (const track of config.tracks) {
    if (!track?.id) continue
    const key = normalizeTrackKey(track.label) || track.id
    const existing = byKey.get(key)
    if (existing) {
      idRemap.set(track.id, existing.id)
      continue
    }
    byKey.set(key, { id: track.id, label: safeText(track.label, "Track") })
  }

  let milestones = config.milestones.map((m) => {
    if (!m.trackId) return { ...m }
    const remapped = idRemap.get(m.trackId) || m.trackId
    return remapped !== m.trackId ? { ...m, trackId: remapped } : { ...m }
  })

  let tracks = [...byKey.values()]
  const known = new Set(tracks.map((t) => t.id))
  milestones = milestones.map((m) => {
    if (!m.trackId || known.has(m.trackId)) return m
    const original = config.tracks.find((t) => t.id === m.trackId)
    const label = original?.label || "Other"
    let track = tracks.find((t) => normalizeTrackKey(t.label) === normalizeTrackKey(label))
    if (!track) {
      track = { id: m.trackId, label }
      tracks.push(track)
      known.add(track.id)
      return m
    }
    return { ...m, trackId: track.id }
  })

  if (milestones.some((m) => !m.trackId)) {
    let fallback = tracks[0]
    if (!fallback) {
      fallback = { id: "track-employment", label: "Professional Experience" }
      tracks = [fallback]
    }
    milestones = milestones.map((m) => (m.trackId ? m : { ...m, trackId: fallback!.id }))
  }

  const used = new Set(milestones.map((m) => m.trackId).filter(Boolean))
  tracks = tracks.filter(
    (t) =>
      used.has(t.id) ||
      (options?.keepEmptyParallelTracks === true &&
        isParallelCareerEvolutionTrack(t)),
  )
  // Ensure Parallel layout always has a dedicated independent track slot
  if (
    options?.keepEmptyParallelTracks &&
    !tracks.some(isParallelCareerEvolutionTrack)
  ) {
    tracks.push({
      id: CAREER_EVOLUTION_INDEPENDENT_TRACK_ID,
      label: "Independent work",
    })
  }
  tracks.sort((a, b) => {
    const ap = isParallelCareerEvolutionTrack(a) ? 1 : 0
    const bp = isParallelCareerEvolutionTrack(b) ? 1 : 0
    if (ap !== bp) return ap - bp
    const ae = /experience|employment|beruf/i.test(a.label) ? 0 : 1
    const be = /experience|employment|beruf/i.test(b.label) ? 0 : 1
    return ae - be
  })
  return { tracks, milestones }
}

function milestoneTime(m: CareerEvolutionMilestone) {
  const start = parseMonthIndex(m.start)
  const end = parseMonthIndex(m.end) ?? start
  if (start == null && end == null) return { mid: null as number | null }
  if (start == null) return { mid: end }
  if (end == null) return { mid: start }
  return { mid: (start + end) / 2 }
}

function sortChronological(ms: CareerEvolutionMilestone[]) {
  return [...ms].sort((a, b) => (milestoneTime(a).mid ?? 0) - (milestoneTime(b).mid ?? 0))
}

/** Drop connections whose endpoints no longer exist (renamed/removed milestones). */
export function filterValidConnections(
  connections: CareerEvolutionConnection[] | undefined,
  milestones: CareerEvolutionMilestone[],
): CareerEvolutionConnection[] {
  if (!connections?.length) return []
  const ids = new Set(milestones.map((m) => m.id).filter(Boolean))
  return connections.filter(
    (c) =>
      Boolean(c?.fromMilestoneId) &&
      Boolean(c?.toMilestoneId) &&
      ids.has(c.fromMilestoneId) &&
      ids.has(c.toMilestoneId) &&
      c.fromMilestoneId !== c.toMilestoneId,
  )
}

export function resolveConnectionEndpoints(
  connection: CareerEvolutionConnection,
  milestones: CareerEvolutionMilestone[],
  tracks: CareerEvolutionTrack[],
): { from: CareerEvolutionMilestone; to: CareerEvolutionMilestone } | null {
  const byId = (id: string) => milestones.find((m) => m.id === id)
  let from = byId(connection.fromMilestoneId)
  let to = byId(connection.toMilestoneId)
  if (!from || !to || from.id === to.id) {
    if (tracks.length >= 2) {
      const primary = milestones.filter((m) => m.trackId === tracks[0]!.id)
      const secondary = milestones.filter((m) => m.trackId === tracks[1]!.id)
      if (primary.length && secondary.length) {
        return { from: secondary[secondary.length - 1]!, to: primary[primary.length - 1]! }
      }
    }
    return null
  }
  if (from.trackId && to.trackId && from.trackId === to.trackId) return null
  return { from, to }
}

function lucideGitMergeIcon(x: number, y: number, accent: string, size = 12): string {
  const a = escapeHtmlText(accent)
  const s = size / 24
  return `<g data-ce-merge-icon="1" transform="translate(${x}, ${y}) scale(${s})" fill="none" stroke="${a}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></g>`
}

function accentRgba(hex: string, opacity: number): string {
  const raw = hex.replace("#", "").trim()
  if (raw.length === 6 && /^[0-9a-f]+$/i.test(raw)) {
    const r = Number.parseInt(raw.slice(0, 2), 16)
    const g = Number.parseInt(raw.slice(2, 4), 16)
    const b = Number.parseInt(raw.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${opacity.toFixed(3)})`
  }
  return `rgba(15,123,108,${opacity.toFixed(3)})`
}

function wrapSvg(
  width: number,
  height: number,
  body: string,
  alt: string,
  layout?: CareerEvolutionLayout,
  dens?: CareerEvolutionDensityMetrics,
): string {
  const metrics = dens || careerEvolutionDensityMetrics("compact")
  const h = Math.min(Math.ceil(height), metrics.maxHeightPx)
  const layoutAttr = layout ? ` data-ce-layout="${escapeHtmlText(layout)}"` : ""
  const densityAttr = ` data-ce-density="${metrics.density}"`
  // aspect-ratio on the figure keeps print engines from collapsing
  // width:100% + height:auto SVGs to 0 height (Chromium Print → PDF).
  return `<figure class="career-evolution-figure" data-ats-exclude="career-evolution" data-ce-layout-root="1"${layoutAttr}${densityAttr} style="margin:2px 0 6px;max-width:100%;max-height:${metrics.maxHeightMm}mm;aspect-ratio:${width} / ${h};overflow:visible;">
  <svg role="img" aria-hidden="true" focusable="false" viewBox="0 0 ${width} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%;max-width:100%;overflow:visible;" data-ce-density="${metrics.density}">
    ${body}
  </svg>
  <figcaption class="career-evolution-figure__alt">${alt}</figcaption>
</figure>`
}

/**
 * Resolve a capability pill label for Skills Convergence.
 * Short display labels live on milestones — stored capabilities often keep the
 * long stage/theme text, so match by id / label / evidenceRef and prefer
 * `displayLabel` when present.
 */
export function capabilityLabelForRender(
  _config: CareerEvolutionConfig,
  cap: CareerEvolutionCapability,
): { label: string; fullLabel: string } {
  // Authoritative: use the stored capability label as edited.
  // Never remap to milestone displayLabel — that blocked Skills Convergence editing.
  const fullFromCap = safeText(cap?.label, "Capability")
  return { label: fullFromCap, fullLabel: fullFromCap }
}

/** Derive capability streams for convergence when not stored explicitly. */
export function capabilitiesForRender(
  config: CareerEvolutionConfig,
): CareerEvolutionCapability[] {
  const stored = (config.capabilities || [])
    .filter((c) => c?.id && safeText(c?.label))
    .slice(0, CAREER_EVOLUTION_CAPABILITY_MAX)
  if (stored.length > 0) {
    return stored
  }
  const seen = new Set<string>()
  const out: CareerEvolutionCapability[] = []
  for (const m of config.milestones) {
    // Prefer short display labels; never ellipsis-truncate into stored capability text.
    const label = milestoneCardLabel(m).linesSource
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    // Fresh cap-* ids so capability edits never collide with milestone ids.
    out.push({
      id: `cap-derived-${out.length + 1}`,
      label,
      evidenceRef: m.evidenceRef,
    })
    if (out.length >= CAREER_EVOLUTION_CAPABILITY_DEFAULT) break
  }
  return out
}

/**
 * Derive evidence→requirement rows from milestones when structured alignments
 * are missing. Used for seeding the editor — never invents requirements.
 */
export function deriveAlignmentsFromMilestones(
  config: CareerEvolutionConfig,
): CareerEvolutionAlignment[] {
  const out: CareerEvolutionAlignment[] = []
  const seen = new Set<string>()
  for (const m of config.milestones) {
    const requirement = m.jobRequirementAddressed?.trim()
    const evidence = (m.label || m.officialTitle || "").trim()
    if (!requirement || !evidence) continue
    const key = `${evidence.toLowerCase()}→${requirement.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const matchType =
      m.evidenceFit === "direct" || m.evidenceFit === "transferable"
        ? m.evidenceFit
        : undefined
    out.push({
      id: m.id.startsWith("al-") ? m.id : `al-${m.id}`,
      evidenceLabel: evidence,
      requirementLabel: requirement,
      evidenceRef: m.evidenceRef,
      matchType,
      approved: true,
    })
    if (out.length >= 4) break
  }
  return out
}

export function alignmentsForRender(
  config: CareerEvolutionConfig,
): CareerEvolutionAlignment[] {
  // Evidence-to-Role uses the dedicated ALIGNMENT dataset only — never TRACK stages.
  return resolveAlignmentsFromConfig(config).slice(0, 4)
}

/** True when Evidence-to-Role has at least one pair to draw. */
export function hasCareerEvolutionAlignmentContent(
  config: CareerEvolutionConfig,
): boolean {
  return alignmentsForRender(config).length >= 1
}

function convergenceTargetLabel(config: CareerEvolutionConfig): string {
  // Only the explicit Central Outcome field — never auto-substitute target job title.
  if (config.convergenceTarget?.trim()) return config.convergenceTarget.trim()
  return "Central outcome"
}

// ─── public entry ───────────────────────────────────────────────────────────

export type CareerEvolutionRenderOptions = {
  accentColor: string
  language?: "en" | "de"
  width?: number
  /** Optional resume body — used to surface confirmed parallel roles at render time. */
  resumeText?: string
}

export function renderCareerEvolutionSvgHtml(
  config: CareerEvolutionConfig,
  options: CareerEvolutionRenderOptions,
): string {
  try {
    const layout = normalizeCareerEvolutionLayout(config.layout)
    const safeMilestones = (config.milestones || []).filter((m) => safeText(m?.label))
    const preparedConfig: CareerEvolutionConfig = {
      ...config,
      layout,
      milestones: safeMilestones,
      tracks: (config.tracks || []).filter((t) => t?.id && safeText(t?.label)),
      connections: filterValidConnections(config.connections, safeMilestones),
    }
    const renderConfig = prepareCareerEvolutionParallelVisibility(
      preparedConfig,
      options.resumeText,
    )
    // Re-filter after enrich (parallel prep may add milestones).
    renderConfig.milestones = (renderConfig.milestones || []).filter((m) =>
      safeText(m?.label),
    )
    renderConfig.connections = filterValidConnections(
      renderConfig.connections,
      renderConfig.milestones,
    )

    if (!renderConfig.visible || renderConfig.milestones.length === 0) {
      // Alignment / convergence may render from capabilities/alignments alone
      const hasAltContent =
        (layout === "convergence" && capabilitiesForRender(renderConfig).length >= 2) ||
        (layout === "alignment" && alignmentsForRender(renderConfig).length >= 1)
      if (!hasAltContent) return ""
    }

    const accent = options.accentColor || "#0f7b6c"
    const language = options.language === "de" ? "de" : "en"
    const width = Math.max(280, Math.min(options.width ?? 480, 520))
    const alt = escapeHtmlText(
      careerEvolutionTextAlternative(renderConfig, language),
    )
    // Keep empty parallel tracks when rendering Parallel Tracks (empty-state row).
    const prepared = uniqueTracksForRender(renderConfig, {
      keepEmptyParallelTracks: layout === "parallel",
    })

    const dens = careerEvolutionDensityMetrics(renderConfig.density)
    const ctx: RenderCtx = { config: renderConfig, prepared, accent, width, alt, language, dens }

    switch (layout) {
      case "parallel":
        return renderParallelTracks(ctx)
      case "convergence":
        return renderSkillsConvergence(ctx)
      case "branching":
        return renderBranchingPathway(ctx)
      case "alignment":
        return renderEvidenceAlignment(ctx)
      case "progression":
        return renderProgressionCards(ctx)
      default:
        // Unknown layouts must not silently become Progression when Parallel was intended
        return renderProgressionCards(ctx)
    }
  } catch (err) {
    // Never let CE graph failures blank the CV editor / PDF pipeline.
    console.error("[career-evolution] SVG render failed:", err)
    const message =
      err instanceof Error ? err.message : "Career Evolution graph could not be rendered."
    const width = Math.max(280, Math.min(options.width ?? 480, 520))
    const dens = careerEvolutionDensityMetrics(config?.density)
    return wrapSvg(
      width,
      48,
      `<text x="0" y="20" font-size="11" fill="#666" font-family="${CE_SVG_FONT}">Graph unavailable — check Graph text.</text>`,
      escapeHtmlText(message),
      normalizeCareerEvolutionLayout(config?.layout),
      dens,
    )
  }
}

type RenderCtx = {
  config: CareerEvolutionConfig
  prepared: ReturnType<typeof uniqueTracksForRender>
  accent: string
  width: number
  alt: string
  language: "en" | "de"
  dens: CareerEvolutionDensityMetrics
}

// ─── 1. Progression Cards ───────────────────────────────────────────────────

function fitProgressionTitleLines(
  source: string,
  innerWidth: number,
  hasShortDisplay: boolean,
  dens: CareerEvolutionDensityMetrics,
): { lines: string[]; fontSize: number } {
  let chosen = {
    lines: wrapLabelLines(source, estimateCharsForWidth(innerWidth, dens.titleSize), 2, {
      allowEllipsis: true,
    }),
    fontSize: dens.titleSize,
  }
  for (
    let fontSize = dens.titleSize;
    fontSize >= dens.titleSizeMin - 0.01;
    fontSize -= 0.5
  ) {
    const maxChars = estimateCharsForWidth(innerWidth, fontSize)
    // Short display labels must wrap — never ellipsis-truncate in the PDF.
    const allowEllipsis =
      !hasShortDisplay && fontSize <= dens.titleSizeMin + 0.01
    const lines = wrapLabelLines(source, maxChars, 2, { allowEllipsis })
    chosen = { lines, fontSize }
    if (!lines.some((l) => l.endsWith("…"))) break
  }
  if (!chosen.lines.length) {
    chosen.lines = [source.slice(0, Math.max(4, estimateCharsForWidth(innerWidth, chosen.fontSize)))]
  }
  return chosen
}

function renderProgressionCards(ctx: RenderCtx): string {
  // One horizontal sequence of career stages — never a second concurrent track row.
  const tracks = ctx.prepared.tracks
  const primaryTrack =
    tracks.find(
      (t) =>
        !isParallelCareerEvolutionTrack(t) &&
        /experience|employment|beruf|professional/i.test(t.label),
    ) || tracks.find((t) => !isParallelCareerEvolutionTrack(t)) ||
    tracks[0]
  const primaryMs = primaryTrack
    ? ctx.prepared.milestones.filter(
        (m) =>
          (m.trackId || primaryTrack.id) === primaryTrack.id &&
          !isParallelCareerEvolutionTrack(
            tracks.find((t) => t.id === m.trackId) || { id: "", label: "" },
          ),
      )
    : ctx.prepared.milestones.filter((m) => {
        const track = tracks.find((t) => t.id === m.trackId)
        return !track || !isParallelCareerEvolutionTrack(track)
      })
  const stages = sortChronological(
    primaryMs.length > 0 ? primaryMs : ctx.prepared.milestones,
  ).slice(0, 5)
  if (!stages.length) return ""
  const dens = ctx.dens
  const pad = 0
  const usable = ctx.width - pad * 2
  const gap = dens.gap
  const n = stages.length
  const cardW = Math.max(48, (usable - gap * Math.max(n - 1, 0)) / n)
  const innerW = Math.max(24, cardW - dens.padX * 2)

  type CardPlan = {
    m: CareerEvolutionMilestone
    date: string
    dateFull: string
    lines: string[]
    fontSize: number
    fullLabel: string
    contentH: number
  }

  // Narrow card rows (3+) always use year-only on the graph so dates never clip
  // mid-token (e.g. "2016-12-2019-" / "2023-11-prese"). Full form stays in <title>.
  const forceCompactDates =
    n >= 3 ||
    dens.density !== "standard" ||
    ctx.config.dateDisplay === "compact" ||
    innerW < 110
  const dateFontSize =
    n >= 4 ? Math.min(dens.dateSize, dens.density === "standard" ? 8 : 7.5) : dens.dateSize

  const plans: CardPlan[] = stages.map((m) => {
    let dateFmt = formatDateLabel(m.start, m.end, {
      language: ctx.language,
      density: dens.density,
      dateDisplay: ctx.config.dateDisplay,
      forceCompact: forceCompactDates,
    })
    // If a Full preference somehow still overflows the card, fall back to compact.
    if (
      dateFmt.display &&
      !progressionDateFits(dateFmt.display, innerW, dateFontSize)
    ) {
      dateFmt = formatDateLabel(m.start, m.end, {
        language: ctx.language,
        density: dens.density,
        dateDisplay: "compact",
        forceCompact: true,
      })
    }
    const { linesSource, fullLabel, hasShortDisplay } = milestoneCardLabel(m)
    const { lines, fontSize } = fitProgressionTitleLines(
      linesSource,
      innerW,
      hasShortDisplay,
      dens,
    )
    const dateBlock = dateFmt.display
      ? dateFontSize + dens.dateToTitleGap
      : 0
    const titleBlock = lines.length * fontSize * dens.titleLineHeight
    const contentH = dens.padY * 2 + dateBlock + titleBlock
    return {
      m,
      date: dateFmt.display,
      dateFull: dateFmt.full,
      lines,
      fontSize,
      fullLabel,
      contentH,
    }
  })

  const cardH = Math.max(
    dens.minCardH,
    ...plans.map((p) => Math.ceil(p.contentH)),
  )

  const parts: string[] = []
  let y = 2

  plans.forEach((plan, i) => {
    const x = pad + i * (cardW + gap)
    const isLast = i === n - 1
    const fill = isLast ? ctx.accent : accentRgba(ctx.accent, 0.07)
    const stroke = isLast ? ctx.accent : accentRgba(ctx.accent, 0.28)
    const textFill = isLast ? "#ffffff" : "#1a1a1a"
    const dateFill = isLast ? "rgba(255,255,255,0.82)" : "#6b6b6b"
    const textX = x + dens.padX
    // Top-align dates/titles consistently inside equal-height cards
    let cursorY = y + dens.padY

    parts.push(
      `<g data-ce-milestone="${escapeHtmlText(plan.m.id)}" data-ce-card="1">`,
    )
    parts.push(
      `<rect x="${x.toFixed(2)}" y="${y}" width="${cardW.toFixed(2)}" height="${cardH}" rx="${dens.rx}" fill="${fill}" stroke="${stroke}" stroke-width="0.75"/>`,
    )
    // Accessible full labels when title or date is shortened
    const titleParts: string[] = []
    if (plan.fullLabel && (plan.m.displayLabel || plan.lines.some((l) => l.endsWith("…")))) {
      titleParts.push(plan.fullLabel)
    }
    if (plan.dateFull && plan.dateFull !== plan.date) {
      titleParts.push(plan.dateFull)
    }
    if (titleParts.length) {
      parts.push(`<title>${escapeHtmlText(titleParts.join(" · "))}</title>`)
    }

    if (plan.date) {
      cursorY += dateFontSize
      // Dates never use ellipsis or mid-token slice — only complete compact/full labels
      parts.push(
        `<text x="${textX.toFixed(2)}" y="${cursorY.toFixed(2)}" font-size="${dateFontSize}" font-weight="400" font-family="${CE_SVG_FONT}" fill="${dateFill}" xml:space="preserve">${escapeHtmlText(plan.date)}</text>`,
      )
      cursorY += dens.dateToTitleGap
    }

    const lineStep = plan.fontSize * dens.titleLineHeight
    plan.lines.forEach((line, lineIndex) => {
      cursorY += lineIndex === 0 ? plan.fontSize : lineStep
      parts.push(
        `<text x="${textX.toFixed(2)}" y="${cursorY.toFixed(2)}" font-size="${plan.fontSize}" font-weight="600" font-family="${CE_SVG_FONT}" fill="${textFill}" xml:space="preserve">${escapeHtmlText(line)}</text>`,
      )
    })
    parts.push(`</g>`)
  })
  y += cardH + dens.gap

  // Optional parallel footnote when Show parallel work is on (not a second card row)
  const parallelTrack = tracks.find(
    (t) =>
      primaryTrack &&
      t.id !== primaryTrack.id &&
      isParallelCareerEvolutionTrack(t),
  )
  const parallelMs =
    careerEvolutionShowParallelWork(ctx.config) && parallelTrack
      ? ctx.prepared.milestones.filter((m) => m.trackId === parallelTrack.id)
      : []
  if (parallelMs.length && ctx.config.showConnectionIcon !== false) {
    const p = parallelMs[parallelMs.length - 1]!
    const noteSource = p.description || p.label
    const noteDate = formatDateLabel(p.start, p.end, {
      maxChars: 14,
      language: ctx.language,
      density: ctx.config.density,
      dateDisplay: ctx.config.dateDisplay,
    })
    const noteInner = noteDate.display
      ? `${noteSource} · ${noteDate.display}`
      : noteSource
    const noteLines = wrapLabelLines(`Parallel research: ${noteInner}`, 58, 2, {
      allowEllipsis: false,
    })
    parts.push(lucideGitMergeIcon(pad, y, ctx.accent, dens.density === "standard" ? 11 : 10))
    if (ctx.config.showConnectionLabels !== false) {
      const noteFs = dens.connectionLabelSize
      noteLines.forEach((line, i) => {
        parts.push(
          `<text x="${pad + 16}" y="${y + 10 + i * (noteFs + 2)}" font-size="${noteFs}" font-family="${CE_SVG_FONT}" fill="${escapeHtmlText(ctx.accent)}">${escapeHtmlText(line)}</text>`,
        )
      })
    }
    y += 10 + Math.max(noteLines.length, 1) * (dens.connectionLabelSize + 3)
  }

  return wrapSvg(
    ctx.width,
    Math.min(y + 2, dens.maxHeightPx),
    parts.join(""),
    ctx.alt,
    "progression",
    dens,
  )
}

// ─── 2. Parallel Tracks ─────────────────────────────────────────────────────

/**
 * Two distinct horizontal rows — never Progression Cards, never a single
 * chronological strip that appends parallel work as another employment card.
 */
/** Fit a parallel-track capsule title: wrap to 2 lines, shrink before ellipsis. */
function fitParallelCapsuleTitle(
  source: string,
  innerWidth: number,
  hasShortDisplay: boolean,
  dens: CareerEvolutionDensityMetrics,
): { lines: string[]; fontSize: number } {
  const maxSize = dens.parallelTitleMax
  const minSize = dens.parallelTitleMin
  let chosen = {
    lines: wrapLabelLines(source, estimateCharsForWidth(innerWidth, maxSize), 2, {
      allowEllipsis: false,
    }),
    fontSize: maxSize,
  }
  for (let fontSize = maxSize; fontSize >= minSize - 0.01; fontSize -= 0.5) {
    const maxChars = estimateCharsForWidth(innerWidth, fontSize)
    // Short display labels must wrap — never ellipsis-truncate in the PDF.
    const allowEllipsis = !hasShortDisplay && fontSize <= minSize + 0.01
    const lines = wrapLabelLines(source, maxChars, 2, { allowEllipsis })
    chosen = { lines, fontSize }
    if (!lines.some((l) => l.endsWith("…"))) break
  }
  if (!chosen.lines.length) {
    chosen.lines = wrapLabelLines(source, estimateCharsForWidth(innerWidth, chosen.fontSize), 2, {
      allowEllipsis: false,
    })
  }
  return chosen
}

function renderParallelCapsuleTitleTexts(
  lines: string[],
  fontSize: number,
  x: number,
  startY: number,
): string {
  const step = fontSize * 1.18
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${(startY + i * step).toFixed(1)}" font-size="${fontSize}" font-weight="600" fill="#1a1a1a" font-family="${CE_SVG_FONT}">${escapeHtmlText(line)}</text>`,
    )
    .join("")
}

/** Prefer Professional Experience over Education / projects for the primary row. */
function pickPrimaryEmploymentTrack(
  tracks: CareerEvolutionTrack[],
): CareerEvolutionTrack | undefined {
  const nonParallel = tracks.filter((t) => !isParallelCareerEvolutionTrack(t))
  if (nonParallel.length === 0) return undefined
  const preferred = nonParallel.find((t) =>
    /experience|employment|beruf|professional|career|anstellung/i.test(t.label),
  )
  return preferred || nonParallel[0]
}

function renderParallelTracks(ctx: RenderCtx): string {
  const milestones = ctx.prepared.milestones
  const allTracks = [...ctx.prepared.tracks]

  // Root cause of empty Independent Work: with 3+ tracks (Experience + Education +
  // Independent), a naive slice(0, 2) kept Education and dropped Independent.
  // Always pair the employment track with the parallel/independent track.
  const track0 =
    pickPrimaryEmploymentTrack(allTracks) ||
    ({ id: "track-employment", label: "Professional Experience" } satisfies CareerEvolutionTrack)
  const parallelTrack =
    allTracks.find(
      (t) => t.id !== track0.id && isParallelCareerEvolutionTrack(t),
    ) ||
    ({
      id: CAREER_EVOLUTION_INDEPENDENT_TRACK_ID,
      label: ctx.language === "de" ? "Unabhängige Arbeit" : "Independent work",
    } satisfies CareerEvolutionTrack)

  const on0 = sortChronological(
    milestones.filter((m) => (m.trackId || track0.id) === track0.id),
  )
  const on1 = sortChronological(
    milestones.filter((m) => m.trackId === parallelTrack.id),
  )

  const dens = ctx.dens
  const pad = 0
  const usable = ctx.width - pad * 2
  // Tall enough for optional date + two wrapped title lines (no mid-word cut-off).
  const capsuleH = dens.capsuleH
  const gap = dens.parallelGap
  const parts: string[] = []
  let y = 2

  // ── Row 1: primary professional career ──────────────────────────────────
  parts.push(
    `<g data-ce-track="${escapeHtmlText(track0.id)}" data-ce-track-label="${escapeHtmlText(track0.label)}" data-ce-parallel-primary="1">`,
  )
  parts.push(
    `<text x="${pad}" y="${y + 9}" font-size="${dens.trackLabelSize}" font-weight="600" letter-spacing="0.04em" font-family="${CE_SVG_FONT}" fill="#666666">${escapeHtmlText(safeText(track0.label, "Track").toUpperCase())}</text>`,
  )
  y += dens.density === "standard" ? 15 : 13
  const n0 = Math.max(on0.length, 1)
  const w0 = (usable - gap * Math.max(n0 - 1, 0)) / n0
  if (on0.length === 0) {
    parts.push(
      `<rect x="${pad}" y="${y}" width="${usable}" height="${capsuleH}" rx="${dens.rx}" fill="${accentRgba(ctx.accent, 0.06)}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.2" stroke-width="0.75"/>`,
    )
  } else {
    on0.forEach((m, i) => {
      const x = pad + i * (w0 + gap)
      const fill = accentRgba(ctx.accent, 0.1 + (i / Math.max(n0 - 1, 1)) * 0.18)
      const innerW = Math.max(20, w0 - 14)
      const date = formatDateLabel(m.start, m.end, {
        maxChars: Math.max(10, Math.floor(innerW / (dens.dateSize * 0.62))),
        language: ctx.language,
        density: dens.density,
        dateDisplay: ctx.config.dateDisplay,
        forceCompact: dens.density === "compact",
      })
      const { linesSource, fullLabel, hasShortDisplay } = milestoneCardLabel(m)
      const { lines, fontSize } = fitParallelCapsuleTitle(
        linesSource,
        innerW,
        hasShortDisplay,
        dens,
      )
      parts.push(
        `<g data-ce-milestone="${escapeHtmlText(m.id)}"><rect x="${x}" y="${y}" width="${w0}" height="${capsuleH}" rx="${dens.rx}" fill="${fill}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.3" stroke-width="0.75"/>`,
      )
      const tipParts: string[] = []
      if (fullLabel && (hasShortDisplay || lines.some((l) => l.endsWith("…")))) {
        tipParts.push(fullLabel)
      }
      if (date.full && date.full !== date.display) tipParts.push(date.full)
      if (tipParts.length) {
        parts.push(`<title>${escapeHtmlText(tipParts.join(" · "))}</title>`)
      }
      if (date.display) {
        parts.push(
          `<text x="${x + 7}" y="${y + 11}" font-size="${dens.dateSize}" fill="#6b6b6b" font-family="${CE_SVG_FONT}">${escapeHtmlText(date.display)}</text>`,
        )
      }
      const titleY = y + (date.display ? dens.dateSize + 12 : 13)
      parts.push(`${renderParallelCapsuleTitleTexts(lines, fontSize, x + 7, titleY)}</g>`)
    })
  }
  parts.push(`</g>`)
  y += capsuleH + (dens.density === "standard" ? 6 : 4)

  // ── Relationship + second row: only when parallel milestones exist ──────
  // Never print editor instructions ("Mark a role under Edit…") on the CV/PDF.
  // If nothing is classified/derived for the independent track, show employment only.
  const showSecond =
    careerEvolutionShowParallelWork(ctx.config) && on1.length > 0
  if (showSecond) {
    const conn = ctx.config.connections.find((c) => c.approved !== false)
    const relLabel =
      conn?.label && !/^growth$|^entwicklung$/i.test(conn.label)
        ? abbreviateStageLabel(conn.label, 48)
        : ctx.language === "de"
          ? "Unabhängige Arbeit parallel zur Anstellung"
          : "Independent research alongside employment"

    if (ctx.config.showConnectionIcon !== false) {
      parts.push(`<g data-ce-relationship="1" data-ce-parallel-link="1">`)
      parts.push(lucideGitMergeIcon(pad, y, ctx.accent, dens.density === "standard" ? 11 : 10))
      if (ctx.config.showConnectionLabels !== false) {
        parts.push(
          `<text x="${pad + 16}" y="${y + 9}" font-size="${dens.connectionLabelSize}" fill="#555" font-family="${CE_SVG_FONT}">${escapeHtmlText(relLabel)}</text>`,
        )
      }
      parts.push(`</g>`)
      y += dens.parallelRelGap
    }

    // ── Row 2: concurrent independent / consulting work ─────────────────
    const dateSpan = formatDateLabel(on1[0]!.start, on1[on1.length - 1]!.end, {
      maxChars: 18,
      language: ctx.language,
      density: dens.density,
      dateDisplay: ctx.config.dateDisplay ?? "compact",
      forceCompact: dens.density === "compact",
    }).display
    const parallelLabel = safeText(parallelTrack.label, "Independent work")
    const heading = dateSpan
      ? `${parallelLabel.toUpperCase()} · ${dateSpan}`
      : parallelLabel.toUpperCase()
    parts.push(
      `<g data-ce-track="${escapeHtmlText(parallelTrack.id)}" data-ce-track-label="${escapeHtmlText(parallelLabel)}" data-ce-parallel-track="1">`,
    )
    parts.push(
      `<text x="${pad}" y="${y + 9}" font-size="${dens.trackLabelSize}" font-weight="600" letter-spacing="0.04em" font-family="${CE_SVG_FONT}" fill="#666666">${escapeHtmlText(heading)}</text>`,
    )
    y += dens.trackLabelSize + (dens.density === "standard" ? 5 : 4)

    if (on1.length === 1) {
      const m = on1[0]!
      const date = formatDateLabel(m.start, m.end, {
        maxChars: 16,
        language: ctx.language,
        density: ctx.config.density,
        dateDisplay: ctx.config.dateDisplay ?? "compact",
        forceCompact: true,
      })
      const { linesSource, fullLabel, hasShortDisplay } = milestoneCardLabel(m)
      const description = safeText(m.description)
      const labelSource = description
        ? `${linesSource} · ${description}`
        : linesSource
      const { lines, fontSize } = fitParallelCapsuleTitle(
        labelSource,
        Math.max(40, usable - 20),
        hasShortDisplay,
        dens,
      )
      parts.push(
        `<g data-ce-milestone="${escapeHtmlText(m.id)}"><rect x="${pad}" y="${y}" width="${usable}" height="${capsuleH}" rx="${dens.rx}" fill="${accentRgba(ctx.accent, 0.12)}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.35" stroke-width="0.75"/>`,
      )
      const tip = [fullLabel, m.description, date.full].filter(Boolean).join(" · ")
      if (tip) {
        parts.push(`<title>${escapeHtmlText(tip)}</title>`)
      }
      if (date.display) {
        parts.push(
          `<text x="${pad + 10}" y="${y + 12}" font-size="${dens.dateSize}" fill="#6b6b6b" font-family="${CE_SVG_FONT}">${escapeHtmlText(date.display)}</text>`,
        )
      }
      const titleY = y + (date.display ? dens.dateSize + 13 : 14)
      parts.push(`${renderParallelCapsuleTitleTexts(lines, fontSize, pad + 10, titleY)}</g>`)
    } else {
      const n1 = on1.length
      const w1 = (usable - gap * (n1 - 1)) / n1
      on1.forEach((m, i) => {
        const x = pad + i * (w1 + gap)
        const innerW = Math.max(20, w1 - 16)
        const date = formatDateLabel(m.start, m.end, {
          maxChars: Math.max(10, Math.floor(innerW / (dens.dateSize * 0.62))),
          language: ctx.language,
          density: ctx.config.density,
          dateDisplay: ctx.config.dateDisplay ?? "compact",
          forceCompact: true,
        })
        const { linesSource, fullLabel, hasShortDisplay } = milestoneCardLabel(m)
        const { lines, fontSize } = fitParallelCapsuleTitle(
          linesSource,
          innerW,
          hasShortDisplay,
          dens,
        )
        parts.push(
          `<g data-ce-milestone="${escapeHtmlText(m.id)}"><rect x="${x}" y="${y}" width="${w1}" height="${capsuleH}" rx="${dens.rx}" fill="${accentRgba(ctx.accent, 0.12)}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.35" stroke-width="0.75"/>`,
        )
        if (fullLabel && (hasShortDisplay || lines.some((l) => l.endsWith("…")))) {
          parts.push(`<title>${escapeHtmlText(fullLabel)}</title>`)
        }
        if (date.display) {
          parts.push(
            `<text x="${x + 8}" y="${y + 12}" font-size="${dens.dateSize}" fill="#6b6b6b" font-family="${CE_SVG_FONT}">${escapeHtmlText(date.display)}</text>`,
          )
        }
        const titleY = y + (date.display ? dens.dateSize + 13 : 14)
        parts.push(`${renderParallelCapsuleTitleTexts(lines, fontSize, x + 8, titleY)}</g>`)
      })
    }
    parts.push(`</g>`)
    y += capsuleH + (dens.density === "standard" ? 6 : 4)
  }

  return wrapSvg(
    ctx.width,
    Math.min(y, dens.twoTrackMaxPx),
    parts.join(""),
    ctx.alt,
    "parallel",
    dens,
  )
}

// ─── 3. Skills Convergence ──────────────────────────────────────────────────

/**
 * Fit wrapped label into a pill: shrink type before adding lines; never ellipsis.
 * Uses a bold-safe glyph width so Standard density does not paint past the rect.
 */
function fitConvergenceLabel(
  source: string | null | undefined,
  innerWidth: number,
  maxFont: number,
  minFont: number,
  maxLines: number,
  options?: { bold?: boolean },
): { lines: string[]; fontSize: number } {
  const text = safeText(source)
  if (!text) return { lines: [], fontSize: maxFont }
  // Bold / semibold Inter runs wider than the regular 0.52em average used elsewhere.
  const glyphEm = options?.bold ? 0.62 : 0.58
  const linesFit = (candidate: string[], fontSize: number) =>
    candidate.length > 0 &&
    candidate.every(
      (line) => estimateLineWidthPx(line, fontSize, glyphEm) <= innerWidth + 0.5,
    )

  let fontSize = maxFont
  let lines: string[] = []
  for (; fontSize >= minFont - 0.01; fontSize -= 0.5) {
    lines = wrapLabelLines(
      text,
      estimateCharsForWidth(innerWidth, fontSize, glyphEm),
      maxLines,
      { allowEllipsis: false },
    )
    const joined = lines.join(" ").replace(/\s+/g, " ").trim()
    if (joined === text && linesFit(lines, fontSize)) return { lines, fontSize }
  }
  // Still long after min font — keep complete words; drop a trailing phrase rather
  // than mid-word cuts or ellipsis. Re-check pixel width and tighten if needed.
  let chars = estimateCharsForWidth(innerWidth, minFont, glyphEm)
  for (let guard = 0; guard < 8; guard += 1) {
    lines = wrapLabelLines(text, chars, maxLines, { allowEllipsis: false })
    if (linesFit(lines, minFont)) break
    chars = Math.max(4, chars - 2)
  }
  return { lines: lines.length ? lines : [text], fontSize: minFont }
}

function renderSkillsConvergence(ctx: RenderCtx): string {
  const caps = capabilitiesForRender(ctx.config)
  if (caps.length < 2) {
    // Never silently fall back to Progression — empty until capabilities exist
    return ""
  }
  const dens = ctx.dens
  const streams = caps.slice(0, 6)
  // Standard needs wider pills + more padding so bold labels stay inside the stroke.
  const leftW = dens.density === "standard" ? 198 : 168
  const rightW = dens.density === "standard" ? 205 : 172
  const padX = dens.density === "standard" ? 12 : 8
  // Tighter padding when stacking 5–6 boxes so print height stays within budget.
  const padY =
    streams.length >= 5
      ? dens.density === "standard"
        ? 5
        : 3
      : dens.density === "standard"
        ? 8
        : 5
  const gap =
    streams.length >= 5
      ? Math.max(2, dens.convGap - 2)
      : dens.convGap
  const leftX = 0
  const rightX = ctx.width - rightW
  const midX = (leftW + rightX) / 2
  const leftInner = Math.max(24, leftW - padX * 2)
  const rightInner = Math.max(24, rightW - padX * 2)
  const startY = dens.density === "standard" ? 8 : 6
  const maxCapLines = streams.length >= 5 ? 2 : dens.density === "standard" ? 3 : 2
  const minCapFont = dens.density === "standard" ? 7 : 7
  const minTargetFont = dens.density === "standard" ? 7.5 : 7

  const capPlans = streams.map((c) => {
    const resolved = capabilityLabelForRender(ctx.config, c)
    const fit = fitConvergenceLabel(
      resolved.label,
      leftInner,
      dens.convFont,
      minCapFont,
      maxCapLines,
      { bold: true },
    )
    const lineStep = fit.fontSize * 1.22
    const textBlock = fit.lines.length * lineStep
    const rowH = Math.max(dens.convRowH, padY * 2 + textBlock + 2)
    return {
      cap: c,
      displayLabel: resolved.label,
      fullLabel: resolved.fullLabel,
      ...fit,
      lineStep,
      rowH,
    }
  })

  const targetSource = convergenceTargetLabel(ctx.config)
  const targetFit = fitConvergenceLabel(
    targetSource,
    rightInner,
    dens.convTargetFont,
    minTargetFont,
    dens.density === "standard" ? 3 : 2,
    { bold: true },
  )
  const targetLineStep = targetFit.fontSize * 1.22
  const targetTextBlock = Math.max(1, targetFit.lines.length) * targetLineStep
  const targetH = Math.max(dens.convTargetH, padY * 2 + targetTextBlock + 4)

  // Stack left pills with variable heights
  const ys: number[] = []
  let cursor = startY
  for (const plan of capPlans) {
    ys.push(cursor)
    cursor += plan.rowH + gap
  }
  const totalH = cursor - startY - gap
  const targetY = startY + Math.max(0, totalH / 2 - targetH / 2)
  const parts: string[] = []

  capPlans.forEach((plan, i) => {
    const y = ys[i]!
    const cy = y + plan.rowH / 2
    const textX = leftX + padX
    let textCursor = y + padY
    const titleAttrs = `font-size="${plan.fontSize}" font-weight="600" fill="#1a3a34" font-family="${CE_SVG_FONT}"`
    const lineTexts = plan.lines
      .map((line, lineIndex) => {
        textCursor += lineIndex === 0 ? plan.fontSize : plan.lineStep
        return `<text x="${textX}" y="${textCursor.toFixed(1)}" ${titleAttrs} xml:space="preserve">${escapeHtmlText(line)}</text>`
      })
      .join("")
    const tip =
      plan.fullLabel && plan.fullLabel !== plan.displayLabel
        ? plan.fullLabel
        : plan.displayLabel
    parts.push(
      `<g data-ce-capability="${escapeHtmlText(plan.cap.id)}"><title>${escapeHtmlText(tip)}</title><rect x="${leftX}" y="${y}" width="${leftW}" height="${plan.rowH}" rx="${dens.rx}" fill="${accentRgba(ctx.accent, 0.14)}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.35" stroke-width="0.75"/>${lineTexts}</g>`,
    )
    parts.push(
      `<path d="M ${leftX + leftW} ${cy} C ${midX} ${cy}, ${midX} ${targetY + targetH / 2}, ${rightX} ${targetY + targetH / 2}" fill="none" stroke="${escapeHtmlText(ctx.accent)}" stroke-width="${dens.density === "standard" ? 1.5 : 1.25}" stroke-opacity="0.7"/>`,
    )
  })

  {
    const textX = rightX + rightW / 2
    let textCursor = targetY + (targetH - targetTextBlock) / 2
    const titleAttrs = `text-anchor="middle" font-size="${targetFit.fontSize}" font-weight="700" fill="#ffffff" font-family="${CE_SVG_FONT}"`
    const lineTexts = targetFit.lines
      .map((line, lineIndex) => {
        textCursor += lineIndex === 0 ? targetFit.fontSize : targetLineStep
        return `<text x="${textX}" y="${textCursor.toFixed(1)}" ${titleAttrs} xml:space="preserve">${escapeHtmlText(line)}</text>`
      })
      .join("")
    parts.push(
      `<g data-ce-convergence-target="1"><title>${escapeHtmlText(targetSource)}</title><rect x="${rightX}" y="${targetY}" width="${rightW}" height="${targetH}" rx="6" fill="${escapeHtmlText(ctx.accent)}"/>${lineTexts}</g>`,
    )
  }

  const height = Math.min(
    Math.max(startY + totalH + 12, targetY + targetH + 8),
    dens.maxHeightPx,
  )
  return wrapSvg(
    ctx.width,
    height,
    parts.join(""),
    ctx.alt,
    "convergence",
    dens,
  )
}

// ─── 4. Branching Pathway ───────────────────────────────────────────────────

/** Max label width for a node, based on spacing to neighbours (avoids overlap). */
function branchingLabelWidthPx(
  xs: number[],
  index: number,
  padX: number,
  totalWidth: number,
): number {
  const x = xs[index]!
  const left = index === 0 ? padX : (xs[index - 1]! + x) / 2
  const right =
    index === xs.length - 1 ? totalWidth - padX : (x + xs[index + 1]!) / 2
  // Keep a small gutter so adjacent labels do not collide
  return Math.max(56, right - left - 8)
}

function branchingLabelTexts(
  labelSource: string,
  widthPx: number,
  fontSize: number,
): { lines: string[]; usedEllipsis: boolean } {
  const maxChars = estimateCharsForWidth(widthPx, fontSize)
  // Prefer wrapping the full title over hard truncation.
  const fullFit = wrapLabelLines(labelSource, maxChars, 2, { allowEllipsis: false })
  const joined = fullFit.join(" ").replace(/\s+/g, " ").trim()
  const sourceNorm = labelSource.replace(/\s+/g, " ").trim()
  if (joined === sourceNorm || fullFit.join("").replace(/\s+/g, "") === sourceNorm.replace(/\s+/g, "")) {
    return { lines: fullFit, usedEllipsis: false }
  }
  // Still too long for two lines — allow ellipsis on the last line only
  return {
    lines: wrapLabelLines(labelSource, maxChars, 2, { allowEllipsis: true }),
    usedEllipsis: true,
  }
}

function renderBranchingPathway(ctx: RenderCtx): string {
  const tracks = ctx.prepared.tracks
  const primaryTrack =
    tracks.find((t) => !isParallelCareerEvolutionTrack(t)) || tracks[0]
  const primaryId = primaryTrack?.id
  const branchTrack = careerEvolutionShowParallelWork(ctx.config)
    ? tracks.find((t) => t.id !== primaryId && isParallelCareerEvolutionTrack(t)) ||
      tracks.find((t) => t.id !== primaryId)
    : undefined
  const primary = sortChronological(
    ctx.prepared.milestones.filter((m) => !primaryId || m.trackId === primaryId),
  ).slice(0, 5)
  if (primary.length < 1) return ""

  const dens = ctx.dens
  const padX = dens.density === "standard" ? 32 : 28
  const usable = ctx.width - padX * 2
  const labelFont = dens.branchLabelFont
  const labelLineH = dens.branchLabelLineH
  const mainY = dens.branchMainY
  const branchY = dens.branchY
  const parts: string[] = []

  parts.push(
    `<line x1="${padX}" y1="${mainY}" x2="${padX + usable}" y2="${mainY}" stroke="${escapeHtmlText(ctx.accent)}" stroke-width="1.75" stroke-opacity="0.55"/>`,
  )

  const xs = primary.map((_, i) =>
    padX + (primary.length === 1 ? usable / 2 : (i / (primary.length - 1)) * usable),
  )

  let maxLabelLines = 1

  primary.forEach((m, i) => {
    const x = xs[i]!
    const { linesSource, fullLabel, hasShortDisplay } = milestoneCardLabel(m)
    const widthPx = branchingLabelWidthPx(xs, i, padX, ctx.width)
    const { lines, usedEllipsis } = branchingLabelTexts(linesSource, widthPx, labelFont)
    maxLabelLines = Math.max(maxLabelLines, lines.length)
    const date = formatDateLabel(m.start, m.end, {
      maxChars: 12,
      language: ctx.language,
      density: ctx.config.density,
      dateDisplay: ctx.config.dateDisplay ?? "compact",
      forceCompact: true,
    })
    const tipLabel = hasShortDisplay || usedEllipsis ? fullLabel : linesSource
    const tip =
      tipLabel || date.full
        ? `<title>${escapeHtmlText(
            [tipLabel, date.full].filter(Boolean).join(" · "),
          )}</title>`
        : ""
    const labelBlock = lines
      .map((line, li) => {
        const y = mainY - 10 - (lines.length - 1 - li) * labelLineH
        return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${labelFont}" font-weight="600" fill="#1a1a1a" font-family="${CE_SVG_FONT}">${escapeHtmlText(line)}</text>`
      })
      .join("")
    parts.push(
      `<g data-ce-milestone="${escapeHtmlText(m.id)}">${tip}<circle cx="${x}" cy="${mainY}" r="4.5" fill="${escapeHtmlText(ctx.accent)}"/>${labelBlock}${
        date.display
          ? `<text x="${x}" y="${mainY + dens.dateSize + 6}" text-anchor="middle" font-size="${dens.dateSize}" fill="#6b6b6b" font-family="${CE_SVG_FONT}">${escapeHtmlText(date.display)}</text>`
          : ""
      }</g>`,
    )
  })

  if (branchTrack) {
    const branchMs = sortChronological(
      ctx.prepared.milestones.filter((m) => m.trackId === branchTrack.id),
    )
    if (branchMs.length) {
      // Branch from second node when available, else first
      const forkIdx = Math.min(1, primary.length - 1)
      const forkX = xs[forkIdx]!
      const b = branchMs[0]!
      const branchX = Math.min(forkX + usable * 0.35, padX + usable - 8)
      const { linesSource, fullLabel, hasShortDisplay } = milestoneCardLabel(b)
      // Branch sits toward the right — use space from fork to the right edge
      const branchWidthPx = Math.max(72, padX + usable - branchX + usable * 0.2)
      const { lines, usedEllipsis } = branchingLabelTexts(
        linesSource,
        Math.min(branchWidthPx, usable * 0.55),
        labelFont,
      )
      const branchDate = formatDateLabel(b.start, b.end, {
        maxChars: 12,
        language: ctx.language,
        density: ctx.config.density,
        dateDisplay: ctx.config.dateDisplay ?? "compact",
        forceCompact: true,
      })
      const tipLabel = hasShortDisplay || usedEllipsis ? fullLabel : linesSource
      const branchTip =
        tipLabel || branchDate.full
          ? `<title>${escapeHtmlText(
              [tipLabel, branchDate.full].filter(Boolean).join(" · "),
            )}</title>`
          : ""
      parts.push(
        `<path d="M ${forkX} ${mainY} C ${forkX} ${branchY}, ${forkX + 20} ${branchY}, ${branchX} ${branchY}" fill="none" stroke="${escapeHtmlText(ctx.accent)}" stroke-width="1.5" stroke-dasharray="3 2.5" stroke-opacity="0.75"/>`,
      )
      const branchLabelBlock = lines
        .map((line, li) => {
          const y = branchY + 14 + li * labelLineH
          return `<text x="${branchX}" y="${y}" text-anchor="middle" font-size="${labelFont}" font-weight="600" fill="#1a1a1a" font-family="${CE_SVG_FONT}">${escapeHtmlText(line)}</text>`
        })
        .join("")
      const dateY = branchY + 14 + lines.length * labelLineH + 2
      parts.push(
        `<g data-ce-milestone="${escapeHtmlText(b.id)}" data-ce-track="${escapeHtmlText(branchTrack.id)}">${branchTip}<circle cx="${branchX}" cy="${branchY}" r="4.5" fill="${escapeHtmlText(ctx.accent)}"/>${branchLabelBlock}${
          branchDate.display
            ? `<text x="${branchX}" y="${dateY}" text-anchor="middle" font-size="${dens.dateSize}" fill="#6b6b6b" font-family="${CE_SVG_FONT}">${escapeHtmlText(branchDate.display)}</text>`
            : ""
        }</g>`,
      )
      const h = Math.min(
        Math.max(dateY + 8, (dens.density === "standard" ? 112 : 96) + (maxLabelLines > 1 ? 8 : 0)),
        dens.maxHeightPx,
      )
      return wrapSvg(ctx.width, h, parts.join(""), ctx.alt, "branching", dens)
    }
  }

  const h = Math.min(
    (dens.density === "standard" ? 68 : 56) + (maxLabelLines > 1 ? 12 : 0),
    dens.maxHeightPx,
  )
  return wrapSvg(ctx.width, h, parts.join(""), ctx.alt, "branching", dens)
}

// ─── 5. Evidence-to-Role Alignment ───────────────────────────────────────────

function renderEvidenceAlignment(ctx: RenderCtx): string {
  const rows = alignmentsForRender(ctx.config)
  if (rows.length < 1) {
    // Never fall back to Progression Cards — editor offers generation instead
    return ""
  }
  const dens = ctx.dens
  const maxLines = 2
  const arrowW = dens.density === "standard" ? 22 : 18
  const colGap = dens.density === "standard" ? 10 : 8
  const display = rows.slice(0, 4)
  const usable = ctx.width - arrowW - colGap * 2
  const leftW = Math.floor(usable * 0.48)
  const rightW = usable - leftW
  const leftX = 0
  const arrowX = leftX + leftW + colGap
  const rightX = arrowX + arrowW + colGap
  const parts: string[] = []
  let y = 2

  // Compact column cues (not dates)
  const evidenceHeader =
    ctx.language === "de" ? "Evidenz" : "Evidence"
  const requirementHeader =
    ctx.language === "de" ? "Anforderung" : "Requirement"
  const headerFs = dens.trackLabelSize
  parts.push(
    `<text x="${leftX + 2}" y="${y + 8}" font-size="${headerFs}" font-weight="600" letter-spacing="0.04em" fill="#888888" font-family="${CE_SVG_FONT}">${escapeHtmlText(evidenceHeader.toUpperCase())}</text>`,
    `<text x="${rightX + 2}" y="${y + 8}" font-size="${headerFs}" font-weight="600" letter-spacing="0.04em" fill="#888888" font-family="${CE_SVG_FONT}">${escapeHtmlText(requirementHeader.toUpperCase())}</text>`,
  )
  y += headerFs + (dens.density === "standard" ? 5 : 4)

  const leftMaxChars = Math.max(12, Math.floor(leftW / (dens.alignFontSize * 0.52)))
  const rightMaxChars = Math.max(12, Math.floor(rightW / (dens.alignFontSize * 0.52)))

  display.forEach((row) => {
    const leftLines = wrapLabelLines(row.evidenceLabel, leftMaxChars, maxLines, {
      allowEllipsis: true,
    })
    const rightLines = wrapLabelLines(
      row.requirementLabel,
      rightMaxChars,
      maxLines,
      { allowEllipsis: true },
    )
    const lineCount = Math.max(leftLines.length, rightLines.length, 1)
    const textH = lineCount * dens.alignFontSize * dens.alignLineHeight
    const rowH = Math.max(dens.alignRowMinH, textH + dens.alignRowPadY * 2)
    const textBase = y + dens.alignRowPadY + dens.alignFontSize
    const midY = y + rowH / 2

    const tip = row.evidenceRef
      ? `<title>${escapeHtmlText(
          `${row.evidenceLabel} → ${row.requirementLabel}${
            row.matchType ? ` (${row.matchType})` : ""
          } · ${row.evidenceRef}`,
        )}</title>`
      : `<title>${escapeHtmlText(`${row.evidenceLabel} → ${row.requirementLabel}`)}</title>`

    parts.push(`<g data-ce-alignment="${escapeHtmlText(row.id)}" data-ce-match="${escapeHtmlText(row.matchType || "")}">`)
    parts.push(tip)
    // Left: evidence
    parts.push(
      `<rect x="${leftX}" y="${y}" width="${leftW}" height="${rowH}" rx="${dens.rx}" fill="${accentRgba(ctx.accent, 0.08)}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.28" stroke-width="0.75"/>`,
    )
    leftLines.forEach((line, i) => {
      parts.push(
        `<text x="${leftX + 8}" y="${(textBase + i * dens.alignFontSize * dens.alignLineHeight).toFixed(1)}" font-size="${dens.alignFontSize}" fill="#1a1a1a" font-family="${CE_SVG_FONT}">${escapeHtmlText(line)}</text>`,
      )
    })
    // Arrow
    parts.push(
      `<text x="${arrowX + arrowW / 2}" y="${midY + 3}" text-anchor="middle" font-size="${dens.density === "standard" ? 11 : 10}" font-weight="600" fill="${escapeHtmlText(ctx.accent)}" font-family="${CE_SVG_FONT}">→</text>`,
    )
    // Right: requirement
    parts.push(
      `<rect x="${rightX}" y="${y}" width="${rightW}" height="${rowH}" rx="${dens.rx}" fill="${accentRgba(ctx.accent, 0.2)}" stroke="${escapeHtmlText(ctx.accent)}" stroke-opacity="0.4" stroke-width="0.75"/>`,
    )
    rightLines.forEach((line, i) => {
      parts.push(
        `<text x="${rightX + 8}" y="${(textBase + i * dens.alignFontSize * dens.alignLineHeight).toFixed(1)}" font-size="${dens.alignFontSize}" font-weight="600" fill="#1a3a34" font-family="${CE_SVG_FONT}">${escapeHtmlText(line)}</text>`,
      )
    })
    parts.push(`</g>`)
    y += rowH + dens.alignGap
  })

  const h = Math.min(Math.max(y, dens.density === "standard" ? 118 : 100), dens.maxHeightPx)
  return wrapSvg(ctx.width, h, parts.join(""), ctx.alt, "alignment", dens)
}
