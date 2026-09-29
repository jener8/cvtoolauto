import type { ApplicationStageRecord, JobApplication } from "@/lib/types"
import { coerceApplicationTimestamp, isValidApplicationTimestamp } from "@/lib/application-dates"

export type ApplicationStage =
  | "applied"
  | "hr_screening"
  | "hiring_manager_interview_1"
  | "hiring_manager_interview_2"
  | "final_interview"
  | "offer"
  | "hired"

export type StageOutcome =
  | "pending"
  | "passed"
  | "rejected"
  | "declined"
  | "withdrawn"
  | "no_response"

export const APPLICATION_STAGES: ApplicationStage[] = [
  "applied",
  "hr_screening",
  "hiring_manager_interview_1",
  "hiring_manager_interview_2",
  "final_interview",
  "offer",
  "hired",
]

export const STAGE_OUTCOMES: StageOutcome[] = [
  "pending",
  "passed",
  "rejected",
  "declined",
  "withdrawn",
  "no_response",
]

const TERMINAL_OUTCOMES = new Set<StageOutcome>([
  "rejected",
  "declined",
  "withdrawn",
  "no_response",
])

const INTERVIEW_STAGES = new Set<ApplicationStage>([
  "hr_screening",
  "hiring_manager_interview_1",
  "hiring_manager_interview_2",
  "final_interview",
])

/** Legacy flat status values from the previous model. */
export type LegacyApplicationStatus =
  | "applied"
  | "rejected"
  | "interview_invited"
  | "interview_completed"
  | "second_interview"
  | "final_interview"
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "withdrawn"
  | "no_response"
  | "not_submitted"
  | "interview"
  | "offer"

function stageIndex(stage: ApplicationStage): number {
  return APPLICATION_STAGES.indexOf(stage)
}

export function nextStage(stage: ApplicationStage): ApplicationStage | null {
  const index = stageIndex(stage)
  return index >= 0 && index < APPLICATION_STAGES.length - 1
    ? APPLICATION_STAGES[index + 1]
    : null
}

export function isTerminalOutcome(outcome: StageOutcome): boolean {
  return TERMINAL_OUTCOMES.has(outcome)
}

export function createDefaultPipeline(appliedDate?: number): ApplicationStageRecord[] {
  const date = isValidApplicationTimestamp(appliedDate) ? appliedDate : undefined
  return [{ stage: "applied", outcome: "pending", date }]
}

function passedThrough(stage: ApplicationStage): ApplicationStageRecord[] {
  const index = stageIndex(stage)
  return APPLICATION_STAGES.slice(0, index + 1).map((s) => ({
    stage: s,
    outcome: "passed" as const,
  }))
}

function buildPipelineUpTo(
  stage: ApplicationStage,
  outcome: StageOutcome,
): ApplicationStageRecord[] {
  const index = stageIndex(stage)
  const records: ApplicationStageRecord[] = APPLICATION_STAGES.slice(0, index).map((s) => ({
    stage: s,
    outcome: "passed",
  }))
  records.push({ stage, outcome })
  return records
}

const LEGACY_STATUS_PIPELINE: Record<
  LegacyApplicationStatus,
  (job: JobApplication) => ApplicationStageRecord[]
> = {
  not_submitted: () => createDefaultPipeline(),
  applied: (job) => [{ stage: "applied", outcome: "pending", date: job.appliedDate }],
  interview_invited: (job) => [
    { stage: "applied", outcome: "passed", date: job.appliedDate },
    {
      stage: "hr_screening",
      outcome: "pending",
      date: job.firstInterviewDate,
    },
  ],
  interview: (job) => LEGACY_STATUS_PIPELINE.interview_invited(job),
  interview_completed: (job) => [
    { stage: "applied", outcome: "passed", date: job.appliedDate },
    { stage: "hr_screening", outcome: "passed", date: job.firstInterviewDate },
    {
      stage: "hiring_manager_interview_1",
      outcome: "pending",
      date: job.additionalInterviewDates?.[0],
    },
  ],
  second_interview: (job) => [
    { stage: "applied", outcome: "passed", date: job.appliedDate },
    { stage: "hr_screening", outcome: "passed", date: job.firstInterviewDate },
    {
      stage: "hiring_manager_interview_1",
      outcome: "passed",
      date: job.additionalInterviewDates?.[0],
    },
    {
      stage: "hiring_manager_interview_2",
      outcome: "pending",
      date: job.additionalInterviewDates?.[1],
    },
  ],
  final_interview: (job) => [
    ...passedThrough("hiring_manager_interview_1"),
    {
      stage: "hiring_manager_interview_2",
      outcome: "passed",
      date: job.additionalInterviewDates?.[1] ?? job.firstInterviewDate,
    },
    {
      stage: "final_interview",
      outcome: "pending",
      date: job.additionalInterviewDates?.[2],
    },
  ],
  offer: (job) => LEGACY_STATUS_PIPELINE.offer_received(job),
  offer_received: (job) => [
    ...passedThrough("final_interview"),
    { stage: "offer", outcome: "pending", date: job.offerDate },
  ],
  offer_accepted: (job) => [
    ...passedThrough("offer"),
    { stage: "hired", outcome: "passed", date: job.offerDate },
  ],
  offer_rejected: (job) => [
    ...passedThrough("final_interview"),
    { stage: "offer", outcome: "declined", date: job.offerDate ?? job.rejectionDate },
  ],
  rejected: (job) => {
    const furthest = inferFurthestLegacyStage(job.status as LegacyApplicationStatus)
    return buildPipelineUpTo(furthest, "rejected").map((record, index, arr) => {
      const isLast = index === arr.length - 1
      return isLast
        ? { ...record, date: job.rejectionDate ?? record.date }
        : { ...record, outcome: "passed" as const }
    })
  },
  withdrawn: (job) => {
    const furthest = inferFurthestLegacyStage(job.status as LegacyApplicationStatus)
    return buildPipelineUpTo(furthest, "withdrawn")
  },
  no_response: (job) => {
    const furthest = inferFurthestLegacyStage(job.status as LegacyApplicationStatus)
    return buildPipelineUpTo(furthest, "no_response")
  },
}

function inferFurthestLegacyStage(status: LegacyApplicationStatus): ApplicationStage {
  switch (status) {
    case "interview_invited":
    case "interview":
      return "hr_screening"
    case "interview_completed":
      return "hiring_manager_interview_1"
    case "second_interview":
      return "hiring_manager_interview_2"
    case "final_interview":
      return "final_interview"
    case "offer":
    case "offer_received":
    case "offer_accepted":
    case "offer_rejected":
      return "offer"
    default:
      return "applied"
  }
}

export function migrateLegacyStatusToPipeline(job: JobApplication): ApplicationStageRecord[] {
  const legacyStatus = (job.status ?? "applied") as LegacyApplicationStatus
  const builder = LEGACY_STATUS_PIPELINE[legacyStatus]
  if (builder) return builder(job)
  return createDefaultPipeline(job.appliedDate)
}

function mapPipelineRecords(pipeline: ApplicationStageRecord[]): ApplicationStageRecord[] {
  return pipeline.map((record) => ({
    stage: record.stage,
    outcome: record.outcome,
    date: coerceApplicationTimestamp(record.date),
    notes: record.notes?.trim() || undefined,
  }))
}

/** True when pipeline is empty or only the default "applied / pending" shell. */
export function isShallowAppliedPipeline(pipeline: ApplicationStageRecord[]): boolean {
  if (pipeline.length === 0) return true
  if (pipeline.length !== 1) return false
  const record = pipeline[0]
  return record.stage === "applied" && record.outcome === "pending"
}

/** Rebuild pipeline from legacy status or interview/offer dates after DB restore. */
export function inferPipelineFromLegacyHints(job: JobApplication): ApplicationStageRecord[] | null {
  const legacyStatus = (job.status ?? "").trim() as LegacyApplicationStatus
  if (
    legacyStatus &&
    legacyStatus !== "applied" &&
    legacyStatus !== "not_submitted" &&
    LEGACY_STATUS_PIPELINE[legacyStatus]
  ) {
    return migrateLegacyStatusToPipeline({ ...job, pipeline: undefined })
  }

  if (isValidApplicationTimestamp(job.offerDate)) {
    return LEGACY_STATUS_PIPELINE.offer_received(job)
  }
  if (isValidApplicationTimestamp(job.rejectionDate)) {
    return LEGACY_STATUS_PIPELINE.rejected({ ...job, status: "rejected" })
  }
  if (
    Array.isArray(job.additionalInterviewDates) &&
    job.additionalInterviewDates.length >= 2
  ) {
    return LEGACY_STATUS_PIPELINE.second_interview(job)
  }
  if (
    Array.isArray(job.additionalInterviewDates) &&
    job.additionalInterviewDates.length >= 1
  ) {
    return LEGACY_STATUS_PIPELINE.interview_completed(job)
  }
  if (isValidApplicationTimestamp(job.firstInterviewDate)) {
    return LEGACY_STATUS_PIPELINE.interview_invited(job)
  }

  return null
}

export function normalizePipeline(
  pipeline: ApplicationStageRecord[] | undefined,
  job: JobApplication,
): ApplicationStageRecord[] {
  let normalized: ApplicationStageRecord[]
  if (pipeline && pipeline.length > 0) {
    normalized = mapPipelineRecords(pipeline)
  } else {
    normalized = migrateLegacyStatusToPipeline(job)
  }

  if (isShallowAppliedPipeline(normalized)) {
    const inferred = inferPipelineFromLegacyHints(job)
    if (inferred && !isShallowAppliedPipeline(inferred)) {
      normalized = mapPipelineRecords(inferred)
    }
  }

  return normalized
}

export function getPipeline(job: JobApplication): ApplicationStageRecord[] {
  return normalizePipeline(job.pipeline, job)
}

export function getCurrentStageRecord(job: JobApplication): ApplicationStageRecord {
  const pipeline = getPipeline(job)
  return pipeline[pipeline.length - 1]
}

export function getCurrentStage(job: JobApplication): ApplicationStage {
  return getCurrentStageRecord(job).stage
}

export function getCurrentOutcome(job: JobApplication): StageOutcome {
  return getCurrentStageRecord(job).outcome
}

export function hasReachedStage(job: JobApplication, stage: ApplicationStage): boolean {
  const pipeline = getPipeline(job)
  return pipeline.some((record) => record.stage === stage)
}

export function getStageRecord(
  job: JobApplication,
  stage: ApplicationStage,
): ApplicationStageRecord | undefined {
  return getPipeline(job).find((record) => record.stage === stage)
}

export function passedStage(job: JobApplication, stage: ApplicationStage): boolean {
  return getStageRecord(job, stage)?.outcome === "passed"
}

export function hasInterviewProgress(job: JobApplication): boolean {
  return getPipeline(job).some((record) => INTERVIEW_STAGES.has(record.stage))
}

export function reachedOfferStage(job: JobApplication): boolean {
  return hasReachedStage(job, "offer") || hasReachedStage(job, "hired")
}

export function isHired(job: JobApplication): boolean {
  return getStageRecord(job, "hired")?.outcome === "passed"
}

export function isActiveApplication(job: JobApplication): boolean {
  const outcome = getCurrentOutcome(job)
  return !isTerminalOutcome(outcome)
}

export function updateStageRecord(
  pipeline: ApplicationStageRecord[],
  stage: ApplicationStage,
  updates: Partial<ApplicationStageRecord>,
): ApplicationStageRecord[] {
  const index = pipeline.findIndex((record) => record.stage === stage)
  if (index < 0) return pipeline

  const next = [...pipeline]
  next[index] = { ...next[index], ...updates, stage }

  if (updates.outcome === "passed") {
    const following = nextStage(stage)
    if (following && !next.some((record) => record.stage === following)) {
      next.push({ stage: following, outcome: "pending" })
    }
    return next.filter((record, i) => {
      if (i <= index) return true
      return record.stage === following
    })
  }

  if (updates.outcome && isTerminalOutcome(updates.outcome)) {
    return next.slice(0, index + 1)
  }

  return next
}

export function deriveLegacyStatus(job: JobApplication): LegacyApplicationStatus {
  const current = getCurrentStageRecord(job)
  if (current.stage === "hired" && current.outcome === "passed") return "offer_accepted"
  if (current.stage === "offer") {
    if (current.outcome === "pending") return "offer_received"
    if (current.outcome === "declined") return "offer_rejected"
  }
  if (current.outcome === "rejected") return "rejected"
  if (current.outcome === "withdrawn") return "withdrawn"
  if (current.outcome === "no_response") return "no_response"

  switch (current.stage) {
    case "applied":
      return "applied"
    case "hr_screening":
      return current.outcome === "passed" ? "interview_completed" : "interview_invited"
    case "hiring_manager_interview_1":
      return current.outcome === "passed" ? "second_interview" : "interview_completed"
    case "hiring_manager_interview_2":
      return current.outcome === "passed" ? "final_interview" : "second_interview"
    case "final_interview":
      return "final_interview"
    case "hired":
      return "offer_accepted"
    default:
      return "applied"
  }
}

export function syncLegacyDateFields(
  pipeline: ApplicationStageRecord[],
  appliedDate: number,
): Pick<
  JobApplication,
  "appliedDate" | "firstInterviewDate" | "additionalInterviewDates" | "rejectionDate" | "offerDate"
> {
  const applied = getStageRecordFromPipeline(pipeline, "applied")
  const hr = getStageRecordFromPipeline(pipeline, "hr_screening")
  const hm1 = getStageRecordFromPipeline(pipeline, "hiring_manager_interview_1")
  const hm2 = getStageRecordFromPipeline(pipeline, "hiring_manager_interview_2")
  const final = getStageRecordFromPipeline(pipeline, "final_interview")
  const offer = getStageRecordFromPipeline(pipeline, "offer")

  const additionalDates = [hm1?.date, hm2?.date, final?.date].filter(
    (value): value is number => typeof value === "number",
  )

  const terminal = pipeline.find((record) => isTerminalOutcome(record.outcome))
  const rejectionDate =
    terminal && (terminal.outcome === "rejected" || terminal.outcome === "declined")
      ? terminal.date
      : undefined

  return {
    appliedDate: applied?.date ?? (isValidApplicationTimestamp(appliedDate) ? appliedDate : 0),
    firstInterviewDate: hr?.date,
    additionalInterviewDates: additionalDates,
    rejectionDate,
    offerDate: offer?.date,
  }
}

function getStageRecordFromPipeline(
  pipeline: ApplicationStageRecord[],
  stage: ApplicationStage,
): ApplicationStageRecord | undefined {
  return pipeline.find((record) => record.stage === stage)
}
