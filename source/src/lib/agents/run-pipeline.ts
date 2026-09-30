/**
 * Phase 9 — scheduling orchestration.
 * Job Scout pipeline: search → assess → draft (within caps / pause flags).
 * Company Scout pipeline: company discovery → assess → draft.
 * Activity logs include agent name/kind and counts only (no extra PII).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getAgentControls,
  isAgentPaused,
  type AgentControlKey,
} from "@/lib/agents/agent-controls"
import { getJobDraftsDailyCap } from "@/lib/agents/draft-schema"
import { runCompanyScout } from "@/lib/agents/run-company-scout"
import { runDraftGeneration } from "@/lib/agents/run-draft"
import { runRelevanceReview } from "@/lib/agents/run-relevance"
import { runJobSearch } from "@/lib/agents/run-search"

export type PipelineTrigger = "cron" | "manual"

export type CronAgent = "job_scout" | "company_scout"

export type RunPipelineResult = {
  trigger: PipelineTrigger
  agent: CronAgent | "pipeline"
  skippedPaused: AgentControlKey[]
  fetched: number
  inserted: number
  relevant: number
  drafted: number
  errors: number
  errorMessages: string[]
  dailyCap: number
  activityId: string | null
  search: Awaited<ReturnType<typeof runJobSearch>> | null
  companyScout: Awaited<ReturnType<typeof runCompanyScout>> | null
  review: Awaited<ReturnType<typeof runRelevanceReview>> | null
  draft: Awaited<ReturnType<typeof runDraftGeneration>> | null
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

async function runAssessAndDraft(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
  force?: boolean
}): Promise<{
  review: Awaited<ReturnType<typeof runRelevanceReview>> | null
  draft: Awaited<ReturnType<typeof runDraftGeneration>> | null
  skippedPaused: AgentControlKey[]
  errorMessages: string[]
}> {
  const skippedPaused: AgentControlKey[] = []
  const errorMessages: string[] = []
  let review: Awaited<ReturnType<typeof runRelevanceReview>> | null = null
  let draft: Awaited<ReturnType<typeof runDraftGeneration>> | null = null

  const assessorPaused =
    !input.force &&
    (await isAgentPaused({
      userId: input.userId,
      client: input.client,
      agentKey: "assessor",
      signal: input.signal,
    }))
  if (assessorPaused) {
    skippedPaused.push("assessor")
  } else {
    review = await runRelevanceReview({
      userId: input.userId,
      client: input.client,
      signal: input.signal,
    })
    errorMessages.push(...(review.errorMessages ?? []))
  }

  const writerPaused =
    !input.force &&
    (await isAgentPaused({
      userId: input.userId,
      client: input.client,
      agentKey: "writer",
      signal: input.signal,
    }))
  if (writerPaused) {
    skippedPaused.push("writer")
  } else {
    draft = await runDraftGeneration({
      userId: input.userId,
      client: input.client,
      signal: input.signal,
    })
    errorMessages.push(...(draft.errorMessages ?? []))
  }

  return { review, draft, skippedPaused, errorMessages }
}

/**
 * Job Scout → Assessor → Writer (respects pause + JOB_DRAFTS_DAILY_CAP).
 */
export async function runJobScoutPipeline(input: {
  userId: string
  client: SupabaseClient
  trigger: PipelineTrigger
  signal?: AbortSignal
  /** When true (manual per-agent), ignore pause for the requested steps. */
  forceScout?: boolean
}): Promise<RunPipelineResult> {
  const dailyCap = getJobDraftsDailyCap()
  const skippedPaused: AgentControlKey[] = []
  const errorMessages: string[] = []

  const scoutPaused =
    !input.forceScout &&
    (await isAgentPaused({
      userId: input.userId,
      client: input.client,
      agentKey: "job_scout",
      signal: input.signal,
    }))

  let search: Awaited<ReturnType<typeof runJobSearch>> | null = null
  if (scoutPaused) {
    skippedPaused.push("job_scout")
  } else {
    search = await runJobSearch({
      userId: input.userId,
      client: input.client,
      signal: input.signal,
    })
    errorMessages.push(...(search.errors ?? []))
  }

  const follow = await runAssessAndDraft({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  skippedPaused.push(...follow.skippedPaused)
  errorMessages.push(...follow.errorMessages)

  return finalizePipelineResult({
    trigger: input.trigger,
    agent: "job_scout",
    skippedPaused,
    errorMessages,
    dailyCap,
    search,
    companyScout: null,
    review: follow.review,
    draft: follow.draft,
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
}

/**
 * Company Scout → Assessor → Writer (weekly cap on scout step).
 */
export async function runCompanyScoutPipeline(input: {
  userId: string
  client: SupabaseClient
  trigger: PipelineTrigger
  signal?: AbortSignal
  forceScout?: boolean
}): Promise<RunPipelineResult> {
  const dailyCap = getJobDraftsDailyCap()
  const skippedPaused: AgentControlKey[] = []
  const errorMessages: string[] = []

  const scoutPaused =
    !input.forceScout &&
    (await isAgentPaused({
      userId: input.userId,
      client: input.client,
      agentKey: "company_scout",
      signal: input.signal,
    }))

  let companyScout: Awaited<ReturnType<typeof runCompanyScout>> | null = null
  if (scoutPaused) {
    skippedPaused.push("company_scout")
  } else {
    companyScout = await runCompanyScout({
      userId: input.userId,
      client: input.client,
      signal: input.signal,
    })
    errorMessages.push(...(companyScout.errors ?? []))
  }

  const follow = await runAssessAndDraft({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  skippedPaused.push(...follow.skippedPaused)
  errorMessages.push(...follow.errorMessages)

  return finalizePipelineResult({
    trigger: input.trigger,
    agent: "company_scout",
    skippedPaused,
    errorMessages,
    dailyCap,
    search: null,
    companyScout,
    review: follow.review,
    draft: follow.draft,
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
}

/** Backward-compatible alias — full Job Scout pipeline. */
export async function runDailyPipeline(input: {
  userId: string
  client: SupabaseClient
  trigger: PipelineTrigger
  signal?: AbortSignal
}): Promise<RunPipelineResult> {
  return runJobScoutPipeline(input)
}

/**
 * Run a single agent step (manual Run now / pause-respecting unless force).
 */
export async function runSingleAgent(input: {
  userId: string
  client: SupabaseClient
  agentKey: AgentControlKey
  signal?: AbortSignal
  /** Manual Run now ignores pause for this agent. */
  force?: boolean
}): Promise<{
  agentKey: AgentControlKey
  paused: boolean
  skipped: boolean
  result: unknown
  activityId: string | null
  errorMessages: string[]
}> {
  const paused = await isAgentPaused({
    userId: input.userId,
    client: input.client,
    agentKey: input.agentKey,
    signal: input.signal,
  })
  if (paused && !input.force) {
    return {
      agentKey: input.agentKey,
      paused: true,
      skipped: true,
      result: null,
      activityId: null,
      errorMessages: [`${input.agentKey} is paused`],
    }
  }

  const errorMessages: string[] = []
  let result: unknown = null
  let activityId: string | null = null

  switch (input.agentKey) {
    case "job_scout": {
      const search = await runJobSearch({
        userId: input.userId,
        client: input.client,
        signal: input.signal,
      })
      result = search
      activityId = search.activityId
      errorMessages.push(...(search.errors ?? []))
      break
    }
    case "company_scout": {
      const scout = await runCompanyScout({
        userId: input.userId,
        client: input.client,
        signal: input.signal,
      })
      result = scout
      activityId = scout.activityId
      errorMessages.push(...(scout.errors ?? []))
      break
    }
    case "assessor": {
      const review = await runRelevanceReview({
        userId: input.userId,
        client: input.client,
        signal: input.signal,
      })
      result = review
      activityId = review.activityId
      errorMessages.push(...(review.errorMessages ?? []))
      break
    }
    case "writer": {
      const draft = await runDraftGeneration({
        userId: input.userId,
        client: input.client,
        signal: input.signal,
      })
      result = draft
      activityId = draft.activityId
      errorMessages.push(...(draft.errorMessages ?? []))
      break
    }
  }

  // Ensure a controls-aware activity row for single-agent manual runs when
  // the underlying runner already logged (activityId set). Also log skip-free summary.
  try {
    const controls = await getAgentControls({
      userId: input.userId,
      client: input.client,
      signal: input.signal,
    })
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: `manual_${input.agentKey}`,
      fetched: 0,
      relevant: 0,
      drafted: 0,
      errors: errorMessages.slice(0, 50),
      details: {
        agent: input.agentKey,
        trigger: "manual",
        force: Boolean(input.force),
        paused_flags: {
          job_scout: controls.job_scout.paused,
          company_scout: controls.company_scout.paused,
          assessor: controls.assessor.paused,
          writer: controls.writer.paused,
        },
        child_activity_id: activityId,
      },
    })
    if (input.signal) activityQuery = activityQuery.abortSignal(input.signal)
    const { data: activity, error } = await activityQuery.select("id").single()
    if (!error && activity?.id) activityId = activity.id as string
    else if (error) errorMessages.push(`activity log: ${error.message}`)
  } catch (e) {
    errorMessages.push(
      e instanceof Error ? `activity log: ${e.message}` : "activity log failed",
    )
  }

  return {
    agentKey: input.agentKey,
    paused: false,
    skipped: false,
    result,
    activityId,
    errorMessages,
  }
}

async function finalizePipelineResult(input: {
  trigger: PipelineTrigger
  agent: CronAgent
  skippedPaused: AgentControlKey[]
  errorMessages: string[]
  dailyCap: number
  search: Awaited<ReturnType<typeof runJobSearch>> | null
  companyScout: Awaited<ReturnType<typeof runCompanyScout>> | null
  review: Awaited<ReturnType<typeof runRelevanceReview>> | null
  draft: Awaited<ReturnType<typeof runDraftGeneration>> | null
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<RunPipelineResult> {
  const trimmedErrors = collectErrors(input.errorMessages)
  const fetched =
    (input.search?.fetched ?? 0) + (input.companyScout?.fetched ?? 0)
  const inserted =
    (input.search?.inserted ?? 0) + (input.companyScout?.inserted ?? 0)
  const relevant = input.review?.relevant ?? 0
  const drafted = input.draft?.drafted ?? 0
  const errorsCount =
    trimmedErrors.length +
    (input.review?.errors ?? 0) +
    (input.draft?.errors ?? 0) +
    (input.search?.errors?.length ?? 0) +
    (input.companyScout?.errors?.length ?? 0)

  let activityId: string | null = null
  try {
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: input.trigger === "cron" ? `cron_${input.agent}` : `pipeline_${input.agent}`,
      fetched,
      relevant,
      drafted,
      errors: trimmedErrors,
      details: {
        agent: input.agent,
        trigger: input.trigger,
        inserted,
        skipped_paused: input.skippedPaused,
        duplicates: input.search?.duplicates ?? 0,
        company_scout_inserted: input.companyScout?.inserted ?? 0,
        company_weekly_cap: input.companyScout?.weeklyCap,
        reviewed: input.review?.reviewed ?? 0,
        not_relevant: input.review?.notRelevant ?? 0,
        needs_manual_review: input.review?.needsManualReview ?? 0,
        draft_skipped_cap: input.draft?.skippedCap ?? 0,
        daily_cap: input.dailyCap,
        drafted_today_before: input.draft?.draftedTodayBefore ?? 0,
        search_activity_id: input.search?.activityId,
        company_scout_activity_id: input.companyScout?.activityId,
        review_activity_id: input.review?.activityId,
        draft_activity_id: input.draft?.activityId,
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
    agent: input.agent,
    trigger: input.trigger,
    fetched,
    relevant,
    drafted,
    skippedPaused: input.skippedPaused,
    errors: trimmedErrors.length,
  })

  return {
    trigger: input.trigger,
    agent: input.agent,
    skippedPaused: input.skippedPaused,
    fetched,
    inserted,
    relevant,
    drafted,
    errors: Math.max(errorsCount, trimmedErrors.length),
    errorMessages: trimmedErrors,
    dailyCap: input.dailyCap,
    activityId,
    search: input.search,
    companyScout: input.companyScout,
    review: input.review,
    draft: input.draft,
  }
}
