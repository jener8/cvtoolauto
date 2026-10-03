import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { listProfileFacts, mapAgentProfileFactRow } from "@/lib/agents/profile-facts"
import type { AgentFactStatus, AgentFactSource } from "@/lib/agents/types"

export const runtime = "nodejs"

/** GET /api/agents/profile — list master-profile facts */
export async function GET(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")?.trim()
  const status =
    statusParam === "confirmed" || statusParam === "unconfirmed"
      ? (statusParam as AgentFactStatus)
      : undefined

  try {
    const facts = await listProfileFacts({
      userId: ctx.userId,
      client: ctx.supabase,
      status,
      signal: ctx.controller.signal,
    })
    return NextResponse.json({ facts })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load profile facts"
    console.error("[api/agents/profile] GET", message)
    return NextResponse.json({ error: message, facts: [] }, { status: 503 })
  }
}

/** POST /api/agents/profile — create a manual fact (starts unconfirmed unless status set) */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: {
    factText?: string
    category?: string
    status?: AgentFactStatus
    source?: AgentFactSource
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const factText = body.factText?.trim()
  if (!factText) {
    return NextResponse.json({ error: "factText is required" }, { status: 400 })
  }

  const category = body.category?.trim() || "other"
  const status: AgentFactStatus = body.status === "confirmed" ? "confirmed" : "unconfirmed"
  const source: AgentFactSource = body.source === "manual" || !body.source ? "manual" : body.source

  try {
    const { data, error } = await ctx.supabase
      .from("agent_profile_facts")
      .insert({
        user_id: ctx.userId,
        category,
        fact_text: factText,
        status,
        source,
        source_ref: { createdVia: "manual" },
        source_key: null,
        sort_order: Date.now() % 1_000_000,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .abortSignal(ctx.controller.signal)
      .single()

    if (error) {
      console.error("[api/agents/profile] POST", error)
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    return NextResponse.json({
      fact: mapAgentProfileFactRow(data as Parameters<typeof mapAgentProfileFactRow>[0]),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create fact"
    console.error("[api/agents/profile] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
