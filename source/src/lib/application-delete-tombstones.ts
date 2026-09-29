import { isApplicationResumeVersion } from "@/lib/resume-classification"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import {
  LOCAL_STORE_KEYS,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/supabase/local-store"

const TOMBSTONE_STORE_KEY = LOCAL_STORE_KEYS.deletedApplicationTombstones

type FolderTombstones = {
  applicationIds: string[]
  resumeVersionIds: string[]
}

type TombstoneStore = Record<string, FolderTombstones>

function readStore(): TombstoneStore {
  if (typeof window === "undefined") return {}
  const raw = readLocalStoreJson<TombstoneStore>(TOMBSTONE_STORE_KEY)
  return raw && typeof raw === "object" ? raw : {}
}

function writeStore(store: TombstoneStore): void {
  if (typeof window === "undefined") return
  writeLocalStoreJson(TOMBSTONE_STORE_KEY, store)
}

function ensureFolder(store: TombstoneStore, folderId: string): FolderTombstones {
  if (!store[folderId]) {
    store[folderId] = { applicationIds: [], resumeVersionIds: [] }
  }
  return store[folderId]
}

/** Prevent reconcile from recreating applications the user explicitly deleted. */
export function recordDeletedApplication(
  folderId: string,
  applicationId: string,
  resumeVersionId?: string | null,
): void {
  if (!folderId || !applicationId) return
  const store = readStore()
  const folder = ensureFolder(store, folderId)
  if (!folder.applicationIds.includes(applicationId)) {
    folder.applicationIds.push(applicationId)
  }
  if (resumeVersionId && !folder.resumeVersionIds.includes(resumeVersionId)) {
    folder.resumeVersionIds.push(resumeVersionId)
  }
  writeStore(store)
}

export function getDeletedApplicationIdsForFolder(folderId: string): Set<string> {
  const folder = readStore()[folderId]
  if (!folder) return new Set()
  return new Set(folder.applicationIds)
}

/** Remove tombstones for one folder (e.g. after a DB restore). */
export function clearDeletedApplicationTombstonesForFolder(folderId: string): number {
  if (!folderId) return 0
  const store = readStore()
  const removed = store[folderId]?.applicationIds.length ?? 0
  if (store[folderId]) {
    delete store[folderId]
    writeStore(store)
  }
  return removed
}

/** Remove all tombstones on this device. */
export function clearAllDeletedApplicationTombstones(): number {
  const store = readStore()
  const removed = Object.values(store).reduce(
    (sum, folder) => sum + folder.applicationIds.length,
    0,
  )
  if (Object.keys(store).length > 0) {
    writeLocalStoreJson(TOMBSTONE_STORE_KEY, {})
  }
  return removed
}

export function getExcludedResumeVersionIdsForFolder(folderId: string): Set<string> {
  const folder = readStore()[folderId]
  if (!folder) return new Set()
  return new Set(folder.resumeVersionIds)
}

export function isResumeVersionDeleted(folderId: string | undefined, resumeVersionId: string): boolean {
  if (!folderId || !resumeVersionId) return false
  return getExcludedResumeVersionIdsForFolder(folderId).has(resumeVersionId)
}

function normalizeMatchText(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

/** Block reconcile from resurrecting CVs tied to a deleted application. */
export function tombstoneApplicationDeletion(
  folderId: string,
  job: JobApplication,
  versions: ResumeVersion[],
): void {
  recordDeletedApplication(folderId, job.id, job.resumeVersionId)

  const company = normalizeMatchText(job.company)
  const jobTitle = normalizeMatchText(job.jobTitle)

  for (const version of versions) {
    if (version.applicationId === job.id) {
      recordDeletedApplication(folderId, job.id, version.id)
      continue
    }
    if (job.resumeVersionId?.trim() === version.id) {
      recordDeletedApplication(folderId, job.id, version.id)
      continue
    }
    if (!company) continue
    const targetCompany = normalizeMatchText(version.contactInfo?.targetCompany)
    const targetRole = normalizeMatchText(version.contactInfo?.targetRole)
    if (targetCompany !== company) continue
    if (jobTitle && targetRole && targetRole !== jobTitle) continue
    if (!isApplicationResumeVersion(version)) continue
    recordDeletedApplication(folderId, job.id, version.id)
  }
}
