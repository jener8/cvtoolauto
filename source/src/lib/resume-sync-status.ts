import type { SaveResumeResult } from "@/lib/resume-persistence"

/** Cloud sync state for a single resume save operation. */
export type ResumeCloudSyncStatus = "idle" | "syncing" | "synced" | "local_only"

export const RESUME_CLOUD_SYNC_LABELS: Record<
  Exclude<ResumeCloudSyncStatus, "idle">,
  string
> = {
  syncing: "Syncing",
  synced: "Saved to Supabase",
  local_only: "Saved locally only",
}

/**
 * Code paths where local resume storage can succeed without a resume_versions row:
 *
 * 1. saveResumeDraft() — saveResumeDraftLocal() then best-effort syncResumeRemote()
 * 2. saveResume() — saveResumeSnapshotLocal() then best-effort syncResumeRemote()
 * 3. saveResumes() — writeResumeSnapshotsForFolder() then batch upsert (local kept if remote fails)
 * 4. syncResumeRemote() skips or fails when:
 *    - shouldUseLocalFallback() (offline / local mode)
 *    - Supabase client unavailable
 *    - upsert error / network error / payload too large
 * 5. importWorkspaceBackupLocally() — local snapshots only (by design)
 */
export const RESUME_LOCAL_ONLY_SAVE_PATHS = [
  "saveResumeDraft → saveResumeDraftLocal + syncResumeRemote",
  "saveResume → saveResumeSnapshotLocal + syncResumeRemote",
  "saveResumes → writeResumeSnapshotsForFolder + resume_versions upsert",
  "syncResumeRemote early exit (offline mode / no client / upsert failure)",
] as const

export function resumeCloudSyncLabel(status: ResumeCloudSyncStatus): string {
  if (status === "idle") return ""
  return RESUME_CLOUD_SYNC_LABELS[status]
}

export function deriveResumeCloudSyncFromSaveResult(
  result: Pick<SaveResumeResult, "localSaved" | "remoteSynced" | "remoteError">,
): ResumeCloudSyncStatus {
  if (result.remoteSynced) return "synced"
  if (result.localSaved) return "local_only"
  return "idle"
}

export function resumeCloudSyncDescription(
  status: ResumeCloudSyncStatus,
  remoteError?: string | null,
): string {
  switch (status) {
    case "syncing":
      return "Saving to this device and syncing with Supabase…"
    case "synced":
      return "This resume is stored in Supabase and on this device."
    case "local_only":
      return (
        remoteError?.trim() ||
        "Saved on this device only. Open Data Integrity to restore missing cloud copies."
      )
    default:
      return ""
  }
}

export type SaveResumesResult = {
  count: number
  localSaved: boolean
  remoteSynced: boolean
  remoteError?: string
}

export function deriveResumeCloudSyncFromBulkSave(result: SaveResumesResult): ResumeCloudSyncStatus {
  if (result.remoteSynced) return "synced"
  if (result.localSaved) return "local_only"
  return "idle"
}
