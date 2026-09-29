import { normalizeJobApplication } from "@/lib/application-outcome"
import { resolveApplicationRole } from "@/lib/job-application-display"
import { FOLDERS_CACHE_KEY, readFoldersCache, writeFoldersCache } from "@/lib/folders-cache"
import { normalizeResumeVersion } from "@/lib/resume-persistence"
import { saveResumeSnapshotLocal } from "@/lib/resume-local-storage"
import {
  LOCAL_STORE_KEYS,
  readLocalStore,
  writeLocalStore,
  type LocalStoreKey,
} from "@/lib/supabase/local-store"
import {
  loadCoverLetters,
  loadJobApplications,
  loadResumeVersions,
} from "@/lib/storage"
import type { CoverLetter, Folder, JobApplication, ResumeVersion } from "@/lib/types"

export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1

export const WORKSPACE_BACKUP_LOCAL_KEYS: LocalStoreKey[] = [
  LOCAL_STORE_KEYS.jobApplications,
  LOCAL_STORE_KEYS.resumeVersions,
  LOCAL_STORE_KEYS.coverLetters,
  LOCAL_STORE_KEYS.currentResumeDraft,
  LOCAL_STORE_KEYS.folders,
  LOCAL_STORE_KEYS.deletedApplicationTombstones,
]

export type WorkspaceBackup = {
  schemaVersion: typeof WORKSPACE_BACKUP_SCHEMA_VERSION
  kind: "workspace-backup"
  exportedAt: string
  summary: {
    jobApplications: number
    resumeVersions: number
    coverLetters: number
    folders: number
    localStorageKeys: number
  }
  data: {
    jobApplications: JobApplication[]
    resumeVersions: ResumeVersion[]
    coverLetters: CoverLetter[]
    folders: Folder[]
  }
  localStorage: Record<string, string | null>
}

export type WorkspaceBackupPreview = {
  backup: WorkspaceBackup
  summary: WorkspaceBackup["summary"]
  applications: Array<{
    id: string
    company: string
    jobTitle: string
    folderId?: string
    resumeVersionId?: string
    coverLetterId?: string
  }>
}

export type WorkspaceBackupImportSelection = {
  applicationIds: string[]
  includeResumeVersions: boolean
  includeCoverLetters: boolean
  includeFolders: boolean
  includeLocalStorageCache: boolean
  /** When true, also restore resumes/letters linked from selected applications. */
  includeLinkedDocuments: boolean
}

export type WorkspaceBackupImportResult = {
  restoredApplications: number
  restoredResumeVersions: number
  restoredCoverLetters: number
  restoredFolders: number
  restoredLocalStorageKeys: number
}

function readRawLocalStorageKeys(): Record<string, string | null> {
  if (typeof window === "undefined") return {}
  const out: Record<string, string | null> = {}
  for (const key of WORKSPACE_BACKUP_LOCAL_KEYS) {
    out[key] = localStorage.getItem(key)
  }
  out[FOLDERS_CACHE_KEY] = localStorage.getItem(FOLDERS_CACHE_KEY)
  return out
}

function mergeFolders(existing: Folder[], incoming: Folder[]): Folder[] {
  const byId = new Map(existing.map((folder) => [folder.id, folder]))
  for (const folder of incoming) {
    byId.set(folder.id, folder)
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt)
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]))
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

function applicationLabel(job: JobApplication, resumes: ResumeVersion[]): {
  company: string
  jobTitle: string
} {
  const resume = resumes.find((v) => v.id === job.resumeVersionId)
  const role = resolveApplicationRole(job, resume)
  return {
    company: role.company || "Unknown company",
    jobTitle: role.jobTitle || "Untitled role",
  }
}

export async function createWorkspaceBackup(): Promise<WorkspaceBackup> {
  const [jobApplications, resumeVersions, coverLetters] = await Promise.all([
    loadJobApplications(),
    loadResumeVersions(),
    loadCoverLetters(),
  ])

  const localFolders = readLocalStore<Folder>(LOCAL_STORE_KEYS.folders)
  const cachedFolders = readFoldersCache()
  const folders = mergeFolders(localFolders, cachedFolders)
  const localStorage = readRawLocalStorageKeys()

  return {
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    kind: "workspace-backup",
    exportedAt: new Date().toISOString(),
    summary: {
      jobApplications: jobApplications.length,
      resumeVersions: resumeVersions.length,
      coverLetters: coverLetters.length,
      folders: folders.length,
      localStorageKeys: Object.values(localStorage).filter(Boolean).length,
    },
    data: {
      jobApplications,
      resumeVersions,
      coverLetters,
      folders,
    },
    localStorage,
  }
}

export function downloadWorkspaceBackup(backup: WorkspaceBackup, filename?: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download =
    filename ?? `workspace-backup-${backup.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function parseWorkspaceBackup(raw: unknown): WorkspaceBackup {
  if (!raw || typeof raw !== "object") {
    throw new Error("Backup file is not valid JSON.")
  }
  const obj = raw as Partial<WorkspaceBackup>
  if (obj.kind !== "workspace-backup") {
    throw new Error('Backup file must have kind "workspace-backup".')
  }
  if (!obj.data || typeof obj.data !== "object") {
    throw new Error("Backup file is missing data.")
  }
  const data = obj.data as WorkspaceBackup["data"]
  return {
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    kind: "workspace-backup",
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    summary: {
      jobApplications: Array.isArray(data.jobApplications) ? data.jobApplications.length : 0,
      resumeVersions: Array.isArray(data.resumeVersions) ? data.resumeVersions.length : 0,
      coverLetters: Array.isArray(data.coverLetters) ? data.coverLetters.length : 0,
      folders: Array.isArray(data.folders) ? data.folders.length : 0,
      localStorageKeys: obj.localStorage
        ? Object.values(obj.localStorage).filter(Boolean).length
        : 0,
    },
    data: {
      jobApplications: Array.isArray(data.jobApplications) ? data.jobApplications : [],
      coverLetters: Array.isArray(data.coverLetters) ? data.coverLetters : [],
      resumeVersions: Array.isArray(data.resumeVersions) ? data.resumeVersions : [],
      folders: Array.isArray(data.folders) ? data.folders : [],
    },
    localStorage:
      obj.localStorage && typeof obj.localStorage === "object" ? obj.localStorage : {},
  }
}

export function buildWorkspaceBackupPreview(backup: WorkspaceBackup): WorkspaceBackupPreview {
  const resumes = backup.data.resumeVersions
  const applications = backup.data.jobApplications.map((job) => {
    const label = applicationLabel(job, resumes)
    return {
      id: job.id,
      company: label.company,
      jobTitle: label.jobTitle,
      folderId: job.folderId,
      resumeVersionId: job.resumeVersionId || undefined,
      coverLetterId: job.coverLetterId || undefined,
    }
  })

  return {
    backup,
    summary: backup.summary,
    applications,
  }
}

function collectLinkedDocumentIds(
  applications: JobApplication[],
  resumes: ResumeVersion[],
): { resumeIds: Set<string>; coverLetterIds: Set<string> } {
  const resumeIds = new Set<string>()
  const coverLetterIds = new Set<string>()

  for (const job of applications) {
    if (job.resumeVersionId?.trim()) resumeIds.add(job.resumeVersionId.trim())
    if (job.coverLetterId?.trim()) coverLetterIds.add(job.coverLetterId.trim())
  }

  for (const resume of resumes) {
    if (resume.coverLetter?.id?.trim()) coverLetterIds.add(resume.coverLetter.id.trim())
  }

  return { resumeIds, coverLetterIds }
}

/** Restore backup into localStorage only — never writes to Supabase. */
export function importWorkspaceBackupLocally(
  backup: WorkspaceBackup,
  selection: WorkspaceBackupImportSelection,
): WorkspaceBackupImportResult {
  if (typeof window === "undefined") {
    throw new Error("Import is only available in the browser.")
  }

  const selectedIds = new Set(selection.applicationIds)
  const selectedApplications = backup.data.jobApplications
    .filter((job) => selectedIds.has(job.id))
    .map((job) => normalizeJobApplication(job))

  let resumesToRestore: ResumeVersion[] = []
  if (selection.includeResumeVersions) {
    resumesToRestore = backup.data.resumeVersions
  } else if (selection.includeLinkedDocuments && selectedApplications.length > 0) {
    const { resumeIds } = collectLinkedDocumentIds(selectedApplications, backup.data.resumeVersions)
    resumesToRestore = backup.data.resumeVersions.filter((r) => resumeIds.has(r.id))
  }

  let lettersToRestore: CoverLetter[] = []
  if (selection.includeCoverLetters) {
    lettersToRestore = backup.data.coverLetters
  } else if (selection.includeLinkedDocuments && selectedApplications.length > 0) {
    const { coverLetterIds } = collectLinkedDocumentIds(
      selectedApplications,
      backup.data.resumeVersions,
    )
    lettersToRestore = backup.data.coverLetters.filter((l) => coverLetterIds.has(l.id))
  }

  let restoredApplications = 0
  if (selectedApplications.length > 0) {
    const existing = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications).map(
      normalizeJobApplication,
    )
    const merged = mergeById(existing, selectedApplications)
    writeLocalStore(LOCAL_STORE_KEYS.jobApplications, merged)
    restoredApplications = selectedApplications.length
  }

  let restoredResumeVersions = 0
  for (const resume of resumesToRestore) {
    const normalized = normalizeResumeVersion(resume)
    const result = saveResumeSnapshotLocal(normalized)
    if (result.ok) restoredResumeVersions++
  }

  let restoredCoverLetters = 0
  if (lettersToRestore.length > 0) {
    const existing = readLocalStore<CoverLetter>(LOCAL_STORE_KEYS.coverLetters)
    const merged = mergeById(existing, lettersToRestore)
    writeLocalStore(LOCAL_STORE_KEYS.coverLetters, merged)
    restoredCoverLetters = lettersToRestore.length
  }

  let restoredFolders = 0
  if (selection.includeFolders && backup.data.folders.length > 0) {
    const existing = readLocalStore<Folder>(LOCAL_STORE_KEYS.folders)
    const merged = mergeFolders(existing, backup.data.folders)
    writeLocalStore(LOCAL_STORE_KEYS.folders, merged)
    writeFoldersCache(merged)
    restoredFolders = backup.data.folders.length
  }

  let restoredLocalStorageKeys = 0
  if (selection.includeLocalStorageCache) {
    for (const [key, value] of Object.entries(backup.localStorage)) {
      if (value == null) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, value)
      }
      restoredLocalStorageKeys++
    }
  }

  return {
    restoredApplications,
    restoredResumeVersions,
    restoredCoverLetters,
    restoredFolders,
    restoredLocalStorageKeys,
  }
}
