import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import {
  approveAgentJob,
  completeEmailSend,
  markAgentJobSent,
  rejectAgentJob,
  requestChangesAgentJob,
  startEmailSend,
  undoEmailSend,
} from "@/lib/agents/review-actions"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

type ActionBody = {
  action?: string
  reason?: string | null
  force?: boolean
}

const ACTIONS = [
  "approve",
  "request_changes",
  "reject",
  "start_send",
  "undo_send",
  "complete_send",
  "mark_sent",
] as const

type ActionName = (typeof ACTIONS)[number]

/**
 * POST /api/agents/jobs/[id]/action
 * Gate 2/3 human actions (one job). Never portal-auto-applies. No bulk.
 */
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const jobId = id?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  let body: ActionBody = {}
  try {
    body = (await request.json()) as ActionBody
  } catch {
    body = {}
  }

  const action = (body.action ?? "").trim() as ActionName
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Use one of: ${ACTIONS.join(", ")}` },
      { status: 400 },
    )
  }

  const base = {
    userId: gate.ctx.userId,
    client: gate.ctx.supabase,
    jobId,
    signal: gate.ctx.controller.signal,
  }

  try {
    let result
    switch (action) {
      case "approve":
        result = await approveAgentJob(base)
        break
      case "request_changes":
        result = await requestChangesAgentJob(base)
        break
      case "reject":
        result = await rejectAgentJob({ ...base, reason: body.reason })
        break
      case "start_send":
        result = await startEmailSend(base)
        break
      case "undo_send":
        result = await undoEmailSend(base)
        break
      case "complete_send":
        result = await completeEmailSend({ ...base, force: body.force === true })
        break
      case "mark_sent":
        result = await markAgentJobSent(base)
        break
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
