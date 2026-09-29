import { normalizeJobApplication } from "@/lib/application-outcome"
import { coerceApplicationTimestamp } from "@/lib/application-dates"
import { normalizeUploadDetails } from "@/lib/upload-details"
import type { ApplicationStageRecord, JobApplication } from "@/lib/types"

function resolveRowAppliedDate(
  row: Record<string, unknown>,
  jobDescription: Record<string, unknown> | null,
  pipeline: ApplicationStageRecord[],
): number {
  const fromColumn = coerceApplicationTimestamp(row.applied_date)
  const pipelineDates = pipeline
    .map((record) => coerceApplicationTimestamp(record.date))
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b)
  const fromPipelineApplied = coerceApplicationTimestamp(
    pipeline.find((record) => record.stage === "applied")?.date,
  )

  return (
    fromColumn ??
    fromPipelineApplied ??
    pipelineDates[0] ??
    coerceApplicationTimestamp(jobDescription?.appliedDate) ??
    coerceApplicationTimestamp(row.updated_at) ??
    0
  )
}

/** Map a Supabase job_applications row to the in-app JobApplication shape. */
export function mapJobApplicationRow(row: Record<string, unknown>): JobApplication {
  const jobDescription =
    row.job_description && typeof row.job_description === "object"
      ? (row.job_description as Record<string, unknown>)
      : null

  const pipeline: ApplicationStageRecord[] = Array.isArray(jobDescription?.pipeline)
    ? jobDescription.pipeline.map((record: {
        stage: string
        outcome: string
        date?: string | number
        notes?: string
      }) => ({
        stage: record.stage,
        outcome: record.outcome,
        date: coerceApplicationTimestamp(record.date),
        notes: record.notes,
      }))
    : []

  return normalizeJobApplication({
    id: String(row.id ?? ""),
    jobTitle: String(row.role ?? ""),
    company: String(row.company ?? ""),
    jobDescription: String(
      jobDescription?.content ?? jobDescription?.description ?? "",
    ),
    jobDescriptionSummary: String(jobDescription?.summary ?? ""),
    jobDescriptionUrl: String(jobDescription?.url ?? ""),
    strategySummary:
      row.job_strategy &&
      typeof row.job_strategy === "object" &&
      "summary" in row.job_strategy
        ? String((row.job_strategy as { summary?: unknown }).summary ?? "")
        : "",
    why:
      row.why_content &&
      typeof row.why_content === "object" &&
      "text" in row.why_content
        ? String((row.why_content as { text?: unknown }).text ?? "")
        : "",
    resumeVersionId: String(
      row.resume_version_id ?? jobDescription?.resumeVersionId ?? "",
    ),
    contactPersonName: String(jobDescription?.contactPerson ?? ""),
    salaryExpectation: String(jobDescription?.salary ?? ""),
    employmentType: String(jobDescription?.employmentType ?? "full-time"),
    jobStrategy: row.job_strategy,
    companyInfo:
      row.company_info && typeof row.company_info === "object"
        ? row.company_info
        : {
            website: "",
            researchNotes: "",
            linkedInContacts: [],
            lastModified: Date.now(),
          },
    contacts: Array.isArray(row.contacts) ? row.contacts : [],
    coverLetter:
      row.cover_letter && typeof row.cover_letter === "object"
        ? row.cover_letter
        : {
            content: "",
            lastModified: Date.now(),
          },
    yourStory:
      row.your_story && typeof row.your_story === "object"
        ? (row.your_story as JobApplication["yourStory"])
        : undefined,
    coverLetterId: String(row.cover_letter_id ?? ""),
    interviewPrep:
      row.interview_prep && typeof row.interview_prep === "object"
        ? row.interview_prep
        : {
            questions: [],
            possibleAnswers: [],
            personalDescription: "",
            interviewers: [],
            generalNotes: "",
            lastModified: Date.now(),
          },
    fitScores: row.fit_scores ?? undefined,
    redFlags: row.red_flags ?? undefined,
    uploadDetails: normalizeUploadDetails(row.upload_details),
    folderId: row.folder_id ? String(row.folder_id) : undefined,
    pipeline,
    status: row.status,
    location: String(jobDescription?.location ?? ""),
    appliedDate: resolveRowAppliedDate(row, jobDescription, pipeline),
    firstInterviewDate: jobDescription?.firstInterviewDate
      ? new Date(String(jobDescription.firstInterviewDate)).getTime()
      : undefined,
    additionalInterviewDates: Array.isArray(jobDescription?.additionalInterviewDates)
      ? jobDescription.additionalInterviewDates.map((value: string | number) =>
          new Date(value).getTime(),
        )
      : [],
    rejectionDate: jobDescription?.rejectionDate
      ? new Date(String(jobDescription.rejectionDate)).getTime()
      : undefined,
    offerDate: jobDescription?.offerDate
      ? new Date(String(jobDescription.offerDate)).getTime()
      : undefined,
    lastModified: row.updated_at
      ? new Date(String(row.updated_at)).getTime()
      : Date.now(),
  })
}
