import type { CvUser } from "@/lib/cv-auth-types"
import { getWorkspaceSlugForUser } from "@/lib/cv-workspace-routing"
import { LOCAL_STORE_KEYS, readLocalStore } from "@/lib/supabase/local-store"
import {
  hasWorkspaceLocalContent,
  loadWorkspaceFromLocalCache,
} from "@/lib/workspace-local-cache"
import type { Folder, JobApplication } from "@/lib/types"

/** Count cloud/local applications per workspace folder id. */
export function buildFolderApplicationCounts(
  applications: JobApplication[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const application of applications) {
    if (!application.folderId) continue
    counts.set(application.folderId, (counts.get(application.folderId) ?? 0) + 1)
  }
  return counts
}

export function folderIdsMatchingSlug(folders: Folder[], slug: string): Set<string> {
  const normalized = slug.trim().toLowerCase()
  return new Set(
    folders
      .filter((folder) => folder.name.trim().toLowerCase() === normalized)
      .map((folder) => folder.id),
  )
}

/** Score folders by cached resumes + applications so we open the workspace that has data. */
export function scoreFolderLocalContent(folderId: string): number {
  if (typeof window === "undefined") return 0
  const snapshot = loadWorkspaceFromLocalCache(folderId)
  return snapshot.applications.length * 10 + snapshot.versions.length
}

export function hasAnyLocalWorkspaceData(folders: Folder[]): boolean {
  if (typeof window === "undefined") return false

  if (folders.some((folder) => hasWorkspaceLocalContent(loadWorkspaceFromLocalCache(folder.id)))) {
    return true
  }

  const applications = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications)
  return applications.length > 0
}

/**
 * Pick the workspace that should open after login.
 * Prefers slug match; when multiple folders match, chooses the one with the most
 * applications in Supabase (then local cache) so localhost matches production.
 */
export function findBestFolderForUser(
  folders: Folder[],
  user: CvUser,
  pendingSlug?: string | null,
  remoteCounts?: Map<string, number>,
): Folder | undefined {
  if (folders.length === 0) return undefined

  const slug = (pendingSlug ?? getWorkspaceSlugForUser(user)).trim().toLowerCase()
  const slugMatches = folders.filter(
    (folder) => folder.name.trim().toLowerCase() === slug,
  )

  const candidates = slugMatches.length > 0 ? slugMatches : folders

  return [...candidates].sort((a, b) => {
    const remoteA = remoteCounts?.get(a.id) ?? 0
    const remoteB = remoteCounts?.get(b.id) ?? 0
    if (remoteB !== remoteA) return remoteB - remoteA

    const scoreDiff = scoreFolderLocalContent(b.id) - scoreFolderLocalContent(a.id)
    if (scoreDiff !== 0) return scoreDiff
    return (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
  })[0]
}

export function findFolderWithMostLocalContent(folders: Folder[]): Folder | undefined {
  if (folders.length === 0) return undefined
  return [...folders].sort(
    (a, b) => scoreFolderLocalContent(b.id) - scoreFolderLocalContent(a.id),
  )[0]
}
