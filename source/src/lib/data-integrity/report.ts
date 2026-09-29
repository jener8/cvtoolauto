import { getSupabaseClient } from "@/lib/supabase/client"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"
import {
  expandCompactResume,
  migrateLocalResumeStorageIfNeeded,
  readResumeDraftAsVersion,
  readResumeSnapshotsLocal,
} from "@/lib/resume-local-storage"
import { normalizeResumeVersion } from "@/lib/resume-persistence"
import type { ResumeVersion } from "@/lib/types"

export type BrokenResumeLinkRow = {
  applicationId: string
  company: string
  jobTitle: string
  missingResumeId: string
  folderId: string | null
  localSnapshotFound: boolean
  localSnapshotName: string | null
  /** True when Supabase has a row but resume_text is empty. */
  emptyRemoteText: boolean
}

/** @deprecated Use BrokenResumeLinkRow */
export type OrphanResumeLinkRow = BrokenResumeLinkRow

export type IntegritySummary = {
  generatedAt: string
  supabaseAvailable: boolean
  applicationCount: number
  resumeVersionCount: number
  coverLetterCount: number
  applicationsWithResumeLink: number
  orphanResumeLinks: BrokenResumeLinkRow[]
  emptyResumeTextLinks: BrokenResumeLinkRow[]
  applicationsWithCoverLetterLink: number
  coverLettersInTable: number
}

function buildLocalResumeIndex(): Map<string, ResumeVersion> {
  if (typeof window === "undefined") return new Map()
  migrateLocalResumeStorageIfNeeded()
  const index = new Map<string, ResumeVersion>()
  for (const compact of readResumeSnapshotsLocal()) {
    const resume = normalizeResumeVersion(expandCompactResume(compact))
    index.set(resume.id, resume)
  }
  const draft = readResumeDraftAsVersion()
  if (draft?.id) {
    index.set(draft.id, normalizeResumeVersion(draft))
  }
  return index
}

export function findLocalResumeSnapshotById(resumeId: string): ResumeVersion | null {
  return buildLocalResumeIndex().get(resumeId) ?? null
}

function localSnapshotHasRecoverableText(resumeId: string, localIndex: Map<string, ResumeVersion>): boolean {
  const local = localIndex.get(resumeId)
  return Boolean(local?.resumeText?.trim())
}

function brokenResumeLinkRow(
  row: Record<string, unknown>,
  resumeId: string,
  localIndex: Map<string, ResumeVersion>,
  emptyRemoteText: boolean,
): BrokenResumeLinkRow {
  const local = localIndex.get(resumeId)
  return {
    applicationId: String(row.id),
    company: String(row.company ?? "").trim() || "Unknown company",
    jobTitle: String(row.role ?? "").trim() || "Untitled role",
    missingResumeId: resumeId,
    folderId: row.folder_id ? String(row.folder_id) : null,
    localSnapshotFound: localSnapshotHasRecoverableText(resumeId, localIndex),
    localSnapshotName: local?.name ?? null,
    emptyRemoteText,
  }
}

export function listLocalResumeSnapshotIds(): string[] {
  return [...buildLocalResumeIndex().keys()]
}

export async function buildIntegrityReport(): Promise<IntegritySummary> {
  const localIndex = buildLocalResumeIndex()
  const generatedAt = new Date().toISOString()

  if (shouldUseLocalFallback()) {
    return {
      generatedAt,
      supabaseAvailable: false,
      applicationCount: 0,
      resumeVersionCount: 0,
      coverLetterCount: 0,
      applicationsWithResumeLink: 0,
      orphanResumeLinks: [],
      emptyResumeTextLinks: [],
      applicationsWithCoverLetterLink: 0,
      coverLettersInTable: 0,
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      generatedAt,
      supabaseAvailable: false,
      applicationCount: 0,
      resumeVersionCount: 0,
      coverLetterCount: 0,
      applicationsWithResumeLink: 0,
      orphanResumeLinks: [],
      emptyResumeTextLinks: [],
      applicationsWithCoverLetterLink: 0,
      coverLettersInTable: 0,
    }
  }

  const [appsResult, resumesResult, lettersResult] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, company, role, resume_version_id, cover_letter_id, folder_id"),
    supabase.from("resume_versions").select("id, resume_text"),
    supabase.from("cover_letters").select("id"),
  ])

  if (appsResult.error) throw new Error(appsResult.error.message)
  if (resumesResult.error) throw new Error(resumesResult.error.message)
  if (lettersResult.error) throw new Error(lettersResult.error.message)

  const resumeIds = new Set(
    (resumesResult.data ?? []).map((row) => String(row.id)).filter(Boolean),
  )
  const resumeIdsWithText = new Set(
    (resumesResult.data ?? [])
      .filter((row) => String(row.resume_text ?? "").trim().length > 0)
      .map((row) => String(row.id))
      .filter(Boolean),
  )
  const apps = appsResult.data ?? []

  const orphanResumeLinks: BrokenResumeLinkRow[] = []
  const emptyResumeTextLinks: BrokenResumeLinkRow[] = []
  let applicationsWithResumeLink = 0
  let applicationsWithCoverLetterLink = 0

  for (const row of apps) {
    const resumeId = String(row.resume_version_id ?? "").trim()
    if (resumeId) {
      applicationsWithResumeLink++
      if (!resumeIds.has(resumeId)) {
        orphanResumeLinks.push(
          brokenResumeLinkRow(row, resumeId, localIndex, false),
        )
      } else if (!resumeIdsWithText.has(resumeId)) {
        emptyResumeTextLinks.push(
          brokenResumeLinkRow(row, resumeId, localIndex, true),
        )
      }
    }
    if (String(row.cover_letter_id ?? "").trim()) {
      applicationsWithCoverLetterLink++
    }
  }

  return {
    generatedAt,
    supabaseAvailable: true,
    applicationCount: apps.length,
    resumeVersionCount: resumeIds.size,
    coverLetterCount: (lettersResult.data ?? []).length,
    applicationsWithResumeLink,
    orphanResumeLinks,
    emptyResumeTextLinks,
    applicationsWithCoverLetterLink,
    coverLettersInTable: (lettersResult.data ?? []).length,
  }
}
