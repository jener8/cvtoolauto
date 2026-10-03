import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { runRelevanceReview } from "@/lib/agents/run-relevance"

export const runtime = "nodejs"
export const maxDuration = 120

const PER_JOB_TIMEOUT_MS = 100_000

/**
 * POST /api/agents/jobs/[id]/review
 * Manually review one job (status new or needs_manual_review).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const jobId = id?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "Job id is required" }, { status: 400 })
  }

  const { ctx } = gate
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_JOB_TIMEOUT_MS)
  try {
    const result = await runRelevanceReview({
      userId: ctx.userId,
      client: ctx.supabase,
      jobId,
      maxJobs: 1,
      signal: controller.signal,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Relevance review failed"
    console.error("[api/agents/jobs/[id]/review] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
