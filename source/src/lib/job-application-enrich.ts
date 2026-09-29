import { normalizeJobApplication } from "@/lib/application-outcome"
import { coerceApplicationTimestamp } from "@/lib/application-dates"
import type { JobApplication, ResumeVersion } from "@/lib/types"

function hasApplicationLabel(app: JobApplication): boolean {
  return Boolean(app.company?.trim() || app.jobTitle?.trim())
}

/** Drop empty reconcile shells when a labeled application owns the same resume. */
export function removeOrphanReconcileShells(
  applications: JobApplication[],
  versions: ResumeVersion[],
): JobApplication[] {
  const labeledByResumeId = new Map<string, string>()
  const labeledByAppId = new Map<string, string>()

  for (const app of applications) {
    if (!hasApplicationLabel(app)) continue
    const resumeId = app.resumeVersionId?.trim()
    if (resumeId) labeledByResumeId.set(resumeId, app.id)
    labeledByAppId.set(app.id, app.id)
  }

  for (const version of versions) {
    const appId = version.applicationId?.trim()
    if (!appId || !labeledByAppId.has(appId)) continue
    labeledByResumeId.set(version.id, labeledByAppId.get(appId)!)
  }

  return applications.filter((app) => {
    if (hasApplicationLabel(app)) return true

    const resumeId = app.resumeVersionId?.trim()
    if (resumeId) {
      const ownerId = labeledByResumeId.get(resumeId)
      if (ownerId && ownerId !== app.id) return false
    }

    const linkedVersion = versions.find(
      (version) =>
        version.applicationId === app.id ||
        (resumeId && version.id === resumeId),
    )
    const ownerId = linkedVersion?.applicationId?.trim()
    if (ownerId && labeledByAppId.has(ownerId) && ownerId !== app.id) {
      return false
    }

    return true
  })
}

/** Prefer linked resume creation time when applied_date was reset during restore. */
export function enrichApplicationDatesFromLinkedResumes(
  applications: JobApplication[],
  versions: ResumeVersion[],
): JobApplication[] {
  const versionById = new Map(versions.map((version) => [version.id, version]))
  const versionByAppId = new Map(
    versions
      .filter((version) => version.applicationId?.trim())
      .map((version) => [version.applicationId!.trim(), version]),
  )

  return applications.map((app) => {
    const version =
      (app.resumeVersionId ? versionById.get(app.resumeVersionId) : undefined) ??
      versionByAppId.get(app.id)
    const resumeTs = coerceApplicationTimestamp(version?.createdAt ?? version?.timestamp)
    if (!resumeTs) return normalizeJobApplication(app)

    const applied = coerceApplicationTimestamp(app.appliedDate)
    if (!applied || resumeTs < applied) {
      return normalizeJobApplication({ ...app, appliedDate: resumeTs })
    }
    return normalizeJobApplication(app)
  })
}

export function finalizeWorkspaceApplications(
  applications: JobApplication[],
  versions: ResumeVersion[],
): JobApplication[] {
  const withoutShells = removeOrphanReconcileShells(applications, versions)
  return enrichApplicationDatesFromLinkedResumes(withoutShells, versions)
}
