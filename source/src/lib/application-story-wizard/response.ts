import { normalizeYourStoryCvEvidence } from "@/lib/your-story"
import type {
  ApplicationIllustration,
  ApplicationStoryAnalysis,
  CompanyIntelligence,
  CandidateIntelligence,
  IllustrationHotspot,
  IllustrationStyle,
  OpportunityGap,
  OpportunityMapping,
  OpportunityMatch,
  ParsedApplicationStoryWizardResponse,
  StoryMap,
  StoryMapEdge,
  StoryMapLayout,
  StoryMapNode,
  StoryMapNodeType,
} from "@/lib/application-story-wizard/types"

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) return trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]?.trim().startsWith("{")) return fence[1].trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return null
}

const LAYOUTS: StoryMapLayout[] = ["journey", "bridge", "ecosystem", "flow"]
const NODE_TYPES: StoryMapNodeType[] = [
  "company_goal",
  "challenge",
  "capability",
  "evidence",
  "outcome",
]
const STYLES: IllustrationStyle[] = ["professional", "executive", "creative"]

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

function parseCompanyIntelligence(raw: unknown): CompanyIntelligence {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    mission: String(row.mission ?? "").trim() || undefined,
    vision: String(row.vision ?? "").trim() || undefined,
    productsAndServices: asStringArray(row.productsAndServices ?? row.products_and_services),
    industry: String(row.industry ?? "").trim() || undefined,
    targetCustomers: String(row.targetCustomers ?? row.target_customers ?? "").trim() || undefined,
    values: asStringArray(row.values),
    strategicPriorities: asStringArray(row.strategicPriorities ?? row.strategic_priorities),
    aiMaturity: String(row.aiMaturity ?? row.ai_maturity ?? "").trim() || undefined,
    inferredChallenges: asStringArray(row.inferredChallenges ?? row.inferred_challenges),
    terminology: asStringArray(row.terminology),
    employerBrand: String(row.employerBrand ?? row.employer_brand ?? "").trim() || undefined,
  }
}

function parseCandidateIntelligence(raw: unknown): CandidateIntelligence {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    coreCapabilities: asStringArray(row.coreCapabilities ?? row.core_capabilities),
    careerThemes: asStringArray(row.careerThemes ?? row.career_themes),
    domainExpertise: asStringArray(row.domainExpertise ?? row.domain_expertise),
    transferableSkills: asStringArray(row.transferableSkills ?? row.transferable_skills),
    achievements: asStringArray(row.achievements),
    leadershipExamples: asStringArray(row.leadershipExamples ?? row.leadership_examples),
    researchExperience: asStringArray(row.researchExperience ?? row.research_experience),
    technicalKnowledge: asStringArray(row.technicalKnowledge ?? row.technical_knowledge),
    humanCentredStrengths: asStringArray(row.humanCentredStrengths ?? row.human_centred_strengths),
    valuesAndMotivations: asStringArray(row.valuesAndMotivations ?? row.values_and_motivations),
  }
}

function parseMatches(raw: unknown, prefix: string): OpportunityMatch[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      return {
        id: String(row.id ?? `${prefix}-${index + 1}`),
        label: String(row.label ?? "").trim(),
        companyNeed: String(row.companyNeed ?? row.company_need ?? "").trim(),
        candidateStrength: String(row.candidateStrength ?? row.candidate_strength ?? "").trim(),
        evidenceIds: asStringArray(row.evidenceIds ?? row.evidence_ids),
      } satisfies OpportunityMatch
    })
    .filter((m): m is OpportunityMatch => Boolean(m?.label || m?.companyNeed))
}

function parseGaps(raw: unknown): OpportunityGap[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      return {
        id: String(row.id ?? `gap-${index + 1}`),
        requirement: String(row.requirement ?? "").trim(),
        status: String(row.status ?? "").trim(),
        evidenceIds: asStringArray(row.evidenceIds ?? row.evidence_ids),
      } satisfies OpportunityGap
    })
    .filter((g): g is OpportunityGap => Boolean(g?.requirement))
}

function parseOpportunityMapping(raw: unknown): OpportunityMapping {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    strongestMatches: parseMatches(row.strongestMatches ?? row.strongest_matches, "match"),
    gaps: parseGaps(row.gaps),
    differentiators: parseMatches(row.differentiators, "diff"),
    problemsSolved: parseMatches(row.problemsSolved ?? row.problems_solved, "prob"),
  }
}

function parseStoryMapNodes(raw: unknown): StoryMapNode[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const type = String(row.type ?? "capability")
      return {
        id: String(row.id ?? `node-${index + 1}`),
        type: NODE_TYPES.includes(type as StoryMapNodeType)
          ? (type as StoryMapNodeType)
          : "capability",
        label: String(row.label ?? "").trim(),
        description: String(row.description ?? "").trim() || undefined,
        evidenceIds: asStringArray(row.evidenceIds ?? row.evidence_ids),
        illustrationElementId:
          String(row.illustrationElementId ?? row.illustration_element_id ?? "").trim() ||
          undefined,
      } satisfies StoryMapNode
    })
    .filter((n): n is StoryMapNode => Boolean(n?.label))
}

function parseStoryMapEdges(raw: unknown): StoryMapEdge[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const from = String(row.from ?? "").trim()
      const to = String(row.to ?? "").trim()
      if (!from || !to) return null
      return {
        id: String(row.id ?? `edge-${index + 1}`),
        from,
        to,
        label: String(row.label ?? "").trim() || undefined,
      } satisfies StoryMapEdge
    })
    .filter((e): e is StoryMapEdge => Boolean(e))
}

function parseHotspots(raw: unknown): IllustrationHotspot[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      return {
        id: String(row.id ?? `hotspot-${index + 1}`),
        label: String(row.label ?? "").trim(),
        x: Math.min(100, Math.max(0, Number(row.x) || 50)),
        y: Math.min(100, Math.max(0, Number(row.y) || 50)),
        evidenceIds: asStringArray(row.evidenceIds ?? row.evidence_ids),
        symbolism: String(row.symbolism ?? "").trim() || undefined,
      } satisfies IllustrationHotspot
    })
    .filter((h): h is IllustrationHotspot => Boolean(h?.label))
}

function parseStoryMap(raw: unknown): Omit<StoryMap, "lastModified"> {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const layout = String(row.layout ?? "journey")
  return {
    layout: LAYOUTS.includes(layout as StoryMapLayout) ? (layout as StoryMapLayout) : "journey",
    nodes: parseStoryMapNodes(row.nodes),
    edges: parseStoryMapEdges(row.edges),
  }
}

function parseIllustration(
  raw: unknown,
): Omit<ApplicationIllustration, "lastModified" | "imageDataUrl" | "aiMetadata"> {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const style = String(row.style ?? "professional")
  return {
    prompt: String(row.prompt ?? "").trim(),
    style: STYLES.includes(style as IllustrationStyle) ? (style as IllustrationStyle) : "professional",
    hotspots: parseHotspots(row.hotspots),
  }
}

export function parseApplicationStoryWizardResponse(
  raw: string,
): ParsedApplicationStoryWizardResponse | null {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const applicationStory = String(
      parsed.applicationStory ?? parsed.application_story ?? parsed.story ?? "",
    ).trim()
    if (!applicationStory) return null

    const cvEvidence = normalizeYourStoryCvEvidence(parsed.cvEvidence ?? parsed.cv_evidence)
    const analysisRow =
      parsed.analysis && typeof parsed.analysis === "object"
        ? (parsed.analysis as Record<string, unknown>)
        : {}

    const analysis: Omit<ApplicationStoryAnalysis, "analyzedAt"> = {
      companyIntelligence: parseCompanyIntelligence(
        analysisRow.companyIntelligence ?? analysisRow.company_intelligence,
      ),
      candidateIntelligence: parseCandidateIntelligence(
        analysisRow.candidateIntelligence ?? analysisRow.candidate_intelligence,
      ),
      opportunityMapping: parseOpportunityMapping(
        analysisRow.opportunityMapping ?? analysisRow.opportunity_mapping,
      ),
    }

    const storyMap = parseStoryMap(parsed.storyMap ?? parsed.story_map)
    const illustration = parseIllustration(parsed.illustration)

    if (!illustration.prompt) return null

    return {
      applicationStory,
      cvEvidence,
      analysis,
      storyMap,
      illustration,
    }
  } catch {
    return null
  }
}
