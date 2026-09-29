import { createAuditEntryId, providerDisplayName } from "@/lib/ai-transparency"
import { appendFolderAiActivity } from "@/lib/ai-activity-log"
import type { AiApprovalStatus } from "@/lib/types"

export type CoverLetterAiMetadata = {
  model: string
  provider: string
  providerLabel?: string
  generatedAt: number
  status: "pending_review" | "accepted" | "rejected"
  acceptedAt?: number
  rejectedAt?: number
}

export type CoverLetterVersionSnapshot = {
  id: string
  label: string
  contentEn: string
  contentDe: string
  createdAt: number
  source: "user" | "ai_generated"
}

export function createCoverLetterVersionId(): string {
  return `clv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function logCoverLetterAiActivity(opts: {
  folderId?: string
  action: string
  model: string
  provider: string
  approvalStatus: AiApprovalStatus
  documentName?: string
}): void {
  if (!opts.folderId) return
  const now = Date.now()
  appendFolderAiActivity(opts.folderId, {
    id: createAuditEntryId(),
    createdAt: now,
    action: opts.action,
    model: opts.model,
    provider: opts.provider,
    providerLabel: providerDisplayName(opts.provider),
    approvalStatus: opts.approvalStatus,
    approvedAt: opts.approvalStatus === "approved" ? now : undefined,
    rejectedAt: opts.approvalStatus === "rejected" ? now : undefined,
    feature: "cover_letter_generation",
    resumeName: opts.documentName,
  })
}
