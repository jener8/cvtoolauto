import { normalizeJobApplication } from "@/lib/application-outcome"
import type { JobApplication } from "@/lib/types"

export type JobApplicationLinkRow = {
  resume_version_id?: string | null
  cover_letter_id?: string | null
}

function trimmedId(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function applicationTimestamp(app: JobApplication): number {
  const value = app.lastModified ?? app.appliedDate
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Prefer the most recently edited application record, then preserve document links. */
export function mergeNewerJobApplication(
  remote: JobApplication,
  local: JobApplication,
): JobApplication {
  const remoteNorm = normalizeJobApplication(remote)
  const localNorm = normalizeJobApplication(local)
  const newer = applicationTimestamp(localNorm) >= applicationTimestamp(remoteNorm) ? localNorm : remoteNorm
  const older = newer === localNorm ? remoteNorm : localNorm
  return preserveDocumentLinks(older, newer)
}

/** Never strip document links during automatic merges — only explicit non-empty updates apply. */
export function preserveDocumentLinks(
  existing: JobApplication,
  next: JobApplication,
): JobApplication {
  const merged = { ...existing, ...next }
  const existingResume = trimmedId(existing.resumeVersionId)
  const nextResume = trimmedId(next.resumeVersionId)
  if (!nextResume && existingResume) {
    merged.resumeVersionId = existing.resumeVersionId
  }

  const existingCover = trimmedId(existing.coverLetterId)
  const nextCover = trimmedId(next.coverLetterId)
  if (!nextCover && existingCover) {
    merged.coverLetterId = existing.coverLetterId
  }

  return merged
}

/** Map in-memory job to Supabase link columns without clearing existing DB links. */
export function mergeJobLinkFieldsForUpsert(
  app: JobApplication,
  existing?: JobApplicationLinkRow | null,
): { resume_version_id: string | null; cover_letter_id: string | null } {
  const existingResume = trimmedId(existing?.resume_version_id)
  const existingCover = trimmedId(existing?.cover_letter_id)
  const nextResume = trimmedId(app.resumeVersionId)
  const nextCover = trimmedId(app.coverLetterId)

  return {
    resume_version_id: nextResume || existingResume || null,
    cover_letter_id: nextCover || existingCover || null,
  }
}
