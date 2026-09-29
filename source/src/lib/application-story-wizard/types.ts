import type { YourStoryCvEvidenceItem } from "@/lib/types"

export type StoryMapLayout = "journey" | "bridge" | "ecosystem" | "flow"

export type IllustrationStyle = "professional" | "executive" | "creative"

export type StoryMapNodeType =
  | "company_goal"
  | "challenge"
  | "capability"
  | "evidence"
  | "outcome"

export interface StoryMapNode {
  id: string
  type: StoryMapNodeType
  label: string
  description?: string
  /** Links to YourStoryCvEvidenceItem.id */
  evidenceIds: string[]
  /** Links to ApplicationIllustration.hotspots[].id */
  illustrationElementId?: string
}

export interface StoryMapEdge {
  id: string
  from: string
  to: string
  label?: string
}

export interface StoryMap {
  layout: StoryMapLayout
  nodes: StoryMapNode[]
  edges: StoryMapEdge[]
  lastModified: number
}

export interface IllustrationHotspot {
  id: string
  label: string
  /** Percent position on image (0–100) */
  x: number
  y: number
  evidenceIds: string[]
  symbolism?: string
}

export interface ApplicationIllustration {
  prompt: string
  style: IllustrationStyle
  hotspots: IllustrationHotspot[]
  /** Base64 data URL when generated */
  imageDataUrl?: string
  lastModified: number
  aiMetadata?: {
    model?: string
    generatedAt?: number
  }
}

export interface CompanyIntelligence {
  mission?: string
  vision?: string
  productsAndServices?: string[]
  industry?: string
  targetCustomers?: string
  values?: string[]
  strategicPriorities?: string[]
  aiMaturity?: string
  inferredChallenges?: string[]
  terminology?: string[]
  employerBrand?: string
}

export interface CandidateIntelligence {
  coreCapabilities?: string[]
  careerThemes?: string[]
  domainExpertise?: string[]
  transferableSkills?: string[]
  achievements?: string[]
  leadershipExamples?: string[]
  researchExperience?: string[]
  technicalKnowledge?: string[]
  humanCentredStrengths?: string[]
  valuesAndMotivations?: string[]
}

export interface OpportunityMatch {
  id: string
  label: string
  companyNeed: string
  candidateStrength: string
  evidenceIds: string[]
}

export interface OpportunityGap {
  id: string
  requirement: string
  status: string
  evidenceIds: string[]
}

export interface OpportunityMapping {
  strongestMatches: OpportunityMatch[]
  gaps: OpportunityGap[]
  differentiators: OpportunityMatch[]
  problemsSolved: OpportunityMatch[]
}

export interface ApplicationStoryAnalysis {
  companyIntelligence: CompanyIntelligence
  candidateIntelligence: CandidateIntelligence
  opportunityMapping: OpportunityMapping
  analyzedAt: number
}

export interface ApplicationStoryWizardOptionalSources {
  aboutPage?: string
  companyValues?: string
  annualReport?: string
  teamPage?: string
  productPages?: string
  linkedInCompanyPage?: string
}

export interface ApplicationStoryWizardInputs {
  companyWebsiteUrl: string
  jobDescription: string
  tailoredResumeVersionId: string
  optionalSources?: ApplicationStoryWizardOptionalSources
}

export interface ApplicationStoryWizardArtifact {
  inputs: ApplicationStoryWizardInputs
  analysis?: ApplicationStoryAnalysis
  storyMap?: StoryMap
  illustration?: ApplicationIllustration
  wizardCompletedAt?: number
}

export type ApplicationStoryWizardDraft = ApplicationStoryWizardInputs & {
  jobTitle: string
  company: string
  resumeContent: string
  outputLanguage: "en" | "de"
}

export type ParsedApplicationStoryWizardResponse = {
  applicationStory: string
  cvEvidence: YourStoryCvEvidenceItem[]
  analysis: Omit<ApplicationStoryAnalysis, "analyzedAt">
  storyMap: Omit<StoryMap, "lastModified">
  illustration: Omit<ApplicationIllustration, "lastModified" | "imageDataUrl" | "aiMetadata">
}
