import {
  APPLICATION_STAGES,
  createDefaultPipeline,
  deriveLegacyStatus,
  getCurrentOutcome,
  getCurrentStage,
  getPipeline,
  hasInterviewProgress,
  hasReachedStage,
  isActiveApplication,
  isHired,
  isTerminalOutcome,
  normalizePipeline,
  passedStage,
  reachedOfferStage,
  syncLegacyDateFields,
  type ApplicationStage,
  type StageOutcome,
} from "@/lib/application-pipeline"
import {
  coerceApplicationTimestamp,
  isValidApplicationTimestamp,
} from "@/lib/application-dates"
import type { ApplicationStageRecord, JobApplication } from "@/lib/types"

export type { ApplicationStage, StageOutcome }
export { APPLICATION_STAGES, STAGE_OUTCOMES } from "@/lib/application-pipeline"

/** @deprecated Use APPLICATION_STAGES */
export const APPLICATION_PIPELINE_STATUSES = APPLICATION_STAGES

/** @deprecated Use APPLICATION_STAGES */
export const APPLICATION_OUTCOME_STATUSES = APPLICATION_STAGES

export type ApplicationOutcomeFilter =
  | "all"
  | "active"
  | "interview"
  | "offer"
  | "rejected"
  | "declined"
  | "no_response"
  | "withdrawn"
  | "hired"

export type ApplicationStageFilter = ApplicationStage | "all"

function resolveStoredAppliedDate(job: JobApplication): number | undefined {
  if (isValidApplicationTimestamp(job.appliedDate)) return job.appliedDate
  const pipelineApplied = job.pipeline?.find((record) => record.stage === "applied")?.date
  return coerceApplicationTimestamp(pipelineApplied)
}

export function normalizeJobApplication(job: JobApplication): JobApplication {
  const storedApplied = resolveStoredAppliedDate(job)
  const pipeline = normalizePipeline(job.pipeline, {
    ...job,
    appliedDate: storedApplied ?? 0,
  })
  const legacyDates = syncLegacyDateFields(pipeline, storedApplied ?? 0)

  const appliedDate =
    (isValidApplicationTimestamp(legacyDates.appliedDate) ? legacyDates.appliedDate : undefined) ??
    storedApplied ??
    0

  return {
    ...job,
    pipeline,
    status: deriveLegacyStatus({ ...job, pipeline }) as NonNullable<JobApplication["status"]>,
    appliedDate,
    firstInterviewDate: legacyDates.firstInterviewDate,
    additionalInterviewDates: legacyDates.additionalInterviewDates ?? [],
    rejectionDate: legacyDates.rejectionDate,
    offerDate: legacyDates.offerDate,
  }
}

/** @deprecated Use getCurrentStage */
export function normalizeApplicationStatus(
  status: string | undefined | null,
): ApplicationStage {
  const legacyMap: Record<string, ApplicationStage> = {
    not_submitted: "applied",
    applied: "applied",
    interview: "hr_screening",
    interview_invited: "hr_screening",
    interview_completed: "hiring_manager_interview_1",
    second_interview: "hiring_manager_interview_2",
    final_interview: "final_interview",
    offer: "offer",
    offer_received: "offer",
    offer_accepted: "hired",
    offer_rejected: "offer",
    rejected: "applied",
    withdrawn: "applied",
    no_response: "applied",
  }
  if (!status) return "applied"
  if (APPLICATION_STAGES.includes(status as ApplicationStage)) return status as ApplicationStage
  return legacyMap[status] ?? "applied"
}

/** @deprecated Use normalizeJobApplication */
export const normalizeApplicationOutcome = normalizeApplicationStatus

export function isSubmittedOutcome(_job: JobApplication): boolean {
  return true
}

export function isInterviewReceived(job: JobApplication): boolean {
  return passedStage(job, "applied") && hasInterviewProgress(job)
}

export function isSecondInterviewOrBeyond(job: JobApplication): boolean {
  return passedStage(job, "hr_screening")
}

export function isOfferStage(job: JobApplication): boolean {
  return reachedOfferStage(job)
}

export function isPositiveOffer(job: JobApplication): boolean {
  return hasReachedStage(job, "offer") && !isTerminalOutcome(getStageOutcome(job, "offer") ?? "pending")
}

function getStageOutcome(job: JobApplication, stage: ApplicationStage): StageOutcome | undefined {
  return getPipeline(job).find((record) => record.stage === stage)?.outcome
}

/** @deprecated Use isInterviewReceived */
export function isInterviewOutcome(job: JobApplication): boolean {
  return isInterviewReceived(job)
}

/** @deprecated Use isInterviewReceived or isOfferStage */
export function isSuccessfulOutcome(job: JobApplication): boolean {
  return isInterviewReceived(job) || isOfferStage(job)
}

export function matchesOutcomeFilter(
  job: JobApplication,
  filter: ApplicationOutcomeFilter,
): boolean {
  if (filter === "all") return true
  const outcome = getCurrentOutcome(job)
  const stage = getCurrentStage(job)

  if (filter === "active") return isActiveApplication(job)
  if (filter === "interview") return hasInterviewProgress(job)
  if (filter === "offer") return reachedOfferStage(job)
  if (filter === "rejected") return outcome === "rejected"
  if (filter === "declined") return outcome === "declined"
  if (filter === "no_response") return outcome === "no_response"
  if (filter === "withdrawn") return outcome === "withdrawn"
  if (filter === "hired") return isHired(job)
  return true
}

export function matchesStageFilter(job: JobApplication, filter: ApplicationStageFilter): boolean {
  if (filter === "all") return true
  return getCurrentStage(job) === filter
}

export function getPipelineSummaryLabel(job: JobApplication): string {
  const current = getPipeline(job)[getPipeline(job).length - 1]
  return `${current.stage}:${current.outcome}`
}

export function getStatusBadgeClass(job: JobApplication): string {
  const outcome = getCurrentOutcome(job)
  const stage = getCurrentStage(job)

  if (isHired(job)) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  }

  switch (outcome) {
    case "passed":
      if (stage === "offer") {
        return "bg-green-500/10 text-green-700 dark:text-green-400"
      }
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
    case "pending":
      if (stage === "applied") {
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400"
      }
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
    case "rejected":
    case "declined":
      return "bg-red-500/10 text-red-700 dark:text-red-400"
    case "no_response":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-400"
    case "withdrawn":
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function createInitialJobApplicationPipeline(
  appliedDate = Date.now(),
): ApplicationStageRecord[] {
  return createDefaultPipeline(appliedDate)
}

export function averageDaysBetween(samples: number[]): number | null {
  if (samples.length === 0) return null
  const total = samples.reduce((sum, value) => sum + value, 0)
  return Math.round(total / samples.length)
}

export function daysBetween(start: number, end: number): number | null {
  if (!start || !end || end < start) return null
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}
