import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { addAgentJobToApplications } from "@/lib/agents/add-to-applications"

export const runtime = "nodejs"

/**
 * POST /api/agents/jobs/[id]/add-to-applications
 * Opt-in: create a NEW job_applications row from approved/sent agent job + draft.
 * Never modifies existing application records.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const agentJobId = id?.trim()
  if (!agentJobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  try {
    const result = await addAgentJobToApplications({
      userId: gate.ctx.userId,
      client: gate.ctx.supabase,
      agentJobId,
      signal: gate.ctx.controller.signal,
    })

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "STATUS_NOT_SYNCABLE"
            ? 409
            : 503
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status },
      )
    }

    return NextResponse.json({
      ok: true,
      created: result.created,
      applicationId: result.applicationId,
      agentJobId: result.agentJobId,
      reason: "reason" in result ? result.reason : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Add to applications failed"
    console.error("[api/agents/jobs/add-to-applications] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
