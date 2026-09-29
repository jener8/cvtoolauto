import { NextResponse } from "next/server"
import { getServerCvUser } from "@/lib/cv-auth-session-server"
import { getSupabaseEnv } from "@/lib/supabase/config"
import {
  getSupabaseServerAuthStatus,
  SUPABASE_SERVER_AUTH_SETUP_HINT,
} from "@/lib/supabase/server-auth-config"
import { createServerServiceSupabaseClient } from "@/lib/supabase/server-service-client"

export const runtime = "nodejs"

/** Check whether localhost can read applications from Supabase (server credentials). */
export async function GET() {
  const user = await getServerCvUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const env = getSupabaseEnv()
  const authStatus = getSupabaseServerAuthStatus()

  if (!env) {
    return NextResponse.json({
      serverAuthConfigured: false,
      missingEnv: authStatus.missing,
      cloudApplicationCount: 0,
      hint: "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the server.",
    })
  }

  if (!authStatus.configured) {
    console.warn("[diagnostics/cloud-sync] Server auth not configured:", {
      missingEnv: authStatus.missing,
      invalidPasswordLooksLikeApiKey: authStatus.invalidPasswordLooksLikeApiKey,
    })
    return NextResponse.json({
      serverAuthConfigured: false,
      missingEnv: authStatus.missing,
      invalidPasswordLooksLikeApiKey: authStatus.invalidPasswordLooksLikeApiKey,
      cloudApplicationCount: 0,
      hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
    })
  }

  const supabase = await createServerServiceSupabaseClient()
  if (!supabase) {
    return NextResponse.json({
      serverAuthConfigured: false,
      missingEnv: authStatus.missing,
      cloudApplicationCount: 0,
      hint:
        "Server could not sign in to Supabase. Check SUPABASE_APP_USER_EMAIL and SUPABASE_APP_USER_PASSWORD in .env.local (copy values from Vercel → Settings → Environment Variables), then restart npm start.",
    })
  }

  const { count, error } = await supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })

  if (error) {
    console.warn("[diagnostics/cloud-sync] Cloud count query failed:", error.message)
    return NextResponse.json({
      serverAuthConfigured: true,
      cloudApplicationCount: 0,
      hint: `Cloud query failed: ${error.message}`,
    })
  }

  return NextResponse.json({
    serverAuthConfigured: true,
    cloudApplicationCount: count ?? 0,
    byFolder: null,
  })
}
