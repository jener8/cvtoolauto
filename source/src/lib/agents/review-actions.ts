/**
 * Phase 6–8 human review actions — three-gate model.
 * Gate 2 approve documents / Gate 3 send. Never auto-submits to portals.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AgentApplyMethod, AgentJobKind, AgentJobStatus } from "@/lib/agents/types"
import { SEND_UNDO_MS } from "@/lib/agents/copy"
import {
  hasGmailApiCredentials,
  isGmailConnected,
  sendApplicationEmailViaGmail,
} from "@/lib/agents/gmail-send"
import {
  approveDocuments,
  assertSingleJobGate,
  canRejectFromStatus,
  canStartGate3Send,
  logGate3Activity,
  normalizeAgentJobStatus,
  requestDocumentChanges,
} from "@/lib/agents/gate-actions"
import type { FabricationFlag } from "@/lib/agents/types"

export type AgentJobRow = {
  id: string
  status: AgentJobStatus
  kind: AgentJobKind
  apply_method: AgentApplyMethod | null
  email_to: string | null
  reject_reason: string | null
  gmail_message_id: string | null
  sending_started_at: string | null
  title?: string | null
}

export type ReviewActionResult = {
  jobId: string
  status: AgentJobStatus
  sendingStartedAt?: string | null
  gmailMessageId?: string | null
  rejectReason?: string | null
  gmailConnected?: boolean
  message?: string
}

async function loadJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<AgentJobRow> {
  let query = input.client
    .from("agent_jobs")
    .select(
      "id, status, kind, apply_method, email_to, reject_reason, gmail_message_id, sending_started_at, title",
    )
    .eq("user_id", input.userId)
    .eq("id", input.jobId)
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query.maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Job not found")
  return {
    ...(data as AgentJobRow),
    status: normalizeAgentJobStatus((data as AgentJobRow).status),
  }
}

async function updateJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  patch: Record<string, unknown>
  signal?: AbortSignal
}): Promise<AgentJobRow> {
  let query = input.client
    .from("agent_jobs")
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("id", input.jobId)
    .select(
      "id, status, kind, apply_method, email_to, reject_reason, gmail_message_id, sending_started_at, title",
    )
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query.single()

  if (error) throw new Error(error.message)
  return {
    ...(data as AgentJobRow),
    status: normalizeAgentJobStatus((data as AgentJobRow).status),
  }
}

async function loadLatestDraft(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<{
  cover_text: string | null
  cv_text: string | null
  fabrication_flags: FabricationFlag[]
} | null> {
  let query = input.client
    .from("agent_drafts")
    .select("cover_text, cv_text, version, fabrication_flags")
    .eq("user_id", input.userId)
    .eq("job_id", input.jobId)
    .order("version", { ascending: false })
    .limit(1)
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const flags = Array.isArray(data.fabrication_flags)
    ? (data.fabrication_flags as FabricationFlag[])
    : []
  return {
    cover_text: (data.cover_text as string | null) ?? null,
    cv_text: (data.cv_text as string | null) ?? null,
    fabrication_flags: flags,
  }
}

/** Gate 2: drafts_ready → documents_approved (one job). */
export async function approveAgentJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  assertSingleJobGate("gate2", [input.jobId])
  const draft = await loadLatestDraft(input)
  if (!draft) {
    throw new Error("Approve documents requires a draft CV/cover letter first")
  }
  const result = await approveDocuments({
    ...input,
    fabricationFlags: draft.fabrication_flags,
  })
  return { jobId: result.jobId, status: result.status }
}

/** Gate 2: drafts_ready → changes_requested */
export async function requestChangesAgentJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const result = await requestDocumentChanges(input)
  return { jobId: result.jobId, status: result.status }
}

/** Reject at any gate (except sent / already rejected / skipped). */
export async function rejectAgentJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  reason?: string | null
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  if (!canRejectFromStatus(job.status)) {
    throw new Error(`Cannot reject from status ${job.status}`)
  }

  const reason = input.reason?.trim() || null
  const updated = await updateJob({
    ...input,
    patch: {
      status: "rejected",
      reject_reason: reason,
      sending_started_at: null,
    },
  })

  await logGate3Activity({
    ...input,
    decision: "reject",
    jobId: updated.id,
    details: { reason },
  })

  return {
    jobId: updated.id,
    status: updated.status,
    rejectReason: updated.reject_reason,
  }
}

/**
 * Gate 3 email: documents_approved → sending (30s undo).
 * Portal must never use this path. One job only.
 */
export async function startEmailSend(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  assertSingleJobGate("gate3", [input.jobId])
  const job = await loadJob(input)
  const draft = await loadLatestDraft(input)
  const gate = canStartGate3Send({
    status: job.status,
    applyMethod: job.apply_method,
    fabricationFlags: draft?.fabrication_flags ?? [],
  })
  if (!gate.ok) throw new Error(gate.reason)

  const method = job.apply_method
  const isEmailPath =
    method === "email" || job.kind === "initiative" || (method == null && Boolean(job.email_to))

  if (method === "portal") {
    throw new Error("Portal jobs cannot use email send — open the portal, then mark as sent")
  }
  if (!isEmailPath && method != null && method !== "email") {
    throw new Error("Apply method does not support email send")
  }

  const started = new Date().toISOString()
  const updated = await updateJob({
    ...input,
    patch: {
      status: "sending",
      sending_started_at: started,
    },
  })

  await logGate3Activity({
    ...input,
    decision: "start_send",
    jobId: updated.id,
    details: { applyMethod: method, emailTo: job.email_to },
  })

  const connected = isGmailConnected()
  return {
    jobId: updated.id,
    status: updated.status,
    sendingStartedAt: updated.sending_started_at,
    gmailConnected: connected,
    message: connected
      ? undefined
      : "Gmail not connected — after the undo window, send will be skipped; you can mark as sent manually.",
  }
}

/** sending → documents_approved within undo window */
export async function undoEmailSend(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  if (job.status !== "sending") {
    throw new Error("Only sending jobs can be undone")
  }

  const updated = await updateJob({
    ...input,
    patch: {
      status: "documents_approved",
      sending_started_at: null,
    },
  })

  await logGate3Activity({
    ...input,
    decision: "undo_send",
    jobId: updated.id,
  })

  return {
    jobId: updated.id,
    status: updated.status,
    sendingStartedAt: null,
  }
}

export async function completeEmailSend(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  force?: boolean
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  if (job.status !== "sending") {
    throw new Error("Only sending jobs can be finalized")
  }

  if (!input.force && job.sending_started_at) {
    const started = Date.parse(job.sending_started_at)
    const elapsed = Date.now() - started
    if (Number.isFinite(started) && elapsed < SEND_UNDO_MS) {
      throw new Error(
        `Undo window still open (${Math.ceil((SEND_UNDO_MS - elapsed) / 1000)}s remaining)`,
      )
    }
  }

  if (!isGmailConnected()) {
    const updated = await updateJob({
      ...input,
      patch: {
        status: "documents_approved",
        sending_started_at: null,
      },
    })
    return {
      jobId: updated.id,
      status: updated.status,
      sendingStartedAt: null,
      gmailConnected: false,
      message: "Gmail is not connected. Email was not sent.",
    }
  }

  if (hasGmailApiCredentials()) {
    const to = job.email_to?.trim()
    if (!to) {
      const updated = await updateJob({
        ...input,
        patch: {
          status: "documents_approved",
          sending_started_at: null,
        },
      })
      return {
        jobId: updated.id,
        status: updated.status,
        sendingStartedAt: null,
        gmailConnected: true,
        message: "No recipient email on this job — send skipped. Add email_to or mark as sent manually.",
      }
    }

    const draft = await loadLatestDraft(input)
    const cover = draft?.cover_text?.trim() ?? ""
    if (!cover) {
      const updated = await updateJob({
        ...input,
        patch: {
          status: "documents_approved",
          sending_started_at: null,
        },
      })
      return {
        jobId: updated.id,
        status: updated.status,
        sendingStartedAt: null,
        gmailConnected: true,
        message: "Cover letter is empty — edit the draft, then start send again.",
      }
    }

    const title = job.title?.trim() || "Application"
    try {
      const sent = await sendApplicationEmailViaGmail({
        to,
        subject: `Application: ${title}`,
        bodyText: cover,
        cvText: draft?.cv_text ?? null,
        signal: input.signal,
      })

      const updated = await updateJob({
        ...input,
        patch: {
          status: "sent",
          gmail_message_id: sent.messageId,
          sending_started_at: null,
        },
      })

      return {
        jobId: updated.id,
        status: updated.status,
        gmailMessageId: updated.gmail_message_id,
        gmailConnected: true,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gmail send failed"
      const updated = await updateJob({
        ...input,
        patch: {
          status: "documents_approved",
          sending_started_at: null,
        },
      })
      return {
        jobId: updated.id,
        status: updated.status,
        sendingStartedAt: null,
        gmailConnected: true,
        message,
      }
    }
  }

  const messageId = `stub-gmail-${job.id.slice(0, 8)}-${Date.now()}`
  const updated = await updateJob({
    ...input,
    patch: {
      status: "sent",
      gmail_message_id: messageId,
      sending_started_at: null,
    },
  })

  return {
    jobId: updated.id,
    status: updated.status,
    gmailMessageId: updated.gmail_message_id,
    gmailConnected: true,
    message: "Stub send (JOB_AGENT_GMAIL_CONNECTED) — configure Gmail OAuth env for a real send.",
  }
}

/**
 * Gate 3 portal / manual: documents_approved | sending → sent.
 * Never opens/submits an external portal.
 */
export async function markAgentJobSent(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  assertSingleJobGate("gate3", [input.jobId])
  const job = await loadJob(input)
  const status = normalizeAgentJobStatus(job.status)
  if (status !== "documents_approved" && status !== "sending") {
    throw new Error("Only documents_approved (or cancelled-send) jobs can be marked as sent")
  }

  if (status === "documents_approved") {
    const draft = await loadLatestDraft(input)
    const gate = canStartGate3Send({
      status,
      applyMethod: job.apply_method,
      fabricationFlags: draft?.fabrication_flags ?? [],
    })
    if (!gate.ok) throw new Error(gate.reason)
  }

  const updated = await updateJob({
    ...input,
    patch: {
      status: "sent",
      sending_started_at: null,
    },
  })

  await logGate3Activity({
    ...input,
    decision: "mark_sent",
    jobId: updated.id,
    details: { applyMethod: job.apply_method },
  })

  return {
    jobId: updated.id,
    status: updated.status,
    sendingStartedAt: null,
  }
}

export { isGmailConnected, SEND_UNDO_MS, hasGmailApiCredentials }
