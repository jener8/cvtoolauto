import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { runDraftGeneration } from "@/lib/agents/run-draft"

export const runtime = "nodejs"
export const maxDuration = 300

const DRAFT_TIMEOUT_MS = 280_000

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/agents/jobs/[id]/draft
 * Generate (or redraft) CV + cover for one reviewing | changes_requested job.
 */
export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const jobId = id?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS)
  try {
    const result = await runDraftGeneration({
      userId: gate.ctx.userId,
      client: gate.ctx.supabase,
      jobId,
      signal: controller.signal,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Draft failed"
    console.error("[api/agents/jobs/[id]/draft] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
