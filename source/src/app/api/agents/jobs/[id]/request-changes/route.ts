import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { requestDraftChanges } from "@/lib/agents/run-draft"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/agents/jobs/[id]/request-changes
 * Sets status to changes_requested (Writer redraft via draft endpoint).
 */
export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const jobId = id?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  try {
    await requestDraftChanges({
      userId: gate.ctx.userId,
      client: gate.ctx.supabase,
      jobId,
      signal: gate.ctx.controller.signal,
    })
    return NextResponse.json({ ok: true, status: "changes_requested" })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not request changes"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
