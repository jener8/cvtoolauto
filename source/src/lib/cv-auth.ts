import type { CvUser } from "@/lib/cv-auth-types"
import { CV_USER_SESSION_KEY } from "@/lib/cv-auth-types"

export { CV_USER_SESSION_KEY }
export type { CvUser, CvUserRole, AccountRecord, PublicAccount } from "@/lib/cv-auth-types"

export function getCvUser(): CvUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CV_USER_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CvUser
    if (!parsed?.username || !parsed?.role) return null
    return parsed
  } catch {
    return null
  }
}

export function setCvUser(user: CvUser): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(CV_USER_SESSION_KEY, JSON.stringify(user))
}

export function clearCvUser(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(CV_USER_SESSION_KEY)
}

export function isCvAuthenticated(): boolean {
  return getCvUser() !== null
}

export function isCvAdmin(): boolean {
  return getCvUser()?.role === "admin"
}

const AUTH_ME_TIMEOUT_MS = 6_000

/** Restore session from the HTTP-only cookie when sessionStorage is empty. */
export async function fetchCvUserFromSession(): Promise<CvUser | null> {
  if (typeof window === "undefined") return null

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS)

  try {
    const res = await fetch("/api/auth/me", {
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: CvUser }
    if (!data.user?.username || !data.user?.role) return null
    return data.user
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
