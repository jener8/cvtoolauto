import { generateText } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getAgentsAnthropicModelId,
  isAgentsAnthropicConfigured,
  resolveAgentsAnthropicModel,
} from "@/lib/agents/anthropic-client"
import {
  buildCitedFactsSnapshot,
  getJobAgentDailyCap,
  parseAgentFactCheckJson,
  parseAgentWriterJson,
  type FabricationFlag,
} from "@/lib/agents/draft-schema"
import { getConfirmedFacts } from "@/lib/agents/profile-facts"
import type {
  AgentJobStatus,
  AgentProfileFact,
  AgentRelevancePayload,
  CitedFactSnapshot,
} from "@/lib/agents/types"
import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"

const CALL_TIMEOUT_MS = 120_000
const LISTING_TEXT_MAX = 10_000
const DRAFT_ELIGIBLE: AgentJobStatus[] = ["reviewing", "changes_requested"]

export type DraftRunCounts = {
  drafted: number
  skippedCap: number
  errors: number
  flagsTotal: number
}

export type RunDraftResult = DraftRunCounts & {
  activityId: string | null
  errorMessages: string[]
  dailyCap: number
  draftedTodayBefore: number
  results: Array<{
    jobId: string
    draftId: string | null
    status: AgentJobStatus
    flags: number
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
  relevance: AgentRelevancePayload | Record<string, unknown> | null
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
  return facts.map((f) => ({
    id: f.id,
    category: f.category,
    text: f.factText,
  }))
}

function listingPayload(job: JobRow, companyName: string | null) {
  const body = (job.raw_listing_text || job.description || "").slice(0, LISTING_TEXT_MAX)
  return {
    title: job.title,
    company: companyName,
    location: job.location,
    language: job.language,
    listing_text: body,
  }
}

function resolveListingLanguage(job: JobRow): "de" | "en" {
  const rel = job.relevance
  if (rel && typeof rel === "object" && "listing_language" in rel) {
    const lang = (rel as AgentRelevancePayload).listing_language
    if (lang === "de" || lang === "en") return lang
  }
  const raw = (job.language || "").toLowerCase()
  if (raw.startsWith("de") || raw.includes("german") || raw.includes("deutsch")) return "de"
  const body = (job.raw_listing_text || job.description || "").slice(0, 800)
  if (/\b(wir suchen|stellenausschreibung|bewerben|kenntnisse|aufgaben)\b/i.test(body)) {
    return "de"
  }
  return "en"
}

function buildWriterPrompt(
  job: JobRow,
  facts: AgentProfileFact[],
  companyName: string | null,
  language: "de" | "en",
): string {
  const langLabel = language === "de" ? "German (Deutsch)" : "English"
  const coverRules =
    language === "de"
      ? `COVER LETTER (Anschreiben): Write a complete formal German Anschreiben including salutation (e.g. "Sehr geehrte Damen und Herren,") and closing ("Mit freundlichen Grüßen,"). After the salutation the first sentence must start with a lowercase letter. No bracket placeholders.`
      : `COVER LETTER: Write a complete formal English cover letter including salutation and closing (e.g. "Sincerely,"). No bracket placeholders.`

  const cvStructure =
    language === "de"
      ? `CV markup (German section headings ALL CAPS):
PROFIL
- …
BERUFSERFAHRUNG
# Berufsbezeichnung (exact title from facts — never inflate)
## Unternehmen, Ort
### Monat Jahr – Monat Jahr
- …
AUSBILDUNG / FÄHIGKEITEN / SPRACHEN as needed`
      : `CV markup (English section headings ALL CAPS):
PROFILE
- …
EXPERIENCE
# Job Title (exact title from facts — never inflate)
## Company, Location
### Month Year – Month Year
- …
EDUCATION / SKILLS / LANGUAGES as needed`

  return `You are EquitAI's application Writer. Produce a tailored CV and cover letter using ONLY the confirmed master-profile facts below.

Rules (strict anti-fabrication):
1. You may select, reorder, and rephrase confirmed facts. Never add experience, skills, figures, titles, employers, degrees, or dates that are not in the facts.
2. Never inflate job titles (e.g. do not turn "Specialist" into "Lead" or "Senior").
3. Job listing = keyword/tailoring context ONLY — not a factual source.
4. Output language for CV and cover letter: ${langLabel}.
5. cited_fact_ids must list every fact id you used (copy ids exactly from the facts list).
6. Respond with ONLY a single JSON object (no markdown fences, no prose):
{
  "cv_text": "...",
  "cover_text": "...",
  "cited_fact_ids": ["..."],
  "listing_language": "${language}"
}

${cvFactualSourceRulesBlock(language)}

${cvStructure}

${coverRules}

CONFIRMED_FACTS:
${JSON.stringify(factsPayload(facts))}

LISTING:
${JSON.stringify(listingPayload(job, companyName))}`
}

function buildFactCheckPrompt(
  cvText: string,
  coverText: string,
  facts: AgentProfileFact[],
): string {
  return `You are EquitAI's Fact Checker. Compare every factual claim in the CV and cover letter drafts against the confirmed master-profile facts.

Rules:
1. Flag any claim that adds experience, skills, metrics, titles, employers, degrees, languages, or dates not supported by the facts.
2. Rephrasing is OK if the meaning stays within the facts. Title inflation is NOT OK.
3. Do not flag soft phrasing or keywords from the job listing unless they invent candidate facts.
4. Respond with ONLY a single JSON object:
{
  "unsupported_claims": [
    {"claim": "...", "location": "cv"|"cover"|"both", "reason": "..."}
  ]
}
If everything is supported, return {"unsupported_claims": []}.

CONFIRMED_FACTS:
${JSON.stringify(factsPayload(facts))}

CV_DRAFT:
${cvText}

COVER_DRAFT:
${coverText}`
}

async function callClaudeJson(
  prompt: string,
  signal?: AbortSignal,
): Promise<unknown> {
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
      prompt,
      abortSignal: controller.signal,
      maxOutputTokens: 8192,
      temperature: 0.2,
    })
    return extractJsonObject(text)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

async function writeDraftOnce(
  job: JobRow,
  facts: AgentProfileFact[],
  companyName: string | null,
  signal?: AbortSignal,
): Promise<{
  cvText: string
  coverText: string
  cited: CitedFactSnapshot[]
  language: "de" | "en"
}> {
  const language = resolveListingLanguage(job)
  const raw = await callClaudeJson(
    buildWriterPrompt(job, facts, companyName, language),
    signal,
  )
  const parsed = parseAgentWriterJson(raw)
  const factsById = new Map(facts.map((f) => [f.id, f]))
  const cited = buildCitedFactsSnapshot(parsed.cited_fact_ids, factsById)
  if (cited.length === 0) {
    throw new Error("Writer cited no valid confirmed fact ids")
  }
  return {
    cvText: parsed.cv_text.trim(),
    coverText: parsed.cover_text.trim(),
    cited,
    language: parsed.listing_language || language,
  }
}

async function factCheckOnce(
  cvText: string,
  coverText: string,
  facts: AgentProfileFact[],
  signal?: AbortSignal,
): Promise<FabricationFlag[]> {
  const raw = await callClaudeJson(buildFactCheckPrompt(cvText, coverText, facts), signal)
  const parsed = parseAgentFactCheckJson(raw)
  return parsed.unsupported_claims
}

async function countDraftsToday(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  let query = client
    .from("agent_drafts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
  if (signal) query = query.abortSignal(signal)
  const { count, error } = await query
  if (error) {
    console.warn("[agents/draft] count today failed", error.message)
    return 0
  }
  return count ?? 0
}

async function loadCompanyNames(
  client: SupabaseClient,
  userId: string,
  companyIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (companyIds.length === 0) return map
  let query = client
    .from("agent_companies")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", companyIds)
  if (signal) query = query.abortSignal(signal)
  const { data } = await query
  for (const row of (data as Array<{ id: string; name: string }> | null) ?? []) {
    map.set(row.id, row.name)
  }
  return map
}

async function nextDraftVersion(
  client: SupabaseClient,
  userId: string,
  jobId: string,
  signal?: AbortSignal,
): Promise<number> {
  let query = client
    .from("agent_drafts")
    .select("version")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .order("version", { ascending: false })
    .limit(1)
  if (signal) query = query.abortSignal(signal)
  const { data } = await query
  const prev = (data as Array<{ version: number }> | null)?.[0]?.version
  return typeof prev === "number" && prev >= 1 ? prev + 1 : 1
}

async function persistDraft(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  cvText: string
  coverText: string
  cited: CitedFactSnapshot[]
  flags: FabricationFlag[]
  version: number
  signal?: AbortSignal
}): Promise<string> {
  let query = input.client
    .from("agent_drafts")
    .insert({
      user_id: input.userId,
      job_id: input.jobId,
      cv_text: input.cvText,
      cover_text: input.coverText,
      cited_facts_snapshot: input.cited,
      fabrication_flags: input.flags,
      version: input.version,
      updated_at: new Date().toISOString(),
    })
    .select("id")
  if (input.signal) query = query.abortSignal(input.signal)
  const { data, error } = await query.single()
  if (error) throw new Error(error.message)
  return data.id as string
}

async function setJobReviewing(input: {
  client: SupabaseClient
  userId: string
  jobId: string
  signal?: AbortSignal
}): Promise<void> {
  let query = input.client
    .from("agent_jobs")
    .update({ status: "reviewing", updated_at: new Date().toISOString() })
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
  if (input.signal) query = query.abortSignal(input.signal)
  const { error } = await query
  if (error) throw new Error(error.message)
}

/**
 * Draft tailored CV + cover for status=reviewing | changes_requested jobs.
 * Respects JOB_AGENT_DAILY_CAP (default 5). changes_requested → reviewing after draft.
 * Activity log: counts only (no PII).
 */
export async function runDraftGeneration(input: {
  userId: string
  client: SupabaseClient
  jobId?: string
  maxJobs?: number
  signal?: AbortSignal
}): Promise<RunDraftResult> {
  const dailyCap = getJobAgentDailyCap()
  const counts: DraftRunCounts = {
    drafted: 0,
    skippedCap: 0,
    errors: 0,
    flagsTotal: 0,
  }
  const errorMessages: string[] = []
  const results: RunDraftResult["results"] = []

  if (!isAgentsAnthropicConfigured()) {
    errorMessages.push("ANTHROPIC_API_KEY is not set")
    return {
      ...counts,
      errors: 1,
      activityId: null,
      errorMessages,
      dailyCap,
      draftedTodayBefore: 0,
      results,
    }
  }

  const facts = await getConfirmedFacts({
    userId: input.userId,
    client: input.client,
    signal: input.signal,
  })
  if (facts.length === 0) {
    errorMessages.push("No confirmed profile facts — confirm master-profile facts before drafting")
    return {
      ...counts,
      errors: 1,
      activityId: null,
      errorMessages,
      dailyCap,
      draftedTodayBefore: 0,
      results,
    }
  }

  const draftedTodayBefore = await countDraftsToday(input.client, input.userId, input.signal)
  const remaining = Math.max(0, dailyCap - draftedTodayBefore)
  if (remaining === 0 && !input.jobId) {
    counts.skippedCap = 1
    errorMessages.push(`Daily draft cap reached (${dailyCap})`)
    return {
      ...counts,
      activityId: null,
      errorMessages,
      dailyCap,
      draftedTodayBefore,
      results,
    }
  }

  // Batch: fetch a wider pool, then prefer strongest + freshest (Phase 9).
  const fetchLimit = input.jobId
    ? 1
    : Math.min(Math.max(input.maxJobs ?? remaining * 3, remaining, 1), 50)

  let jobsQuery = input.client
    .from("agent_jobs")
    .select(
      "id, title, location, language, description, raw_listing_text, url, source, status, company_id, relevance, posted_at, updated_at",
    )
    .eq("user_id", input.userId)
    .limit(fetchLimit)

  if (input.jobId) {
    jobsQuery = jobsQuery.eq("id", input.jobId)
  } else {
    jobsQuery = jobsQuery.in("status", DRAFT_ELIGIBLE)
  }

  if (input.signal) jobsQuery = jobsQuery.abortSignal(input.signal)

  const { data: rows, error: loadError } = await jobsQuery
  if (loadError) {
    errorMessages.push(loadError.message)
    return {
      ...counts,
      errors: 1,
      activityId: null,
      errorMessages,
      dailyCap,
      draftedTodayBefore,
      results,
    }
  }

  type JobRowWithMeta = JobRow & {
    posted_at?: string | null
    updated_at?: string | null
    relevance?: AgentRelevancePayload | Record<string, unknown> | null
  }

  const eligible = ((rows as JobRowWithMeta[] | null) ?? []).filter((j) =>
    DRAFT_ELIGIBLE.includes(j.status as AgentJobStatus),
  )

  function relevanceStrength(rel: JobRowWithMeta["relevance"]): number {
    if (!rel || typeof rel !== "object") return 0
    const met = Array.isArray((rel as AgentRelevancePayload).requirements_met)
      ? (rel as AgentRelevancePayload).requirements_met.length
      : 0
    const unmet = Array.isArray((rel as AgentRelevancePayload).requirements_not_met)
      ? (rel as AgentRelevancePayload).requirements_not_met.length
      : 0
    return met * 10 - unmet
  }

  function postedMs(posted: string | null | undefined, fallback: string | null | undefined): number {
    if (posted) {
      const t = Date.parse(posted)
      if (!Number.isNaN(t)) return t
    }
    if (fallback) {
      const t = Date.parse(fallback)
      if (!Number.isNaN(t)) return t
    }
    return 0
  }

  const sorted = input.jobId
    ? eligible
    : [...eligible].sort((a, b) => {
        const strengthDelta = relevanceStrength(b.relevance) - relevanceStrength(a.relevance)
        if (strengthDelta !== 0) return strengthDelta
        return (
          postedMs(b.posted_at, b.updated_at) - postedMs(a.posted_at, a.updated_at)
        )
      })

  const jobs = (input.jobId ? sorted : sorted.slice(0, remaining)).filter((j) =>
    DRAFT_ELIGIBLE.includes(j.status as AgentJobStatus),
  )

  if (jobs.length === 0) {
    return {
      ...counts,
      activityId: null,
      errorMessages,
      dailyCap,
      draftedTodayBefore,
      results,
    }
  }

  const companyIds = [
    ...new Set(jobs.map((j) => j.company_id).filter((id): id is string => Boolean(id))),
  ]
  const companyNames = await loadCompanyNames(
    input.client,
    input.userId,
    companyIds,
    input.signal,
  )

  console.info("[agents/draft] starting", {
    jobCount: jobs.length,
    remaining,
    dailyCap,
    confirmedFacts: facts.length,
    model: getAgentsAnthropicModelId(),
  })

  let used = 0
  for (const job of jobs) {
    if (input.signal?.aborted) break
    if (!input.jobId && used >= remaining) {
      counts.skippedCap += 1
      break
    }
    // Single-job path still respects cap unless already over (allow explicit redraft of one)
    if (input.jobId && draftedTodayBefore + used >= dailyCap) {
      // Allow redraft of changes_requested even at cap (human requested)
      if (job.status !== "changes_requested") {
        counts.skippedCap += 1
        errorMessages.push(`Daily draft cap reached (${dailyCap})`)
        results.push({
          jobId: job.id,
          draftId: null,
          status: job.status as AgentJobStatus,
          flags: 0,
        })
        break
      }
    }

    const companyName = job.company_id ? companyNames.get(job.company_id) ?? null : null

    try {
      let writerOut: Awaited<ReturnType<typeof writeDraftOnce>> | null = null
      let lastErr = "Writer failed"
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          writerOut = await writeDraftOnce(job, facts, companyName, input.signal)
          break
        } catch (e) {
          lastErr = e instanceof Error ? e.message : "Writer failed"
          console.warn("[agents/draft] writer attempt failed", {
            jobId: job.id,
            attempt,
            reason: lastErr,
          })
        }
      }
      if (!writerOut) throw new Error(lastErr)

      let flags: FabricationFlag[] = []
      try {
        flags = await factCheckOnce(
          writerOut.cvText,
          writerOut.coverText,
          facts,
          input.signal,
        )
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Fact check failed"
        console.warn("[agents/draft] fact check failed", { jobId: job.id, reason })
        flags = [
          {
            claim: "(fact-check unavailable)",
            location: "both",
            reason: `Second verification pass failed: ${reason}`,
          },
        ]
      }

      const version = await nextDraftVersion(
        input.client,
        input.userId,
        job.id,
        input.signal,
      )
      const draftId = await persistDraft({
        client: input.client,
        userId: input.userId,
        jobId: job.id,
        cvText: writerOut.cvText,
        coverText: writerOut.coverText,
        cited: writerOut.cited,
        flags,
        version,
        signal: input.signal,
      })

      // changes_requested → reviewing after successful redraft
      await setJobReviewing({
        client: input.client,
        userId: input.userId,
        jobId: job.id,
        signal: input.signal,
      })

      counts.drafted += 1
      counts.flagsTotal += flags.length
      used += 1
      results.push({
        jobId: job.id,
        draftId,
        status: "reviewing",
        flags: flags.length,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Draft failed"
      errorMessages.push(message)
      counts.errors += 1
      results.push({
        jobId: job.id,
        draftId: null,
        status: job.status as AgentJobStatus,
        flags: 0,
      })
    }
  }

  let activityId: string | null = null
  try {
    let activityQuery = input.client.from("agent_activity").insert({
      user_id: input.userId,
      run_at: new Date().toISOString(),
      kind: "draft",
      fetched: 0,
      relevant: 0,
      drafted: counts.drafted,
      errors: errorMessages.slice(0, 50),
      details: {
        agent: "writer",
        drafted: counts.drafted,
        skipped_cap: counts.skippedCap,
        errors: counts.errors,
        flags_total: counts.flagsTotal,
        daily_cap: dailyCap,
        drafted_today_before: draftedTodayBefore,
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

  console.info("[agents/draft] complete", {
    drafted: counts.drafted,
    skippedCap: counts.skippedCap,
    errors: counts.errors,
    flagsTotal: counts.flagsTotal,
  })

  return {
    ...counts,
    activityId,
    errorMessages,
    dailyCap,
    draftedTodayBefore,
    results,
  }
}

/** Mark job changes_requested (human asked for redraft). Does not auto-run Writer. */
export async function requestDraftChanges(input: {
  userId: string
  client: SupabaseClient
  jobId: string
  signal?: AbortSignal
}): Promise<void> {
  let query = input.client
    .from("agent_jobs")
    .update({
      status: "changes_requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
    .in("status", ["reviewing", "changes_requested"])
    .select("id")
  if (input.signal) query = query.abortSignal(input.signal)
  const { error, data } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("Job not found or not eligible for changes_requested")
}
