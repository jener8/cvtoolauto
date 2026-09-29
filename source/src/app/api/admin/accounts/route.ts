import { NextResponse } from "next/server"
import { readAccounts, writeAccounts } from "@/lib/accounts-server"
import type { AccountRecord } from "@/lib/cv-auth-types"
import { requireAdminUser } from "@/lib/cv-auth-session-server"
import { hashPasswordSync } from "@/lib/password-hash"

function toPublicAccount(account: AccountRecord) {
  const { passwordHash: _passwordHash, ...rest } = account
  return rest
}

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  return NextResponse.json({
    accounts: readAccounts().map(toPublicAccount),
  })
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      username?: string
      password?: string
      surname?: string
      email?: string
      role?: AccountRecord["role"]
    }

    const username = body.username?.trim() ?? ""
    const password = body.password?.trim() ?? ""
    const surname = body.surname?.trim() || password

    if (!username || !password) {
      return NextResponse.json({ error: "First name and surname are required." }, { status: 400 })
    }

    const accounts = readAccounts()
    if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
      return NextResponse.json({ error: "An account with this username already exists." }, { status: 409 })
    }

    const next: AccountRecord = {
      username,
      passwordHash: hashPasswordSync(password),
      surname,
      role: body.role ?? "user",
      email: body.email?.trim() || undefined,
      created: new Date().toLocaleDateString("en-GB"),
    }

    writeAccounts([...accounts, next])
    return NextResponse.json({ account: toPublicAccount(next) })
  } catch {
    return NextResponse.json({ error: "Could not create account." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { username?: string; action?: "reset_password" }
    const username = body.username?.trim() ?? ""
    if (!username || body.action !== "reset_password") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    }

    const accounts = readAccounts()
    const index = accounts.findIndex(
      (a) => a.username.toLowerCase() === username.toLowerCase(),
    )
    if (index < 0) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 })
    }

    const account = accounts[index]
    accounts[index] = {
      ...account,
      passwordHash: hashPasswordSync(account.username),
    }
    writeAccounts(accounts)

    return NextResponse.json({ account: toPublicAccount(accounts[index]) })
  } catch {
    return NextResponse.json({ error: "Could not reset password." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const username = new URL(request.url).searchParams.get("username")?.trim() ?? ""
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 })
  }

  if (username.toLowerCase() === "jennifer") {
    return NextResponse.json({ error: "The admin account cannot be deleted." }, { status: 403 })
  }

  const accounts = readAccounts()
  const next = accounts.filter((a) => a.username.toLowerCase() !== username.toLowerCase())
  if (next.length === accounts.length) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 })
  }

  writeAccounts(next)
  return NextResponse.json({ ok: true })
}
