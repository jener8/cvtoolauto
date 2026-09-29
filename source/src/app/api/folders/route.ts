import { NextResponse } from "next/server"
import { mapFolderRow } from "@/lib/folder-map"
import { getSupabaseEnv, SUPABASE_REQUEST_TIMEOUT_MS } from "@/lib/supabase/config"
import { createServerServiceSupabaseClient } from "@/lib/supabase/server-service-client"

export const runtime = "nodejs"

export async function GET() {
  const env = getSupabaseEnv()

  if (!env) {
    return NextResponse.json(
      {
        error: "Supabase is not configured",
        offline: true,
        folders: [],
      },
      { status: 503 },
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS)

  try {
    const supabase = await createServerServiceSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        {
          error: "Supabase app auth is not configured on the server.",
          offline: true,
          folders: [],
        },
        { status: 503 },
      )
    }

    const { data, error } = await supabase
      .from("folders")
      .select("id, name, contact_info, created_at, updated_at")
      .order("created_at", { ascending: false })
      .abortSignal(controller.signal)

    if (error) {
      console.error("[api/folders] Supabase error:", error)
      return NextResponse.json({ error: error.message, offline: true, folders: [] }, { status: 503 })
    }

    const folders =
      data?.map((row) => mapFolderRow(row as Record<string, unknown>, false)) ?? []

    return NextResponse.json({ folders, offline: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load folders"
    console.error("[api/folders]", message)
    const status = message.toLowerCase().includes("abort") ? 504 : 503
    return NextResponse.json({ error: message, offline: true, folders: [] }, { status })
  } finally {
    clearTimeout(timeoutId)
  }
}
