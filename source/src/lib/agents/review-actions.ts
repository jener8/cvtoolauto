/**
 * Phase 6–8 human review actions on agent_jobs.
 * Never auto-submits to employer portals.
 * Email finalize: Gmail API when OAuth env is set; otherwise safe stub / no-send.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AgentApplyMethod, AgentJobKind, AgentJobStatus } from "@/lib/agents/types"
import { SEND_UNDO_MS } from "@/lib/agents/copy"
import {
  hasGmailApiCredentials,
  isGmailConnected,
  sendApplicationEmailViaGmail,
} from "@/lib/agents/gmail-send"

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
  return data as AgentJobRow
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
  return data as AgentJobRow
}

async function hasDraft(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<boolean> {
  let query = input.client
    .from("agent_drafts")
    .select("id")
    .eq("user_id", input.userId)
    .eq("job_id", input.jobId)
    .limit(1)
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query.maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

async function loadLatestDraft(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<{ cover_text: string | null; cv_text: string | null } | null> {
  let query = input.client
    .from("agent_drafts")
    .select("cover_text, cv_text, version")
    .eq("user_id", input.userId)
    .eq("job_id", input.jobId)
    .order("version", { ascending: false })
    .limit(1)
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    cover_text: (data.cover_text as string | null) ?? null,
    cv_text: (data.cv_text as string | null) ?? null,
  }
}

/** reviewing (+ draft) → approved */
export async function approveAgentJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  if (job.status !== "reviewing") {
    throw new Error("Only jobs in reviewing can be approved")
  }
  const draftOk = await hasDraft(input)
  if (!draftOk) {
    throw new Error("Approve requires a draft CV/cover letter first")
  }

  const updated = await updateJob({
    ...input,
    patch: {
      status: "approved",
      sending_started_at: null,
    },
  })

  return { jobId: updated.id, status: updated.status }
}

/** Keep job (dedupe), optional reason → rejected */
export async function rejectAgentJob(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  reason?: string | null
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  const allowed: AgentJobStatus[] = [
    "new",
    "needs_manual_review",
    "reviewing",
    "changes_requested",
    "approved",
    "sending",
    "not_relevant",
  ]
  if (!allowed.includes(job.status)) {
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

  return {
    jobId: updated.id,
    status: updated.status,
    rejectReason: updated.reject_reason,
  }
}

/**
 * Email / initiative: approved → sending (starts 30s undo).
 * Portal must never use this path.
 * Caller UI must show a per-item confirmation dialog before invoking.
 */
export async function startEmailSend(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  if (job.status !== "approved") {
    throw new Error("Only approved jobs can start send")
  }

  const method = job.apply_method
  const isEmailPath =
    method === "email" || job.kind === "initiative" || (method == null && Boolean(job.email_to))

  if (method === "portal") {
    throw new Error("Portal jobs cannot use email send — mark as sent after you apply yourself")
  }
  if (!isEmailPath && method !== "email") {
    // Unknown method with no email: still allow only if not portal
    if (method != null) {
      throw new Error("Apply method does not support email send")
    }
  }

  const started = new Date().toISOString()
  const updated = await updateJob({
    ...input,
    patch: {
      status: "sending",
      sending_started_at: started,
    },
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

/** sending → approved within undo window */
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
      status: "approved",
      sending_started_at: null,
    },
  })

  return {
    jobId: updated.id,
    status: updated.status,
    sendingStartedAt: null,
  }
}

/**
 * After undo window: Gmail API send (if credentials) → sent + gmail_message_id.
 * Legacy JOB_AGENT_GMAIL_CONNECTED stub marks sent with stub id (local/dev only).
 * Otherwise revert to approved (no employer email).
 */
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
    // Revert to approved — human can send outside and Mark as sent
    const updated = await updateJob({
      ...input,
      patch: {
        status: "approved",
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

  // Real Gmail API path
  if (hasGmailApiCredentials()) {
    const to = job.email_to?.trim()
    if (!to) {
      const updated = await updateJob({
        ...input,
        patch: {
          status: "approved",
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
          status: "approved",
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
      // Stay in sending? Better revert to approved so user can retry after fixing credentials.
      const updated = await updateJob({
        ...input,
        patch: {
          status: "approved",
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

  // Legacy stub when JOB_AGENT_GMAIL_CONNECTED=true but no OAuth env
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
 * Portal (or manual after email stub): approved → sent.
 * Never opens/submits an external portal.
 */
export async function markAgentJobSent(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<ReviewActionResult> {
  const job = await loadJob(input)
  if (job.status !== "approved" && job.status !== "sending") {
    throw new Error("Only approved (or cancelled-send) jobs can be marked as sent")
  }

  const updated = await updateJob({
    ...input,
    patch: {
      status: "sent",
      sending_started_at: null,
    },
  })

  return {
    jobId: updated.id,
    status: updated.status,
    sendingStartedAt: null,
  }
}

export { isGmailConnected, SEND_UNDO_MS, hasGmailApiCredentials }
