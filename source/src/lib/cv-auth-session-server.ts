import { cookies } from "next/headers"
import type { CvUser } from "@/lib/cv-auth-types"
import { findAccountByUsername } from "@/lib/accounts-server"

export const CV_AUTH_COOKIE = "cv_auth_session"

export async function getServerCvUser(): Promise<CvUser | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(CV_AUTH_COOKIE)?.value
  if (!raw) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CvUser
    if (!parsed?.username || !parsed?.role) return null
    const account = findAccountByUsername(parsed.username)
    if (!account || account.role !== parsed.role) return null
    return { username: account.username, role: account.role }
  } catch {
    return null
  }
}

export async function requireAdminUser(): Promise<CvUser | null> {
  const user = await getServerCvUser()
  if (!user || user.role !== "admin") return null
  return user
}
