import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import {
  isJobAgentAutoReviewEnabled,
  runRelevanceReview,
} from "@/lib/agents/run-relevance"
import { runJobSearch } from "@/lib/agents/run-search"

export const runtime = "nodejs"
export const maxDuration = 300

/** Longer than default Supabase 12s — BA detail fetches + multi-source upsert (+ optional review). */
const SEARCH_RUN_TIMEOUT_MS = 280_000

/**
 * POST /api/agents/search/run
 * Manual “Run search”: fetch BA + Arbeitnow (+ Adzuna if keyed), normalize, dedupe, upsert.
 * Optional Claude relevance when body.autoReview=true or JOB_AGENT_AUTO_REVIEW=true.
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { autoReview?: boolean } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const autoReview = body.autoReview === true || isJobAgentAutoReviewEnabled()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_RUN_TIMEOUT_MS)
  try {
    const result = await runJobSearch({
      userId: ctx.userId,
      client: ctx.supabase,
      signal: controller.signal,
    })

    let review = null
    if (autoReview && result.inserted > 0) {
      review = await runRelevanceReview({
        userId: ctx.userId,
        client: ctx.supabase,
        signal: controller.signal,
      })
    }

    return NextResponse.json({ ...result, autoReview, review })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search run failed"
    console.error("[api/agents/search/run] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
