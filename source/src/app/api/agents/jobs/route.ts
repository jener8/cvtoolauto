import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import type {
  AgentApplyMethod,
  AgentJobKind,
  AgentJobStatus,
  AgentRelevancePayload,
} from "@/lib/agents/types"
import { AGENT_JOB_STATUSES } from "@/lib/agents/types"
import { normalizeAgentJobStatus } from "@/lib/agents/status-machine"

export const runtime = "nodejs"

export type AgentJobListItem = {
  id: string
  status: AgentJobStatus
  kind: AgentJobKind
  applyMethod: AgentApplyMethod | null
  title: string | null
  location: string | null
  language: string | null
  url: string | null
  source: string | null
  companyName: string | null
  postedAt: string | null
  emailTo: string | null
  rejectReason: string | null
  gmailMessageId: string | null
  sendingStartedAt: string | null
  relevance: AgentRelevancePayload | Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const DEFAULT_STATUSES: AgentJobStatus[] = [
  "new",
  "potential_fit",
  "not_a_fit",
  "manual",
  "shortlisted",
  "skipped",
  "drafting",
  "drafts_ready",
  "changes_requested",
  "documents_approved",
  "sending",
  "sent",
  "rejected",
  // legacy aliases still readable pre-migration
  "reviewing",
  "not_relevant",
  "needs_manual_review",
  "approved",
]

/**
 * GET /api/agents/jobs?status=new,reviewing,approved,...
 * Review queue listing (Phase 4–6).
 */
export async function GET(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")?.trim()
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is AgentJobStatus =>
          (AGENT_JOB_STATUSES as string[]).includes(s),
        )
    : DEFAULT_STATUSES

  try {
    const { data, error } = await ctx.supabase
      .from("agent_jobs")
      .select(
        "id, status, kind, apply_method, title, location, language, url, source, relevance, posted_at, email_to, reject_reason, gmail_message_id, sending_started_at, created_at, updated_at, company_id",
      )
      .eq("user_id", ctx.userId)
      .in("status", statuses)
      .order("updated_at", { ascending: false })
      .limit(150)
      .abortSignal(ctx.controller.signal)

    if (error) {
      return NextResponse.json({ error: error.message, jobs: [] }, { status: 503 })
    }

    const rows = (data as Array<Record<string, unknown>> | null) ?? []
    const companyIds = [
      ...new Set(
        rows
          .map((r) => r.company_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    const companyNameById = new Map<string, string>()
    if (companyIds.length > 0) {
      const { data: companies } = await ctx.supabase
        .from("agent_companies")
        .select("id, name")
        .eq("user_id", ctx.userId)
        .in("id", companyIds)
        .abortSignal(ctx.controller.signal)
      for (const c of (companies as Array<{ id: string; name: string }> | null) ?? []) {
        companyNameById.set(c.id, c.name)
      }
    }

    const jobs: AgentJobListItem[] = rows.map((row) => {
      const companyId = row.company_id as string | null
      return {
        id: row.id as string,
        status: normalizeAgentJobStatus(String(row.status)),
        kind: ((row.kind as AgentJobKind) || "listing") as AgentJobKind,
        applyMethod: (row.apply_method as AgentApplyMethod | null) ?? null,
        title: (row.title as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        language: (row.language as string | null) ?? null,
        url: (row.url as string | null) ?? null,
        source: (row.source as string | null) ?? null,
        companyName: companyId ? companyNameById.get(companyId) ?? null : null,
        postedAt: (row.posted_at as string | null) ?? null,
        emailTo: (row.email_to as string | null) ?? null,
        rejectReason: (row.reject_reason as string | null) ?? null,
        gmailMessageId: (row.gmail_message_id as string | null) ?? null,
        sendingStartedAt: (row.sending_started_at as string | null) ?? null,
        relevance: (row.relevance as AgentRelevancePayload | Record<string, unknown>) ?? {},
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }
    })

    return NextResponse.json({ jobs })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load jobs"
    console.error("[api/agents/jobs] GET", message)
    return NextResponse.json({ error: message, jobs: [] }, { status: 503 })
  }
}
