import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"

export const runtime = "nodejs"

/**
 * POST /api/agents/profile/clear
 * Deletes all agent_profile_facts for the current user so they can re-import cleanly.
 * Body: { confirm: "CLEAR_PROFILE_FACTS" }
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { confirm?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // ignore
  }

  if (body.confirm !== "CLEAR_PROFILE_FACTS") {
    return NextResponse.json(
      {
        error: 'Confirmation required. Send { "confirm": "CLEAR_PROFILE_FACTS" }.',
      },
      { status: 400 },
    )
  }

  try {
    const { data, error } = await ctx.supabase
      .from("agent_profile_facts")
      .delete()
      .eq("user_id", ctx.userId)
      .select("id")
      .abortSignal(ctx.controller.signal)

    if (error) {
      console.error("[api/agents/profile/clear]", error)
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    return NextResponse.json({ deleted: data?.length ?? 0 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear profile facts"
    console.error("[api/agents/profile/clear]", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
