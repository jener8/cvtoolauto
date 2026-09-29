import { findLocalResumeSnapshotById } from "@/lib/data-integrity/report"
import {
  normalizeResumeForRemoteSave,
  normalizeResumeVersion,
  saveResume,
} from "@/lib/resume-persistence"
import { saveResumeSnapshotLocal } from "@/lib/resume-local-storage"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"

export type ResumeRecoveryResult = {
  resumeId: string
  success: boolean
  localFound: boolean
  localSaved: boolean
  remoteSynced: boolean
  error?: string
  resumeName?: string
}

export async function restoreResumeVersionsFromLocalStorage(
  resumeIds: string[],
): Promise<ResumeRecoveryResult[]> {
  if (shouldUseLocalFallback()) {
    throw new Error("Supabase is unavailable — cannot restore resume versions to cloud.")
  }

  const uniqueIds = [...new Set(resumeIds.map((id) => id.trim()).filter(Boolean))]
  const results: ResumeRecoveryResult[] = []

  for (const resumeId of uniqueIds) {
    const snapshot = findLocalResumeSnapshotById(resumeId)
    if (!snapshot) {
      results.push({
        resumeId,
        success: false,
        localFound: false,
        localSaved: false,
        remoteSynced: false,
        error: "No matching snapshot in cv_local_resume_versions on this browser.",
      })
      continue
    }

    const normalized = normalizeResumeForRemoteSave(normalizeResumeVersion(snapshot))

    try {
      const localWrite = saveResumeSnapshotLocal(normalized)
      const saveResult = await saveResume(normalized)
      results.push({
        resumeId,
        success: saveResult.remoteSynced,
        localFound: true,
        localSaved: localWrite.ok,
        remoteSynced: saveResult.remoteSynced,
        error: saveResult.remoteSynced ? undefined : saveResult.remoteError,
        resumeName: normalized.name,
      })
    } catch (error) {
      results.push({
        resumeId,
        success: false,
        localFound: true,
        localSaved: false,
        remoteSynced: false,
        error: error instanceof Error ? error.message : "Restore failed",
        resumeName: normalized.name,
      })
    }
  }

  return results
}

export function downloadRecoveryLog(
  results: ResumeRecoveryResult[],
  filename?: string,
): void {
  const payload = {
    recoveredAt: new Date().toISOString(),
    kind: "resume-recovery-log",
    results,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename ?? `resume-recovery-log-${payload.recoveredAt.slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
