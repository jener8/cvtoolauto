import { NextResponse } from "next/server"
import { mapResumeVersionRow } from "@/lib/resume-persistence"
import { getServerCvUser } from "@/lib/cv-auth-session-server"
import { getSupabaseEnv, SUPABASE_REQUEST_TIMEOUT_MS } from "@/lib/supabase/config"
import {
  getSupabaseServerAuthStatus,
  isSupabaseServerAuthConfigured,
  SUPABASE_SERVER_AUTH_SETUP_HINT,
  supabaseServerAuthFailureHint,
} from "@/lib/supabase/server-auth-config"
import {
  createServerServiceSupabaseClient,
  getLastServerServiceSignInError,
} from "@/lib/supabase/server-service-client"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getServerCvUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", offline: true, versions: [] }, { status: 401 })
  }

  const env = getSupabaseEnv()
  if (!env) {
    return NextResponse.json(
      { error: "Supabase is not configured", offline: true, versions: [] },
      { status: 503 },
    )
  }

  if (!isSupabaseServerAuthConfigured()) {
    const status = getSupabaseServerAuthStatus()
    console.warn("[api/workspace/resume-versions] Server auth not configured:", {
      missingEnv: status.missing,
      invalidPasswordLooksLikeApiKey: status.invalidPasswordLooksLikeApiKey,
    })
    return NextResponse.json(
      {
        error: "Supabase app auth is not configured on the server.",
        hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
        code: "SUPABASE_SERVER_AUTH_MISSING",
        offline: true,
        versions: [],
      },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get("folderId")?.trim() || undefined
  const idsParam = searchParams.get("ids")?.trim()
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []
  const applicationIdsParam = searchParams.get("applicationIds")?.trim()
  const applicationIds = applicationIdsParam
    ? applicationIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    const supabase = await createServerServiceSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        {
          error: "Could not sign in to Supabase on the server.",
          hint: supabaseServerAuthFailureHint(getLastServerServiceSignInError()),
          code: "SUPABASE_SERVER_AUTH_FAILED",
          offline: true,
          versions: [],
        },
        { status: 503 },
      )
    }

    let query = supabase
      .from("resume_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .abortSignal(controller.signal)

    if (folderId) {
      query = query.eq("folder_id", folderId)
    }
    if (ids.length > 0) {
      query = query.in("id", ids)
    }
    if (applicationIds.length > 0) {
      query = query.in("application_id", applicationIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("[api/workspace/resume-versions] Supabase error:", error)
      return NextResponse.json({ error: error.message, offline: true, versions: [] }, { status: 503 })
    }

    const versions = (data ?? []).map((row) =>
      mapResumeVersionRow(row as Record<string, unknown>),
    )
    const withText = versions.filter((version) => version.resumeText?.trim()).length

    return NextResponse.json({
      versions,
      offline: false,
      cloudCount: versions.length,
      withTextCount: withText,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load resume versions"
    console.error("[api/workspace/resume-versions]", message)
    const status = message.toLowerCase().includes("abort") ? 504 : 503
    return NextResponse.json({ error: message, offline: true, versions: [] }, { status })
  } finally {
    clearTimeout(timeoutId)
  }
}
