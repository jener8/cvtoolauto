import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import {
  agentDraftFilename,
  buildAgentDraftDocx,
  buildAgentDraftPdf,
  type AgentDraftExportFormat,
  type AgentDraftExportKind,
} from "@/lib/agents/draft-export"

export const runtime = "nodejs"
export const maxDuration = 120

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/agents/drafts/[id]/export?format=pdf|docx&doc=cv|cover
 */
export async function GET(request: Request, context: RouteContext) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const draftId = id?.trim()
  if (!draftId) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const format = (searchParams.get("format")?.trim().toLowerCase() || "pdf") as AgentDraftExportFormat
  const doc = (searchParams.get("doc")?.trim().toLowerCase() || "cv") as AgentDraftExportKind

  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "format must be pdf or docx" }, { status: 400 })
  }
  if (doc !== "cv" && doc !== "cover") {
    return NextResponse.json({ error: "doc must be cv or cover" }, { status: 400 })
  }

  try {
    const { data: draft, error } = await gate.ctx.supabase
      .from("agent_drafts")
      .select("id, job_id, cv_text, cover_text")
      .eq("id", draftId)
      .eq("user_id", gate.ctx.userId)
      .abortSignal(gate.ctx.controller.signal)
      .single()

    if (error || !draft) {
      return NextResponse.json({ error: error?.message ?? "Draft not found" }, { status: 404 })
    }

    const text =
      doc === "cv"
        ? ((draft.cv_text as string | null) ?? "").trim()
        : ((draft.cover_text as string | null) ?? "").trim()

    if (!text) {
      return NextResponse.json({ error: `No ${doc} text on this draft` }, { status: 400 })
    }

    let jobTitle: string | null = null
    const jobId = draft.job_id as string
    if (jobId) {
      const { data: job } = await gate.ctx.supabase
        .from("agent_jobs")
        .select("title")
        .eq("id", jobId)
        .eq("user_id", gate.ctx.userId)
        .abortSignal(gate.ctx.controller.signal)
        .maybeSingle()
      jobTitle = (job?.title as string | null) ?? null
    }

    const title = doc === "cv" ? "Curriculum Vitae" : "Cover Letter / Anschreiben"
    const buffer =
      format === "docx"
        ? await buildAgentDraftDocx({ kind: doc, text, title })
        : await buildAgentDraftPdf({ kind: doc, text, title })

    const filename = agentDraftFilename({ kind: doc, format, jobTitle })
    const contentType =
      format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf"

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed"
    console.error("[api/agents/drafts/export]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
