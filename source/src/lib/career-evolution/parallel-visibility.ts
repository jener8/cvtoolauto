/**
 * Parallel-work visibility for Career Evolution — independent of layout template
 * and of Experience `[work=…]` classification persistence.
 */

import {
  listExperienceRolesForEditor,
  isParallelExperienceWorkType,
} from "@/lib/experience-work-modifier"
import { normalizeCompanyKey } from "@/lib/experience-organization"
import { splitCareerEvolutionDateRange } from "@/lib/career-evolution/date-format"
import type {
  CareerEvolutionConfig,
  CareerEvolutionMilestone,
  CareerEvolutionTrack,
} from "@/lib/career-evolution/types"
import { newCareerEvolutionId } from "@/lib/career-evolution/types"

export const CAREER_EVOLUTION_INDEPENDENT_TRACK_ID = "track-independent"

export function careerEvolutionShowParallelWork(
  config: CareerEvolutionConfig,
): boolean {
  // Legacy configs omit the field — keep prior behaviour (show when data exists).
  return config.showParallelWork !== false
}

export function isParallelCareerEvolutionTrack(track: {
  id?: string | null
  label?: string | null
}): boolean {
  const id = String(track?.id ?? "").toLowerCase()
  const label = String(track?.label ?? "").toLowerCase()
  if (
    id.includes("independent") ||
    id.includes("parallel") ||
    id.includes("neben") ||
    id === CAREER_EVOLUTION_INDEPENDENT_TRACK_ID
  ) {
    return true
  }
  return /independent|parallel|nebenberuf|freelance|consult|side\s*project|trustaudit/.test(
    label,
  )
}

export function parallelTrackIdsFrom(
  tracks: CareerEvolutionTrack[],
): Set<string> {
  return new Set(
    tracks.filter(isParallelCareerEvolutionTrack).map((t) => t.id),
  )
}

/** True when structured CE data already has a parallel/independent track with milestones. */
export function hasParallelTrackContent(config: CareerEvolutionConfig): boolean {
  const parallelIds = parallelTrackIdsFrom(config.tracks)
  if (parallelIds.size === 0) return false
  return config.milestones.some(
    (m) => Boolean(m.trackId) && parallelIds.has(m.trackId!),
  )
}

/**
 * Render-time preparation: optionally hide parallel tracks, or surface
 * confirmed Experience parallel roles onto an independent track without
 * mutating persisted graph text.
 *
 * Always merges missing classified roles when visibility is on — even if
 * some parallel content already exists — so Parallel Tracks never silently
 * looks like a single Progression row.
 */
export function prepareCareerEvolutionParallelVisibility(
  config: CareerEvolutionConfig,
  resumeText?: string,
): CareerEvolutionConfig {
  if (!careerEvolutionShowParallelWork(config)) {
    return stripParallelTracksForRender(config)
  }

  if (resumeText?.trim()) {
    return enrichParallelFromExperienceClassifications(config, resumeText)
  }

  return config
}

function stripParallelTracksForRender(
  config: CareerEvolutionConfig,
): CareerEvolutionConfig {
  const parallelIds = parallelTrackIdsFrom(config.tracks)
  if (parallelIds.size === 0) return config
  const tracks = config.tracks.filter((t) => !parallelIds.has(t.id))
  const milestones = config.milestones.filter(
    (m) => !m.trackId || !parallelIds.has(m.trackId),
  )
  const connections = config.connections.filter((c) => {
    const from = config.milestones.find((m) => m.id === c.fromMilestoneId)
    const to = config.milestones.find((m) => m.id === c.toMilestoneId)
    if (from?.trackId && parallelIds.has(from.trackId)) return false
    if (to?.trackId && parallelIds.has(to.trackId)) return false
    return true
  })
  return { ...config, tracks, milestones, connections }
}

function milestoneLooksLikeRole(
  m: CareerEvolutionMilestone,
  role: { title: string; company: string },
): boolean {
  const companyKey = role.company ? normalizeCompanyKey(role.company) : ""
  const titleKey = role.title.trim().toLowerCase()
  const blob = `${m.label} ${m.description || ""} ${m.officialTitle || ""} ${m.evidenceRef || ""}`
  const blobKey = normalizeCompanyKey(blob)
  const blobLower = blob.toLowerCase()
  if (companyKey && blobKey.includes(companyKey)) return true
  if (
    companyKey &&
    role.company &&
    blobLower.includes(role.company.toLowerCase().slice(0, 12))
  ) {
    return true
  }
  // Company-only match on description (common for Independent work cards)
  if (companyKey && normalizeCompanyKey(m.description || "") === companyKey) {
    return true
  }
  if (titleKey && titleKey.length >= 8 && blobLower.includes(titleKey.slice(0, 18))) {
    return true
  }
  return false
}

function enrichParallelFromExperienceClassifications(
  config: CareerEvolutionConfig,
  resumeText: string,
): CareerEvolutionConfig {
  const parallelRoles = listExperienceRolesForEditor(resumeText).filter((r) =>
    isParallelExperienceWorkType(r.workRelationship),
  )
  if (parallelRoles.length === 0) return config

  const independentLabel = /de/i.test(
    `${config.graphTitle || ""} ${config.sourceText || ""}`,
  )
    ? "Unabhängige Arbeit"
    : "Independent work"

  let tracks = [...config.tracks]
  let independent = tracks.find(isParallelCareerEvolutionTrack)
  if (!independent) {
    independent = {
      id: CAREER_EVOLUTION_INDEPENDENT_TRACK_ID,
      label: independentLabel,
    }
    tracks = [...tracks, independent]
  }

  const employmentTrack =
    tracks.find((t) => !isParallelCareerEvolutionTrack(t)) || tracks[0]

  const milestones = config.milestones.map((m) => ({ ...m }))
  const alreadyOnParallel = new Set(
    milestones
      .filter((m) => m.trackId === independent!.id)
      .map((m) => m.id),
  )

  for (const role of parallelRoles) {
    // Prefer remapping an existing employment-track milestone that matches the role
    const matchIndex = milestones.findIndex((m) => {
      if (alreadyOnParallel.has(m.id)) return false
      if (m.trackId === independent!.id) return false
      return milestoneLooksLikeRole(m, role)
    })

    if (matchIndex >= 0) {
      const m = milestones[matchIndex]!
      alreadyOnParallel.add(m.id)
      milestones[matchIndex] = { ...m, trackId: independent.id }
      continue
    }

    // Already represented on the parallel track?
    const onParallel = milestones.some(
      (m) => m.trackId === independent!.id && milestoneLooksLikeRole(m, role),
    )
    if (onParallel) continue

    // Add a compact milestone from the classified role (verified CV evidence only)
    const id = newCareerEvolutionId("m")
    alreadyOnParallel.add(id)
    const dateSplit = splitCareerEvolutionDateRange(role.dateText || "")
    const start = dateSplit?.start || (role.dateText || "").trim() || undefined
    const end = dateSplit?.end || start
    const roleLabel =
      String(role.title || "").trim() ||
      String(role.company || "").trim() ||
      "Role"
    milestones.push({
      id,
      label: roleLabel,
      description: role.company || undefined,
      officialTitle: roleLabel,
      start,
      end,
      trackId: independent.id,
      evidenceRef: role.company
        ? `${roleLabel} @ ${role.company}`
        : roleLabel,
      approved: true,
      milestoneKind: "formal-role",
    })
  }

  // Ensure employment milestones stay on employment track when remapped left orphans
  const employmentId = employmentTrack?.id
  const nextMilestones = milestones.map((m) => {
    if (m.trackId) return m
    return employmentId ? { ...m, trackId: employmentId } : m
  })

  // Cross-track connection for merge icon (approved, non-invented relationship)
  const employmentMs = nextMilestones.filter(
    (m) => m.trackId === employmentId,
  )
  const parallelMs = nextMilestones.filter(
    (m) => m.trackId === independent!.id,
  )
  let connections = [...config.connections]
  const hasCrossTrackLink = connections.some((c) => {
    const from = nextMilestones.find((m) => m.id === c.fromMilestoneId)
    const to = nextMilestones.find((m) => m.id === c.toMilestoneId)
    if (!from?.trackId || !to?.trackId) return false
    return from.trackId !== to.trackId && c.approved !== false
  })
  if (employmentMs.length && parallelMs.length && !hasCrossTrackLink) {
    connections = [
      ...connections,
      {
        id: newCareerEvolutionId("c"),
        fromMilestoneId: parallelMs[parallelMs.length - 1]!.id,
        toMilestoneId: employmentMs[employmentMs.length - 1]!.id,
        label: "Independent research alongside employment",
        approved: true,
        evidenceRef: "Confirmed parallel work classification",
      },
    ]
  }

  return {
    ...config,
    tracks,
    milestones: nextMilestones,
    connections,
  }
}
