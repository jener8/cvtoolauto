import { ensureAlignmentSourceText } from "@/lib/career-evolution/alignment-text"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import {
  extractCareerEvolution,
  normalizeCareerEvolutionConfig,
} from "@/lib/career-evolution/markdown"
import {
  serializeCareerEvolutionText,
} from "@/lib/career-evolution/text-syntax"
import {
  emptyCareerEvolutionConfig,
  type CareerEvolutionConfig,
} from "@/lib/career-evolution/types"

function backfillCareerEvolutionTexts(
  normalized: CareerEvolutionConfig,
): CareerEvolutionConfig {
  let next = normalized
  if (!next.sourceText?.trim() && next.milestones.length > 0) {
    next = {
      ...next,
      sourceText: serializeCareerEvolutionText(next),
    }
  }
  return ensureAlignmentSourceText(next)
}

/**
 * Prefer per-CV contactInfo store; fall back to legacy Markdown fence once.
 * Never invent content — empty config stays invisible by default.
 */
export function resolveCareerEvolutionConfig(
  contactCareerEvolution: unknown,
  resumeText: string,
): CareerEvolutionConfig {
  if (contactCareerEvolution != null && typeof contactCareerEvolution === "object") {
    return backfillCareerEvolutionTexts(
      normalizeCareerEvolutionConfig(contactCareerEvolution),
    )
  }

  const fromDoc = extractCareerEvolution(resumeText)
  if (fromDoc.config) {
    const normalized = normalizeCareerEvolutionConfig(fromDoc.config)
    return backfillCareerEvolutionTexts({
      ...normalized,
      sourceText:
        normalized.sourceText?.trim() ||
        serializeCareerEvolutionText(normalized),
    })
  }

  return emptyCareerEvolutionConfig({ visible: false })
}

/** True when the config has anything worth persisting (even if hidden). */
export function hasCareerEvolutionContent(config: CareerEvolutionConfig): boolean {
  return (
    Boolean(config.sourceText?.trim()) ||
    Boolean(config.alignmentSourceText?.trim()) ||
    config.milestones.length > 0 ||
    (config.alignments?.length || 0) > 0 ||
    (config.capabilities?.length || 0) > 0 ||
    Boolean(config.convergenceTarget?.trim()) ||
    config.connections.length > 0 ||
    config.visible === true
  )
}

/** True when there is real graph narrative (text or milestones) — not just toggles. */
export function hasMeaningfulCareerEvolutionNarrative(
  config: CareerEvolutionConfig | null | undefined,
): boolean {
  if (!config) return false
  if (config.sourceText?.trim()) return true
  return config.milestones.length > 0
}

/**
 * Manual graph-text edits that must not be overwritten by Generate without approval.
 * Empty editors and presentation-only changes do not count.
 */
export function hasUserProtectedCareerEvolutionEdits(
  config: CareerEvolutionConfig | null | undefined,
): boolean {
  if (!hasMeaningfulCareerEvolutionNarrative(config)) return false
  return (
    config!.origin === "user" ||
    config!.origin === "mixed" ||
    typeof config!.userEditedAt === "number"
  )
}

export function isCareerEvolutionSectionTitle(title: string): boolean {
  const key = normalizeCvSectionKey(title)
  if (key === "CAREER_EVOLUTION") return true
  const normalized = title.toUpperCase().trim()
  return (
    normalized.includes("CAREER EVOLUTION") ||
    normalized.includes("KARRIEREENTWICKLUNG")
  )
}

export function isPrimaryExperienceSectionTitle(title: string): boolean {
  return normalizeCvSectionKey(title) === "EXPERIENCE"
}

/**
 * Strip any Markdown CAREER EVOLUTION section and inject a synthetic one
 * at the configured position when the graph is visible.
 */
export function placeCareerEvolutionInSections<T extends { title: string }>(
  sections: T[],
  config: CareerEvolutionConfig | null | undefined,
  makeSection: () => T,
): T[] {
  // Always strip every CAREER EVOLUTION section first so we never keep a
  // markdown copy alongside the synthetic graph (duplicate timelines).
  const base = sections.filter((s) => !isCareerEvolutionSectionTitle(s.title))
  if (!config || config.visible !== true) {
    return base
  }
  const hasTimeline = config.milestones.length > 0
  const hasAlignment =
    (config.alignments?.length || 0) > 0 ||
    Boolean(config.alignmentSourceText?.trim())
  const hasConvergence =
    config.layout === "convergence" &&
    (config.capabilities || []).filter((c) => Boolean(c.label?.trim())).length >= 2
  // Alignment / Convergence may render without TRACK milestones.
  const canPlace =
    hasTimeline ||
    (config.layout === "alignment" && hasAlignment) ||
    hasConvergence
  if (!canPlace) {
    return base
  }
  const synthetic = makeSection()
  const expIdx = base.findIndex((s) => isPrimaryExperienceSectionTitle(s.title))
  if (expIdx < 0) return [...base, synthetic]
  if (config.position === "after-experience") {
    return [...base.slice(0, expIdx + 1), synthetic, ...base.slice(expIdx + 1)]
  }
  return [...base.slice(0, expIdx), synthetic, ...base.slice(expIdx)]
}
