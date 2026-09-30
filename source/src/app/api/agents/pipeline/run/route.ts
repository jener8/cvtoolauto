import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { runDailyPipeline } from "@/lib/agents/run-pipeline"

export const runtime = "nodejs"
export const maxDuration = 300

const PIPELINE_TIMEOUT_MS = 280_000

/**
 * POST /api/agents/pipeline/run
 * Manual “Run now”: search → relevance → draft (respects JOB_AGENT_DAILY_CAP).
 */
export async function POST() {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS)
  try {
    const result = await runDailyPipeline({
      userId: ctx.userId,
      client: ctx.supabase,
      trigger: "manual",
      signal: controller.signal,
    })

    return NextResponse.json({
      ok: true,
      trigger: result.trigger,
      fetched: result.fetched,
      inserted: result.inserted,
      relevant: result.relevant,
      drafted: result.drafted,
      errors: result.errors,
      errorMessages: result.errorMessages.slice(0, 20),
      dailyCap: result.dailyCap,
      activityId: result.activityId,
      search: {
        fetched: result.search.fetched,
        inserted: result.search.inserted,
        duplicates: result.search.duplicates,
      },
      review: {
        reviewed: result.review.reviewed,
        relevant: result.review.relevant,
        notRelevant: result.review.notRelevant,
        needsManualReview: result.review.needsManualReview,
        errors: result.review.errors,
      },
      draft: {
        drafted: result.draft.drafted,
        skippedCap: result.draft.skippedCap,
        errors: result.draft.errors,
        flagsTotal: result.draft.flagsTotal,
        dailyCap: result.draft.dailyCap,
        draftedTodayBefore: result.draft.draftedTodayBefore,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pipeline run failed"
    console.error("[api/agents/pipeline/run] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
