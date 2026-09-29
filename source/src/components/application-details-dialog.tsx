"use client"

import type { ReactNode } from "react"
import { ApplicationPipelineEditor } from "@/components/application-pipeline-editor"
import { ApplicationRoleFields } from "@/components/application-role-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getCurrentOutcome, getCurrentStage, getPipeline } from "@/lib/application-pipeline"
import { getStatusBadgeClass } from "@/lib/application-outcome"
import {
  formatApplicationDate,
  formatFitScoreSummary,
  resolveApplicationRole,
} from "@/lib/job-application-display"
import { getFitScoreTypeLabel, getPipelineSummaryLabel, type Language } from "@/lib/translations"
import type { CoverLetter, JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Building2,
  ClipboardList,
  FileText,
  MessageSquare,
  Star,
  Target,
} from "lucide-react"

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2 border-b border-border/60 pb-5 last:border-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

export interface ApplicationDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: JobApplication | null
  versions: ResumeVersion[]
  coverLetters?: CoverLetter[]
  language: Language
  onUpdateJob: (id: string, updates: Partial<JobApplication>) => void
  onUpdateRole?: (
    id: string,
    values: { jobTitle: string; company: string; location: string },
  ) => void
  onOpenCompanyInfo: (jobId: string) => void
  onOpenJobStrategy: (jobId: string) => void
  onOpenContacts: (jobId: string) => void
  onOpenInterviewPrep: (jobId: string) => void
  onOpenCoverLetterWizard: (jobId: string) => void
  onOpenCoverLetterEditor: (jobId: string) => void
  onOpenUploadDetails: (jobId: string) => void
  onLoadVersion: (version: ResumeVersion) => void
  onEditFitScore: (
    jobId: string,
    type: "culture" | "ambitions" | "skills" | "strategy",
    job: JobApplication,
  ) => void
}

export function ApplicationDetailsDialog({
  open,
  onOpenChange,
  job,
  versions,
  coverLetters,
  language,
  onUpdateJob,
  onUpdateRole,
  onOpenCompanyInfo,
  onOpenJobStrategy,
  onOpenContacts,
  onOpenInterviewPrep,
  onOpenCoverLetterWizard,
  onOpenCoverLetterEditor,
  onOpenUploadDetails,
  onLoadVersion,
  onEditFitScore,
}: ApplicationDetailsDialogProps) {
  if (!job) return null

  const resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
  const linkedCoverLetter = coverLetters?.find((letter) => letter.id === job.coverLetterId)
  const role = resolveApplicationRole(job, resumeVersion)
  const currentStage = getCurrentStage(job)
  const currentOutcome = getCurrentOutcome(job)
  const fitSummary = formatFitScoreSummary(job)

  const timelineEntries = getPipeline(job)
    .filter((record) => record.date)
    .map((record) => ({
      label: getPipelineSummaryLabel(language, record.stage, record.outcome),
      date: record.date!,
    }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ApplicationRoleFields
                values={{
                  jobTitle: role.jobTitle,
                  company: role.company,
                  location: role.location,
                }}
                onSave={(values) =>
                  onUpdateRole
                    ? onUpdateRole(job.id, values)
                    : onUpdateJob(job.id, {
                        jobTitle: values.jobTitle,
                        company: values.company,
                        location: values.location || undefined,
                      })
                }
              />
              {job.appliedDate && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Applied {formatApplicationDate(job.appliedDate)}
                </p>
              )}
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium shrink-0",
                getStatusBadgeClass(job),
              )}
            >
              {getPipelineSummaryLabel(language, currentStage, currentOutcome)}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="py-5 space-y-5">
            <DetailSection title="Application details">
              <p className="text-xs text-muted-foreground">
                Job application → company → CV version. Edit the role fields above; track pipeline
                progress below.
              </p>
            </DetailSection>

            <DetailSection title="Hiring pipeline">
              <ApplicationPipelineEditor
                job={job}
                language={language}
                onUpdateJob={onUpdateJob}
              />
              {timelineEntries.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {timelineEntries.map((entry) => (
                    <li key={`${entry.label}-${entry.date}`}>
                      <span className="font-medium text-foreground">{entry.label}:</span>{" "}
                      {formatApplicationDate(entry.date)}
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>

            <DetailSection title="Job description">
              {(job.jobDescription?.trim() || resumeVersion?.jobDescription?.trim()) ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground max-h-[min(70vh,36rem)] overflow-y-auto rounded-md border bg-muted/20 p-3">
                  {job.jobDescription?.trim() || resumeVersion?.jobDescription?.trim()}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No job description saved.</p>
              )}
              {job.jobDescriptionUrl && (
                <a
                  href={job.jobDescriptionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm text-primary hover:underline"
                >
                  View original posting →
                </a>
              )}
            </DetailSection>

            <DetailSection title="Notes">
              {job.jobDescriptionSummary?.trim() ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {job.jobDescriptionSummary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No summary notes.</p>
              )}
              {job.companyInfo?.researchNotes?.trim() && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-foreground mb-1">Company research</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.companyInfo.researchNotes}
                  </p>
                </div>
              )}
              {job.interviewPrep?.generalNotes?.trim() && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-foreground mb-1">Interview prep notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.interviewPrep.generalNotes}
                  </p>
                </div>
              )}
            </DetailSection>

            <DetailSection title="Motivation statement">
              {job.why?.trim() ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{job.why}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No motivation statement yet.</p>
              )}
            </DetailSection>

            <DetailSection title="Job fit analysis">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-primary" />
                {fitSummary ? (
                  <span className="text-sm font-medium">Overall: {fitSummary}</span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">No fit scores yet</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["culture", "ambitions", "skills", "strategy"] as const).map((type) => {
                  const fitScore = job.fitScores?.[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onEditFitScore(job.id, type, job)}
                      className="rounded-md border bg-background p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-xs font-medium mb-1">
                        {getFitScoreTypeLabel(language, type)}
                      </p>
                      {fitScore ? (
                        <>
                          <p className="text-sm font-semibold">{fitScore.score}/5</p>
                          {fitScore.summary && (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                              {fitScore.summary}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Click to add</p>
                      )}
                    </button>
                  )
                })}
              </div>
              {job.strategySummary?.trim() && (
                <div className="mt-3 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium mb-1">Strategy summary</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.strategySummary}
                  </p>
                </div>
              )}
            </DetailSection>

            <DetailSection title="Documents">
              <div className="flex flex-wrap gap-2">
                {resumeVersion ? (
                  <Button variant="outline" size="sm" onClick={() => onLoadVersion(resumeVersion)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Resume: {resumeVersion.name}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground italic">No resume linked</span>
                )}
                {linkedCoverLetter ? (
                  <Button variant="outline" size="sm" onClick={() => onOpenCoverLetterEditor(job.id)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Cover letter: {linkedCoverLetter.name}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onOpenCoverLetterWizard(job.id)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Create cover letter
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => onOpenUploadDetails(job.id)}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Upload Details
                </Button>
              </div>
            </DetailSection>

            <DetailSection title="Interview history">
              <p className="text-sm text-muted-foreground">
                {job.interviewPrep?.questions?.length ?? 0} prep questions ·{" "}
                {job.interviewPrep?.interviewers?.length ?? 0} interviewers noted
              </p>
              <Button variant="outline" size="sm" onClick={() => onOpenInterviewPrep(job.id)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Open interview prep
              </Button>
            </DetailSection>

            <DetailSection title="Related">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenCompanyInfo(job.id)}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Company info
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenJobStrategy(job.id)}>
                  <Target className="h-4 w-4 mr-2" />
                  Job strategy
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenContacts(job.id)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contacts
                  {job.contacts?.length ? ` (${job.contacts.length})` : ""}
                </Button>
              </div>
            </DetailSection>

            {job.redFlags && job.redFlags.length > 0 && (
              <DetailSection title="Red flags">
                <ul className="space-y-2">
                  {job.redFlags.map((flag) => (
                    <li key={flag.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{flag.question}</p>
                      {flag.answer && (
                        <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{flag.answer}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
