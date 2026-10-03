import { NextResponse } from "next/server"
import { getServerCvUser } from "@/lib/cv-auth-session-server"
import { isJobAgentApiEnabled } from "@/lib/agents/feature-flag"
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
  resolveServerServiceUserId,
} from "@/lib/supabase/server-service-client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { CvUser } from "@/lib/cv-auth-types"

export type AgentsApiContext = {
  user: CvUser
  supabase: SupabaseClient
  userId: string
  controller: AbortController
}

/** Shared auth + feature-flag gate for /api/agents/* routes. */
export async function requireAgentsApi(): Promise<
  | { ok: true; ctx: AgentsApiContext }
  | { ok: false; response: NextResponse }
> {
  if (!isJobAgentApiEnabled()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }

  const user = await getServerCvUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const env = getSupabaseEnv()
  if (!env) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Supabase is not configured" }, { status: 503 }),
    }
  }

  if (!isSupabaseServerAuthConfigured()) {
    const status = getSupabaseServerAuthStatus()
    console.warn("[api/agents] Server auth not configured:", {
      missingEnv: status.missing,
    })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Supabase app auth is not configured on the server.",
          hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
          code: "SUPABASE_SERVER_AUTH_MISSING",
        },
        { status: 503 },
      ),
    }
  }

  const supabase = await createServerServiceSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Could not sign in to Supabase on the server.",
          hint: supabaseServerAuthFailureHint(getLastServerServiceSignInError()),
          code: "SUPABASE_SERVER_AUTH_FAILED",
        },
        { status: 503 },
      ),
    }
  }

  const { userId, errorMessage } = await resolveServerServiceUserId(supabase)
  if (!userId) {
    console.warn("[api/agents] Could not resolve Supabase user:", errorMessage)
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Could not resolve Supabase user for agent tables.",
          hint: errorMessage,
        },
        { status: 503 },
      ),
    }
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  return {
    ok: true,
    ctx: {
      user,
      supabase,
      userId,
      controller,
    },
  }
}
