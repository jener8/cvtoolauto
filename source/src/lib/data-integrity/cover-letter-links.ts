import { getSupabaseClient } from "@/lib/supabase/client"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"
import { LOCAL_STORE_KEYS, readLocalStore, writeLocalStore } from "@/lib/supabase/local-store"
import { normalizeJobApplication } from "@/lib/application-outcome"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"

export type CoverLetterLinkMatchReason =
  | "embedded_job_cover_letter_id"
  | "embedded_resume_cover_letter_id"
  | "resume_name_pattern"
  | "folder_and_name_pattern"

export type CoverLetterLinkProposal = {
  applicationId: string
  company: string
  jobTitle: string
  folderId: string | null
  proposedCoverLetterId: string
  proposedCoverLetterName: string
  matchReason: CoverLetterLinkMatchReason
  confidence: "high" | "medium"
}

export type CoverLetterIntegrityAnalysis = {
  applicationsWithoutLink: number
  coverLettersInTable: number
  proposals: CoverLetterLinkProposal[]
  investigationNotes: string[]
}

type JobRow = {
  id: string
  company: string | null
  role: string | null
  cover_letter_id: string | null
  cover_letter: Record<string, unknown> | null
  resume_version_id: string | null
  folder_id: string | null
}

type LetterRow = {
  id: string
  name: string
  folder_id: string | null
}

type ResumeRow = {
  id: string
  name: string
  folder_id: string | null
  resume_cover_letter: Record<string, unknown> | null
}

function embeddedId(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const id = (value as { id?: unknown }).id
  return typeof id === "string" ? id.trim() : ""
}

/** Set coverLetterId in memory when a standalone row matches the linked CV name pattern. */
export function inferCoverLetterIdsFromPatterns(
  applications: JobApplication[],
  coverLetters: CoverLetter[],
  resumes: ResumeVersion[],
): JobApplication[] {
  const resumeById = new Map(resumes.map((resume) => [resume.id, resume]))
  const letterById = new Map(coverLetters.map((letter) => [letter.id, letter]))

  return applications.map((app) => {
    if (app.coverLetterId?.trim()) return app

    const jobEmbeddedId = embeddedId(app.coverLetter)
    if (jobEmbeddedId && letterById.has(jobEmbeddedId)) {
      return { ...app, coverLetterId: jobEmbeddedId }
    }

    const resumeId = app.resumeVersionId?.trim()
    const resume =
      (resumeId ? resumeById.get(resumeId) : undefined) ??
      resumes.find((row) => row.applicationId === app.id && row.resumeText?.trim())

    if (!resume) return app

    const resumeEmbeddedId = embeddedId(resume.coverLetter)
    if (resumeEmbeddedId && letterById.has(resumeEmbeddedId)) {
      return { ...app, coverLetterId: resumeEmbeddedId }
    }

    const patternName = `Cover Letter - ${resume.name}`
    const byName = coverLetters.find((letter) => letter.name === patternName)
    if (byName) {
      return { ...app, coverLetterId: byName.id }
    }

    return app
  })
}

function sameFolder(a: string | null, b: string | null): boolean {
  if (!a || !b) return true
  return a === b
}

export async function analyzeCoverLetterLinks(): Promise<CoverLetterIntegrityAnalysis> {
  const investigationNotes = [
    "New applications are created with coverLetterId: \"\" (empty string).",
    "Supabase save maps cover_letter_id: app.coverLetterId || null, so empty values are stored as NULL.",
    "Cover letter chips also resolve from embedded job.cover_letter and resume.coverLetter — no FK required for UI.",
    "Standalone rows in cover_letters are often matched by name pattern \"Cover Letter - {resume.name}\" at load time, not via cover_letter_id.",
    "Result: 56 cover letters can exist in Supabase while every job_applications.cover_letter_id stays NULL.",
  ]

  if (shouldUseLocalFallback()) {
    return {
      applicationsWithoutLink: 0,
      coverLettersInTable: 0,
      proposals: [],
      investigationNotes,
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      applicationsWithoutLink: 0,
      coverLettersInTable: 0,
      proposals: [],
      investigationNotes,
    }
  }

  const [appsResult, lettersResult, resumesResult] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, company, role, cover_letter_id, cover_letter, resume_version_id, folder_id"),
    supabase.from("cover_letters").select("id, name, folder_id"),
    supabase.from("resume_versions").select("id, name, folder_id, resume_cover_letter"),
  ])

  if (appsResult.error) throw new Error(appsResult.error.message)
  if (lettersResult.error) throw new Error(lettersResult.error.message)
  if (resumesResult.error) throw new Error(resumesResult.error.message)

  const letters = (lettersResult.data ?? []) as LetterRow[]
  const letterById = new Map(letters.map((letter) => [letter.id, letter]))
  const resumes = (resumesResult.data ?? []) as ResumeRow[]
  const resumeById = new Map(resumes.map((resume) => [resume.id, resume]))
  const apps = (appsResult.data ?? []) as JobRow[]

  const proposals: CoverLetterLinkProposal[] = []
  let applicationsWithoutLink = 0

  for (const app of apps) {
    if (String(app.cover_letter_id ?? "").trim()) continue
    applicationsWithoutLink++

    const company = String(app.company ?? "").trim() || "Unknown company"
    const jobTitle = String(app.role ?? "").trim() || "Untitled role"
    const folderId = app.folder_id ? String(app.folder_id) : null

    const jobEmbeddedId = embeddedId(app.cover_letter)
    if (jobEmbeddedId && letterById.has(jobEmbeddedId)) {
      const letter = letterById.get(jobEmbeddedId)!
      proposals.push({
        applicationId: app.id,
        company,
        jobTitle,
        folderId,
        proposedCoverLetterId: letter.id,
        proposedCoverLetterName: letter.name,
        matchReason: "embedded_job_cover_letter_id",
        confidence: "high",
      })
      continue
    }

    const resumeId = String(app.resume_version_id ?? "").trim()
    const resume = resumeId ? resumeById.get(resumeId) : undefined
    if (resume) {
      const resumeEmbeddedId = embeddedId(resume.resume_cover_letter)
      if (resumeEmbeddedId && letterById.has(resumeEmbeddedId)) {
        const letter = letterById.get(resumeEmbeddedId)!
        proposals.push({
          applicationId: app.id,
          company,
          jobTitle,
          folderId,
          proposedCoverLetterId: letter.id,
          proposedCoverLetterName: letter.name,
          matchReason: "embedded_resume_cover_letter_id",
          confidence: "high",
        })
        continue
      }

      const patternName = `Cover Letter - ${resume.name}`
      const byName = letters.find(
        (letter) =>
          letter.name === patternName && sameFolder(folderId, letter.folder_id ? String(letter.folder_id) : null),
      )
      if (byName) {
        proposals.push({
          applicationId: app.id,
          company,
          jobTitle,
          folderId,
          proposedCoverLetterId: byName.id,
          proposedCoverLetterName: byName.name,
          matchReason: "resume_name_pattern",
          confidence: "high",
        })
        continue
      }
    }

    const loose = letters.find(
      (letter) =>
        sameFolder(folderId, letter.folder_id ? String(letter.folder_id) : null) &&
        letter.name.toLowerCase().includes(company.toLowerCase().slice(0, 12)),
    )
    if (loose) {
      proposals.push({
        applicationId: app.id,
        company,
        jobTitle,
        folderId,
        proposedCoverLetterId: loose.id,
        proposedCoverLetterName: loose.name,
        matchReason: "folder_and_name_pattern",
        confidence: "medium",
      })
    }
  }

  const seen = new Set<string>()
  const deduped = proposals.filter((proposal) => {
    const key = `${proposal.applicationId}:${proposal.proposedCoverLetterId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    applicationsWithoutLink,
    coverLettersInTable: letters.length,
    proposals: deduped,
    investigationNotes,
  }
}

export type CoverLetterLinkApplyResult = {
  applicationId: string
  coverLetterId: string
  success: boolean
  error?: string
}

export async function applyCoverLetterLinks(
  proposals: CoverLetterLinkProposal[],
): Promise<CoverLetterLinkApplyResult[]> {
  if (shouldUseLocalFallback()) {
    throw new Error("Supabase is unavailable — cannot apply cover letter links.")
  }
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error("Supabase client is not configured.")

  const results: CoverLetterLinkApplyResult[] = []

  for (const proposal of proposals) {
    const { error } = await supabase
      .from("job_applications")
      .update({ cover_letter_id: proposal.proposedCoverLetterId })
      .eq("id", proposal.applicationId)

    if (error) {
      results.push({
        applicationId: proposal.applicationId,
        coverLetterId: proposal.proposedCoverLetterId,
        success: false,
        error: error.message,
      })
      continue
    }

    const localApps = readLocalStore<JobApplication>(LOCAL_STORE_KEYS.jobApplications).map(
      normalizeJobApplication,
    )
    const updated = localApps.map((app) =>
      app.id === proposal.applicationId
        ? { ...app, coverLetterId: proposal.proposedCoverLetterId }
        : app,
    )
    writeLocalStore(LOCAL_STORE_KEYS.jobApplications, updated)

    results.push({
      applicationId: proposal.applicationId,
      coverLetterId: proposal.proposedCoverLetterId,
      success: true,
    })
  }

  return results
}
