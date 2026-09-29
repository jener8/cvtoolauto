import { getPipeline } from "@/lib/application-pipeline"
import type { ApplicationStatistics } from "@/lib/application-statistics"
import type { ApplicationStageRecord, JobApplication, ResumeVersion } from "@/lib/types"

/** Lightweight job record for AI statistics — avoids shipping full resume blobs. */
export type StatisticsJobSummary = {
  id: string
  folderId?: string
  company: string
  jobTitle: string
  resumeVersionId: string
  appliedDate?: number
  strategySummary?: string
  pipeline: ApplicationStageRecord[]
}

export type StatisticsVersionSummary = {
  id: string
  name: string
}

export type StatisticsStrategyPayload = {
  folderId: string
  stats: ApplicationStatistics
  jobs: StatisticsJobSummary[]
  versions: StatisticsVersionSummary[]
  outputLanguage: "en" | "de"
}

export type StatisticsDataReadiness = {
  applicationCount: number
  resumeVersionCount: number
  outcomeCount: number
  hasApplications: boolean
  hasResumeVersions: boolean
  hasRecordedOutcomes: boolean
  emptyStateMessage: string | null
}

export function toStatisticsJobSummary(job: JobApplication): StatisticsJobSummary {
  return {
    id: job.id,
    folderId: job.folderId,
    company: job.company?.trim() || "",
    jobTitle: job.jobTitle?.trim() || "",
    resumeVersionId: job.resumeVersionId || "",
    appliedDate: job.appliedDate,
    strategySummary: job.strategySummary?.trim() || undefined,
    pipeline: getPipeline(job),
  }
}

export function toStatisticsVersionSummary(version: ResumeVersion): StatisticsVersionSummary {
  return {
    id: version.id,
    name: version.name?.trim() || "Untitled resume",
  }
}

export function buildStatisticsStrategyPayload(input: {
  folderId: string
  stats: ApplicationStatistics
  jobs: JobApplication[]
  versions: ResumeVersion[]
  outputLanguage: "en" | "de"
}): StatisticsStrategyPayload {
  const folderJobs = input.jobs.filter(
    (job) => !job.folderId || job.folderId === input.folderId,
  )

  return {
    folderId: input.folderId,
    stats: input.stats,
    jobs: folderJobs.map(toStatisticsJobSummary),
    versions: input.versions
      .filter((v) => !v.folderId || v.folderId === input.folderId)
      .map(toStatisticsVersionSummary),
    outputLanguage: input.outputLanguage,
  }
}

/** Count applications with at least one non-default outcome or progressed stage. */
export function countRecordedOutcomes(jobs: StatisticsJobSummary[]): number {
  return jobs.filter((job) => hasMeaningfulOutcomes(job)).length
}

export function hasMeaningfulOutcomes(job: StatisticsJobSummary): boolean {
  const pipeline = job.pipeline
  if (pipeline.length === 0) return false

  const hasTerminal = pipeline.some(
    (record) =>
      record.outcome === "rejected" ||
      record.outcome === "declined" ||
      record.outcome === "withdrawn" ||
      record.outcome === "no_response",
  )
  if (hasTerminal) return true

  const progressedBeyondApplied = pipeline.some(
    (record) => record.stage !== "applied" || record.outcome === "passed",
  )
  if (progressedBeyondApplied) return true

  const hiredOrOffer = pipeline.some(
    (record) =>
      (record.stage === "offer" || record.stage === "hired") &&
      (record.outcome === "passed" || record.outcome === "pending"),
  )
  return hiredOrOffer
}

export function assessStatisticsDataReadiness(
  payload: StatisticsStrategyPayload,
): StatisticsDataReadiness {
  const applicationCount = payload.jobs.length
  const resumeVersionCount = payload.versions.length
  const outcomeCount = countRecordedOutcomes(payload.jobs)

  let emptyStateMessage: string | null = null

  if (applicationCount === 0) {
    emptyStateMessage =
      "No applications found in this folder. Create applications to generate AI strategy insights."
  } else if (outcomeCount === 0) {
    emptyStateMessage =
      "No application outcomes have been recorded yet. Add interview, rejection, offer, or withdrawal statuses on your application cards to generate meaningful insights."
  }

  return {
    applicationCount,
    resumeVersionCount,
    outcomeCount,
    hasApplications: applicationCount > 0,
    hasResumeVersions: resumeVersionCount > 0,
    hasRecordedOutcomes: outcomeCount > 0,
    emptyStateMessage,
  }
}

/** Estimate serialized payload size for diagnostics. */
export function estimatePayloadBytes(payload: StatisticsStrategyPayload): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length
  } catch {
    return -1
  }
}
