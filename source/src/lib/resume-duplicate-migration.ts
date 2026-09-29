import { resolveApplicationRole } from "@/lib/job-application-display"
import { isResumeTemplateVersion } from "@/lib/resume-classification"
import {
  createSnapshotFromResume,
  getResumeLineageBase,
  normalizeResumeVersionHistory,
} from "@/lib/resume-version-history"
import type { JobApplication, ResumeVersion } from "@/lib/types"

export type ResumeMigrationResult = {
  versions: ResumeVersion[]
  applications: JobApplication[]
  changed: boolean
  mergedCount: number
  message?: string
}

function sameApplicationContext(
  a: ResumeVersion,
  b: ResumeVersion,
  job?: JobApplication,
): boolean {
  if (a.folderId && b.folderId && a.folderId !== b.folderId) return false
  if (a.applicationId && b.applicationId && a.applicationId === b.applicationId) return true

  const roleA = job ? resolveApplicationRole(job, a) : null
  const baseA = getResumeLineageBase(a.name)
  const baseB = getResumeLineageBase(b.name)
  if (baseA && baseB && baseA === baseB) return true

  if (roleA) {
    const bCompany = b.contactInfo?.targetCompany?.trim()
    const bRole = b.contactInfo?.targetRole?.trim()
    if (
      bCompany &&
      bRole &&
      bCompany === roleA.company &&
      bRole === roleA.jobTitle
    ) {
      return true
    }
  }

  return false
}

/**
 * Merge duplicate resume records (same application lineage) into one resume with version history.
 * Preserves the application's linked resumeVersionId as the canonical record.
 */
export function migrateDuplicateResumes(
  versions: ResumeVersion[],
  applications: JobApplication[],
): ResumeMigrationResult {
  let changed = false
  let mergedCount = 0
  const versionById = new Map(versions.map((v) => [v.id, normalizeResumeVersionHistory(v)]))
  const removeIds = new Set<string>()
  const appUpdates = new Map<string, string>()

  for (const job of applications) {
    const canonicalId = job.resumeVersionId
    if (!canonicalId) continue

    const canonical = versionById.get(canonicalId)
    if (!canonical || isResumeTemplateVersion(canonical)) continue

    const duplicates = versions.filter(
      (v) =>
        v.id !== canonicalId &&
        !isResumeTemplateVersion(v) &&
        !removeIds.has(v.id) &&
        sameApplicationContext(canonical, v, job),
    )

    if (duplicates.length === 0) continue

    let history = [...(canonical.versionHistory ?? [])]
    for (const dup of duplicates.sort(
      (a, b) => (a.createdAt ?? a.timestamp ?? 0) - (b.createdAt ?? b.timestamp ?? 0),
    )) {
      history.push(
        createSnapshotFromResume(dup, dup.name, "manual"),
      )
      removeIds.add(dup.id)
      mergedCount++
      changed = true
    }

    history = history
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-50)

    versionById.set(canonicalId, {
      ...canonical,
      applicationId: canonical.applicationId ?? job.id,
      versionHistory: history,
      name: getResumeLineageBase(canonical.name) || canonical.name,
    })
  }

  // Re-link applications pointing at removed duplicate ids
  for (const job of applications) {
    if (job.resumeVersionId && removeIds.has(job.resumeVersionId)) {
      const replacement = [...versionById.values()].find(
        (v) =>
          v.applicationId === job.id ||
          sameApplicationContext(
            v,
            versions.find((x) => x.id === job.resumeVersionId)!,
            job,
          ),
      )
      if (replacement) {
        appUpdates.set(job.id, replacement.id)
        changed = true
      }
    }
  }

  const nextVersions = [...versionById.values()].filter((v) => !removeIds.has(v.id))
  const nextApplications = applications.map((job) => {
    const newResumeId = appUpdates.get(job.id)
    if (!newResumeId) return job
    return { ...job, resumeVersionId: newResumeId }
  })

  return {
    versions: nextVersions,
    applications: nextApplications,
    changed,
    mergedCount,
    message:
      mergedCount > 0
        ? `Merged ${mergedCount} duplicate resume record${mergedCount === 1 ? "" : "s"} into version history.`
        : undefined,
  }
}
