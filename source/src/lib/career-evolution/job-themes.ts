/**
 * Capability themes extracted from a job description.
 * Patterns are generic role capabilities — never employer- or person-specific.
 */

export type JobCapabilityTheme = {
  id: string
  labelEn: string
  labelDe: string
  /** Matched requirement phrases from the JD (verbatim snippets when possible). */
  matchedPhrases: string[]
  score: number
}

type ThemeDef = {
  id: string
  labelEn: string
  labelDe: string
  patterns: RegExp[]
}

const THEME_DEFS: ThemeDef[] = [
  {
    id: "research",
    labelEn: "Research & discovery",
    labelDe: "Research & Discovery",
    patterns: [
      /\bux research\b/i,
      /\buser research\b/i,
      /\bdiscovery\b/i,
      /\busability\b/i,
      /\bresearch method/i,
      /\bqualitative\b/i,
      /\bquantitative\b/i,
      /\binterview(s|ing)?\b/i,
      /\binsight(s)?\b/i,
    ],
  },
  {
    id: "ai-responsible",
    labelEn: "Responsible AI & governance",
    labelDe: "Responsible AI & Governance",
    patterns: [
      /\bresponsible ai\b/i,
      /\bai governance\b/i,
      /\bai literacy\b/i,
      /\bai ethics\b/i,
      /\bai transformation\b/i,
      /\bgen(?:erative )?ai\b/i,
      /\bllm\b/i,
      /\bmachine learning\b/i,
      /\bartificial intelligence\b/i,
    ],
  },
  {
    id: "product-design",
    labelEn: "Product design & delivery",
    labelDe: "Product Design & Delivery",
    patterns: [
      /\bproduct design\b/i,
      /\bproduct discovery\b/i,
      /\bend[- ]to[- ]end\b/i,
      /\binteraction design\b/i,
      /\bui design\b/i,
      /\bdesign delivery\b/i,
      /\bshipping\b/i,
    ],
  },
  {
    id: "design-systems",
    labelEn: "Design systems",
    labelDe: "Design Systems",
    patterns: [
      /\bdesign system\b/i,
      /\bcomponent librar/i,
      /\bdesign token/i,
      /\bpattern librar/i,
    ],
  },
  {
    id: "accessibility",
    labelEn: "Accessibility",
    labelDe: "Barrierefreiheit",
    patterns: [/\baccessibility\b/i, /\ba11y\b/i, /\bwcag\b/i, /\binclusive design\b/i],
  },
  {
    id: "strategy",
    labelEn: "Strategy & influence",
    labelDe: "Strategie & Einfluss",
    patterns: [
      /\bstrateg(y|ic)\b/i,
      /\bstakeholder\b/i,
      /\binfluence\b/i,
      /\broadmap\b/i,
      /\bvision\b/i,
      /\bleadership\b/i,
    ],
  },
  {
    id: "enablement",
    labelEn: "Enablement & facilitation",
    labelDe: "Enablement & Facilitation",
    patterns: [
      /\benablement\b/i,
      /\bfacilitation\b/i,
      /\bworkshop\b/i,
      /\bcoaching\b/i,
      /\btraining\b/i,
      /\bupskill/i,
    ],
  },
]

/** Extract ranked capability themes from a job description + optional role title. */
export function extractJobCapabilityThemes(
  jobDescription: string,
  targetRole = "",
): JobCapabilityTheme[] {
  const text = `${targetRole}\n${jobDescription}`.trim()
  if (!text) return []

  const themes: JobCapabilityTheme[] = []
  for (const def of THEME_DEFS) {
    const matchedPhrases: string[] = []
    let score = 0
    for (const pattern of def.patterns) {
      const match = text.match(pattern)
      if (match?.[0]) {
        score += 1
        const phrase = match[0].trim()
        if (!matchedPhrases.some((p) => p.toLowerCase() === phrase.toLowerCase())) {
          matchedPhrases.push(phrase)
        }
      }
    }
    // Boost when role title itself signals the theme
    for (const pattern of def.patterns) {
      if (pattern.test(targetRole)) score += 2
    }
    if (score > 0) {
      themes.push({
        id: def.id,
        labelEn: def.labelEn,
        labelDe: def.labelDe,
        matchedPhrases,
        score,
      })
    }
  }

  return themes.sort((a, b) => b.score - a.score)
}

export function themeLabel(theme: JobCapabilityTheme, language: "en" | "de"): string {
  return language === "de" ? theme.labelDe : theme.labelEn
}

/** Score how well a blob of verified evidence text matches a theme. */
export function scoreEvidenceAgainstTheme(
  evidenceText: string,
  theme: JobCapabilityTheme,
): number {
  const hay = evidenceText.toLowerCase()
  let score = 0
  for (const phrase of theme.matchedPhrases) {
    if (hay.includes(phrase.toLowerCase())) score += 2
  }
  const def = THEME_DEFS.find((t) => t.id === theme.id)
  if (def) {
    for (const pattern of def.patterns) {
      if (pattern.test(evidenceText)) score += 1
    }
  }
  return score
}
