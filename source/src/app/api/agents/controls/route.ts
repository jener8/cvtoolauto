import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import {
  getAgentControls,
  isAgentControlKey,
  setAgentPaused,
} from "@/lib/agents/agent-controls"

export const runtime = "nodejs"

/**
 * GET /api/agents/controls — pause state for Job Scout / Company Scout / Assessor / Writer
 */
export async function GET() {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  try {
    const controls = await getAgentControls({
      userId: ctx.userId,
      client: ctx.supabase,
      signal: ctx.controller.signal,
    })
    return NextResponse.json({ controls })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load agent controls"
    console.error("[api/agents/controls] GET", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

/**
 * PATCH /api/agents/controls — { agentKey, paused }
 */
export async function PATCH(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { agentKey?: unknown; paused?: unknown }
  try {
    body = (await request.json()) as { agentKey?: unknown; paused?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isAgentControlKey(body.agentKey)) {
    return NextResponse.json(
      {
        error: "agentKey must be one of: job_scout, company_scout, assessor, writer",
      },
      { status: 400 },
    )
  }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused must be a boolean" }, { status: 400 })
  }

  try {
    const controls = await setAgentPaused({
      userId: ctx.userId,
      client: ctx.supabase,
      agentKey: body.agentKey,
      paused: body.paused,
      signal: ctx.controller.signal,
    })
    return NextResponse.json({ controls, agentKey: body.agentKey, paused: body.paused })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update agent controls"
    console.error("[api/agents/controls] PATCH", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
