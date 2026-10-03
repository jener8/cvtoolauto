import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { deleteAllAgentData } from "@/lib/agents/delete-agent-data"

export const runtime = "nodejs"

/**
 * DELETE /api/agents/data
 * GDPR: delete all agent_* rows for the workspace user.
 * Does not delete resumes, job_applications, cover letters, or folders.
 * Body optional: { confirm: "DELETE_AGENT_DATA" } required.
 */
export async function DELETE(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { confirm?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (body.confirm !== "DELETE_AGENT_DATA") {
    return NextResponse.json(
      {
        error: 'Confirmation required. Send { "confirm": "DELETE_AGENT_DATA" }.',
        code: "CONFIRMATION_REQUIRED",
      },
      { status: 400 },
    )
  }

  try {
    const result = await deleteAllAgentData({
      userId: ctx.userId,
      client: ctx.supabase,
      signal: ctx.controller.signal,
    })
    return NextResponse.json({
      ok: true,
      total: result.total,
      deleted: result.deleted,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed"
    console.error("[api/agents/data] DELETE", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
