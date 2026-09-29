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

export type AgentJobKind = "listing" | "initiative"
export type AgentApplyMethod = "email" | "portal"

/** v2 agent_jobs status machine */
export type AgentJobStatus =
  | "new"
  | "needs_manual_review"
  | "reviewing"
  | "changes_requested"
  | "approved"
  | "sending"
  | "sent"
  | "rejected"

export const AGENT_JOB_STATUSES: AgentJobStatus[] = [
  "new",
  "needs_manual_review",
  "reviewing",
  "changes_requested",
  "approved",
  "sending",
  "sent",
  "rejected",
]

export type AgentProfileFactInsert = {
  category: AgentFactCategory | string
  factText: string
  status?: AgentFactStatus
  source: AgentFactSource
  sourceRef?: Record<string, unknown>
  sourceKey?: string | null
  sortOrder?: number
}
