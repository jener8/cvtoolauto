import { NextResponse } from "next/server"
import { runLinkedInSync } from "@/lib/linkedin-sync-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        status: "failed",
        error: "Invalid request body",
        userMessage: "Invalid request",
        debug: { parseFailed: true, reason: "Invalid JSON body" },
      },
      { status: 400 },
    )
  }

  const result = await runLinkedInSync(body.url ?? "")

  const httpStatus =
    result.status === "synced" || result.status === "partial"
      ? 200
      : result.status === "blocked"
        ? 403
        : result.status === "failed" && result.debug.fetchError
          ? 502
          : 422

  return NextResponse.json(result, { status: httpStatus })
}
