import { emptyJobApplicationFields } from "@/lib/application-flow-complete"
import { sortJobApplicationsByDate } from "@/lib/job-application-display"
import { normalizeJobApplication } from "@/lib/application-outcome"
import { resolveDraftApplicationRole } from "@/lib/application-role-label"
import { isApplicationResumeVersion } from "@/lib/resume-classification"
import {
  getDeletedApplicationIdsForFolder,
  isResumeVersionDeleted,
} from "@/lib/application-delete-tombstones"
import type { JobApplication, ResumeVersion } from "@/lib/types"

/** @deprecated Legacy local-only ids; new reconciled records use UUIDs. */
export function reconciledApplicationIdForVersion(versionId: string): string {
  return `reconciled-${versionId}`
}

function uploadDetailsFingerprint(details: JobApplication["uploadDetails"]): string {
  if (!details) return ""
  return JSON.stringify({
    outputLanguage: details.outputLanguage ?? "",
    salaryExpectation: details.salaryExpectation ?? "",
    availability: details.availability ?? "",
    whyRole: details.whyRole ?? "",
    whyCompany: details.whyCompany ?? "",
    fitStatement: details.fitStatement ?? "",
    shortMotivation: details.shortMotivation ?? "",
    locationPreference: details.locationPreference ?? "",
    additionalNotes: details.additionalNotes ?? "",
    salaryGuidance: details.salaryGuidance ?? null,
  })
}

function jobApplicationFingerprint(app: JobApplication): string {
  const normalized = normalizeJobApplication(app)
  return JSON.stringify({
    id: normalized.id,
    resumeVersionId: normalized.resumeVersionId ?? "",
    jobTitle: normalized.jobTitle,
    company: normalized.company,
    status: normalized.status,
    pipeline: (normalized.pipeline ?? []).map(
      (record) => `${record.stage}:${record.outcome}:${record.date ?? ""}`,
    ),
    folderId: normalized.folderId ?? "",
    location: normalized.location ?? "",
    uploadDetails: uploadDetailsFingerprint(normalized.uploadDetails),
  })
}

/** True when persisted job-application fields differ (ignores volatile timestamps). */
export function haveJobApplicationsChanged(
  before: JobApplication[],
  after: JobApplication[],
): boolean {
  if (before.length !== after.length) return true
  const beforeById = new Map(before.map((app) => [app.id, jobApplicationFingerprint(app)]))
  for (const app of after) {
    const prev = beforeById.get(app.id)
    if (prev === undefined || prev !== jobApplicationFingerprint(app)) return true
  }
  return false
}

export function createJobApplicationFromVersion(
  version: ResumeVersion,
  folderId?: string,
): JobApplication {
  const role = resolveDraftApplicationRole(version)
  const timestamp = version.createdAt ?? version.timestamp ?? Date.now()

  return {
    ...emptyJobApplicationFields({
      jobTitle: role.jobTitle || version.name.trim() || "New Application",
      company: role.company,
      location: role.location || undefined,
      jobDescription: version.jobDescription || "",
      resumeVersionId: version.id,
    }),
    id: crypto.randomUUID(),
    folderId,
    appliedDate: timestamp,
    lastModified: timestamp,
  }
}

/**
 * Promote unlinked role-specific CVs to full job application records so tracking
 * (status, interviews, pipeline) is never lost behind a "template" label.
 */
export function reconcileWorkspaceApplications(
  versions: ResumeVersion[],
  applications: JobApplication[],
  folderId?: string,
): { applications: JobApplication[]; newApplicationCount: number } {
  const applicationsById = new Map(applications.map((app) => [app.id, app]))
  const linkedVersionIds = new Set(
    applications.map((app) => app.resumeVersionId).filter((id): id is string => Boolean(id)),
  )
  for (const version of versions) {
    const appId = version.applicationId?.trim()
    if (appId && applicationsById.has(appId)) {
      linkedVersionIds.add(version.id)
    }
  }
  const existingReconciledVersionIds = new Set(
    applications
      .filter((app) => app.id.startsWith("reconciled-"))
      .map((app) => app.id.slice("reconciled-".length)),
  )

  const newApplications: JobApplication[] = []
  const deletedApplicationIds = folderId ? getDeletedApplicationIdsForFolder(folderId) : new Set<string>()

  for (const version of versions) {
    if (linkedVersionIds.has(version.id)) continue
    if (version.applicationId?.trim() && applicationsById.has(version.applicationId.trim())) {
      continue
    }
    if (existingReconciledVersionIds.has(version.id)) continue
    if (folderId && version.folderId && version.folderId !== folderId) continue
    if (folderId && isResumeVersionDeleted(folderId, version.id)) continue
    if (version.applicationId && deletedApplicationIds.has(version.applicationId)) continue
    if (!isApplicationResumeVersion(version)) continue

    const application = createJobApplicationFromVersion(version, folderId)
    newApplications.push(application)
    linkedVersionIds.add(version.id)
  }

  if (newApplications.length === 0) {
    return { applications, newApplicationCount: 0 }
  }

  const merged = sortJobApplicationsByDate([...newApplications, ...applications])

  return { applications: merged, newApplicationCount: newApplications.length }
}
