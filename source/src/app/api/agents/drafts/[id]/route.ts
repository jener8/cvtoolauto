import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import type { CitedFactSnapshot, FabricationFlag } from "@/lib/agents/types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/agents/drafts/[id]
 * Editable text version in the UI (cv_text / cover_text only).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const draftId = id?.trim()
  if (!draftId) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 })
  }

  let body: { cvText?: string; coverText?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body.cvText === "string") updates.cv_text = body.cvText
  if (typeof body.coverText === "string") updates.cover_text = body.coverText

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No cvText or coverText provided" }, { status: 400 })
  }

  try {
    const { data, error } = await gate.ctx.supabase
      .from("agent_drafts")
      .update(updates)
      .eq("id", draftId)
      .eq("user_id", gate.ctx.userId)
      .select(
        "id, job_id, cv_text, cover_text, cited_facts_snapshot, fabrication_flags, version, created_at, updated_at",
      )
      .abortSignal(gate.ctx.controller.signal)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (!data) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    }

    const row = data as Record<string, unknown>
    return NextResponse.json({
      draft: {
        id: row.id as string,
        jobId: row.job_id as string,
        cvText: (row.cv_text as string | null) ?? null,
        coverText: (row.cover_text as string | null) ?? null,
        citedFactsSnapshot: (row.cited_facts_snapshot as CitedFactSnapshot[]) ?? [],
        fabricationFlags: (row.fabrication_flags as FabricationFlag[]) ?? [],
        version: (row.version as number) ?? 1,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update draft"
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
