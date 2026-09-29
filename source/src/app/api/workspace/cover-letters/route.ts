import { NextResponse } from "next/server"
import { getServerCvUser } from "@/lib/cv-auth-session-server"
import type { CoverLetter } from "@/lib/types"
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

function mapCoverLetterRow(row: Record<string, unknown>): CoverLetter {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    contentEn: String(row.content_en ?? ""),
    contentDe: String(row.content_de ?? ""),
    contactPersonName: String(row.contact_person_name ?? ""),
    folderId: row.folder_id ? String(row.folder_id) : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at ?? row.created_at)).getTime(),
  }
}

export async function GET(request: Request) {
  const user = await getServerCvUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", offline: true, letters: [] }, { status: 401 })
  }

  const env = getSupabaseEnv()
  if (!env) {
    return NextResponse.json(
      { error: "Supabase is not configured", offline: true, letters: [] },
      { status: 503 },
    )
  }

  if (!isSupabaseServerAuthConfigured()) {
    const status = getSupabaseServerAuthStatus()
    console.warn("[api/workspace/cover-letters] Server auth not configured:", {
      missingEnv: status.missing,
      invalidPasswordLooksLikeApiKey: status.invalidPasswordLooksLikeApiKey,
    })
    return NextResponse.json(
      {
        error: "Supabase app auth is not configured on the server.",
        hint: SUPABASE_SERVER_AUTH_SETUP_HINT,
        code: "SUPABASE_SERVER_AUTH_MISSING",
        offline: true,
        letters: [],
      },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get("folderId")?.trim() || undefined

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
          letters: [],
        },
        { status: 503 },
      )
    }

    let query = supabase
      .from("cover_letters")
      .select("*")
      .order("created_at", { ascending: false })
      .abortSignal(controller.signal)

    if (folderId) {
      query = query.eq("folder_id", folderId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[api/workspace/cover-letters] Supabase error:", error)
      return NextResponse.json({ error: error.message, offline: true, letters: [] }, { status: 503 })
    }

    const letters = (data ?? []).map((row) => mapCoverLetterRow(row as Record<string, unknown>))

    return NextResponse.json({
      letters,
      offline: false,
      cloudCount: letters.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load cover letters"
    console.error("[api/workspace/cover-letters]", message)
    const status = message.toLowerCase().includes("abort") ? 504 : 503
    return NextResponse.json({ error: message, offline: true, letters: [] }, { status })
  } finally {
    clearTimeout(timeoutId)
  }
}
