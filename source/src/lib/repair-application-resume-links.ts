import type { JobApplication, ResumeVersion } from "@/lib/types"

export type RepairApplicationResumeLinksResult = {
  applications: JobApplication[]
  versions: ResumeVersion[]
  changed: boolean
}

/** Keep job ↔ resume links consistent after reloads or partial saves. */
export function repairApplicationResumeLinks(
  applications: JobApplication[],
  versions: ResumeVersion[],
  folderId?: string,
): RepairApplicationResumeLinksResult {
  const scopedApps = folderId
    ? applications.filter((app) => app.folderId === folderId)
    : applications
  const scopedIds = new Set(scopedApps.map((app) => app.id))

  let changed = false
  const nextVersions = versions.map((version) => ({ ...version }))
  const versionById = new Map(nextVersions.map((version) => [version.id, version]))

  const nextApps = applications.map((app) => {
    if (folderId && app.folderId !== folderId) return app
    if (!scopedIds.has(app.id)) return app

    const owned = nextVersions.find(
      (version) => version.applicationId === app.id && version.resumeText?.trim(),
    )
    if (owned) {
      if (app.resumeVersionId?.trim() !== owned.id) {
        changed = true
        return { ...app, resumeVersionId: owned.id }
      }
      return app
    }

    const linkedId = app.resumeVersionId?.trim()
    if (linkedId) {
      const linked = versionById.get(linkedId)
      if (linked?.resumeText?.trim()) {
        if (linked.applicationId !== app.id) {
          linked.applicationId = app.id
          changed = true
        }
        return app
      }
    }

    // Recover when the app lost resumeVersionId but a version still points at it.
    const recovered = nextVersions.find(
      (version) =>
        version.applicationId === app.id &&
        version.resumeText?.trim() &&
        version.id !== linkedId,
    )
    if (recovered) {
      changed = true
      if (recovered.applicationId !== app.id) {
        recovered.applicationId = app.id
      }
      return { ...app, resumeVersionId: recovered.id }
    }

    return app
  })

  // Fix versions whose applicationId drifted after app id normalization.
  for (const version of nextVersions) {
    if (!version.resumeText?.trim()) continue
    const appId = version.applicationId?.trim()
    if (!appId || scopedIds.has(appId)) continue

    const owner = nextApps.find((app) => app.resumeVersionId?.trim() === version.id)
    if (!owner || (folderId && owner.folderId !== folderId)) continue

    version.applicationId = owner.id
    changed = true
  }

  return {
    applications: nextApps,
    versions: nextVersions,
    changed,
  }
}
