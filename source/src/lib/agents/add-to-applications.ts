/**
 * Optional manual sync: create a NEW job_applications row from an approved/sent
 * agent job + latest draft. Never updates existing application records.
 * Idempotency via job_description.agentJobId (no schema migration required).
 * See docs/agents-job-applications-mapping.md.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { COMPANY_NOT_ADDED, JOB_TITLE_NOT_ADDED } from "@/lib/job-application-display"
import type { AgentJobStatus, AgentRelevancePayload } from "@/lib/agents/types"

const SYNCABLE: AgentJobStatus[] = ["approved", "sent"]

export type AddToApplicationsResult =
  | {
      ok: true
      created: true
      applicationId: string
      agentJobId: string
    }
  | {
      ok: true
      created: false
      applicationId: string
      agentJobId: string
      reason: "already_linked"
    }
  | {
      ok: false
      error: string
      code?: string
    }

function isRelevance(value: unknown): value is AgentRelevancePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "relevant" in value &&
    typeof (value as AgentRelevancePayload).relevant === "boolean"
  )
}

function emptyInterviewPrep(now: number) {
  return {
    questions: [],
    possibleAnswers: [],
    personalDescription: "",
    interviewers: [],
    generalNotes: "",
    lastModified: now,
  }
}

/**
 * Insert a tracker row for the agent job. Returns existing id if already linked.
 */
export async function addAgentJobToApplications(input: {
  userId: string
  client: SupabaseClient
  agentJobId: string
  signal?: AbortSignal
}): Promise<AddToApplicationsResult> {
  const jobId = input.agentJobId.trim()
  if (!jobId) {
    return { ok: false, error: "Missing agent job id", code: "MISSING_JOB_ID" }
  }

  // Idempotency: already linked via job_description.agentJobId
  let existingQuery = input.client
    .from("job_applications")
    .select("id, job_description")
    .eq("user_id", input.userId)
    .filter("job_description->>agentJobId", "eq", jobId)
    .limit(1)
  if (input.signal) existingQuery = existingQuery.abortSignal(input.signal)
  const { data: existingRows, error: existingError } = await existingQuery
  if (existingError) {
    return { ok: false, error: existingError.message, code: "LOOKUP_FAILED" }
  }
  const existingId = (existingRows as Array<{ id: string }> | null)?.[0]?.id
  if (existingId) {
    return {
      ok: true,
      created: false,
      applicationId: existingId,
      agentJobId: jobId,
      reason: "already_linked",
    }
  }

  let jobQuery = input.client
    .from("agent_jobs")
    .select(
      "id, user_id, status, title, location, description, raw_listing_text, url, source, posted_at, email_to, company_id, relevance",
    )
    .eq("id", jobId)
    .eq("user_id", input.userId)
  if (input.signal) jobQuery = jobQuery.abortSignal(input.signal)
  const { data: job, error: jobError } = await jobQuery.maybeSingle()
  if (jobError) {
    return { ok: false, error: jobError.message, code: "JOB_LOAD_FAILED" }
  }
  if (!job) {
    return { ok: false, error: "Agent job not found", code: "NOT_FOUND" }
  }

  const status = job.status as AgentJobStatus
  if (!SYNCABLE.includes(status)) {
    return {
      ok: false,
      error: "Only approved or sent agent jobs can be added to applications",
      code: "STATUS_NOT_SYNCABLE",
    }
  }

  let companyName: string | null = null
  let companyWebsite = ""
  if (job.company_id) {
    let companyQuery = input.client
      .from("agent_companies")
      .select("name, website")
      .eq("id", job.company_id as string)
      .eq("user_id", input.userId)
    if (input.signal) companyQuery = companyQuery.abortSignal(input.signal)
    const { data: company } = await companyQuery.maybeSingle()
    companyName = (company?.name as string | null) ?? null
    companyWebsite = (company?.website as string | null)?.trim() || ""
  }

  let draftQuery = input.client
    .from("agent_drafts")
    .select("id, cover_text, cv_text, version")
    .eq("job_id", jobId)
    .eq("user_id", input.userId)
    .order("version", { ascending: false })
    .limit(1)
  if (input.signal) draftQuery = draftQuery.abortSignal(input.signal)
  const { data: draft } = await draftQuery.maybeSingle()

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const relevance = isRelevance(job.relevance) ? job.relevance : null
  const listingText =
    ((job.raw_listing_text as string | null) ||
      (job.description as string | null) ||
      "").trim()
  const role =
    typeof job.title === "string" && job.title.trim()
      ? job.title.trim()
      : JOB_TITLE_NOT_ADDED
  const company =
    companyName && companyName.trim() ? companyName.trim() : COMPANY_NOT_ADDED
  const applicationId = crypto.randomUUID()

  const emailTo =
    typeof job.email_to === "string" && job.email_to.trim() ? job.email_to.trim() : null

  // Tracker has no separate "to apply" stage; both approved and sent use status=applied.
  // applied_date / pipeline stage only when agent job is already sent (see mapping doc).
  const isSent = status === "sent"

  const row = {
    id: applicationId,
    user_id: input.userId,
    role,
    company,
    status: "applied",
    folder_id: null,
    applied_date: isSent ? nowIso : null,
    updated_at: nowIso,
    resume_version_id: null,
    cover_letter_id: null,
    job_strategy: null,
    fit_scores: null,
    red_flags: null,
    upload_details: null,
    your_story: null,
    job_description: {
      content: listingText,
      summary: relevance?.summary ?? undefined,
      url: (job.url as string | null) ?? undefined,
      location: (job.location as string | null) ?? null,
      source: (job.source as string | null) ?? undefined,
      postedAt: (job.posted_at as string | null) ?? undefined,
      agentJobId: jobId,
      agentDraftId: (draft?.id as string | null) ?? null,
      cvTextPreview: draft?.cv_text
        ? String(draft.cv_text).slice(0, 500)
        : undefined,
      pipeline: isSent
        ? [{ stage: "applied", outcome: "pending", date: nowIso }]
        : [],
    },
    why_content: {
      text: relevance?.summary ?? "",
    },
    company_info: {
      website: companyWebsite,
      researchNotes: "",
      linkedInContacts: [],
      lastModified: now,
    },
    contacts: emailTo
      ? [
          {
            id: crypto.randomUUID(),
            name: "",
            role: "",
            email: emailTo,
            phone: "",
            linkedIn: "",
            notes: "From agent job listing",
          },
        ]
      : [],
    cover_letter: draft?.cover_text
      ? {
          content: String(draft.cover_text),
          lastModified: now,
        }
      : {
          content: "",
          lastModified: now,
        },
    interview_prep: emptyInterviewPrep(now),
  }

  let insertQuery = input.client.from("job_applications").insert(row).select("id")
  if (input.signal) insertQuery = insertQuery.abortSignal(input.signal)
  const { data: inserted, error: insertError } = await insertQuery.single()
  if (insertError) {
    return { ok: false, error: insertError.message, code: "INSERT_FAILED" }
  }

  console.info("[agents/sync] created job_application", {
    applicationId: inserted?.id,
    // agent job id only — no titles/companies in logs
  })

  return {
    ok: true,
    created: true,
    applicationId: (inserted?.id as string) ?? applicationId,
    agentJobId: jobId,
  }
}
