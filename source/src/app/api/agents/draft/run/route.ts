import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { runDraftGeneration } from "@/lib/agents/run-draft"

export const runtime = "nodejs"
export const maxDuration = 300

const DRAFT_RUN_TIMEOUT_MS = 280_000

/**
 * POST /api/agents/draft/run
 * Draft CV + cover for reviewing | changes_requested jobs (JOB_AGENT_DAILY_CAP).
 * Body: { maxJobs?, jobId? }
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { maxJobs?: number; jobId?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DRAFT_RUN_TIMEOUT_MS)
  try {
    const result = await runDraftGeneration({
      userId: ctx.userId,
      client: ctx.supabase,
      jobId: body.jobId?.trim() || undefined,
      maxJobs: typeof body.maxJobs === "number" ? body.maxJobs : undefined,
      signal: controller.signal,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Draft generation failed"
    console.error("[api/agents/draft/run] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
