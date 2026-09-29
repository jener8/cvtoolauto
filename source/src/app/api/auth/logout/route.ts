import { NextResponse } from "next/server"
import { CV_AUTH_COOKIE } from "@/lib/cv-auth-session-server"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(CV_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
