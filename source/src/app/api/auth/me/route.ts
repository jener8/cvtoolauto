import { NextResponse } from "next/server"
import { getServerCvUser } from "@/lib/cv-auth-session-server"

export async function GET() {
  const user = await getServerCvUser()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({ user })
}
