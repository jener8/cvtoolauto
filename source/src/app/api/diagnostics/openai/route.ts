import { NextResponse } from "next/server"

/**
 * Temporary diagnostic — confirms OPENAI_API_KEY is visible in the server runtime.
 * Does not expose the key or any secret material.
 * Remove when no longer needed for deployment verification.
 */
export async function GET() {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())

  return NextResponse.json({ openaiConfigured })
}
