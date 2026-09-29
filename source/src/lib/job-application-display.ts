import {
  resolveApplicationRole,
  resolveDraftApplicationRole,
} from "@/lib/application-role-label"
import {
  matchesOutcomeFilter,
  matchesStageFilter,
  type ApplicationOutcomeFilter,
  type ApplicationStageFilter,
} from "@/lib/application-outcome"
import { getCurrentOutcome, getCurrentStage, getPipeline } from "@/lib/application-pipeline"
import { getPipelineSummaryLabel, getStageLabel } from "@/lib/translations"
import { isResumeTemplateVersion } from "@/lib/resume-classification"
import {
  getResumeLanguage,
  matchesResumeLanguageFilter,
  type ResumeLanguageFilter,
} from "@/lib/resume-language"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"

export { resolveApplicationRole, resolveDraftApplicationRole }

const FIT_SCORE_KEYS = ["culture", "ambitions", "skills", "strategy"] as const

export function getAverageFitScore(job: JobApplication): number | null {
  if (!job.fitScores) return null
  const values = FIT_SCORE_KEYS.map((key) => job.fitScores?.[key]?.score).filter(
    (score): score is number => typeof score === "number",
  )
  if (values.length === 0) return null
  return values.reduce((sum, score) => sum + score, 0) / values.length
}

export function formatFitScoreSummary(job: JobApplication): string | null {
  const average = getAverageFitScore(job)
  if (average == null) return null
  return `${average.toFixed(1)}/5`
}

export function hasApplicationCoverLetter(
  job: JobApplication,
  coverLetters?: CoverLetter[],
  resumeVersion?: ResumeVersion | null,
): boolean {
  return getCoverLetterDisplayName(job, coverLetters, resumeVersion) !== null
}

export function getCoverLetterDisplayName(
  job: JobApplication,
  coverLetters?: CoverLetter[],
  resumeVersion?: ResumeVersion | null,
): string | null {
  const linked = coverLetters?.find((letter) => letter.id === job.coverLetterId)
  if (linked?.name?.trim()) return linked.name.trim()
  if (resumeVersion?.coverLetter?.name?.trim()) return resumeVersion.coverLetter.name.trim()
  const hasEmbedded =
    Boolean(job.coverLetter?.content?.trim()) ||
    Boolean(job.coverLetter?.contentEn?.trim()) ||
    Boolean(job.coverLetter?.contentDe?.trim())
  if (hasEmbedded) return "Cover letter attached"
  return null
}

export const COMPANY_NOT_ADDED = "Unknown Company"
export const JOB_TITLE_NOT_ADDED = "Untitled Job"
export const LOCATION_NOT_ADDED = "Add location (optional)"

export function getJobCompanyDisplay(
  job: JobApplication,
  version?: ResumeVersion | null,
): string {
  const resolved = resolveApplicationRole(job, version).company
  return resolved || COMPANY_NOT_ADDED
}

export function getJobTitleDisplay(
  job: JobApplication,
  version?: ResumeVersion | null,
): string {
  const resolved = resolveApplicationRole(job, version).jobTitle
  return resolved || JOB_TITLE_NOT_ADDED
}

export function getJobLocationDisplay(
  job: JobApplication,
  version?: ResumeVersion | null,
): string {
  return resolveApplicationRole(job, version).location
}

export function getResumeVersionCompanyDisplay(version: ResumeVersion): string {
  return resolveDraftApplicationRole(version).company || COMPANY_NOT_ADDED
}

export function getResumeVersionTitleDisplay(version: ResumeVersion): string {
  return resolveDraftApplicationRole(version).jobTitle || JOB_TITLE_NOT_ADDED
}

export function getResumeVersionLocationDisplay(version: ResumeVersion): string {
  return resolveDraftApplicationRole(version).location
}

export function formatApplicationDate(timestamp?: number | null): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function appendSearchParts(parts: string[], value: string | number | null | undefined) {
  if (value === null || value === undefined) return
  const text = String(value).trim()
  if (text) parts.push(text)
}

export function collectJobApplicationSearchText(
  job: JobApplication,
  version?: ResumeVersion | null,
): string {
  const parts: string[] = []

  const role = resolveApplicationRole(job, version)
  appendSearchParts(parts, job.company)
  appendSearchParts(parts, job.jobTitle)
  appendSearchParts(parts, job.location)
  appendSearchParts(parts, role.company)
  appendSearchParts(parts, role.jobTitle)
  appendSearchParts(parts, role.location)
  appendSearchParts(parts, job.jobDescription)
  appendSearchParts(parts, job.jobDescriptionSummary)
  appendSearchParts(parts, job.strategySummary)
  appendSearchParts(parts, job.why)
  appendSearchParts(parts, job.industry)
  appendSearchParts(parts, job.salaryExpectation)
  appendSearchParts(parts, job.companyInfo?.researchNotes)
  appendSearchParts(parts, job.companyInfo?.website)
  appendSearchParts(
    parts,
    getPipelineSummaryLabel("en", getCurrentStage(job), getCurrentOutcome(job)),
  )

  for (const record of getPipeline(job)) {
    appendSearchParts(parts, getStageLabel("en", record.stage))
    appendSearchParts(parts, record.notes)
    if (record.date) appendSearchParts(parts, formatApplicationDate(record.date))
  }

  appendSearchParts(parts, version?.name)
  appendSearchParts(parts, version?.contactInfo?.targetCompany)
  appendSearchParts(parts, version?.contactInfo?.targetRole)
  appendSearchParts(parts, version?.jobDescription)

  if (job.appliedDate) {
    appendSearchParts(parts, formatApplicationDate(job.appliedDate))
    appendSearchParts(parts, new Date(job.appliedDate).toISOString().slice(0, 10))
  }

  for (const contact of job.contacts ?? []) {
    appendSearchParts(parts, contact.name)
    appendSearchParts(parts, contact.role)
    appendSearchParts(parts, contact.notes)
  }

  return parts.join(" ").toLowerCase()
}

export function collectResumeVersionSearchText(
  version: ResumeVersion,
  linkedJob?: JobApplication | null,
): string {
  const parts: string[] = []
  const role = resolveDraftApplicationRole(version)
  appendSearchParts(parts, version.name)
  appendSearchParts(parts, role.jobTitle)
  appendSearchParts(parts, role.company)
  appendSearchParts(parts, role.location)
  appendSearchParts(parts, version.contactInfo?.targetCompany)
  appendSearchParts(parts, version.contactInfo?.targetRole)
  appendSearchParts(parts, version.jobDescription)
  appendSearchParts(parts, version.jobAdvertSource)
  appendSearchParts(parts, version.contactInfo?.jobAdvertSource)

  // Linked application context — company often lives on the job, not the CV title.
  if (linkedJob) {
    appendSearchParts(parts, linkedJob.company)
    appendSearchParts(parts, linkedJob.jobTitle)
    appendSearchParts(parts, linkedJob.location)
  }

  const timestamp = version.createdAt ?? version.timestamp
  if (timestamp) {
    appendSearchParts(parts, formatApplicationDate(timestamp))
    appendSearchParts(parts, new Date(timestamp).toISOString().slice(0, 10))
  }

  return parts.join(" ").toLowerCase()
}

export function matchesSearchQuery(haystack: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return haystack.includes(normalizedQuery)
}

export type JobApplicationFilterOptions = {
  query: string
  stageFilter?: ApplicationStageFilter
  outcomeFilter?: ApplicationOutcomeFilter
  cvLanguageFilter?: ResumeLanguageFilter
  versions: ResumeVersion[]
}

/** Sort key for Applications date ordering.
 *
 * Prefer `lastModified` (DB `updated_at`). Many legacy rows have had `applied_date`
 * mass-rewritten during sync while `updated_at` stayed correct, which buried
 * genuinely new applications when sorting by `Math.max(applied, modified)`.
 *
 * "Newest" = most recently active application record.
 */
export function getJobApplicationSortDate(job: JobApplication): number {
  const modified = job.lastModified || 0
  const applied = job.appliedDate || 0
  if (modified > 0) return modified
  return applied
}

export type JobApplicationDateSort = "newest" | "oldest"

/** Sort by last activity — non-destructive. Default: newest first. */
export function sortJobApplicationsByDate(
  jobs: JobApplication[],
  direction: JobApplicationDateSort = "newest",
): JobApplication[] {
  return [...jobs].sort((a, b) => {
    const diff = getJobApplicationSortDate(b) - getJobApplicationSortDate(a)
    if (diff !== 0) return direction === "newest" ? diff : -diff
    // Stable tie-break: id string so equal timestamps don't shuffle.
    return direction === "newest" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)
  })
}

export function filterJobApplications(
  jobs: JobApplication[],
  queryOrOptions: string | JobApplicationFilterOptions,
  versions?: ResumeVersion[],
): JobApplication[] {
  const options: JobApplicationFilterOptions =
    typeof queryOrOptions === "string"
      ? { query: queryOrOptions, versions: versions ?? [], stageFilter: "all", outcomeFilter: "all" }
      : queryOrOptions

  const versionById = new Map(options.versions.map((version) => [version.id, version]))
  const stageFilter = options.stageFilter ?? "all"
  const outcomeFilter = options.outcomeFilter ?? "all"
  const cvLanguageFilter = options.cvLanguageFilter ?? "all"

  return jobs.filter((job) => {
    if (!matchesStageFilter(job, stageFilter)) return false
    if (!matchesOutcomeFilter(job, outcomeFilter)) return false
    if (cvLanguageFilter !== "all") {
      const resumeLanguage = getResumeLanguage(versionById.get(job.resumeVersionId))
      if (!matchesResumeLanguageFilter(resumeLanguage, cvLanguageFilter)) return false
    }
    return matchesSearchQuery(
      collectJobApplicationSearchText(job, versionById.get(job.resumeVersionId)),
      options.query,
    )
  })
}

export function filterResumeVersions(
  versions: ResumeVersion[],
  query: string,
  linkedJobs?: JobApplication[],
): ResumeVersion[] {
  const jobByResumeId = new Map<string, JobApplication>()
  const jobByApplicationId = new Map<string, JobApplication>()
  for (const job of linkedJobs ?? []) {
    if (job.resumeVersionId) jobByResumeId.set(job.resumeVersionId, job)
    jobByApplicationId.set(job.id, job)
  }

  return versions.filter((version) => {
    const linked =
      jobByResumeId.get(version.id) ||
      (version.applicationId ? jobByApplicationId.get(version.applicationId) : undefined) ||
      null
    return matchesSearchQuery(collectResumeVersionSearchText(version, linked), query)
  })
}

/** @deprecated Use getResumeTemplates — role-specific CVs belong in applications, not templates. */
export function getOrphanResumeVersions(
  versions: ResumeVersion[],
  jobs: JobApplication[],
): ResumeVersion[] {
  return getResumeTemplates(versions, jobs)
}

/** Unlinked reusable base CVs — not role-specific application variants. */
export function getResumeTemplates(
  versions: ResumeVersion[],
  jobs: JobApplication[],
): ResumeVersion[] {
  const linkedVersionIds = new Set(
    jobs.map((job) => job.resumeVersionId).filter((id): id is string => Boolean(id)),
  )
  return versions.filter(
    (version) => !linkedVersionIds.has(version.id) && isResumeTemplateVersion(version),
  )
}
