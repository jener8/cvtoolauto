"use client"

import { useMemo, useState } from "react"
import {
  APPLICATION_STAGES,
  getCurrentOutcome,
  getCurrentStage,
  getPipeline,
  updateStageRecord,
  type ApplicationStage,
  type StageOutcome,
} from "@/lib/application-pipeline"
import {
  getPipelineCardLabel,
  getStageShortLabel,
  STAGE_OUTCOMES,
} from "@/lib/application-pipeline-ui"
import {
  normalizeJobApplication,
  type ApplicationOutcomeFilter,
} from "@/lib/application-outcome"
import {
  filterJobApplications,
  hasApplicationCoverLetter,
  resolveApplicationRole,
  sortJobApplicationsByDate,
  type JobApplicationDateSort,
} from "@/lib/job-application-display"
import { resolveResumeForJob } from "@/lib/resolve-application-resume"
import { hasResumeCoverLetterContent } from "@/lib/resume-cover-letter"
import { deleteJobApplicationById, saveJobApplications } from "@/lib/storage"
import { getOutcomeFilterLabel, getStageOutcomeLabel } from "@/lib/translations"
import type { ApplicationStageRecord, JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Plus,
  ScrollText,
  Search,
  Trash2,
} from "lucide-react"

const MOBILE_OUTCOME_FILTERS: ApplicationOutcomeFilter[] = [
  "all",
  "active",
  "interview",
  "offer",
  "rejected",
  "declined",
  "no_response",
  "withdrawn",
  "hired",
]

type MobileApplicationsListProps = {
  applications: JobApplication[]
  resumes: ResumeVersion[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onApplicationsChange: (applications: JobApplication[]) => void
  onOpenResume: (resumeId: string) => void
  onOpenCoverLetter: (resumeId: string) => void
  onCreateApplication?: () => void
}

function formatAppliedDate(timestamp: number | undefined): string | null {
  if (!timestamp || timestamp <= 0) return null
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Find resume linked to a job even if CV text is still empty. */
function findLinkedResume(
  job: JobApplication,
  resumes: ResumeVersion[],
): ResumeVersion | undefined {
  return (
    resolveResumeForJob(job, resumes) ??
    resumes.find((version) => version.applicationId === job.id) ??
    (job.resumeVersionId?.trim()
      ? resumes.find((version) => version.id === job.resumeVersionId?.trim())
      : undefined)
  )
}

function buildPipelineAtStage(
  stage: ApplicationStage,
  outcome: StageOutcome,
  appliedDate?: number,
): ApplicationStageRecord[] {
  const index = APPLICATION_STAGES.indexOf(stage)
  if (index < 0) return [{ stage: "applied", outcome: "pending", date: appliedDate }]
  const records: ApplicationStageRecord[] = APPLICATION_STAGES.slice(0, index).map((s) => ({
    stage: s,
    outcome: "passed" as const,
  }))
  records.push({
    stage,
    outcome,
    date: stage === "applied" ? appliedDate : undefined,
  })
  return records
}

function ApplicationDetail({
  job,
  resumes,
  onBack,
  onUpdated,
  onDeleted,
  onOpenResume,
  onOpenCoverLetter,
}: {
  job: JobApplication
  resumes: ResumeVersion[]
  onBack: () => void
  onUpdated: (next: JobApplication) => void | Promise<void>
  onDeleted: (id: string) => void
  onOpenResume: (resumeId: string) => void
  onOpenCoverLetter: (resumeId: string) => void
}) {
  const role = resolveApplicationRole(job)
  const stage = getCurrentStage(job)
  const outcome = getCurrentOutcome(job)
  const statusLabel = getPipelineCardLabel("en", stage, outcome)
  const appliedLabel = formatAppliedDate(job.appliedDate)
  const summary = job.jobDescriptionSummary?.trim() || job.why?.trim() || ""
  const linkedResume = findLinkedResume(job, resumes)
  const jobDescriptionText =
    job.jobDescription?.trim() || linkedResume?.jobDescription?.trim() || ""
  const hasLetter =
    hasResumeCoverLetterContent(linkedResume?.coverLetter) ||
    hasApplicationCoverLetter(job, undefined, linkedResume)

  const [savingStatus, setSavingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showJobDescription, setShowJobDescription] = useState(false)

  const handleStageChange = async (nextStage: ApplicationStage) => {
    if (nextStage === stage) return
    setSavingStatus(true)
    setActionError(null)
    try {
      const pipeline = buildPipelineAtStage(nextStage, "pending", job.appliedDate)
      await onUpdated(
        normalizeJobApplication({
          ...job,
          pipeline,
          lastModified: Date.now(),
        }),
      )
    } catch (err) {
      console.error("[mobile] Status stage update failed:", err)
      setActionError("Couldn’t update status.")
    } finally {
      setSavingStatus(false)
    }
  }

  const handleOutcomeChange = async (nextOutcome: StageOutcome) => {
    if (nextOutcome === outcome) return
    setSavingStatus(true)
    setActionError(null)
    try {
      const pipeline = updateStageRecord(getPipeline(job), stage, { outcome: nextOutcome })
      await onUpdated(
        normalizeJobApplication({
          ...job,
          pipeline,
          lastModified: Date.now(),
        }),
      )
    } catch (err) {
      console.error("[mobile] Status outcome update failed:", err)
      setActionError("Couldn’t update status.")
    } finally {
      setSavingStatus(false)
    }
  }

  const handleDelete = async () => {
    const label = [role.jobTitle, role.company].filter(Boolean).join(" at ") || "this application"
    if (!window.confirm(`Delete ${label}? This can’t be undone.`)) return

    setDeleting(true)
    setActionError(null)
    try {
      const result = await deleteJobApplicationById(job.id, {
        folderId: job.folderId,
        resumeVersionId: job.resumeVersionId,
        company: job.company,
        jobTitle: job.jobTitle,
      })
      if (!result.success) {
        setActionError(result.error ?? "Couldn’t delete application.")
        return
      }
      onDeleted(job.id)
    } catch (err) {
      console.error("[mobile] Delete application failed:", err)
      setActionError("Couldn’t delete application.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200/80 bg-white/95 px-3 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"
          aria-label="Back to applications"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{role.jobTitle}</p>
          <p className="truncate text-xs text-zinc-500">{role.company}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="rounded-2xl bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</p>
          <p className="mt-1 text-sm font-medium text-zinc-900">{statusLabel}</p>
          {appliedLabel ? (
            <p className="mt-1 text-xs text-zinc-500">Applied {appliedLabel}</p>
          ) : null}

          <div className="mt-3 grid grid-cols-1 gap-2">
            <label className="block">
              <span className="text-[11px] font-medium text-zinc-500">Stage</span>
              <select
                value={stage}
                disabled={savingStatus}
                onChange={(e) => void handleStageChange(e.target.value as ApplicationStage)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                {APPLICATION_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {getStageShortLabel("en", s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-zinc-500">Outcome</span>
              <select
                value={outcome}
                disabled={savingStatus}
                onChange={(e) => void handleOutcomeChange(e.target.value as StageOutcome)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                {STAGE_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {getStageOutcomeLabel("en", o)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {savingStatus ? (
            <p className="mt-2 text-xs text-zinc-500">Updating…</p>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Documents</p>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              disabled={!linkedResume}
              onClick={() => linkedResume && onOpenResume(linkedResume.id)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 text-left",
                linkedResume
                  ? "bg-white active:bg-zinc-50"
                  : "cursor-not-allowed bg-zinc-50 opacity-60",
              )}
            >
              <FileText className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {linkedResume ? linkedResume.name || "Resume" : "No resume linked"}
                </span>
                {linkedResume ? (
                  <span className="block truncate text-xs text-zinc-500">Open in Resume tab</span>
                ) : null}
              </span>
              {linkedResume ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              ) : null}
            </button>

            <button
              type="button"
              disabled={!linkedResume}
              onClick={() => linkedResume && onOpenCoverLetter(linkedResume.id)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 text-left",
                linkedResume
                  ? "bg-white active:bg-zinc-50"
                  : "cursor-not-allowed bg-zinc-50 opacity-60",
              )}
            >
              <Mail className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {linkedResume
                    ? hasLetter
                      ? linkedResume.coverLetter?.name || "Cover letter"
                      : "Cover letter (empty)"
                    : "No cover letter"}
                </span>
                {linkedResume ? (
                  <span className="block truncate text-xs text-zinc-500">Open in Letter tab</span>
                ) : null}
              </span>
              {linkedResume ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              ) : null}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Job description
          </p>
          <button
            type="button"
            onClick={() => setShowJobDescription((open) => !open)}
            className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 text-left active:bg-zinc-50"
          >
            <ScrollText className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-900">
                {jobDescriptionText
                  ? showJobDescription
                    ? "Hide job description"
                    : "Show job description"
                  : "No job description saved"}
              </span>
              {jobDescriptionText ? (
                <span className="block truncate text-xs text-zinc-500">
                  Pasted when creating this application
                </span>
              ) : null}
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
                showJobDescription && "rotate-90",
              )}
              aria-hidden
            />
          </button>
          {showJobDescription && jobDescriptionText ? (
            <div className="mt-2 max-h-[min(70vh,36rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800">
                {jobDescriptionText}
              </p>
            </div>
          ) : null}
        </div>

        {role.location ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-zinc-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            <span>{role.location}</span>
          </p>
        ) : null}

        {summary ? (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{summary}</p>
          </div>
        ) : null}

        {job.jobDescriptionUrl ? (
          <a
            href={job.jobDescriptionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white active:bg-zinc-800"
          >
            Open job posting
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : null}

        {actionError ? <p className="mt-4 text-xs text-red-700">{actionError}</p> : null}

        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 active:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {deleting ? "Deleting…" : "Delete application"}
        </button>
      </div>
    </div>
  )
}

export function MobileApplicationsList({
  applications,
  resumes,
  loading = false,
  error = null,
  onRefresh,
  onApplicationsChange,
  onOpenResume,
  onOpenCoverLetter,
  onCreateApplication,
}: MobileApplicationsListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [dateSort, setDateSort] = useState<JobApplicationDateSort>("newest")
  const [outcomeFilter, setOutcomeFilter] = useState<ApplicationOutcomeFilter>("all")

  const filtered = useMemo(() => {
    const matched = filterJobApplications(applications, {
      query,
      outcomeFilter,
      stageFilter: "all",
      versions: resumes,
    })
    return sortJobApplicationsByDate(matched, dateSort)
  }, [applications, query, outcomeFilter, dateSort, resumes])

  const hasActiveFilters = Boolean(query.trim()) || outcomeFilter !== "all"

  const selected = selectedId
    ? applications.find((job) => job.id === selectedId) ?? null
    : null

  const handleUpdated = async (next: JobApplication) => {
    const nextList = sortAndReplace(applications, next)
    onApplicationsChange(nextList)
    try {
      await saveJobApplications(nextList)
    } catch (err) {
      console.error("[mobile] Failed to persist applications:", err)
    }
  }

  const handleDeleted = (id: string) => {
    onApplicationsChange(applications.filter((job) => job.id !== id))
    setSelectedId(null)
  }

  if (selected) {
    return (
      <ApplicationDetail
        key={selected.id}
        job={selected}
        resumes={resumes}
        onBack={() => setSelectedId(null)}
        onUpdated={(next) => void handleUpdated(next)}
        onDeleted={handleDeleted}
        onOpenResume={onOpenResume}
        onOpenCoverLetter={onOpenCoverLetter}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-zinc-200/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              EquitAI
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900">
              Applications
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            <p className="text-xs tabular-nums text-zinc-500">{applications.length}</p>
            {onCreateApplication ? (
              <button
                type="button"
                onClick={onCreateApplication}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white active:bg-zinc-800"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New
              </button>
            ) : null}
          </div>
        </div>

        <label className="relative mt-3 block">
          <span className="sr-only">Search company or role</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or role"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            enterKeyHint="search"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className="text-[11px] font-medium text-zinc-500">Sort</span>
            <select
              value={dateSort}
              onChange={(e) => setDateSort(e.target.value as JobApplicationDateSort)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              aria-label="Sort applications by date"
            >
              <option value="newest">Youngest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-[11px] font-medium text-zinc-500">Status</span>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as ApplicationOutcomeFilter)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              aria-label="Filter applications by status"
            >
              {MOBILE_OUTCOME_FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {filter === "all" ? "All statuses" : getOutcomeFilterLabel("en", filter)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="space-y-3 px-4 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-700">{error}</p>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 min-h-11 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <Briefcase className="h-5 w-5 text-zinc-500" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-900">
              {hasActiveFilters ? "No matching applications" : "No applications yet"}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
              {hasActiveFilters
                ? "Try a different search or status filter."
                : "Create an application with the same wizard you use on desktop."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setOutcomeFilter("all")
                }}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 active:bg-zinc-50"
              >
                Clear filters
              </button>
            ) : onCreateApplication ? (
              <button
                type="button"
                onClick={onCreateApplication}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white active:bg-zinc-800"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New application
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 px-2 py-1 pb-4">
            {filtered.map((job) => {
              const role = resolveApplicationRole(job)
              const stage = getCurrentStage(job)
              const outcome = getCurrentOutcome(job)
              const statusLabel = getPipelineCardLabel("en", stage, outcome)
              const appliedLabel = formatAppliedDate(job.appliedDate)
              const isTerminal =
                outcome === "rejected" ||
                outcome === "declined" ||
                outcome === "withdrawn" ||
                outcome === "no_response"

              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(job.id)}
                    className="flex w-full min-h-[4.5rem] flex-col gap-1 rounded-xl px-3 py-3.5 text-left active:bg-zinc-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-zinc-900">
                          {role.jobTitle || "Untitled role"}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-zinc-600">
                          {role.company || "Company not set"}
                        </p>
                      </div>
                      {appliedLabel ? (
                        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-zinc-400">
                          {appliedLabel}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isTerminal
                          ? "bg-zinc-100 text-zinc-600"
                          : "bg-teal-50 text-teal-800",
                      )}
                    >
                      {statusLabel}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function sortAndReplace(list: JobApplication[], next: JobApplication): JobApplication[] {
  return list.map((job) => (job.id === next.id ? next : job))
}
