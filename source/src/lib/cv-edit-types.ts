export type CvEditChangeType = "added" | "removed" | "updated"

export type CvEditChange = {
  section: string
  type: CvEditChangeType
  description?: string
  before?: string
  after?: string
  authorship?: "ai_generated" | "ai_enhanced" | "user_authored" | "user_edited_after_ai"
}

export type CvEditStructuredResponse = {
  mode: "edit_cv" | "chat"
  summary: string
  changes: CvEditChange[]
  updatedResume?: string
}

export type CvEditRiskAssessment = {
  isRisky: boolean
  reasons: string[]
}

export type AiResumeEditPayload = {
  previousResumeText: string
  newResumeText: string
  summary: string
  changes: CvEditChange[]
  versionName: string
  instruction: string
  previousVersionId?: string | null
  model?: string
  provider?: string
  providerLabel?: string
  feature?: string
  explainability?: import("@/lib/ai-transparency").AiExplainability
  assistantMessageId?: string
  approvalStatus?: import("@/lib/types").AiApprovalStatus
}

export type AiResumeEditResult = {
  success: boolean
  error?: string
  previousVersionId?: string
  newVersionId?: string
  newVersionName?: string
}

export type AssistantCvEditResult = {
  mode: "edit_cv"
  summary: string
  proposedChanges?: string[]
  changes: CvEditChange[]
  previousResumeText: string
  newResumeText: string
  versionName: string
  applied: boolean
  selectionOnly?: boolean
  selectionReplacement?: string
  pendingConfirmation?: boolean
  rejected?: boolean
  riskReasons?: string[]
  requiresValidationOverride?: boolean
  validationWarnings?: string[]
  strippedEmployers?: string[]
  previousVersionId?: string
  newVersionId?: string
  newVersionName?: string
  appliedAt?: number
  model?: string
  provider?: string
  providerLabel?: string
  explainability?: import("@/lib/ai-transparency").AiExplainability
}

export type AssistantCoverLetterEditResult = {
  mode: "edit_cover_letter"
  summary: string
  proposedChanges?: string[]
  changes: CvEditChange[]
  previousLetterText: string
  newLetterText: string
  applied: boolean
  selectionOnly?: boolean
  pendingConfirmation?: boolean
  rejected?: boolean
  selectionReplacement?: string
  appliedAt?: number
  model?: string
  provider?: string
  providerLabel?: string
  explainability?: import("@/lib/ai-transparency").AiExplainability
}
