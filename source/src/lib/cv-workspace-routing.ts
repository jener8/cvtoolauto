import type { Folder } from "@/lib/types"
import type { CvUser } from "@/lib/cv-auth-types"

export const CV_WORKSPACE_SLUG_KEY = "cv_workspace_slug"

/** URL slug for the workspace route after login. */
export function getWorkspaceSlugForUser(user: CvUser): string {
  return user.role === "admin" ? "jennifer" : user.username.toLowerCase()
}

export function setPendingWorkspaceSlug(slug: string): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(CV_WORKSPACE_SLUG_KEY, slug.trim().toLowerCase())
}

export function peekPendingWorkspaceSlug(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(CV_WORKSPACE_SLUG_KEY)
}

export function consumePendingWorkspaceSlug(): string | null {
  if (typeof window === "undefined") return null
  const slug = sessionStorage.getItem(CV_WORKSPACE_SLUG_KEY)
  if (slug) sessionStorage.removeItem(CV_WORKSPACE_SLUG_KEY)
  return slug
}

export function workspacePathForUser(user: CvUser): string {
  return `/app/workspace/${getWorkspaceSlugForUser(user)}`
}

/** Open the app with the user's workspace slug queued (preferred over workspacePathForUser). */
export function openAppForUser(user: CvUser): string {
  setPendingWorkspaceSlug(getWorkspaceSlugForUser(user))
  return "/app"
}

export function findFolderForSlug(folders: Folder[], slug: string): Folder | undefined {
  const normalized = slug.trim().toLowerCase()
  return folders.find((folder) => folder.name.trim().toLowerCase() === normalized)
}

export function findFolderForUser(folders: Folder[], user: CvUser): Folder | undefined {
  return findFolderForSlug(folders, getWorkspaceSlugForUser(user))
}
