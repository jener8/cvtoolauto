import { clearCvUser } from "@/lib/cv-auth"
import { CV_WORKSPACE_SLUG_KEY } from "@/lib/cv-workspace-routing"

/** Clears local session and notifies the auth API. */
export async function signOutFromApp(): Promise<void> {
  clearCvUser()
  sessionStorage.removeItem(CV_WORKSPACE_SLUG_KEY)
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } catch {
    /* proceed to login */
  }
}
