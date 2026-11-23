/**
 * Suggest concise Career Evolution short display labels (≈2–4 words).
 * Deterministic — never invents employers, seniority, or achievements.
 */

import type {
  CareerEvolutionLayout,
  CareerEvolutionMilestone,
} from "@/lib/career-evolution/types"
import type { JobCapabilityTheme } from "@/lib/career-evolution/job-themes"

export type DisplayLabelSuggestContext = {
  language?: "en" | "de"
  layout?: CareerEvolutionLayout
  targetRole?: string
  jobDescription?: string
  themes?: JobCapabilityTheme[]
  /** Other short labels already chosen (avoid duplicates). */
  usedLabels?: string[]
}

const SENIORITY =
  /\b(senior|junior|staff|lead|principal|head of|director|intern|associate|mid[- ]?level)\b/gi

/** Theme stage labels → shorter graph card forms (style guide, not person-specific). */
const THEME_SHORT_EN: Record<string, string[]> = {
  research: ["Strategic Research", "UX Research", "Research & Discovery"],
  "ai-responsible": ["Responsible AI", "AI Governance", "AI Literacy"],
  "product-design": ["Product Design", "Product Delivery", "Design Delivery"],
  "design-systems": ["Design Systems", "Component Systems"],
  accessibility: ["Accessibility", "Inclusive Design"],
  strategy: ["Product Strategy", "UX Strategy", "Design Strategy"],
  enablement: ["AI Enablement", "Team Enablement", "Facilitation"],
}

const THEME_SHORT_DE: Record<string, string[]> = {
  research: ["Strategische Research", "UX Research", "Research & Discovery"],
  "ai-responsible": ["Responsible AI", "AI-Governance", "AI Literacy"],
  "product-design": ["Product Design", "Product Delivery", "Design Delivery"],
  "design-systems": ["Design Systems", "Komponentensysteme"],
  accessibility: ["Barrierefreiheit", "Inclusive Design"],
  strategy: ["Product Strategy", "UX Strategy", "Design Strategy"],
  enablement: ["AI Enablement", "Team Enablement", "Facilitation"],
}

const GENERIC_SINGLE = new Set([
  "strategy",
  "research",
  "design",
  "product",
  "delivery",
  "influence",
  "discovery",
  "enablement",
  "governance",
  "strategie",
  "forschung",
])

function cleanSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function titleCaseWords(s: string): string {
  return cleanSpaces(s)
    .split(" ")
    .map((w) => {
      if (!w) return w
      if (/^&$|^und$/i.test(w)) return w.toLowerCase() === "und" ? "und" : "&"
      if (/^(ai|ux|ui|qa|ml|llm|a11y)$/i.test(w)) return w.toUpperCase()
      // Preserve internal capitals in compounds (Human-Centred, TrustAudit)
      if (w.includes("-")) {
        return w
          .split("-")
          .map((part) => {
            if (/^(ai|ux|ui)$/i.test(part)) return part.toUpperCase()
            return part.charAt(0).toUpperCase() + part.slice(1)
          })
          .join("-")
      }
      if (w === w.toUpperCase() && w.length <= 3) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(" ")
}

function wordCount(s: string): number {
  return cleanSpaces(s)
    .split(/\s+/)
    .filter((w) => w && w !== "&" && !/^(and|und)$/i.test(w))
    .length
}

function isTooGeneric(label: string): boolean {
  const words = cleanSpaces(label)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== "&" && w !== "und" && w !== "and")
  if (words.length === 0) return true
  if (words.length === 1 && GENERIC_SINGLE.has(words[0]!)) return true
  return false
}

function stripSeniorityAndNoise(title: string): string {
  let t = cleanSpaces(title)
  t = t.replace(SENIORITY, " ")
  t = t.replace(/\([^)]*\)/g, " ")
  t = t.replace(/\b(f\/m\/x|m\/w\/d|w\/m\/d)\b/gi, " ")
  // Only treat spaced dashes/slashes as role separators — keep Human-Centred, AI-native, etc.
  t = t.replace(/\s+[-–—|/]\s+/g, " – ")
  return cleanSpaces(t)
}

/**
 * Compress an official title into ≈2–4 words without inventing content.
 * e.g. "Senior UX Designer - Product & Research" → "UX Design & Research"
 */
export function compressOfficialTitle(title: string): string {
  const raw = stripSeniorityAndNoise(title)
  if (!raw) return ""

  // Split on en-dash / hyphen separators into left (role) and right (focus)
  const parts = raw.split(/\s*[–—]\s*/).map(cleanSpaces).filter(Boolean)
  if (parts.length >= 2) {
    const left = parts[0]!
      .replace(/\bdesigner\b/gi, "Design")
      .replace(/\bresearcher\b/gi, "Research")
      .replace(/\bstrategist\b/gi, "Strategy")
      .replace(/\bengineer\b/gi, "Engineering")
      .replace(/\bmanager\b/gi, "Management")
    const right = parts.slice(1).join(" ")
    const leftKey = left
      .replace(/\b(ux|ui|product|service|ai)\b/gi, (m) => m.toUpperCase())
      .split(/\s+/)
      .filter((w) => /^(UX|UI|AI|Product|Service|Design|Research|Strategy)$/i.test(w))
      .slice(0, 2)
      .join(" ")
    const rightTokens = right
      .replace(/\bproduct\b/gi, "Product")
      .split(/\s+/)
      .filter((w) => w && w !== "&" && w.toLowerCase() !== "and")
      .slice(0, 2)
    // Prefer "UX Design & Research" over repeating Product when left already has Design
    const rightBit =
      rightTokens.length > 1
        ? rightTokens.join(" & ")
        : rightTokens[0] || ""
    const leftBit = leftKey || left.split(/\s+/).slice(0, 2).join(" ")
    let combo = cleanSpaces(`${leftBit} & ${rightBit}`.replace(/\s*&\s*&\s*/g, " & "))
    // Drop duplicate trailing focus if left already contains it
    if (/design/i.test(leftBit) && /^product$/i.test(rightTokens[0] || "")) {
      combo = cleanSpaces(
        `${leftBit} & ${(rightTokens[1] || rightTokens[0] || "").trim()}`.replace(
          /\s*&\s*$/,
          "",
        ),
      )
    }
    const shortened = titleCaseWords(combo)
    if (wordCount(shortened) >= 2 && wordCount(shortened) <= 4) return shortened
  }

  // Single phrase / compound words (Human-Centred AI Enablement)
  const tokens = raw
    .replace(/\bdesigner\b/gi, "Design")
    .replace(/\bresearcher\b/gi, "Research")
    .split(/\s+/)
    .filter((w) => w && w !== "&" && !/^(and|und)$/i.test(w))
  // Prefer trailing capability words when the phrase is long
  if (tokens.length > 4) {
    const tail = tokens.slice(-3).join(" ")
    if (wordCount(tail) >= 2) return titleCaseWords(tail)
  }
  if (tokens.length === 4 && /interaction|responsible|enablement/i.test(tokens.join(" "))) {
    return titleCaseWords(tokens.slice(-3).join(" "))
  }
  return titleCaseWords(tokens.slice(0, 4).join(" "))
}

function pickThemeShort(
  themeId: string,
  language: "en" | "de",
  jobBlob: string,
  used: Set<string>,
): string | undefined {
  const table = language === "de" ? THEME_SHORT_DE : THEME_SHORT_EN
  const options = table[themeId] || []
  const hay = jobBlob.toLowerCase()
  const ranked = [...options].sort((a, b) => {
    const score = (s: string) =>
      s
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && hay.includes(w.toLowerCase())).length
    return score(b) - score(a)
  })
  for (const opt of ranked) {
    const key = opt.toLowerCase()
    if (!used.has(key) && !isTooGeneric(opt)) return opt
  }
  return ranked.find((o) => !used.has(o.toLowerCase())) || ranked[0]
}

function matchThemeId(
  label: string,
  themes: JobCapabilityTheme[] | undefined,
): string | undefined {
  const norm = label.toLowerCase()
  for (const t of themes || []) {
    if (
      t.labelEn.toLowerCase() === norm ||
      t.labelDe.toLowerCase() === norm ||
      norm.includes(t.labelEn.toLowerCase().split(" & ")[0]!) ||
      t.id === norm
    ) {
      return t.id
    }
  }
  // Match known theme long labels even without themes array
  for (const [id, def] of Object.entries(THEME_SHORT_EN)) {
    void def
    const en = (
      {
        research: "research & discovery",
        "ai-responsible": "responsible ai & governance",
        "product-design": "product design & delivery",
        "design-systems": "design systems",
        accessibility: "accessibility",
        strategy: "strategy & influence",
        enablement: "enablement & facilitation",
      } as Record<string, string>
    )[id]
    if (en && norm === en) return id
  }
  for (const [id, de] of Object.entries({
    research: "research & discovery",
    "ai-responsible": "responsible ai & governance",
    "product-design": "product design & delivery",
    strategy: "strategie & einfluss",
    enablement: "enablement & facilitation",
  })) {
    if (norm === de) return id
  }
  return undefined
}

function fromRequirement(phrase: string | undefined): string | undefined {
  if (!phrase) return undefined
  const cleaned = titleCaseWords(
    stripSeniorityAndNoise(phrase).replace(/[.:;]+$/g, ""),
  )
  if (wordCount(cleaned) < 2 || wordCount(cleaned) > 4) return undefined
  if (isTooGeneric(cleaned)) return undefined
  return cleaned
}

/**
 * Suggest one short display label for a milestone.
 */
export function suggestMilestoneDisplayLabel(
  milestone: Pick<
    CareerEvolutionMilestone,
    "label" | "officialTitle" | "description" | "jobRequirementAddressed"
  >,
  ctx: DisplayLabelSuggestContext = {},
): string {
  const language = ctx.language === "de" ? "de" : "en"
  const used = new Set((ctx.usedLabels || []).map((s) => s.toLowerCase()))
  const jobBlob = `${ctx.targetRole || ""}\n${ctx.jobDescription || ""}`
  const candidates: string[] = []

  const themeId = matchThemeId(milestone.label, ctx.themes)
  if (themeId) {
    const short = pickThemeShort(themeId, language, jobBlob, used)
    if (short) candidates.push(short)
  }

  const fromTitle = compressOfficialTitle(
    milestone.officialTitle || milestone.label || "",
  )
  if (fromTitle) candidates.push(fromTitle)

  const fromReq = fromRequirement(milestone.jobRequirementAddressed)
  if (fromReq) candidates.push(fromReq)

  // Stage label already short enough
  const stage = titleCaseWords(milestone.label || "")
  if (stage && wordCount(stage) >= 2 && wordCount(stage) <= 4 && !isTooGeneric(stage)) {
    candidates.push(stage)
  }

  // Prefer candidate that fits layout density and isn't duplicate/generic
  const maxWords = ctx.layout === "parallel" || ctx.layout === "branching" ? 4 : 4
  for (const c of candidates) {
    const label = titleCaseWords(c)
    if (!label) continue
    if (wordCount(label) < 1 || wordCount(label) > maxWords + 1) continue
    if (isTooGeneric(label)) continue
    if (used.has(label.toLowerCase())) continue
    // Prefer 2–4 words
    if (wordCount(label) >= 2 && wordCount(label) <= 4) return label
  }

  for (const c of candidates) {
    const label = titleCaseWords(c)
    if (label && !used.has(label.toLowerCase()) && !isTooGeneric(label)) {
      // Trim to 4 words if needed
      const words = label.split(/\s+/)
      return words.slice(0, 4).join(" ")
    }
  }

  // Last resort: compressed title or stage, still no ellipsis
  const fallback = fromTitle || stage
  if (!fallback) return ""
  return fallback.split(/\s+/).slice(0, 4).join(" ")
}

export type DisplayLabelProposal = {
  milestoneId: string
  milestoneLabel: string
  current?: string
  proposed: string
  /** True when applying would replace a user-edited label (never auto-applied). */
  protectedEdit: boolean
}

/**
 * Propose short labels for all milestones. Never marks user-origin labels for silent overwrite.
 */
export function proposeMilestoneDisplayLabels(
  milestones: CareerEvolutionMilestone[],
  ctx: DisplayLabelSuggestContext = {},
): DisplayLabelProposal[] {
  const used: string[] = []
  return milestones.map((m) => {
    const proposed = suggestMilestoneDisplayLabel(m, { ...ctx, usedLabels: used })
    if (proposed) used.push(proposed)
    const current = m.displayLabel?.trim() || undefined
    // Protect non-empty manual text. Empty user-cleared fields may be filled on Apply
    // after an explicit Regenerate Labels confirmation.
    // Missing origin + existing value → treat as manual (legacy edits before origin tracking).
    const protectedEdit =
      Boolean(current) &&
      (m.displayLabelOrigin === "user" || m.displayLabelOrigin !== "auto")
    return {
      milestoneId: m.id,
      milestoneLabel: m.label,
      current,
      proposed,
      protectedEdit,
    }
  })
}

export type ApplyDisplayLabelsOptions = DisplayLabelSuggestContext & {
  /**
   * - missing: fill empty only (default)
   * - auto: replace empty + previous auto labels
   * - all: replace everything including user (only when user confirmed regenerate)
   */
  mode?: "missing" | "auto" | "all"
}

/**
 * Apply suggested display labels onto milestones.
 */
export function applySuggestedDisplayLabels(
  milestones: CareerEvolutionMilestone[],
  options: ApplyDisplayLabelsOptions = {},
): CareerEvolutionMilestone[] {
  const mode = options.mode || "missing"
  const used: string[] = []

  /** User-origin is always protected — including intentional empty (cleared) labels. */
  const isProtected = (m: CareerEvolutionMilestone) =>
    m.displayLabelOrigin === "user" ||
    (Boolean(m.displayLabel?.trim()) && m.displayLabelOrigin !== "auto")

  // Reserve labels we will keep so new suggestions stay distinct
  for (const m of milestones) {
    const current = m.displayLabel?.trim()
    if (!current) continue
    const keep =
      mode === "all" ? false : mode === "missing" ? true : isProtected(m)
    if (keep) used.push(current)
  }

  return milestones.map((m) => {
    const current = m.displayLabel?.trim()

    // Never auto-fill a field the user cleared or already set.
    if (mode === "missing" && isProtected(m)) {
      return m
    }
    if (mode === "missing" && current) {
      // Legacy values without origin: keep text, mark as user so regenerate won't clobber.
      if (!m.displayLabelOrigin) {
        return { ...m, displayLabel: current, displayLabelOrigin: "user" as const }
      }
      return m
    }
    if (mode === "auto" && isProtected(m)) {
      return m
    }

    const proposed = suggestMilestoneDisplayLabel(m, {
      ...options,
      usedLabels: used,
    })
    if (!proposed) return m
    used.push(proposed)
    return {
      ...m,
      displayLabel: proposed,
      displayLabelOrigin: "auto" as const,
    }
  })
}

/** Strip gender markers and vacancy fluff from a job title — never use as-is in the graph. */
export function stripJobTitleForOutcome(role: string): string {
  return cleanSpaces(
    role
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b(f\/m\/x|m\/w\/d|w\/m\/d|m\/f\/d|all genders?)\b/gi, " ")
      .replace(/\s+[-–—|/]\s+/g, " ")
      .replace(/\s+/g, " "),
  )
}

function normalizeOutcomeKey(value: string): string {
  return stripJobTitleForOutcome(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/**
 * True when the Central Outcome Label must survive regenerate / apply.
 * Protects explicit user edits; treats legacy custom text as protected unless
 * it is clearly a dumped target job title (auto-seeded before this field existed).
 */
export function isUserProtectedConvergenceTarget(
  config: {
    convergenceTarget?: string
    convergenceTargetOrigin?: "auto" | "user"
    generatedForRole?: string
  },
  targetRole?: string,
): boolean {
  const current = config.convergenceTarget?.trim()
  if (!current) return false
  if (config.convergenceTargetOrigin === "user") return true
  if (config.convergenceTargetOrigin === "auto") return false
  const role = (targetRole || config.generatedForRole || "").trim()
  if (role && normalizeOutcomeKey(current) === normalizeOutcomeKey(role)) {
    return false
  }
  return true
}

export type CentralOutcomeSuggestInput = {
  language?: "en" | "de"
  targetRole?: string
  jobDescription?: string
  themes?: JobCapabilityTheme[]
  capabilities?: Array<{ label?: string } | null | undefined>
}

/**
 * Concise Skills Convergence central outcome — from verified capabilities + role
 * requirements. Never returns a raw vacancy title (no f/m/x, no long job string).
 */
export function suggestCentralOutcomeLabel(input: CentralOutcomeSuggestInput = {}): string {
  const language = input.language === "de" ? "de" : "en"
  const roleClean = stripJobTitleForOutcome(input.targetRole || "")
  const caps = (input.capabilities || [])
    .map((c) => cleanSpaces(String(c?.label ?? "")))
    .filter(Boolean)
  const themes = input.themes || []
  const jobBlob = `${roleClean}\n${input.jobDescription || ""}`.toLowerCase()

  const themeShorts: string[] = []
  for (const theme of themes.slice(0, 3)) {
    const short = pickThemeShort(theme.id, language, jobBlob, new Set(themeShorts.map((s) => s.toLowerCase())))
    if (short) themeShorts.push(short)
  }

  const capShorts = caps
    .map((label) => compressOfficialTitle(label) || titleCaseWords(label))
    .filter((s) => s && wordCount(s) <= 4 && !isTooGeneric(s))
    .slice(0, 3)

  const parts = [...new Set([...themeShorts, ...capShorts].map((s) => cleanSpaces(s)))].filter(
    Boolean,
  )

  if (parts.length >= 2) {
    const a = parts[0]!.split(/\s+/).slice(0, 2).join(" ")
    const b = parts[1]!.split(/\s+/).slice(0, 2).join(" ")
    const combo = titleCaseWords(`${a} & ${b}`)
    if (wordCount(combo) >= 2 && wordCount(combo) <= 5) return combo
  }

  if (parts[0] && wordCount(parts[0]) >= 2) {
    return titleCaseWords(parts[0])
  }

  if (roleClean) {
    const fromRole = compressOfficialTitle(roleClean)
    if (fromRole && wordCount(fromRole) >= 2 && wordCount(fromRole) <= 5) {
      return fromRole
    }
    // Last resort: first 3–4 meaningful words of the cleaned role — still not the raw vacancy string.
    const words = roleClean
      .split(/\s+/)
      .filter((w) => w && !/^(and|und|&|the|der|die|das)$/i.test(w))
      .slice(0, 4)
    if (words.length >= 2) return titleCaseWords(words.join(" "))
  }

  return language === "de" ? "Zentrales Ergebnis" : "Central outcome"
}

/**
 * When accepting a pending CE suggestion, keep user-edited short labels by match.
 */
export function mergePreservingUserDisplayLabels(
  incoming: CareerEvolutionMilestone[],
  previous: CareerEvolutionMilestone[],
): CareerEvolutionMilestone[] {
  if (!previous.length) return incoming
  return incoming.map((m) => {
    const prev =
      previous.find((p) => p.id === m.id) ||
      previous.find(
        (p) =>
          p.label === m.label &&
          (p.start || "") === (m.start || "") &&
          (p.end || "") === (m.end || ""),
      ) ||
      previous.find((p) => p.officialTitle && p.officialTitle === m.officialTitle)
    const prevLabel = prev?.displayLabel?.trim()
    const prevProtected =
      prev?.displayLabelOrigin === "user" ||
      (Boolean(prevLabel) && prev?.displayLabelOrigin !== "auto")
    if (prevProtected) {
      return {
        ...m,
        // Preserve intentional empties (user cleared) as well as custom text.
        displayLabel: prevLabel || undefined,
        displayLabelOrigin: "user",
      }
    }
    return m
  })
}
