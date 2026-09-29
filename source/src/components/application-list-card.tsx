"use client"

import type { ReactNode } from "react"
import { ApplicationPipelineStatusControl } from "@/components/application-pipeline-status-control"
import { ApplicationRoleFields } from "@/components/application-role-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getCurrentOutcome,
  getCurrentStage,
  getPipeline,
  updateStageRecord,
} from "@/lib/application-pipeline"
import { resolveApplicationRole } from "@/lib/job-application-display"
import {
  getResumeLanguage,
  getResumeLanguageLabel,
  getResumeLanguageShortLabel,
} from "@/lib/resume-language"
import type { ApplicationStageRecord, JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  FileEdit,
  FileText,
  ClipboardList,
  Mail,
  Plus,
  Star,
  Trash2,
  BookOpen,
  Sparkles,
  ScrollText,
} from "lucide-react"
import type { Language } from "@/lib/translations"
import { hasUsableYourStory, yourStoryPreview } from "@/lib/your-story"

export interface ApplicationListCardProps {
  job: JobApplication
  resumeVersion?: ResumeVersion | null
  appliedDateLabel: string | null
  lastUpdatedLabel: string | null
  resumeVersionName: string | null
  coverLetterName: string | null
  hasCoverLetter: boolean
  hasUploadDetails?: boolean
  hasJobDescription?: boolean
  fitScoreSummary: string | null
  language: Language
  onEdit: () => void
  onUpdateRole: (
    id: string,
    values: { jobTitle: string; company: string; location: string },
  ) => void
  onChangePipeline: (pipeline: ApplicationStageRecord[]) => void
  onOpenCv: () => void
  onOpenCoverLetter: () => void
  onOpenYourStory?: () => void
  onOpenStoryWizard?: () => void
  onOpenUploadDetails: () => void
  onOpenJobDescription: () => void
  onOpen: () => void
  onDelete: () => void
  isWorkspaceSyncing?: boolean
  isCvImporting?: boolean
}

type ApplicationDocumentChipProps = {
  label: string
  icon: ReactNode
  ariaLabel: string
  title?: string
  disabled?: boolean
  isEmpty?: boolean
  syncing?: boolean
  syncingLabel?: string
  onClick: () => void
}

function ApplicationDocumentChip({
  label,
  icon,
  ariaLabel,
  title,
  disabled = false,
  isEmpty = false,
  syncing = false,
  syncingLabel = "Syncing...",
  onClick,
}: ApplicationDocumentChipProps) {
  const isDisabled = disabled || syncing

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={syncing}
      aria-label={syncing ? "Syncing — please wait" : ariaLabel}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        if (!isDisabled) onClick()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "ui-document-chip",
        !isEmpty && !isDisabled && "ui-document-chip--filled",
        isEmpty && !isDisabled && "ui-document-chip--action",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)] focus-visible:ring-offset-2",
      )}
    >
      {syncing ? (
        <>
          <span className="spinner" aria-hidden />
          <span className="truncate">{syncingLabel}</span>
        </>
      ) : (
        <>
          {icon}
          <span className="truncate">{label}</span>
        </>
      )}
    </button>
  )
}

function cardBorderClass(outcome: ReturnType<typeof getCurrentOutcome>, stage: ReturnType<typeof getCurrentStage>) {
  if (outcome === "rejected") return "border-l-[var(--status-rejected-dot)]"
  if (outcome === "pending" && stage === "applied") return "border-l-[var(--status-pending-dot)]"
  return "border-l-[var(--brand-teal)]"
}

export function ApplicationListCard({
  job,
  resumeVersion,
  appliedDateLabel,
  lastUpdatedLabel,
  resumeVersionName,
  coverLetterName,
  hasCoverLetter,
  hasUploadDetails = false,
  hasJobDescription = false,
  fitScoreSummary,
  language,
  onEdit,
  onUpdateRole,
  onChangePipeline,
  onOpenCv,
  onOpenCoverLetter,
  onOpenYourStory,
  onOpenStoryWizard,
  onOpenUploadDetails,
  onOpenJobDescription,
  onOpen,
  onDelete,
  isWorkspaceSyncing = false,
  isCvImporting = false,
}: ApplicationListCardProps) {
  const currentStage = getCurrentStage(job)
  const currentOutcome = getCurrentOutcome(job)
  const role = resolveApplicationRole(job, resumeVersion)
  const hasUsableCv = Boolean(resumeVersion?.resumeText?.trim())
  const hasLinkedCv = hasUsableCv
  const cvLanguage = getResumeLanguage(resumeVersion)
  const storyPreview = yourStoryPreview(job.yourStory?.content ?? "")
  const hasStory = hasUsableYourStory(job.yourStory)

  const handleOutcomeChange = (outcome: ApplicationStageRecord["outcome"]) => {
    onChangePipeline(updateStageRecord(getPipeline(job), currentStage, { outcome }))
  }

  const stopCardOpen = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
  }

  const openDetailsFromHeader = () => {
    onOpen()
  }

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      e.stopPropagation()
      onOpen()
    }
  }

  return (
    <Card
      className={cn(
        "ui-workspace-card gap-0 rounded-[12px] py-0 shadow-none",
        "border-l-[3px] rounded-l-none",
        cardBorderClass(currentOutcome, currentStage),
        "group/card relative",
      )}
    >
      <CardContent className="px-4 py-[14px]">
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <div className="min-w-0 space-y-2.5">
            <div
              className={cn(
                "cursor-pointer rounded-md -m-1 p-1 transition-colors min-h-[44px]",
                "hover:bg-[var(--page-bg)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)] focus-visible:ring-offset-2",
              )}
              role="button"
              tabIndex={0}
              onClick={openDetailsFromHeader}
              onKeyDown={handleHeaderKeyDown}
              aria-label={`Open application details for ${role.jobTitle || "Application"}`}
            >
              <ApplicationRoleFields
                values={{
                  jobTitle: role.jobTitle,
                  company: role.company,
                  location: role.location,
                }}
                onSave={(values) => onUpdateRole(job.id, values)}
                isolateEditControls
              />
            </div>

            {fitScoreSummary && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-teal-bg)] px-2.5 py-1 text-xs font-medium text-[var(--brand-teal-text)]">
                  <Star className="h-3 w-3" aria-hidden />
                  {fitScoreSummary}
                </span>
              </div>
            )}

            <div
              className="flex flex-wrap gap-2"
              onClick={stopCardOpen}
              onKeyDown={stopCardOpen}
              onMouseDown={stopCardOpen}
              role="group"
              aria-label="Application documents"
            >
              <ApplicationDocumentChip
                label={
                  hasLinkedCv
                    ? `Resume · ${getResumeLanguageShortLabel(cvLanguage)}`
                    : "Add CV"
                }
                title={
                  hasLinkedCv
                    ? [
                        role.company || job.company || null,
                        resumeVersionName ?? "Resume",
                        getResumeLanguageLabel(cvLanguage),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : undefined
                }
                icon={<FileText className="h-3.5 w-3.5 shrink-0" />}
                ariaLabel={
                  isCvImporting
                    ? "Importing CV — please wait"
                    : hasLinkedCv
                      ? `Open resume formatter for this application — ${[
                          role.company || job.company || null,
                          resumeVersionName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}`
                      : "Add CV"
                }
                disabled={isWorkspaceSyncing && !hasLinkedCv}
                syncing={isCvImporting || (isWorkspaceSyncing && !hasLinkedCv)}
                syncingLabel={isCvImporting ? "Importing..." : "Syncing..."}
                isEmpty={!hasLinkedCv}
                onClick={() => {
                  console.log("Opening Resume Formatter")
                  onOpenCv()
                }}
              />

              <ApplicationDocumentChip
                label={hasCoverLetter ? "Cover letter" : "Add cover letter"}
                title={hasCoverLetter ? (coverLetterName ?? undefined) : undefined}
                icon={
                  hasCoverLetter ? (
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  )
                }
                isEmpty={!hasCoverLetter}
                disabled={isWorkspaceSyncing && !hasCoverLetter}
                syncing={isWorkspaceSyncing && !hasCoverLetter}
                ariaLabel={
                  hasCoverLetter
                    ? `Open cover letter for this application${coverLetterName ? ` — ${coverLetterName}` : ""}`
                    : "Add cover letter"
                }
                onClick={() => {
                  console.log("Opening Cover Letter Builder")
                  onOpenCoverLetter()
                }}
              />

              <ApplicationDocumentChip
                label="Job description"
                icon={<ScrollText className="h-3.5 w-3.5 shrink-0" />}
                ariaLabel={
                  hasJobDescription
                    ? "View the job description used for this application"
                    : "Add or view job description for this application"
                }
                isEmpty={!hasJobDescription}
                onClick={() => {
                  onOpenJobDescription()
                }}
              />

              <ApplicationDocumentChip
                label="Upload Details"
                icon={<ClipboardList className="h-3.5 w-3.5 shrink-0" />}
                ariaLabel="Open upload details for application form answers"
                isEmpty={!hasUploadDetails}
                onClick={() => {
                  onOpenUploadDetails()
                }}
              />
            </div>

            {(hasStory || onOpenYourStory) && (
              <div
                className="your-story-card-preview"
                onClick={stopCardOpen}
                onKeyDown={stopCardOpen}
                onMouseDown={stopCardOpen}
              >
                <div className="your-story-card-preview__header">
                  <div className="your-story-card-preview__title">
                    <span className="your-story-card-preview__icon" aria-hidden>
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="your-story-card-preview__heading">My Career Story</p>
                      <p className="your-story-card-preview__sub">
                        {hasStory
                          ? "Tailored narrative for this application"
                          : "Draft a role-specific story for recruiters"}
                      </p>
                    </div>
                  </div>
                </div>

                {hasStory ? (
                  <p className="your-story-card-preview__text line-clamp-3">{storyPreview}</p>
                ) : (
                  <p className="your-story-card-preview__empty">
                    Open your story editor or use the wizard to build talking points for interviews
                    and cover letters.
                  </p>
                )}

                <div className="your-story-card-preview__actions">
                  {onOpenYourStory ? (
                    <Button
                      type="button"
                      size="sm"
                      className="your-story-card-preview__btn your-story-card-preview__btn--primary h-8 px-3 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenYourStory()
                      }}
                    >
                      {hasStory ? "Read story" : "Open story"}
                    </Button>
                  ) : null}
                  {onOpenStoryWizard ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="your-story-card-preview__btn h-8 px-3 text-xs gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenStoryWizard()
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Story Wizard
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            {(appliedDateLabel || lastUpdatedLabel) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-meta)]">
                {appliedDateLabel && <span>Applied {appliedDateLabel}</span>}
                {lastUpdatedLabel && <span>Updated {lastUpdatedLabel}</span>}
              </div>
            )}

            <div
              className="lg:hidden pt-1"
              onClick={stopCardOpen}
              onKeyDown={stopCardOpen}
              onMouseDown={stopCardOpen}
            >
              <ApplicationPipelineStatusControl
                stage={currentStage}
                outcome={currentOutcome}
                language={language}
                onOutcomeChange={handleOutcomeChange}
                className="w-full justify-between"
              />
            </div>

            <div
              className="flex flex-wrap items-center gap-2 lg:hidden"
              onClick={stopCardOpen}
              onKeyDown={stopCardOpen}
              onMouseDown={stopCardOpen}
            >
              <Button variant="outline" size="sm" className="ui-btn-ghost h-11" onClick={onEdit}>
                <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                aria-label="Delete application"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            className="hidden lg:flex flex-col items-end gap-2 shrink-0"
            onClick={stopCardOpen}
            onKeyDown={stopCardOpen}
            onMouseDown={stopCardOpen}
          >
            <ApplicationPipelineStatusControl
              stage={currentStage}
              outcome={currentOutcome}
              language={language}
              onOutcomeChange={handleOutcomeChange}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="ui-btn-ghost h-11" onClick={onEdit}>
                <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                aria-label="Delete application"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
