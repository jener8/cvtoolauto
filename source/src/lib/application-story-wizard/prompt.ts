import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"
import { appendStrategicProfileToPrompt } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { buildOptionalSourcesBlock } from "@/lib/application-story-wizard/fetch-company-context"
import type {
  ApplicationStoryWizardOptionalSources,
  IllustrationStyle,
} from "@/lib/application-story-wizard/types"

export type BuildApplicationStoryWizardPromptInput = {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  companyWebsiteUrl: string
  companyWebsiteText?: string
  optionalSources?: ApplicationStoryWizardOptionalSources
  illustrationStyle?: IllustrationStyle
  strategicProfile?: StrategicProfile | null
}

const OUTPUT_SCHEMA = `Return ONLY a single JSON object (no markdown fences, no commentary) with this exact shape:
{
  "applicationStory": "Recruiter-friendly narrative in 4–8 short paragraphs. First person (I/my). Explains fit, problems solved, experience transfer, and value creation.",
  "cvEvidence": [
    {
      "id": "evidence-1",
      "storyExcerpt": "Short quote or paraphrase from the story",
      "cvSection": "Profile | EXPERIENCE employer | Skills | Education | Projects",
      "cvReference": "Exact CV bullet or section text supporting the excerpt",
      "supportLevel": "strong | needs_stronger_cv_evidence | could_be_added_to_cv | risk_story_stronger_than_cv_proof"
    }
  ],
  "analysis": {
    "companyIntelligence": {
      "mission": "string",
      "vision": "string",
      "productsAndServices": ["string"],
      "industry": "string",
      "targetCustomers": "string",
      "values": ["string"],
      "strategicPriorities": ["string"],
      "aiMaturity": "string or null",
      "inferredChallenges": ["string"],
      "terminology": ["frequently used terms"],
      "employerBrand": "string"
    },
    "candidateIntelligence": {
      "coreCapabilities": ["string"],
      "careerThemes": ["string"],
      "domainExpertise": ["string"],
      "transferableSkills": ["string"],
      "achievements": ["evidence-backed only"],
      "leadershipExamples": ["string"],
      "researchExperience": ["string"],
      "technicalKnowledge": ["string"],
      "humanCentredStrengths": ["string"],
      "valuesAndMotivations": ["string"]
    },
    "opportunityMapping": {
      "strongestMatches": [{ "id": "match-1", "label": "short title", "companyNeed": "", "candidateStrength": "", "evidenceIds": ["evidence-1"] }],
      "gaps": [{ "id": "gap-1", "requirement": "", "status": "partial | missing | stretch", "evidenceIds": [] }],
      "differentiators": [{ "id": "diff-1", "label": "", "companyNeed": "", "candidateStrength": "", "evidenceIds": [] }],
      "problemsSolved": [{ "id": "prob-1", "label": "", "companyNeed": "", "candidateStrength": "", "evidenceIds": [] }]
    }
  },
  "storyMap": {
    "layout": "journey | bridge | ecosystem | flow",
    "nodes": [
      {
        "id": "node-1",
        "type": "company_goal | challenge | capability | evidence | outcome",
        "label": "short label",
        "description": "one sentence",
        "evidenceIds": ["evidence-1"],
        "illustrationElementId": "hotspot-1"
      }
    ],
    "edges": [{ "id": "edge-1", "from": "node-1", "to": "node-2", "label": "optional" }]
  },
  "illustration": {
    "prompt": "Detailed DALL-E prompt for conceptual artwork — no clichés unless appropriate. Communicate candidate value through industry-relevant symbolism.",
    "style": "professional | executive | creative",
    "hotspots": [
      { "id": "hotspot-1", "label": "element name", "x": 50, "y": 40, "evidenceIds": ["evidence-1"], "symbolism": "what it represents" }
    ]
  }
}`

export function buildApplicationStoryWizardPrompt(
  input: BuildApplicationStoryWizardPromptInput,
): string {
  const langLabel = input.language === "de" ? "German" : "English"
  const style = input.illustrationStyle ?? "professional"
  const optionalBlock = buildOptionalSourcesBlock(input.optionalSources)
  const websiteBlock = input.companyWebsiteText?.trim()
    ? `\n\nCOMPANY WEBSITE TEXT (fetched):\n${input.companyWebsiteText.trim()}`
    : input.companyWebsiteUrl.trim()
      ? `\n\nCOMPANY WEBSITE URL (content not fetched — infer cautiously from URL and job context only):\n${input.companyWebsiteUrl.trim()}`
      : ""

  const base = `You are an Application Intelligence strategist running the Application Story Wizard.

Produce ONE coherent analysis that powers four connected outputs from the same reasoning:
1) Application Story (written narrative)
2) Story Map (visual structure)
3) Illustration brief (conceptual artwork prompt + hotspots)
4) Interactive Evidence Mapping (cvEvidence + node/hotspot links)

## Phase 1 — Company Intelligence
Analyse company context and identify: mission, vision, products/services, industry, target customers, values, strategic priorities, AI maturity (if applicable), challenges inferred from the role, terminology, employer brand/culture.

## Phase 2 — Candidate Intelligence
Analyse the tailored resume only. Identify capabilities, themes, domain expertise, transferable skills, evidence-backed achievements, leadership, research, technical knowledge, human-centred strengths, values/motivations.

## Phase 3 — Opportunity Mapping
Compare company needs, job requirements, and candidate strengths. Identify strongest matches, gaps, differentiators, and problems the candidate can solve. Every conclusion must cite evidenceIds from cvEvidence.

## Rules
- NEVER invent achievements, employers, dates, or metrics — every claim traceable to the resume
- cvEvidence.supportLevel must flag weak proof honestly
- Story Map layout: choose journey (career arc), bridge (transition), ecosystem (stakeholders), or flow (process) based on best fit
- Story Map path: Company Goals → Challenges → Candidate Capabilities → Evidence → Expected Outcomes
- Illustration style requested: ${style}
- Illustration hotspots must align with story map nodes via evidenceIds and illustrationElementId
- Write applicationStory in ${langLabel}

${cvFactualSourceRulesBlock(input.language)}

${OUTPUT_SCHEMA}

TARGET ROLE: ${input.jobTitle || "(not specified)"}
COMPANY: ${input.company || "(not specified)"}

JOB DESCRIPTION:
${input.jobDescription.trim() || "(none)"}
${websiteBlock}${optionalBlock}

TAILORED RESUME (factual source of truth):
${input.resumeContent.trim() || "(none)"}`

  return appendStrategicProfileToPrompt(base, input.strategicProfile, input.language)
}

export function buildStoryIllustrationImagePrompt(input: {
  illustrationPrompt: string
  style: IllustrationStyle
  company: string
  jobTitle: string
}): string {
  const styleHints: Record<IllustrationStyle, string> = {
    professional: "Clean, modern, corporate-appropriate conceptual illustration. Muted palette with one accent color.",
    executive: "Sophisticated, minimal, boardroom-quality visual metaphor. Premium and restrained.",
    creative: "Bold conceptual art with distinctive symbolism. Still professional — not cartoonish.",
  }
  return `${input.illustrationPrompt.trim()}

Context: conceptual artwork for a ${input.jobTitle} application at ${input.company}.
Style: ${styleHints[input.style]}
No text, logos, or watermarks in the image. No stock-photo clichés unless contextually appropriate.`
}
