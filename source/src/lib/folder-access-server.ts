import type { SupabaseClient } from "@supabase/supabase-js"
import type { CvUser } from "@/lib/cv-auth-types"
import { getWorkspaceSlugForUser } from "@/lib/cv-workspace-routing"

export type FolderAccessOk = { ok: true; folderId: string }
export type FolderAccessErr = { ok: false; status: 403 | 503; error: string }
export type FolderAccessResult = FolderAccessOk | FolderAccessErr

/**
 * Resolve folder rows the signed-in CV user is allowed to access.
 * - admin: all folders (ops / support)
 * - others: folders whose name matches their workspace slug (username)
 */
export async function listAllowedFolders(
  user: CvUser,
  supabase: SupabaseClient,
): Promise<{ folders: Array<{ id: string; name: string }>; error?: string }> {
  const { data, error } = await supabase
    .from("folders")
    .select("id, name")
    .order("created_at", { ascending: false })

  if (error) {
    return { folders: [], error: error.message }
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
  }))

  if (user.role === "admin") {
    return { folders: rows }
  }

  const slug = getWorkspaceSlugForUser(user)
  return {
    folders: rows.filter((folder) => folder.name.trim().toLowerCase() === slug),
  }
}

/**
 * Require a folderId query/body value that belongs to the session user.
 * Missing folderId or wrong folder → 403.
 */
export async function requireSessionFolderAccess(
  user: CvUser,
  folderId: string | null | undefined,
  supabase: SupabaseClient,
): Promise<FolderAccessResult> {
  const id = folderId?.trim()
  if (!id) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const { folders, error } = await listAllowedFolders(user, supabase)
  if (error) {
    return { ok: false, status: 503, error: error }
  }

  if (!folders.some((folder) => folder.id === id)) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  return { ok: true, folderId: id }
}

/** True when a resume/cover-letter row’s folder_id is in the session’s allow-list. */
export async function sessionMayAccessFolderId(
  user: CvUser,
  folderId: string | null | undefined,
  supabase: SupabaseClient,
): Promise<boolean> {
  if (!folderId) return false
  const result = await requireSessionFolderAccess(user, folderId, supabase)
  return result.ok
}
