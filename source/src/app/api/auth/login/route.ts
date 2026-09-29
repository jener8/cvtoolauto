import { NextResponse } from "next/server"
import { findAccount } from "@/lib/accounts-server"
import { CV_AUTH_COOKIE } from "@/lib/cv-auth-session-server"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string }
    const username = body.username?.trim() ?? ""
    const password = body.password?.trim() ?? ""

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username or password incorrect. Please try again." },
        { status: 401 },
      )
    }

    const match = findAccount(username, password)
    if (!match) {
      return NextResponse.json(
        { error: "Username or password incorrect. Please try again." },
        { status: 401 },
      )
    }

    const user = { username: match.username, role: match.role }
    const response = NextResponse.json({ user })
    response.cookies.set(CV_AUTH_COOKIE, encodeURIComponent(JSON.stringify(user)), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch {
    return NextResponse.json({ error: "Unable to sign in. Please try again." }, { status: 500 })
  }
}
