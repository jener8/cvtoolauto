import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { shortlistJobs, skipJobs } from "@/lib/agents/gate-actions"
import { assertSingleJobGate } from "@/lib/agents/status-machine"

export const runtime = "nodejs"

type Body = {
  action?: string
  jobIds?: unknown
}

/**
 * POST /api/agents/jobs/gate
 * Gate 1 bulk: { action: "shortlist"|"skip", jobIds: string[] }
 * Gate 2/3 bulk is rejected (use /jobs/[id]/action).
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const action = (body.action ?? "").trim()
  const jobIds = Array.isArray(body.jobIds)
    ? body.jobIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : []

  if (action === "approve_documents" || action === "start_send" || action === "mark_sent") {
    try {
      assertSingleJobGate(action === "approve_documents" ? "gate2" : "gate3", jobIds)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Bulk not allowed" },
        { status: 400 },
      )
    }
    return NextResponse.json(
      {
        error: "Use POST /api/agents/jobs/[id]/action for Gate 2 and Gate 3 (one job at a time)",
      },
      { status: 400 },
    )
  }

  if (action !== "shortlist" && action !== "skip") {
    return NextResponse.json(
      { error: 'action must be "shortlist" or "skip" (Gate 1 bulk only)' },
      { status: 400 },
    )
  }

  try {
    const base = {
      userId: gate.ctx.userId,
      client: gate.ctx.supabase,
      jobIds,
      signal: gate.ctx.controller.signal,
    }
    const result =
      action === "shortlist" ? await shortlistJobs(base) : await skipJobs(base)
    return NextResponse.json({ ok: true, action, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gate action failed" },
      { status: 400 },
    )
  }
}
