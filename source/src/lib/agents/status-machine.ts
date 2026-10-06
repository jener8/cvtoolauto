/**
 * Job agents three-gate status machine.
 * Assessor outcome → Gate 1 (shortlist) → Writer → Gate 2 (documents) → Gate 3 (send).
 */

export type AgentJobStatus =
  | "new"
  | "potential_fit"
  | "not_a_fit"
  | "manual"
  | "shortlisted"
  | "skipped"
  | "drafting"
  | "drafts_ready"
  | "changes_requested"
  | "documents_approved"
  | "sending"
  | "sent"
  | "rejected"
  /** @deprecated Mapped to potential_fit — kept for reading pre-migration rows briefly */
  | "reviewing"
  /** @deprecated Mapped to not_a_fit */
  | "not_relevant"
  /** @deprecated Mapped to manual */
  | "needs_manual_review"
  /** @deprecated Mapped to documents_approved */
  | "approved"

export const AGENT_JOB_STATUSES: AgentJobStatus[] = [
  "new",
  "potential_fit",
  "not_a_fit",
  "manual",
  "shortlisted",
  "skipped",
  "drafting",
  "drafts_ready",
  "changes_requested",
  "documents_approved",
  "sending",
  "sent",
  "rejected",
]

/** Canonical statuses written by new code (no deprecated aliases). */
export const AGENT_JOB_STATUSES_CANONICAL = AGENT_JOB_STATUSES

/** Writer may only draft these. */
export const DRAFT_ELIGIBLE_STATUSES: AgentJobStatus[] = ["shortlisted", "changes_requested"]

/** Gate 1 — bulk shortlist / skip. */
export const GATE1_ELIGIBLE: AgentJobStatus[] = ["potential_fit", "manual"]

/** Gate 2 — documents approve / request changes (one at a time). */
export const GATE2_ELIGIBLE: AgentJobStatus[] = ["drafts_ready"]

/** Gate 3 — send / mark sent (one at a time). */
export const GATE3_ELIGIBLE: AgentJobStatus[] = ["documents_approved"]

/** Map legacy DB statuses to the three-gate model. */
export function normalizeAgentJobStatus(status: string): AgentJobStatus {
  switch (status) {
    case "reviewing":
      return "potential_fit"
    case "not_relevant":
      return "not_a_fit"
    case "needs_manual_review":
      return "manual"
    case "approved":
      return "documents_approved"
    default:
      return status as AgentJobStatus
  }
}

export function isDraftEligibleStatus(status: string): boolean {
  return DRAFT_ELIGIBLE_STATUSES.includes(normalizeAgentJobStatus(status))
}

export function canShortlistStatus(status: string): boolean {
  return GATE1_ELIGIBLE.includes(normalizeAgentJobStatus(status))
}

export function canSkipStatus(status: string): boolean {
  return GATE1_ELIGIBLE.includes(normalizeAgentJobStatus(status))
}

export function canApproveDocumentsStatus(status: string): boolean {
  return GATE2_ELIGIBLE.includes(normalizeAgentJobStatus(status))
}

export function canRequestChangesStatus(status: string): boolean {
  return GATE2_ELIGIBLE.includes(normalizeAgentJobStatus(status))
}

export type SendBlocker =
  | { ok: true }
  | { ok: false; reason: string }

/** Gate 3: documents_approved + no open fabrication/safety flags. */
export function canStartGate3Send(input: {
  status: string
  applyMethod: "email" | "portal" | null
  fabricationFlags?: Array<{ claim?: string }> | null
}): SendBlocker {
  const status = normalizeAgentJobStatus(input.status)
  if (status !== "documents_approved") {
    return { ok: false, reason: "Only documents_approved jobs can enter Gate 3 (send)" }
  }
  const flags = input.fabricationFlags ?? []
  if (flags.length > 0) {
    return {
      ok: false,
      reason: "Cannot send while fact-check or safety flags are open — resolve flags first",
    }
  }
  return { ok: true }
}

/** Bulk Gate 3 is never allowed. */
export function assertSingleJobGate(action: "gate2" | "gate3", jobIds: string[]): void {
  if (jobIds.length !== 1) {
    throw new Error(
      action === "gate3"
        ? "Gate 3 (send) allows only one job at a time — no bulk send"
        : "Gate 2 (documents) allows only one job at a time — no bulk approval",
    )
  }
}

export function canRejectFromStatus(status: string): boolean {
  const s = normalizeAgentJobStatus(status)
  return s !== "sent" && s !== "rejected" && s !== "skipped"
}
