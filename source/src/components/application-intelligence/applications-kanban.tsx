"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { getCurrentOutcome, getCurrentStage, getPipeline, isTerminalOutcome } from "@/lib/application-pipeline"
import { getPipelineCardLabel } from "@/lib/application-pipeline-ui"
import type { Language } from "@/lib/translations"
import { resolveApplicationRole, sortJobApplicationsByDate } from "@/lib/job-application-display"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import { FileText, Mail } from "lucide-react"

export type KanbanColumnId =
  | "saved"
  | "applying"
  | "applied"
  | "no_response"
  | "recruiter_review"
  | "interview"
  | "final_round"
  | "offer"
  | "rejected"
  | "archived"

const KANBAN_COLUMNS: { id: KanbanColumnId; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "applying", label: "Applying" },
  { id: "applied", label: "Applied" },
  { id: "no_response", label: "No response" },
  { id: "recruiter_review", label: "Recruiter review" },
  { id: "interview", label: "Interview" },
  { id: "final_round", label: "Final round" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
  { id: "archived", label: "Archived" },
]

export function resolveKanbanColumn(job: JobApplication): KanbanColumnId {
  const pipeline = getPipeline(job)
  const current = getCurrentStage(job)

  for (const record of [...pipeline].reverse()) {
    if (isTerminalOutcome(record.outcome)) {
      if (record.outcome === "rejected") return "rejected"
      if (record.outcome === "no_response") return "no_response"
      if (record.outcome === "withdrawn" || record.outcome === "declined") return "archived"
    }
  }

  if (current === "offer" || current === "hired") return "offer"
  if (current === "final_interview") return "final_round"
  if (
    current === "hiring_manager_interview_1" ||
    current === "hiring_manager_interview_2"
  ) {
    return "interview"
  }
  if (current === "hr_screening") return "recruiter_review"
  if (current === "applied") return "applied"

  if (!job.jobDescription?.trim() && !job.resumeVersionId) return "saved"
  if (!job.appliedDate) return "applying"

  return "applied"
}

function outcomeBadgeClass(outcome: ReturnType<typeof getCurrentOutcome>): string {
  switch (outcome) {
    case "rejected":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-200"
    case "passed":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
    case "pending":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-100"
    case "no_response":
      return "bg-stone-500/15 text-stone-800 dark:text-stone-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function KanbanApplicationCard({
  job,
  resumeVersion,
  language,
  onOpen,
}: {
  job: JobApplication
  resumeVersion?: ResumeVersion | null
  language: Language
  onOpen: () => void
}) {
  const role = resolveApplicationRole(job, resumeVersion)
  const stage = getCurrentStage(job)
  const outcome = getCurrentOutcome(job)
  const hasCv = Boolean(job.resumeVersionId && resumeVersion)
  const hasCl = Boolean(job.coverLetter?.content || job.coverLetterId)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-card/90"
    >
      <p className="truncate text-sm font-semibold leading-snug text-foreground">
        {role.company || job.company || "Company"}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {role.jobTitle || job.jobTitle || "Role"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className={cn("text-[10px] font-medium", outcomeBadgeClass(outcome))}>
          {getPipelineCardLabel(language, stage, outcome)}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        {hasCv ? (
          <span className="inline-flex items-center gap-0.5">
            <FileText className="h-3 w-3" aria-hidden />
            CV
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">No CV</span>
        )}
        {hasCl ? (
          <span className="inline-flex items-center gap-0.5">
            <Mail className="h-3 w-3" aria-hidden />
            CL
          </span>
        ) : null}
      </div>
    </button>
  )
}

export type ApplicationsKanbanProps = {
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  language?: Language
  onOpenJob: (jobId: string) => void
  className?: string
}

export function ApplicationsKanban({
  jobApplications,
  versions,
  language = "en",
  onOpenJob,
  className,
}: ApplicationsKanbanProps) {
  const grouped = useMemo(() => {
    const map = new Map<KanbanColumnId, JobApplication[]>()
    for (const col of KANBAN_COLUMNS) map.set(col.id, [])
    for (const job of jobApplications) {
      const col = resolveKanbanColumn(job)
      map.get(col)!.push(job)
    }
    for (const [colId, jobs] of map) {
      map.set(colId, sortJobApplicationsByDate(jobs, "newest"))
    }
    return map
  }, [jobApplications])

  const visibleColumns = useMemo(
    () => KANBAN_COLUMNS.filter((col) => (grouped.get(col.id)?.length ?? 0) > 0),
    [grouped],
  )

  if (jobApplications.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center",
          className,
        )}
      >
        <p className="text-sm font-medium text-foreground">No applications in your pipeline yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an application to see it organised by stage here.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto pb-1", className)}>
      <div className="flex min-w-min gap-3">
        {visibleColumns.map((col) => {
          const jobs = grouped.get(col.id) ?? []
          return (
            <div
              key={col.id}
              className="flex w-[min(100%,240px)] min-w-[220px] shrink-0 flex-col rounded-xl border border-border/60 bg-muted/15"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
                <span className="truncate text-xs font-semibold text-foreground">{col.label}</span>
                <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {jobs.length}
                </span>
              </div>
              <div className="flex max-h-[min(52vh,520px)] flex-col gap-2 overflow-y-auto p-2">
                {jobs.map((job) => (
                  <KanbanApplicationCard
                    key={job.id}
                    job={job}
                    language={language}
                    resumeVersion={versions.find((v) => v.id === job.resumeVersionId)}
                    onOpen={() => onOpenJob(job.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
