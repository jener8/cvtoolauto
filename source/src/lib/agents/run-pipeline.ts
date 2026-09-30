/**
 * Phase 7 — daily / manual pipeline: search → relevance → draft.
 * Reuses Phase 3–5 runners; draft step already enforces JOB_AGENT_DAILY_CAP.
 * Activity log: counts only (no listing titles, company names, or fact text).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { runJobSearch } from "@/lib/agents/run-search"
import { runRelevanceReview } from "@/lib/agents/run-relevance"
import { runDraftGeneration } from "@/lib/agents/run-draft"
import { getJobAgentDailyCap } from "@/lib/agents/draft-schema"

export type PipelineTrigger = "cron" | "manual"

export type RunPipelineResult = {
  trigger: PipelineTrigger
  fetched: number
  inserted: number
  relevant: number
  drafted: number
  errors: number
  errorMessages: string[]
  dailyCap: number
  activityId: string | null
  search: Awaited<ReturnType<typeof runJobSearch>>
  review: Awaited<ReturnType<typeof runRelevanceReview>>
  draft: Awaited<ReturnType<typeof runDraftGeneration>>
}

function collectErrors(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = []
  for (const list of lists) {
    if (!list) continue
    for (const msg of list) {
      if (msg?.trim()) out.push(msg.trim())
    }
  }
  return out.slice(0, 50)
}

/**
 * Orchestrate fetch → relevance → draft for one workspace user.
 * Logs a single agent_activity row (kind cron|pipeline) with aggregate counts.
 */
export async function runDailyPipeline(input: {
  userId: string
  client: SupabaseClient
  trigger: PipelineTrigger
  signal?: AbortSignal
}): Promise<RunPipelineResult> {
  const dailyCap = getJobAgentDailyCap()
  const errorMessages: string[] = []

  const search = await runJobSearch({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  errorMessages.push(...(search.errors ?? []))

  const review = await runRelevanceReview({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  errorMessages.push(...(review.errorMessages ?? []))

  const draft = await runDraftGeneration({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  errorMessages.push(...(draft.errorMessages ?? []))

  const fetched = search.fetched ?? 0
  const relevant = review.relevant ?? 0
  const drafted = draft.drafted ?? 0
  const trimmedErrors = collectErrors(errorMessages)
  const errorsCount =
    trimmedErrors.length +
    (review.errors ?? 0) +
    (draft.errors ?? 0) +
    (search.errors?.length ?? 0)

  let activityId: string | null = null
  try {
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: input.trigger === "cron" ? "cron" : "pipeline",
      fetched,
      relevant,
      drafted,
      errors: trimmedErrors,
      details: {
        trigger: input.trigger,
        inserted: search.inserted ?? 0,
        duplicates: search.duplicates ?? 0,
        reviewed: review.reviewed ?? 0,
        not_relevant: review.notRelevant ?? 0,
        needs_manual_review: review.needsManualReview ?? 0,
        draft_skipped_cap: draft.skippedCap ?? 0,
        daily_cap: dailyCap,
        drafted_today_before: draft.draftedTodayBefore ?? 0,
        search_activity_id: search.activityId,
        review_activity_id: review.activityId,
        draft_activity_id: draft.activityId,
      },
    })
    if (input.signal) activityQuery = activityQuery.abortSignal(input.signal)
    const { data: activity, error: activityError } = await activityQuery.select("id").single()
    if (activityError) {
      trimmedErrors.push(`pipeline activity log: ${activityError.message}`)
    } else {
      activityId = (activity?.id as string) ?? null
    }
  } catch (e) {
    trimmedErrors.push(
      e instanceof Error ? `pipeline activity log: ${e.message}` : "pipeline activity log failed",
    )
  }

  console.info("[agents/pipeline] complete", {
    trigger: input.trigger,
    fetched,
    relevant,
    drafted,
    errors: trimmedErrors.length,
  })

  return {
    trigger: input.trigger,
    fetched,
    inserted: search.inserted ?? 0,
    relevant,
    drafted,
    errors: Math.max(errorsCount, trimmedErrors.length),
    errorMessages: trimmedErrors,
    dailyCap,
    activityId,
    search,
    review,
    draft,
  }
}
