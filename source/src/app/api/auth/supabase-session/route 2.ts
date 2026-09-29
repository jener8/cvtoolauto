import { NextResponse } from "next/server"
import { getServerCvUser } from "@/lib/cv-auth-session-server"
import { createServerServiceSupabaseClient } from "@/lib/supabase/server-service-client"
import {
  getSupabaseServerAuthStatus,
  isSupabaseServerAuthConfigured,
  logSupabaseServerAuthStatusOnce,
  SUPABASE_SERVER_AUTH_SETUP_HINT,
} from "@/lib/supabase/server-auth-config"

export const runtime = "nodejs"

logSupabaseServerAuthStatusOnce()

/** Issue a Supabase Auth session after CV login so RLS-protected tables are reachable. */
export async function POST() {
  const user = await getServerCvUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSupabaseServerAuthConfigured()) {
    const status = getSupabaseServerAuthStatus()
    console.warn("[auth] Supabase server auth missing:", {
      missingEnv: status.missing,
      invalidPasswordLooksLikeApiKey: status.invalidPasswordLooksLikeApiKey,
    })
    return NextResponse.json(
      {
        error: "Supabase app auth is not configured on the server.",
        hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
        code: "SUPABASE_SERVER_AUTH_MISSING",
      },
      { status: 503 },
    )
  }

  const supabase = await createServerServiceSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Could not sign in to Supabase on the server.",
        hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
        code: "SUPABASE_SERVER_AUTH_FAILED",
      },
      { status: 503 },
    )
  }

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    console.warn("[auth] Supabase session bootstrap failed:", error?.message)
    return NextResponse.json(
      { error: "Could not start a secure database session." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
