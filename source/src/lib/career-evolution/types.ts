/**
 * Career Evolution — application-specific narrative + presentation.
 * Career Profile facts stay elsewhere; this store never overwrites them.
 */

export type CareerEvolutionLayout =
  | "progression"
  | "parallel"
  | "convergence"
  | "branching"
  | "alignment"

export type CareerEvolutionDensity = "compact" | "standard"
export type CareerEvolutionDateDisplay = "full" | "compact" | "auto"
export type CareerEvolutionPosition = "before-experience" | "after-experience"
export type CareerEvolutionOrigin = "ai" | "user" | "mixed"
export type CareerEvolutionEvidenceFit = "direct" | "transferable" | "partial"
export type CareerEvolutionMilestoneKind = "formal-role" | "career-stage"

export type CareerEvolutionTrack = {
  id: string
  /** e.g. Employment, Independent work */
  label: string
}

export type CareerEvolutionMilestone = {
  id: string
  /** Interpretive career-stage label (user-approved). */
  label: string
  /**
   * Optional short label for compact graph cards.
   * Does not rewrite `label` / official titles — display only.
   */
  displayLabel?: string
  /**
   * Provenance for `displayLabel`.
   * - auto: generated for the target job / graph
   * - user: manually edited — regenerate must not silently overwrite
   */
  displayLabelOrigin?: "auto" | "user"
  /** Short description shown on the graph (employer / project). */
  description?: string
  /** Official job title when distinct from the stage label. */
  officialTitle?: string
  /** Month-precision start, e.g. "2021-01" or "January 2021". */
  start?: string
  /** Month-precision end, or "present". */
  end?: string
  trackId?: string
  /** Why this milestone matters for the target role (user-visible). */
  relevanceNote?: string
  /** Job requirement / capability this milestone addresses. */
  jobRequirementAddressed?: string
  /** Verified CV / evidence reference (employer, project, or evidence row). */
  evidenceRef?: string
  /** How the evidence relates to the requirement. */
  evidenceFit?: CareerEvolutionEvidenceFit
  /** Formal role title vs interpretive stage framing. */
  milestoneKind?: CareerEvolutionMilestoneKind
  /** User has approved AI-suggested label/content. */
  approved: boolean
}

export type CareerEvolutionConnection = {
  id: string
  fromMilestoneId: string
  toMilestoneId: string
  label?: string
  /** User has approved this relationship. */
  approved: boolean
  evidenceRef?: string
}

/** Capability / skill stream for Skills Convergence (no dates required). */
export type CareerEvolutionCapability = {
  id: string
  label: string
  evidenceRef?: string
}

/** Skills Convergence box count limits (stable ids; labels are editable). */
export const CAREER_EVOLUTION_CAPABILITY_MIN = 2
export const CAREER_EVOLUTION_CAPABILITY_MAX = 6
export const CAREER_EVOLUTION_CAPABILITY_DEFAULT = 4

/** Match strength for an evidence → requirement pair. */
export type CareerEvolutionAlignmentMatch = "direct" | "transferable"

/** Evidence → requirement pair for Evidence-to-Role Alignment. */
export type CareerEvolutionAlignment = {
  id: string
  evidenceLabel: string
  requirementLabel: string
  /** Supporting Career Profile / CV evidence reference. */
  evidenceRef?: string
  /** How the evidence relates to the requirement — never claim “met” without proof. */
  matchType?: CareerEvolutionAlignmentMatch
  approved: boolean
}

export type CareerEvolutionConfig = {
  v: 1
  /**
   * When false, graph is omitted from preview/PDF but content is kept.
   * Default false — existing CVs stay unchanged until opted in / auto-enabled.
   */
  visible: boolean
  /**
   * User explicitly turned the graph off for this application.
   * Regenerating the CV must not silently re-enable when this is true.
   */
  userDisabled?: boolean
  layout: CareerEvolutionLayout
  density: CareerEvolutionDensity
  /**
   * How milestone dates appear on the graph (stored values unchanged).
   * Auto picks full vs compact from card width.
   */
  dateDisplay?: CareerEvolutionDateDisplay
  /** Where the graph sits relative to EXPERIENCE. */
  position: CareerEvolutionPosition
  /**
   * Show confirmed parallel / independent activities in the graph.
   * Independent of layout template and of Experience `[work=…]` classification.
   * Undefined → true (legacy CVs keep prior parallel-track behaviour).
   */
  showParallelWork?: boolean
  /** Show merge/connection marks on the graph. */
  showConnectionIcon: boolean
  /** Show connection label text on the graph. */
  showConnectionLabels: boolean
  tracks: CareerEvolutionTrack[]
  milestones: CareerEvolutionMilestone[]
  connections: CareerEvolutionConnection[]
  /** Skills Convergence streams (optional; else derived from milestones). */
  capabilities?: CareerEvolutionCapability[]
  /**
   * Central Outcome Label for Skills Convergence (right-hand green box).
   * Independent of the CV target job title — edit without changing the job.
   */
  convergenceTarget?: string
  /**
   * Provenance for `convergenceTarget`.
   * - auto: generated from capabilities + role requirements
   * - user: manually edited — regenerate must not silently overwrite
   */
  convergenceTargetOrigin?: "auto" | "user"
  /**
   * Evidence-to-role rows for the Evidence-to-Role Alignment layout.
   * Authoritative structured form of `alignmentSourceText` (not TRACK milestones).
   */
  alignments?: CareerEvolutionAlignment[]
  /**
   * Editable Evidence-to-Role text (`ALIGNMENT: …` + `- evidence | requirement`).
   * Independent of TRACK / CONNECTION `sourceText` — switching layouts preserves both.
   */
  alignmentSourceText?: string
  /** Optional section heading override. */
  graphTitle?: string
  /** Human-readable TRACK / CONNECTION editor source (authoritative for timeline text). */
  sourceText?: string
  /** Target role this narrative was generated for (display only). */
  generatedForRole?: string
  generatedAt?: number
  /** Why auto-generation omitted or hid the graph. */
  omitReason?: string
  /** Distinguishes AI-generated vs user-edited content. */
  origin?: CareerEvolutionOrigin
  /** Set when the user edits text or presentation beyond a simple visibility toggle. */
  userEditedAt?: number
  /**
   * Suggested replacement from regenerate / CV Creator refresh.
   * Not applied until the user accepts it.
   */
  pendingSuggestion?: CareerEvolutionConfig
}

export const CAREER_EVOLUTION_SECTION_TITLE = "CAREER EVOLUTION"
export const CAREER_EVOLUTION_FENCE = "career-evolution"

export function emptyCareerEvolutionConfig(
  overrides?: Partial<CareerEvolutionConfig>,
): CareerEvolutionConfig {
  return {
    v: 1,
    visible: false,
    layout: "progression",
    density: "compact",
    dateDisplay: "auto",
    position: "before-experience",
    showParallelWork: true,
    showConnectionIcon: true,
    showConnectionLabels: true,
    tracks: [],
    milestones: [],
    connections: [],
    capabilities: [],
    alignments: [],
    alignmentSourceText: "",
    sourceText: "",
    origin: "ai",
    ...overrides,
  }
}

export function newCareerEvolutionId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}`
}
