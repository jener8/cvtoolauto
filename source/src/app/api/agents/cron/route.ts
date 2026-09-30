import { NextResponse } from "next/server"
import { isJobAgentEnabled } from "@/lib/agents/feature-flag"
import { isAuthorizedCronRequest, getJobAgentCronSecret } from "@/lib/agents/cron-auth"
import { runDailyPipeline } from "@/lib/agents/run-pipeline"
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
} from "@/lib/supabase/server-service-client"

export const runtime = "nodejs"
export const maxDuration = 300

const PIPELINE_TIMEOUT_MS = 280_000

/**
 * GET/POST /api/agents/cron
 * Vercel Cron (daily) — search → relevance → draft behind JOB_AGENT_ENABLED.
 * Auth: Authorization: Bearer $JOB_AGENT_CRON_SECRET (set CRON_SECRET to the same value on Vercel).
 */
async function handleCron(request: Request) {
  if (!isJobAgentEnabled()) {
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

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user?.id) {
    return NextResponse.json(
      { error: "Could not resolve Supabase user for agent tables." },
      { status: 503 },
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS)
  try {
    const result = await runDailyPipeline({
      userId: authData.user.id,
      client: supabase,
      trigger: "cron",
      signal: controller.signal,
    })

    return NextResponse.json({
      ok: true,
      trigger: result.trigger,
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
