import { getDeletedApplicationIdsForFolder } from "@/lib/application-delete-tombstones"
import { reconcileWorkspaceApplications } from "@/lib/application-reconcile"
import { finalizeWorkspaceApplications } from "@/lib/job-application-enrich"
import { prepareJobApplicationsForWorkspace } from "@/lib/job-applications-normalize"
import { normalizeJobApplication } from "@/lib/application-outcome"
import { repairApplicationResumeLinks } from "@/lib/repair-application-resume-links"
import { mergeLegacyCoverLettersIntoResumes } from "@/lib/resume-cover-letter"
import {
  migrateLocalResumeStorageIfNeeded,
  readResumeSnapshotsForFolder,
  readResumeSnapshotsLocal,
  expandCompactResume,
} from "@/lib/resume-local-storage"
import { normalizeResumeVersion } from "@/lib/resume-persistence"
import { LOCAL_STORE_KEYS, readLocalStore } from "@/lib/supabase/local-store"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"

export type WorkspaceLocalSnapshot = {
  versions: ResumeVersion[]
  applications: JobApplication[]
  coverLetters: CoverLetter[]
}

export const WORKSPACE_LOAD_STAGES = [
  { id: "applications", label: "Loading applications…", progress: 20 },
  { id: "resumes", label: "Loading resumes…", progress: 45 },
  { id: "restore", label: "Restoring saved data…", progress: 70 },
  { id: "prepare", label: "Preparing workspace…", progress: 90 },
] as const

export type WorkspaceLoadStageId = (typeof WORKSPACE_LOAD_STAGES)[number]["id"]

export const WORKSPACE_DB_TIMEOUT_MS = 12_000

export const WORKSPACE_DB_LOAD_RETRIES = 1

/** Synchronous read from browser cache — no network. */
export function loadWorkspaceFromLocalCache(folderId: string): WorkspaceLocalSnapshot {
  if (typeof window === "undefined") {
    return { versions: [], applications: [], coverLetters: [] }
  }

  migrateLocalResumeStorageIfNeeded()

  const versionsInFolder = readResumeSnapshotsForFolder(folderId).map(normalizeResumeVersion)
  const deletedApplicationIds = getDeletedApplicationIdsForFolder(folderId)
  const applications = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications)
    .map(normalizeJobApplication)
    .filter((app) => !deletedApplicationIds.has(app.id))

  const linkedResumeIds = new Set(
    applications.map((app) => app.resumeVersionId?.trim()).filter(Boolean) as string[],
  )
  const allVersions = readResumeSnapshotsLocal()
    .map(expandCompactResume)
    .map(normalizeResumeVersion)
  const linkedVersions = allVersions.filter(
    (version) =>
      linkedResumeIds.has(version.id) ||
      applications.some(
        (app) => app.id === version.applicationId && Boolean(version.resumeText?.trim()),
      ),
  )
  const versionsById = new Map<string, ResumeVersion>()
  for (const version of [...versionsInFolder, ...linkedVersions]) {
    versionsById.set(version.id, version)
  }
  const versions = [...versionsById.values()]

  const linkedCoverLetterIds = new Set(
    applications.map((app) => app.coverLetterId?.trim()).filter(Boolean) as string[],
  )
  const coverLetters = readLocalStore<CoverLetter>(LOCAL_STORE_KEYS.coverLetters).filter(
    (letter) => letter.folderId === folderId || linkedCoverLetterIds.has(letter.id),
  )

  const merged = mergeLegacyCoverLettersIntoResumes(versions, coverLetters)
  const { applications: reconciled } = reconcileWorkspaceApplications(
    merged,
    applications,
    folderId,
  )

  const prepared = prepareJobApplicationsForWorkspace(
    finalizeWorkspaceApplications(reconciled, merged),
  )
  const linkRepair = repairApplicationResumeLinks(prepared, merged, folderId)

  return {
    versions: linkRepair.versions,
    applications: linkRepair.applications,
    coverLetters,
  }
}

export function hasWorkspaceLocalContent(snapshot: WorkspaceLocalSnapshot): boolean {
  return snapshot.versions.length > 0 || snapshot.applications.length > 0
}

export async function loadWithTimeout<T>(
  loader: () => Promise<T>,
  fallback: T,
  ms: number,
): Promise<{ value: T; timedOut: boolean }> {
  let timedOut = false
  const value = await Promise.race([
    loader(),
    new Promise<T>((resolve) => {
      setTimeout(() => {
        timedOut = true
        resolve(fallback)
      }, ms)
    }),
  ])
  return { value, timedOut }
}

/** Try loader with timeout; on timeout retry once before returning fallback. */
export async function loadWithTimeoutAndRetry<T>(
  loader: () => Promise<T>,
  fallback: T,
  ms: number = WORKSPACE_DB_TIMEOUT_MS,
  retries: number = WORKSPACE_DB_LOAD_RETRIES,
): Promise<{ value: T; timedOut: boolean; attempts: number }> {
  let lastTimedOut = false
  let lastValue = fallback

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await loadWithTimeout(loader, fallback, ms)
    lastValue = result.value
    lastTimedOut = result.timedOut
    if (!result.timedOut) {
      return { value: result.value, timedOut: false, attempts: attempt + 1 }
    }
    if (attempt < retries) {
      console.warn(
        `[workspace] Supabase load timed out after ${ms}ms — retrying (${attempt + 1}/${retries})…`,
      )
    }
  }

  return { value: lastValue, timedOut: lastTimedOut, attempts: retries + 1 }
}
