import { NextResponse } from "next/server"
import { runLinkedInSync } from "@/lib/linkedin-sync-server"

export const runtime = "nodejs"

/** @deprecated Prefer POST /api/linkedin/sync — kept for backwards compatibility. */
export async function POST(request: Request) {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await runLinkedInSync(body.url ?? "")

  return NextResponse.json({
    profileText: result.profileText,
    sections: result.sections,
    status: result.status,
    scrapeBlocked: result.status === "blocked",
    partial: result.status === "partial",
    error: result.error ?? result.userMessage,
    debug: result.debug,
  })
}
