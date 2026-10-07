import { NextResponse } from "next/server"
import { requireAgentsApi } from "@/lib/agents/api-guard"
import { isAgentControlKey } from "@/lib/agents/agent-controls"
import {
  runCompanyScoutPipeline,
  runJobScoutPipeline,
  runSingleAgent,
} from "@/lib/agents/run-pipeline"

export const runtime = "nodejs"
export const maxDuration = 300

const PIPELINE_TIMEOUT_MS = 280_000

/**
 * POST /api/agents/run
 * Per-agent Run now: { agentKey, mode?: "step"|"pipeline" }
 * - step (default): run only that agent (ignores its pause)
 * - pipeline: for job_scout / company_scout, run scout → assess → draft
 */
export async function POST(request: Request) {
  const gate = await requireAgentsApi()
  if (!gate.ok) return gate.response

  const { ctx } = gate
  let body: { agentKey?: unknown; mode?: unknown }
  try {
    body = (await request.json()) as { agentKey?: unknown; mode?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isAgentControlKey(body.agentKey)) {
    return NextResponse.json(
      {
        error: "agentKey must be one of: job_scout, company_scout, assessor, writer",
      },
      { status: 400 },
    )
  }

  const mode = body.mode === "pipeline" ? "pipeline" : "step"
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS)

  try {
    if (
      mode === "pipeline" &&
      (body.agentKey === "job_scout" || body.agentKey === "company_scout")
    ) {
      const result =
        body.agentKey === "company_scout"
          ? await runCompanyScoutPipeline({
              userId: ctx.userId,
              client: ctx.supabase,
              trigger: "manual",
              signal: controller.signal,
              forceScout: true,
            })
          : await runJobScoutPipeline({
              userId: ctx.userId,
              client: ctx.supabase,
              trigger: "manual",
              signal: controller.signal,
              forceScout: true,
            })

      return NextResponse.json({
        ok: true,
        mode: "pipeline",
        agentKey: body.agentKey,
        agent: result.agent,
        skippedPaused: result.skippedPaused,
        fetched: result.fetched,
        inserted: result.inserted,
        relevant: result.relevant,
        drafted: result.drafted,
        errors: result.errors,
        errorMessages: result.errorMessages.slice(0, 20),
        dailyCap: result.dailyCap,
        activityId: result.activityId,
      })
    }

    const step = await runSingleAgent({
      userId: ctx.userId,
      client: ctx.supabase,
      agentKey: body.agentKey,
      signal: controller.signal,
      force: true,
    })

    return NextResponse.json({
      ok: true,
      mode: "step",
      agentKey: step.agentKey,
      paused: step.paused,
      skipped: step.skipped,
      activityId: step.activityId,
      errorMessages: step.errorMessages.slice(0, 20),
      result: step.result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent run failed"
    console.error("[api/agents/run] POST", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}
