import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import {
  getOrCreateSearchSettings,
  upsertSearchSettings,
} from "@/lib/agents/search-settings"
import type { AgentSearchSettingsInput } from "@/lib/agents/types"

export const runtime = "nodejs"

/** GET /api/agents/settings — load (or create default) search settings */
export async function GET() {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  try {
    const settings = await getOrCreateSearchSettings({
      userId: ctx.userId,
      client: ctx.supabase,
      signal: ctx.controller.signal,
    })
    return NextResponse.json({ settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load search settings"
    console.error("[api/agents/settings] GET", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

/** PUT /api/agents/settings — upsert search preferences */
export async function PUT(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: AgentSearchSettingsInput
  try {
    body = (await request.json()) as AgentSearchSettingsInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const settings = await upsertSearchSettings({
      userId: ctx.userId,
      client: ctx.supabase,
      patch: body,
      signal: ctx.controller.signal,
    })
    return NextResponse.json({ settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save search settings"
    console.error("[api/agents/settings] PUT", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
