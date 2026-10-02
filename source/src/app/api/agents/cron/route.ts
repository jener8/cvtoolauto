import { NextResponse } from "next/server"
import { isJobAgentApiEnabled } from "@/lib/agents/feature-flag"
import { isAuthorizedCronRequest, getJobAgentCronSecret } from "@/lib/agents/cron-auth"
import {
  runCompanyScoutPipeline,
  runJobScoutPipeline,
  type CronAgent,
} from "@/lib/agents/run-pipeline"
import { getSupabaseEnv } from "@/lib/supabase/config"
import {
  SUPABASE_SERVER_AUTH_SETUP_HINT,
  supabaseServerAuthFailureHint,
} from "@/lib/supabase/connection-messages"
import {
  getSupabaseServerAuthStatus,
  isSupabaseServerAuthConfigured,
} from "@/lib/supabase/server-auth-status"
import {
  createServerServiceSupabaseClient,
  getLastServerServiceSignInError,
  resolveServerServiceUserId,
} from "@/lib/supabase/server-service-client"

export const runtime = "nodejs"
export const maxDuration = 300

const PIPELINE_TIMEOUT_MS = 280_000

function resolveCronAgent(request: Request): CronAgent {
  const url = new URL(request.url)
  const raw = (url.searchParams.get("agent") || "job_scout").trim().toLowerCase()
  if (raw === "company_scout" || raw === "company") return "company_scout"
  return "job_scout"
}

/**
 * GET/POST /api/agents/cron?agent=job_scout|company_scout
 * Vercel Cron — gated by JOB_AGENT_ENABLED alone (not NEXT_PUBLIC_*).
 * Auth: Authorization: Bearer $JOB_AGENT_CRON_SECRET (set CRON_SECRET to the same value on Vercel).
 */
async function handleCron(request: Request) {
  if (!isJobAgentApiEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!getJobAgentCronSecret()) {
    return NextResponse.json(
      {
        error: "JOB_AGENT_CRON_SECRET is not configured",
        code: "CRON_SECRET_MISSING",
      },
      { status: 503 },
    )
  }

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const env = getSupabaseEnv()
  if (!env) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  if (!isSupabaseServerAuthConfigured()) {
    const status = getSupabaseServerAuthStatus()
    return NextResponse.json(
      {
        error: "Supabase app auth is not configured on the server.",
        hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
        code: "SUPABASE_SERVER_AUTH_MISSING",
        missingEnv: status.missing,
      },
      { status: 503 },
    )
  }

  const supabase = await createServerServiceSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Could not sign in to Supabase on the server.",
        hint: supabaseServerAuthFailureHint(getLastServerServiceSignInError()),
        code: "SUPABASE_SERVER_AUTH_FAILED",
      },
      { status: 503 },
    )
  }

  const { userId, errorMessage } = await resolveServerServiceUserId(supabase)
  if (!userId) {
    console.warn("[api/agents/cron] Could not resolve Supabase user:", errorMessage)
    return NextResponse.json(
      {
        error: "Could not resolve Supabase user for agent tables.",
        hint: errorMessage,
      },
      { status: 503 },
    )
  }

  const agent = resolveCronAgent(request)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS)
  try {
    const result =
      agent === "company_scout"
        ? await runCompanyScoutPipeline({
            userId,
            client: supabase,
            trigger: "cron",
            signal: controller.signal,
          })
        : await runJobScoutPipeline({
            userId,
            client: supabase,
            trigger: "cron",
            signal: controller.signal,
          })

    return NextResponse.json({
      ok: true,
      agent: result.agent,
      trigger: result.trigger,
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cron pipeline failed"
    console.error("[api/agents/cron]", message)
    return NextResponse.json({ error: message }, { status: 503 })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: Request) {
  return handleCron(request)
}

export async function POST(request: Request) {
  return handleCron(request)
}
