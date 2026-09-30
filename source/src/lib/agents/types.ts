/** Status for agent_profile_facts */
export type AgentFactStatus = "unconfirmed" | "confirmed"

export type AgentFactSource = "resume" | "qualification_profile" | "manual"

export type AgentFactCategory =
  | "identity"
  | "summary"
  | "role"
  | "employer"
  | "dates"
  | "achievement"
  | "skill"
  | "education"
  | "language"
  | "certification"
  | "experience"
  | "other"

export type AgentProfileFact = {
  id: string
  userId: string
  category: AgentFactCategory | string
  factText: string
  status: AgentFactStatus
  source: AgentFactSource
  sourceRef: Record<string, unknown>
  sourceKey: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Snapshot stored on agent_drafts for Writer/Fact Checker traceability */
export type CitedFactSnapshot = {
  id: string
  text: string
}

/** Fact Checker flags stored on agent_drafts.fabrication_flags */
export type FabricationFlag = {
  claim: string
  location: "cv" | "cover" | "both"
  reason: string
}

export type AgentDraft = {
  id: string
  jobId: string
  cvText: string | null
  coverText: string | null
  citedFactsSnapshot: CitedFactSnapshot[]
  fabricationFlags: FabricationFlag[]
  version: number
  createdAt: string
  updatedAt: string
}

export type AgentJobKind = "listing" | "initiative"
export type AgentApplyMethod = "email" | "portal"

/** v2 agent_jobs status machine */
export type AgentJobStatus =
  | "new"
  | "needs_manual_review"
  | "reviewing"
  | "not_relevant"
  | "changes_requested"
  | "approved"
  | "sending"
  | "sent"
  | "rejected"

export const AGENT_JOB_STATUSES: AgentJobStatus[] = [
  "new",
  "needs_manual_review",
  "reviewing",
  "not_relevant",
  "changes_requested",
  "approved",
  "sending",
  "sent",
  "rejected",
]

/** Phase 4 Claude relevance payload stored on agent_jobs.relevance (no scores). */
export type AgentRelevanceMetRequirement = {
  requirement: string
  evidence_fact_ids: string[]
}

export type AgentRelevancePayload = {
  relevant: boolean
  requirements_met: AgentRelevanceMetRequirement[]
  requirements_not_met: string[]
  summary: string
  listing_language: "de" | "en"
  reviewed_at?: string
  model?: string
  error?: string
}

/** Known automated job listing sources (Phase 3) */
export type AgentJobSource = "arbeitsagentur" | "arbeitnow" | "adzuna"

export type AgentSearchSettings = {
  id: string
  userId: string
  keywords: string[]
  location: string
  remote: boolean
  languages: string[]
  seniority: string | null
  createdAt: string
  updatedAt: string
}

export type AgentSearchSettingsInput = {
  keywords?: string[]
  location?: string
  remote?: boolean
  languages?: string[]
  seniority?: string | null
}

/**
 * Normalized listing shape before upsert into agent_jobs + agent_companies.
 * applyMethod: email when a mailto/email is found in listing text; portal when a URL
 * exists; otherwise left null (schema allows).
 */
export type NormalizedJob = {
  source: AgentJobSource
  sourceKey: string
  title: string
  companyName: string
  companyWebsite?: string | null
  location: string | null
  language: string | null
  description: string | null
  url: string | null
  postedAt: string | null
  rawListingText: string
  applyMethod: AgentApplyMethod | null
  emailTo: string | null
}

export type AgentProfileFactInsert = {
  category: AgentFactCategory | string
  factText: string
  status?: AgentFactStatus
  source: AgentFactSource
  sourceRef?: Record<string, unknown>
  sourceKey?: string | null
  sortOrder?: number
}
