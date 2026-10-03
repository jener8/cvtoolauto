import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import type { CitedFactSnapshot, FabricationFlag } from "@/lib/agents/types"

export const runtime = "nodejs"

export type AgentDraftListItem = {
  id: string
  jobId: string
  cvText: string | null
  coverText: string | null
  citedFactsSnapshot: CitedFactSnapshot[]
  fabricationFlags: FabricationFlag[]
  version: number
  createdAt: string
  updatedAt: string
}

/**
 * GET /api/agents/drafts?jobId=optional
 * Latest draft per job (or all latest drafts for the user).
 */
export async function GET(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim() || null

  try {
    let query = ctx.supabase
      .from("agent_drafts")
      .select(
        "id, job_id, cv_text, cover_text, cited_facts_snapshot, fabrication_flags, version, created_at, updated_at",
      )
      .eq("user_id", ctx.userId)
      .order("version", { ascending: false })
      .limit(200)

    if (jobId) {
      query = query.eq("job_id", jobId).limit(20)
    }

    const { data, error } = await query.abortSignal(ctx.controller.signal)
    if (error) {
      return NextResponse.json({ error: error.message, drafts: [] }, { status: 503 })
    }

    const rows = (data as Array<Record<string, unknown>> | null) ?? []
    const latestByJob = new Map<string, AgentDraftListItem>()
    for (const row of rows) {
      const jid = row.job_id as string
      if (latestByJob.has(jid)) continue
      latestByJob.set(jid, {
        id: row.id as string,
        jobId: jid,
        cvText: (row.cv_text as string | null) ?? null,
        coverText: (row.cover_text as string | null) ?? null,
        citedFactsSnapshot: (row.cited_facts_snapshot as CitedFactSnapshot[]) ?? [],
        fabricationFlags: (row.fabrication_flags as FabricationFlag[]) ?? [],
        version: (row.version as number) ?? 1,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })
    }

    return NextResponse.json({ drafts: [...latestByJob.values()] })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load drafts"
    console.error("[api/agents/drafts] GET", message)
    return NextResponse.json({ error: message, drafts: [] }, { status: 503 })
  }
}
