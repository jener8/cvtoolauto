import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { mapAgentProfileFactRow } from "@/lib/agents/profile-facts"
import type { AgentFactStatus } from "@/lib/agents/types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

/** PATCH /api/agents/profile/[id] — edit text and/or confirm */
export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing fact id" }, { status: 400 })
  }

  let body: { factText?: string; status?: AgentFactStatus; category?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body.factText === "string") {
    const trimmed = body.factText.trim()
    if (!trimmed) {
      return NextResponse.json({ error: "factText cannot be empty" }, { status: 400 })
    }
    updates.fact_text = trimmed
  }
  if (body.status === "confirmed" || body.status === "unconfirmed") {
    updates.status = body.status
  }
  if (typeof body.category === "string" && body.category.trim()) {
    updates.category = body.category.trim()
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const { ctx } = gate
  try {
    const { data, error } = await ctx.supabase
      .from("agent_profile_facts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .select("*")
      .abortSignal(ctx.controller.signal)
      .maybeSingle()

    if (error) {
      console.error("[api/agents/profile/[id]] PATCH", error)
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (!data) {
      return NextResponse.json({ error: "Fact not found" }, { status: 404 })
    }

    return NextResponse.json({
      fact: mapAgentProfileFactRow(data as Parameters<typeof mapAgentProfileFactRow>[0]),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update fact"
    console.error("[api/agents/profile/[id]] PATCH", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

/** DELETE /api/agents/profile/[id] — hard-delete fact */
export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing fact id" }, { status: 400 })
  }

  const { ctx } = gate
  try {
    const { data, error } = await ctx.supabase
      .from("agent_profile_facts")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .select("id")
      .abortSignal(ctx.controller.signal)
      .maybeSingle()

    if (error) {
      console.error("[api/agents/profile/[id]] DELETE", error)
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (!data) {
      return NextResponse.json({ error: "Fact not found" }, { status: 404 })
    }

    return NextResponse.json({ deleted: true, id: data.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete fact"
    console.error("[api/agents/profile/[id]] DELETE", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
