/**
 * Career Evolution presentation templates — shared catalog for editor + auto-gen.
 */

import type { CareerEvolutionLayout } from "@/lib/career-evolution/types"

export type CareerEvolutionLayoutMeta = {
  id: CareerEvolutionLayout
  name: string
  nameDe: string
  desc: string
  descDe: string
  /** Short badge for gallery (e.g. “Most compact”). */
  badge?: string
  badgeDe?: string
}

/** Canonical five templates (legacy `progression` / `parallel` retained as ids). */
export const CAREER_EVOLUTION_LAYOUTS: CareerEvolutionLayoutMeta[] = [
  {
    id: "progression",
    name: "Progression Cards",
    nameDe: "Progressionskarten",
    desc: "A simple left-to-right story of career stages. Reliable for printing.",
    descDe: "Einfache Stationen von links nach rechts — drucksicher.",
    badge: "Most compact",
    badgeDe: "Kompakteste",
  },
  {
    id: "parallel",
    name: "Parallel Tracks",
    nameDe: "Parallele Pfade",
    desc: "Employment plus concurrent independent work, with one merge link.",
    descDe: "Anstellung und parallele Arbeit — eine Merge-Verbindung.",
  },
  {
    id: "convergence",
    name: "Skills Convergence",
    nameDe: "Fähigkeiten-Konvergenz",
    desc: "Capabilities combine into your current professional value. No dates required.",
    descDe: "Fähigkeiten fließen in Ihren aktuellen Beitrag — ohne Daten.",
  },
  {
    id: "branching",
    name: "Branching Pathway",
    nameDe: "Verzweigter Pfad",
    desc: "A chronological path with an optional secondary branch.",
    descDe: "Chronologischer Pfad mit optionalem Nebenast.",
  },
  {
    id: "alignment",
    name: "Evidence-to-Role Alignment",
    nameDe: "Evidenz → Rolle",
    desc: "Maps verified experience to target-job requirements.",
    descDe: "Ordnet verifizierte Erfahrung den Stellenanforderungen zu.",
  },
]

const LAYOUT_IDS = new Set<string>(CAREER_EVOLUTION_LAYOUTS.map((l) => l.id))

/** Accept current + legacy aliases from stored configs. */
export function normalizeCareerEvolutionLayout(raw: unknown): CareerEvolutionLayout {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
  if (s === "progression-cards" || s === "cards" || s === "linear") return "progression"
  if (s === "parallel-tracks" || s === "two-track" || s === "two-tracks") return "parallel"
  if (s === "skills-convergence" || s === "skills" || s === "converge") return "convergence"
  if (s === "branching-pathway" || s === "branch" || s === "pathway") return "branching"
  if (
    s === "evidence-to-role" ||
    s === "evidence-alignment" ||
    s === "alignment" ||
    s === "evidence"
  ) {
    return "alignment"
  }
  if (LAYOUT_IDS.has(s)) return s as CareerEvolutionLayout
  return "progression"
}

export function careerEvolutionLayoutMeta(
  id: CareerEvolutionLayout,
): CareerEvolutionLayoutMeta {
  return (
    CAREER_EVOLUTION_LAYOUTS.find((l) => l.id === id) || CAREER_EVOLUTION_LAYOUTS[0]!
  )
}

export type RecommendLayoutInput = {
  hasParallel: boolean
  milestoneCount: number
  interpretiveCount: number
  themeCount: number
  alignmentPairCount: number
  /** Distinct capability / skill labels available */
  capabilityCount: number
  isCareerTransition?: boolean
}

/**
 * Pick the most useful template for auto-generated CVs.
 * Never forces chronological milestones into convergence/alignment without data.
 */
export function recommendCareerEvolutionLayout(
  input: RecommendLayoutInput,
): CareerEvolutionLayout {
  // Concurrent employment + independent work → parallel tracks
  if (input.hasParallel) return "parallel"

  // Career change / transferable mapping — only when chronology is weak or transition is explicit
  if (
    input.alignmentPairCount >= 2 &&
    (input.isCareerTransition || input.interpretiveCount < 2)
  ) {
    return "alignment"
  }

  // Multidisciplinary hybrid — prefer convergence when we lack a clear stage arc
  if (
    input.capabilityCount >= 3 &&
    input.themeCount >= 2 &&
    input.interpretiveCount < 2
  ) {
    return "convergence"
  }

  if (input.isCareerTransition && input.milestoneCount >= 3) {
    return "branching"
  }

  // Default: chronological progression cards for linear careers
  return "progression"
}

/** Tiny static SVG preview for the layout gallery (not the live graph). */
export function careerEvolutionLayoutPreviewSvg(
  layout: CareerEvolutionLayout,
  accent: string,
): string {
  const a = accent || "#0f7b6c"
  switch (layout) {
    case "parallel":
      return `<svg viewBox="0 0 72 36" width="72" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="4" width="18" height="10" rx="2" fill="${a}" fill-opacity="0.2"/><rect x="26" y="4" width="18" height="10" rx="2" fill="${a}" fill-opacity="0.35"/><rect x="48" y="4" width="18" height="10" rx="2" fill="${a}" fill-opacity="0.55"/><circle cx="10" cy="22" r="2" fill="none" stroke="${a}" stroke-width="1.2"/><path d="M10 24v4M10 26h8" fill="none" stroke="${a}" stroke-width="1.2"/><rect x="22" y="22" width="44" height="8" rx="2" fill="${a}" fill-opacity="0.2"/></svg>`
    case "convergence":
      return `<svg viewBox="0 0 72 36" width="72" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="2" width="22" height="8" rx="2" fill="${a}" fill-opacity="0.25"/><rect x="4" y="14" width="22" height="8" rx="2" fill="${a}" fill-opacity="0.25"/><rect x="4" y="26" width="22" height="8" rx="2" fill="${a}" fill-opacity="0.25"/><path d="M26 6C40 6 40 18 52 18M26 18H52M26 30C40 30 40 18 52 18" fill="none" stroke="${a}" stroke-width="1.2"/><rect x="52" y="10" width="16" height="16" rx="3" fill="${a}"/></svg>`
    case "branching":
      return `<svg viewBox="0 0 72 36" width="72" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="6" y1="12" x2="66" y2="12" stroke="${a}" stroke-width="1.5"/><circle cx="16" cy="12" r="3" fill="${a}"/><circle cx="36" cy="12" r="3" fill="${a}"/><circle cx="56" cy="12" r="3" fill="${a}"/><path d="M36 12c0 8 8 12 20 12" fill="none" stroke="${a}" stroke-width="1.2" stroke-dasharray="2 2"/><circle cx="56" cy="24" r="3" fill="${a}"/></svg>`
    case "alignment":
      return `<svg viewBox="0 0 72 36" width="72" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="4" y="10" font-size="6" fill="#888">•••</text><text x="28" y="10" font-size="7" fill="${a}">→</text><rect x="40" y="2" width="28" height="10" rx="3" fill="${a}" fill-opacity="0.3"/><text x="4" y="22" font-size="6" fill="#888">•••</text><text x="28" y="22" font-size="7" fill="${a}">→</text><rect x="40" y="14" width="28" height="10" rx="3" fill="${a}" fill-opacity="0.3"/><text x="4" y="34" font-size="6" fill="#888">•••</text><text x="28" y="34" font-size="7" fill="${a}">→</text><rect x="40" y="26" width="28" height="8" rx="3" fill="${a}" fill-opacity="0.3"/></svg>`
    case "progression":
    default:
      return `<svg viewBox="0 0 72 36" width="72" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="4" y="14" font-size="7" fill="#666">A</text><text x="22" y="14" font-size="7" fill="#666">B</text><rect x="40" y="4" width="28" height="16" rx="3" fill="${a}"/><text x="46" y="15" font-size="7" fill="#fff">C</text><text x="8" y="30" font-size="5.5" fill="${a}">⇢ parallel</text></svg>`
  }
}
