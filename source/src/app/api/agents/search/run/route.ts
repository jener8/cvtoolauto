import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { runJobSearch } from "@/lib/agents/run-search"

export const runtime = "nodejs"
export const maxDuration = 60

/** Longer than default Supabase 12s — BA detail fetches + multi-source upsert. */
const SEARCH_RUN_TIMEOUT_MS = 55_000

/**
 * POST /api/agents/search/run
 * Manual “Run search”: fetch BA + Arbeitnow (+ Adzuna if keyed), normalize, dedupe, upsert.
 * No Claude relevance (Phase 4).
 */
export async function POST() {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_RUN_TIMEOUT_MS)
  try {
    const result = await runJobSearch({
      userId: ctx.userId,
      client: ctx.supabase,
      signal: controller.signal,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search run failed"
    console.error("[api/agents/search/run] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
