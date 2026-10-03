/**
 * Gate 1–3 human decisions + Activity logging.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { FabricationFlag } from "@/lib/agents/types"
import {
  assertSingleJobGate,
  canApproveDocumentsStatus,
  canRejectFromStatus,
  canRequestChangesStatus,
  canShortlistStatus,
  canSkipStatus,
  canStartGate3Send,
  normalizeAgentJobStatus,
  type AgentJobStatus,
} from "@/lib/agents/status-machine"

export type GateDecision =
  | "shortlist"
  | "skip"
  | "approve_documents"
  | "request_changes"
  | "reject"
  | "start_send"
  | "mark_sent"
  | "undo_send"

async function logGateActivity(input: {
  client: SupabaseClient
  userId: string
  decision: GateDecision
  jobIds: string[]
  details?: Record<string, unknown>
  signal?: AbortSignal
}): Promise<void> {
  let query = input.client.from("agent_activity").insert({
    user_id: input.userId,
    run_at: new Date().toISOString(),
    kind: `gate_${input.decision}`,
    fetched: 0,
    relevant: 0,
    drafted: 0,
    errors: [],
    details: {
      decision: input.decision,
      jobIds: input.jobIds,
      when: new Date().toISOString(),
      ...(input.details ?? {}),
    },
  })
  if (input.signal) query = query.abortSignal(input.signal)
  const { error } = await query
  if (error) {
    console.warn("[agents/gate] activity log failed:", error.message)
  }
}

async function loadJobStatuses(input: {
  client: SupabaseClient
  userId: string
  jobIds: string[]
  signal?: AbortSignal
}): Promise<Array<{ id: string; status: string }>> {
  let query = input.client
    .from("agent_jobs")
    .select("id, status")
    .eq("user_id", input.userId)
    .in("id", input.jobIds)
  if (input.signal) query = query.abortSignal(input.signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as Array<{ id: string; status: string }> | null) ?? []
}

async function setStatus(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  status: AgentJobStatus
  patch?: Record<string, unknown>
  signal?: AbortSignal
}): Promise<void> {
  let query = input.client
    .from("agent_jobs")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
      ...(input.patch ?? {}),
    })
    .eq("user_id", input.userId)
    .eq("id", input.jobId)
  if (input.signal) query = query.abortSignal(input.signal)
  const { error } = await query
  if (error) throw new Error(error.message)
}

/** Gate 1 — bulk shortlist (potential_fit | manual → shortlisted). */
export async function shortlistJobs(input: {
  client: SupabaseClient
  userId: string
  jobIds: string[]
  signal?: AbortSignal
}): Promise<{ updated: string[]; skipped: Array<{ id: string; reason: string }> }> {
  const ids = [...new Set(input.jobIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error("Select at least one job to shortlist")

  const rows = await loadJobStatuses({ ...input, jobIds: ids })
  const updated: string[] = []
  const skipped: Array<{ id: string; reason: string }> = []

  for (const id of ids) {
    const row = rows.find((r) => r.id === id)
    if (!row) {
      skipped.push({ id, reason: "not found" })
      continue
    }
    if (!canShortlistStatus(row.status)) {
      skipped.push({
        id,
        reason: `cannot shortlist from status ${normalizeAgentJobStatus(row.status)}`,
      })
      continue
    }
    await setStatus({ ...input, jobId: id, status: "shortlisted" })
    updated.push(id)
  }

  await logGateActivity({
    ...input,
    decision: "shortlist",
    jobIds: updated,
    details: { skipped },
  })

  return { updated, skipped }
}

/** Gate 1 — bulk skip. */
export async function skipJobs(input: {
  client: SupabaseClient
  userId: string
  jobIds: string[]
  signal?: AbortSignal
}): Promise<{ updated: string[]; skipped: Array<{ id: string; reason: string }> }> {
  const ids = [...new Set(input.jobIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error("Select at least one job to skip")

  const rows = await loadJobStatuses({ ...input, jobIds: ids })
  const updated: string[] = []
  const skipped: Array<{ id: string; reason: string }> = []

  for (const id of ids) {
    const row = rows.find((r) => r.id === id)
    if (!row) {
      skipped.push({ id, reason: "not found" })
      continue
    }
    if (!canSkipStatus(row.status)) {
      skipped.push({
        id,
        reason: `cannot skip from status ${normalizeAgentJobStatus(row.status)}`,
      })
      continue
    }
    await setStatus({ ...input, jobId: id, status: "skipped" })
    updated.push(id)
  }

  await logGateActivity({
    ...input,
    decision: "skip",
    jobIds: updated,
    details: { skipped },
  })

  return { updated, skipped }
}

/** Gate 2 — approve documents (one job). */
export async function approveDocuments(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  fabricationFlags?: FabricationFlag[] | null
  signal?: AbortSignal
}): Promise<{ jobId: string; status: AgentJobStatus }> {
  assertSingleJobGate("gate2", [input.jobId])
  const rows = await loadJobStatuses({ ...input, jobIds: [input.jobId] })
  const row = rows[0]
  if (!row) throw new Error("Job not found")
  if (!canApproveDocumentsStatus(row.status)) {
    throw new Error(
      `Only drafts_ready jobs can have documents approved (got ${normalizeAgentJobStatus(row.status)})`,
    )
  }
  const flags = input.fabricationFlags
  if (flags && flags.length > 0) {
    throw new Error("Resolve open fact-check flags before approving documents")
  }

  await setStatus({ ...input, status: "documents_approved" })
  await logGateActivity({
    ...input,
    decision: "approve_documents",
    jobIds: [input.jobId],
  })
  return { jobId: input.jobId, status: "documents_approved" }
}

/** Gate 2 — request changes → Writer redrafts later. */
export async function requestDocumentChanges(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<{ jobId: string; status: AgentJobStatus }> {
  assertSingleJobGate("gate2", [input.jobId])
  const rows = await loadJobStatuses({ ...input, jobIds: [input.jobId] })
  const row = rows[0]
  if (!row) throw new Error("Job not found")
  if (!canRequestChangesStatus(row.status)) {
    throw new Error(
      `Only drafts_ready jobs can request changes (got ${normalizeAgentJobStatus(row.status)})`,
    )
  }
  await setStatus({ ...input, status: "changes_requested" })
  await logGateActivity({
    ...input,
    decision: "request_changes",
    jobIds: [input.jobId],
  })
  return { jobId: input.jobId, status: "changes_requested" }
}

export async function logGate3Activity(input: {
  client: SupabaseClient
  userId: string
  decision: Extract<GateDecision, "start_send" | "mark_sent" | "undo_send" | "reject">
  jobId: string
  details?: Record<string, unknown>
  signal?: AbortSignal
}): Promise<void> {
  await logGateActivity({
    client: input.client,
    userId: input.userId,
    decision: input.decision,
    jobIds: [input.jobId],
    details: input.details,
    signal: input.signal,
  })
}

export { canStartGate3Send, canRejectFromStatus, assertSingleJobGate, normalizeAgentJobStatus }
