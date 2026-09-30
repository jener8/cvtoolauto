import { generateText } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getAgentsAnthropicModelId,
  isAgentsAnthropicConfigured,
  resolveAgentsAnthropicModel,
} from "@/lib/agents/anthropic-client"
import { getConfirmedFacts } from "@/lib/agents/profile-facts"
import {
  parseAgentRelevanceJson,
  sanitizeRelevanceEvidence,
  type AgentRelevanceResult,
} from "@/lib/agents/relevance-schema"
import type { AgentJobStatus, AgentProfileFact } from "@/lib/agents/types"

const DEFAULT_MAX_JOBS = 20
const CALL_TIMEOUT_MS = 90_000
const LISTING_TEXT_MAX = 12_000

export type RelevanceReviewCounts = {
  reviewed: number
  relevant: number
  notRelevant: number
  needsManualReview: number
  errors: number
}

export type RunRelevanceResult = RelevanceReviewCounts & {
  activityId: string | null
  errorMessages: string[]
  results: Array<{
    jobId: string
    status: AgentJobStatus
    relevant: boolean | null
  }>
}

type JobRow = {
  id: string
  title: string | null
  location: string | null
  language: string | null
  description: string | null
  raw_listing_text: string | null
  url: string | null
  source: string | null
  status: string
  company_id: string | null
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("Model response did not contain a JSON object")
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

function factsPayload(facts: AgentProfileFact[]) {
  // GDPR: confirmed facts only — id + category + text, nothing else
  return facts.map((f) => ({
    id: f.id,
    category: f.category,
    text: f.factText,
  }))
}

function listingPayload(job: JobRow) {
  const body = (job.raw_listing_text || job.description || "").slice(0, LISTING_TEXT_MAX)
  return {
    title: job.title,
    location: job.location,
    language: job.language,
    listing_text: body,
  }
}

function buildPrompt(job: JobRow, facts: AgentProfileFact[]): string {
  return `You are EquitAI's job relevance reviewer. Explain fit in plain language — never use match percentages, scores, rankings, or star ratings.

Given ONLY the confirmed master-profile facts and the job listing below, decide whether the role is relevant for this candidate.

Rules:
1. Use ONLY the provided confirmed facts. Do not invent experience, skills, degrees, or languages.
2. Every item in requirements_met MUST include at least one evidence_fact_ids value copied exactly from the facts list.
3. List important listing requirements the candidate does not clearly meet in requirements_not_met.
4. summary: one or two plain-language sentences on fit (no scores).
5. listing_language: "de" if the listing is primarily German, otherwise "en".
6. Respond with ONLY a single JSON object (no markdown, no prose) matching:
{
  "relevant": true,
  "requirements_met": [{"requirement": "...", "evidence_fact_ids": ["..."]}],
  "requirements_not_met": ["..."],
  "summary": "...",
  "listing_language": "de"
}

CONFIRMED_FACTS:
${JSON.stringify(factsPayload(facts))}

LISTING:
${JSON.stringify(listingPayload(job))}`
}

async function callClaudeOnce(
  job: JobRow,
  facts: AgentProfileFact[],
  signal?: AbortSignal,
): Promise<AgentRelevanceResult> {
  const model = resolveAgentsAnthropicModel()
  if (!model) {
    throw new Error("ANTHROPIC_API_KEY is not configured for job agents")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort)

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(job, facts),
      maxOutputTokens: 2500,
      temperature: 0.2,
      abortSignal: controller.signal,
    })
    if (!text?.trim()) {
      throw new Error("Empty model response")
    }
    const parsed = parseAgentRelevanceJson(extractJsonObject(text))
    return sanitizeRelevanceEvidence(parsed, new Set(facts.map((f) => f.id)))
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

/**
 * Call Claude with one validation retry, then needs_manual_review on failure.
 */
export async function reviewJobRelevance(input: {
  job: JobRow
  facts: AgentProfileFact[]
  signal?: AbortSignal
}): Promise<
  | { ok: true; relevance: AgentRelevanceResult }
  | { ok: false; reason: string }
> {
  if (input.facts.length === 0) {
    return { ok: false, reason: "No confirmed master-profile facts" }
  }

  let lastReason = "Unknown review failure"
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const relevance = await callClaudeOnce(input.job, input.facts, input.signal)
      return { ok: true, relevance }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "Review failed"
      console.warn("[agents/relevance] attempt failed", {
        jobId: input.job.id,
        attempt,
        reason: lastReason,
        model: getAgentsAnthropicModelId(),
      })
    }
  }
  return { ok: false, reason: lastReason }
}

function nextStatus(relevance: AgentRelevanceResult): AgentJobStatus {
  // Documented choice: relevant → reviewing; not relevant → not_relevant (no auto-reject/send)
  return relevance.relevant ? "reviewing" : "not_relevant"
}

async function persistReview(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  status: AgentJobStatus
  relevance: AgentRelevanceResult | Record<string, unknown>
  signal?: AbortSignal
}): Promise<void> {
  let query = input.client
    .from("agent_jobs")
    .update({
      status: input.status,
      relevance: input.relevance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
  if (input.signal) query = query.abortSignal(input.signal)
  const { error } = await query
  if (error) throw new Error(error.message)
}

/**
 * Review status=`new` jobs (or a single job id) with Claude.
 * Writes relevance JSON; sets reviewing | not_relevant | needs_manual_review.
 */
export async function runRelevanceReview(input: {
  userId: string
  client: SupabaseClient
  jobId?: string
  maxJobs?: number
  signal?: AbortSignal
}): Promise<RunRelevanceResult> {
  const counts: RelevanceReviewCounts = {
    reviewed: 0,
    relevant: 0,
    notRelevant: 0,
    needsManualReview: 0,
    errors: 0,
  }
  const errorMessages: string[] = []
  const results: RunRelevanceResult["results"] = []

  if (!isAgentsAnthropicConfigured()) {
    errorMessages.push("ANTHROPIC_API_KEY is not set")
    return { ...counts, errors: 1, activityId: null, errorMessages, results }
  }

  const facts = await getConfirmedFacts({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })

  if (facts.length === 0) {
    errorMessages.push("No confirmed profile facts — confirm master-profile facts before review")
    return { ...counts, errors: 1, activityId: null, errorMessages, results }
  }

  const maxJobs = Math.min(Math.max(input.maxJobs ?? DEFAULT_MAX_JOBS, 1), 50)
  let jobsQuery = input.client
    .from("agent_jobs")
    .select(
      "id, title, location, language, description, raw_listing_text, url, source, status, company_id",
    )
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true })
    .limit(maxJobs)

  if (input.jobId) {
    jobsQuery = jobsQuery.eq("id", input.jobId)
  } else {
    jobsQuery = jobsQuery.eq("status", "new")
  }

  if (input.signal) jobsQuery = jobsQuery.abortSignal(input.signal)

  const { data: rows, error: loadError } = await jobsQuery
  if (loadError) {
    errorMessages.push(loadError.message)
    return { ...counts, errors: 1, activityId: null, errorMessages, results }
  }

  const jobs = (rows as JobRow[] | null) ?? []
  if (jobs.length === 0) {
    return { ...counts, activityId: null, errorMessages, results }
  }

  console.info("[agents/relevance] starting", {
    jobCount: jobs.length,
    confirmedFacts: facts.length,
    model: getAgentsAnthropicModelId(),
  })

  for (const job of jobs) {
    if (input.signal?.aborted) break
    if (job.status !== "new" && !input.jobId) continue
    // Per-job button may re-review needs_manual_review or new only
    if (
      input.jobId &&
      job.status !== "new" &&
      job.status !== "needs_manual_review"
    ) {
      errorMessages.push(`Job ${job.id} is not eligible for relevance review (status=${job.status})`)
      counts.errors += 1
      continue
    }

    try {
      const outcome = await reviewJobRelevance({ job, facts, signal: input.signal })
      if (!outcome.ok) {
        await persistReview({
          client: input.client,
          userId: input.userId,
          jobId: job.id,
          status: "needs_manual_review",
          relevance: {
            error: outcome.reason,
            reviewed_at: new Date().toISOString(),
          },
          signal: input.signal,
        })
        counts.reviewed += 1
        counts.needsManualReview += 1
        results.push({ jobId: job.id, status: "needs_manual_review", relevant: null })
        continue
      }

      const status = nextStatus(outcome.relevance)
      await persistReview({
        client: input.client,
        userId: input.userId,
        jobId: job.id,
        status,
        relevance: {
          ...outcome.relevance,
          reviewed_at: new Date().toISOString(),
          model: getAgentsAnthropicModelId(),
        },
        signal: input.signal,
      })
      counts.reviewed += 1
      if (outcome.relevance.relevant) counts.relevant += 1
      else counts.notRelevant += 1
      results.push({
        jobId: job.id,
        status,
        relevant: outcome.relevance.relevant,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Review persist failed"
      errorMessages.push(message)
      counts.errors += 1
      try {
        await persistReview({
          client: input.client,
          userId: input.userId,
          jobId: job.id,
          status: "needs_manual_review",
          relevance: {
            error: message,
            reviewed_at: new Date().toISOString(),
          },
          signal: input.signal,
        })
        counts.reviewed += 1
        counts.needsManualReview += 1
        results.push({ jobId: job.id, status: "needs_manual_review", relevant: null })
      } catch (persistErr) {
        errorMessages.push(
          persistErr instanceof Error ? persistErr.message : "Could not mark needs_manual_review",
        )
      }
    }
  }

  let activityId: string | null = null
  try {
    // Activity counts only — no listing titles, company names, or fact text (GDPR)
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: "relevance",
      fetched: counts.reviewed,
      relevant: counts.relevant,
      drafted: 0,
      errors: errorMessages.slice(0, 50),
      details: {
        agent: "assessor",
        reviewed: counts.reviewed,
        relevant: counts.relevant,
        not_relevant: counts.notRelevant,
        needs_manual_review: counts.needsManualReview,
        errors: counts.errors,
        model: getAgentsAnthropicModelId(),
      },
    })
    if (input.signal) activityQuery = activityQuery.abortSignal(input.signal)
    const { data: activity, error: activityError } = await activityQuery.select("id").single()
    if (activityError) {
      errorMessages.push(`activity log: ${activityError.message}`)
      counts.errors += 1
    } else {
      activityId = (activity?.id as string) ?? null
    }
  } catch (e) {
    errorMessages.push(e instanceof Error ? `activity log: ${e.message}` : "activity log failed")
    counts.errors += 1
  }

  console.info("[agents/relevance] complete", {
    reviewed: counts.reviewed,
    relevant: counts.relevant,
    notRelevant: counts.notRelevant,
    needsManualReview: counts.needsManualReview,
    errors: counts.errors,
  })

  return { ...counts, activityId, errorMessages, results }
}

export function isJobAgentAutoReviewEnabled(): boolean {
  return process.env.JOB_AGENT_AUTO_REVIEW?.trim().toLowerCase() === "true"
}
