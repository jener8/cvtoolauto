import type { JobApplication, ResumeVersion } from "@/lib/types"

/** Resume text linked to a job — by applicationId first, then resumeVersionId. */
export function resolveResumeForJob(
  job: JobApplication,
  versions: ResumeVersion[],
): ResumeVersion | undefined {
  const owned = versions.find(
    (version) => version.applicationId === job.id && version.resumeText?.trim(),
  )
  if (owned) return owned

  const linkedId = job.resumeVersionId?.trim()
  if (!linkedId) return undefined

  const linked = versions.find((version) => version.id === linkedId)
  if (!linked?.resumeText?.trim()) return undefined

  // Explicit resumeVersionId on the job is authoritative — stale version.applicationId
  // is repaired separately and must not hide a linked CV in the UI.
  return linked
}

export function jobHasUsableResume(
  job: JobApplication,
  versions: ResumeVersion[],
): boolean {
  return Boolean(resolveResumeForJob(job, versions))
}
