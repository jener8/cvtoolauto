import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { mapResumeVersionRow } from "@/lib/resume-persistence"

export const runtime = "nodejs"

/**
 * GET /api/agents/profile/workspace-cvs
 * Lists the current user's saved resume_versions (id + name + hasText)
 * using the same auth path as profile seed.
 */
export async function GET() {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate

  try {
    const { data, error } = await ctx.supabase
      .from("resume_versions")
      .select("id, name, resume_text, created_at, user_id")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .abortSignal(ctx.controller.signal)

    if (error) {
      console.error("[api/agents/profile/workspace-cvs]", error)
      return NextResponse.json({ error: error.message, versions: [], count: 0 }, { status: 503 })
    }

    // Fallback: some older rows may lack user_id match via remapped auth —
    // also include any rows RLS still returns for this session.
    let rows = data ?? []
    if (rows.length === 0) {
      const { data: allVisible, error: visibleError } = await ctx.supabase
        .from("resume_versions")
        .select("id, name, resume_text, created_at, user_id")
        .order("created_at", { ascending: false })
        .abortSignal(ctx.controller.signal)
      if (visibleError) {
        console.error("[api/agents/profile/workspace-cvs] fallback", visibleError)
      } else {
        rows = allVisible ?? []
      }
    }

    const versions = rows.map((row) => {
      const mapped = mapResumeVersionRow(row as Record<string, unknown>)
      return {
        id: mapped.id,
        name: (mapped.name || "Untitled CV").trim() || "Untitled CV",
        hasText: Boolean(mapped.resumeText?.trim()),
      }
    })

    return NextResponse.json({
      versions,
      count: versions.length,
      withTextCount: versions.filter((v) => v.hasText).length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list workspace CVs"
    console.error("[api/agents/profile/workspace-cvs]", message)
    return NextResponse.json({ error: message, versions: [], count: 0 }, { status: 503 })
  }
}
