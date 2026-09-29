"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  generateUploadDetails,
  regenerateUploadDetailsField,
} from "@/app/actions/generate-upload-details"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { OutputLanguageToggle } from "@/components/output-language-toggle"
import { toast } from "@/hooks/use-toast"
import { resolveApplicationRole } from "@/lib/job-application-display"
import {
  loadStrategicProfile,
  patchStrategicProfile,
  type StrategicProfile,
} from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import {
  emptyUploadDetails,
  hasUploadDetailsContent,
  mergeUploadDetails,
  UPLOAD_DETAILS_FIELD_META,
  type UploadDetails,
  type UploadDetailsFieldKey,
} from "@/lib/upload-details"
import type { WorkspaceSyncUiStatus } from "@/components/workspace-sync-status"
import { cn } from "@/lib/utils"
import { AlertTriangle, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { AiWizardProgress } from "@/components/ai-wizard-progress"

export interface UploadDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: JobApplication | null
  resumeVersion?: ResumeVersion | null
  onSave: (jobId: string, uploadDetails: UploadDetails) => void | Promise<void>
  workspaceSyncStatus?: WorkspaceSyncUiStatus
  /** Workspace default when this application has no saved upload-details language yet. */
  defaultOutputLanguage?: "en" | "de"
}

function buildExistingNotes(job: JobApplication): string {
  const parts: string[] = []
  if (job.why?.trim()) parts.push(`Motivation (why): ${job.why.trim()}`)
  if (job.strategySummary?.trim()) parts.push(`Strategy summary: ${job.strategySummary.trim()}`)
  if (job.jobDescriptionSummary?.trim()) {
    parts.push(`Job summary: ${job.jobDescriptionSummary.trim()}`)
  }
  if (job.companyInfo?.researchNotes?.trim()) {
    parts.push(`Company research: ${job.companyInfo.researchNotes.trim()}`)
  }
  if (job.interviewPrep?.generalNotes?.trim()) {
    parts.push(`Interview notes: ${job.interviewPrep.generalNotes.trim()}`)
  }
  const fitParts = (["culture", "ambitions", "skills", "strategy"] as const)
    .map((key) => job.fitScores?.[key])
    .filter(Boolean)
    .map((fit) => `${fit!.summary ?? ""} (${fit!.score}/5)`.trim())
  if (fitParts.length) parts.push(`Fit scores: ${fitParts.join("; ")}`)
  return parts.join("\n\n")
}

function UploadDetailsFieldEditor({
  fieldKey,
  label,
  description,
  rows,
  value,
  onChange,
  onCopy,
  onRegenerate,
  isRegenerating,
  disabled,
}: {
  fieldKey: UploadDetailsFieldKey
  label: string
  description: string
  rows: number
  value: string
  onChange: (value: string) => void
  onCopy: () => void
  onRegenerate: () => void
  isRegenerating: boolean
  disabled?: boolean
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label htmlFor={`upload-details-${fieldKey}`} className="text-sm font-semibold">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onCopy}
            disabled={disabled || !value.trim()}
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onRegenerate}
            disabled={disabled || isRegenerating}
            aria-label={`Regenerate ${label}`}
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            Regenerate
          </Button>
        </div>
      </div>
      <Textarea
        id={`upload-details-${fieldKey}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        className="resize-y min-h-[4.5rem]"
        placeholder="Edit manually or generate a draft…"
      />
    </div>
  )
}

export function UploadDetailsDialog({
  open,
  onOpenChange,
  job,
  resumeVersion,
  onSave,
  workspaceSyncStatus = "idle",
  defaultOutputLanguage = "en",
}: UploadDetailsDialogProps) {
  const [draft, setDraft] = useState<UploadDetails>(emptyUploadDetails())
  const [outputLanguage, setOutputLanguage] = useState<"en" | "de">("en")
  const [noticePeriod, setNoticePeriod] = useState("")
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [regeneratingField, setRegeneratingField] = useState<UploadDetailsFieldKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [generationMessage, setGenerationMessage] = useState<{
    type: "error" | "info" | "success"
    text: string
  } | null>(null)
  const noticeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open || !job) return
    setDraft(job.uploadDetails ? { ...job.uploadDetails } : emptyUploadDetails())
    const savedLang = job.uploadDetails?.outputLanguage
    const sessionLang =
      typeof window !== "undefined" && sessionStorage.getItem("cvLanguage") === "de"
        ? "de"
        : "en"
    setOutputLanguage(savedLang ?? defaultOutputLanguage ?? sessionLang)
    setNoticePeriod(loadStrategicProfile().noticePeriod ?? "")
    setGenerationMessage(null)
  }, [open, job, defaultOutputLanguage])

  const scheduleNoticePeriodSave = useCallback((value: string) => {
    if (noticeSaveTimerRef.current) clearTimeout(noticeSaveTimerRef.current)
    noticeSaveTimerRef.current = window.setTimeout(() => {
      patchStrategicProfile({ noticePeriod: value })
    }, 500)
  }, [])

  const handleNoticePeriodChange = (value: string) => {
    setNoticePeriod(value)
    scheduleNoticePeriodSave(value)
  }

  const role = useMemo(
    () => (job ? resolveApplicationRole(job, resumeVersion) : null),
    [job, resumeVersion],
  )

  const syncOffline =
    workspaceSyncStatus === "unavailable" || workspaceSyncStatus === "loaded_local"

  const hasResume = Boolean(resumeVersion?.resumeText?.trim())
  const hasJobDescription = Boolean(job?.jobDescription?.trim())

  const buildGenerationInput = useCallback(() => {
    if (!job) return null
    const strategicProfile: StrategicProfile = {
      ...loadStrategicProfile(),
      noticePeriod: noticePeriod.trim() || loadStrategicProfile().noticePeriod,
    }
    return {
      jobTitle: role?.jobTitle ?? job.jobTitle,
      company: role?.company ?? job.company,
      location: role?.location ?? job.location,
      jobDescription: job.jobDescription ?? "",
      resumeContent: resumeVersion?.resumeText ?? "",
      strategicProfile,
      existingNotes: buildExistingNotes(job),
      existingSalaryExpectation: job.salaryExpectation,
      employmentType: job.employmentType,
      outputLanguage,
      existingUploadDetails: draft,
    }
  }, [job, role, resumeVersion, draft, outputLanguage, noticePeriod])

  const handleGenerateAll = async () => {
    const input = buildGenerationInput()
    if (!input) return
    if (!hasResume && !hasJobDescription) {
      const message =
        "Add a job description or CV to this application before generating upload details."
      setGenerationMessage({ type: "error", text: message })
      toast({
        title: "More context needed",
        description: message,
        variant: "destructive",
      })
      return
    }

    setGenerationMessage(
      hasResume
        ? null
        : {
            type: "info",
            text: "No CV is linked yet — drafts will be based on the job description and your notes only.",
          },
    )
    setIsGeneratingAll(true)
    try {
      const result = await generateUploadDetails(input)
      if (!result.success || !result.uploadDetails) {
        const message = result.error ?? "Try again in a moment."
        setGenerationMessage({ type: "error", text: message })
        toast({
          title: "Could not generate upload details",
          description: message,
          variant: "destructive",
        })
        return
      }
      setDraft(result.uploadDetails)
      setGenerationMessage({
        type: "success",
        text: "Drafts generated. Review and edit each field before saving.",
      })
      toast({ title: "Drafts generated", description: "Review and edit before saving." })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      setGenerationMessage({ type: "error", text: message })
      toast({
        title: "Could not generate upload details",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingAll(false)
    }
  }

  const handleRegenerateField = async (field: UploadDetailsFieldKey) => {
    const input = buildGenerationInput()
    if (!input) return
    if (!hasResume && !hasJobDescription) {
      const message = "Add a job description or CV before regenerating this field."
      setGenerationMessage({ type: "error", text: message })
      toast({
        title: "More context needed",
        description: message,
        variant: "destructive",
      })
      return
    }

    setRegeneratingField(field)
    try {
      const result = await regenerateUploadDetailsField({ ...input, field })
      if (!result.success || !result.uploadDetails) {
        const message = result.error ?? "Try again."
        setGenerationMessage({ type: "error", text: message })
        toast({
          title: "Regeneration failed",
          description: message,
          variant: "destructive",
        })
        return
      }
      setDraft((prev) => mergeUploadDetails(prev, result.uploadDetails!))
      setGenerationMessage({ type: "success", text: `${field} updated.` })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      setGenerationMessage({ type: "error", text: message })
    } finally {
      setRegeneratingField(null)
    }
  }

  const handleCopy = async (text: string, label: string) => {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text.trim())
      toast({ title: "Copied", description: `${label} copied to clipboard.` })
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not access the clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleSave = async () => {
    if (!job) return
    setIsSaving(true)
    try {
      const toSave = mergeUploadDetails(draft, {
        updatedAt: Date.now(),
        outputLanguage,
      })
      await onSave(job.id, toSave)
      toast({ title: "Saved to application", description: "Upload details are stored with this job." })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (key: UploadDetailsFieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value, updatedAt: Date.now() }))
  }

  if (!job) return null

  const guidance = draft.salaryGuidance
  const hasDrafts = hasUploadDetailsContent(draft) || Boolean(guidance?.suggestedRange?.trim())

  const isBusy = isGeneratingAll || isSaving || regeneratingField !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        busy={isBusy}
        className="flex h-[min(92vh,880px)] max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden p-0 gap-0 sm:max-w-3xl"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Upload Details</DialogTitle>
          <DialogDescription>
            Draft answers for application form questions — tailored to{" "}
            <span className="font-medium text-foreground">
              {role?.jobTitle || job.jobTitle}
            </span>{" "}
            at{" "}
            <span className="font-medium text-foreground">{role?.company || job.company}</span>.
            Nothing is submitted automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-6">
          {isGeneratingAll ? (
            <AiWizardProgress
              variant="scoped-overlay"
              phases={[
                {
                  title: "Reading your CV and job description",
                  detail: "Understanding role fit and your background.",
                },
                {
                  title: "Drafting form answers",
                  detail: "Writing motivation, availability, and fit statements.",
                },
                {
                  title: "Estimating salary guidance",
                  detail: "Preparing conservative and confident answer options.",
                },
              ]}
              headline="AI is drafting your upload answers…"
              footnote="Please keep this dialog open while generation runs."
              className="!mt-0"
            />
          ) : null}
          <div className={cn("py-5 space-y-5", isGeneratingAll && "pointer-events-none opacity-40")}>
            <div className="rounded-lg border border-[var(--brand-teal)]/30 bg-[var(--brand-teal-bg)]/40 px-4 py-3 text-sm text-muted-foreground">
              <p>
                AI can help draft answers, but you should review all details before submitting.
              </p>
              {syncOffline && (
                <p className="mt-2 flex items-start gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  Cloud sync is unavailable — changes are saved on this device until Supabase
                  reconnects.
                </p>
              )}
            </div>

            {!hasResume && !hasJobDescription && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                Add a <strong>job description</strong> or <strong>CV</strong> to this application
                before generating drafts.
              </div>
            )}

            {!hasResume && hasJobDescription && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                No CV is linked yet. Drafts will use the job description and your notes, but fit
                answers will be less specific until you add a CV.
              </div>
            )}

            {generationMessage && (
              <div
                role="status"
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  generationMessage.type === "error" &&
                    "border-destructive/40 bg-destructive/10 text-destructive",
                  generationMessage.type === "info" &&
                    "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                  generationMessage.type === "success" &&
                    "border-[var(--brand-teal)]/40 bg-[var(--brand-teal-bg)]/50 text-[var(--brand-teal-text)]",
                )}
              >
                {generationMessage.text}
              </div>
            )}

            <section className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Your profile</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Saved to your profile and used when drafting availability answers.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-details-notice-period" className="text-sm">
                  Notice period
                </Label>
                <Input
                  id="upload-details-notice-period"
                  placeholder="e.g. 3 months, available from 1 September 2026"
                  value={noticePeriod}
                  onChange={(e) => handleNoticePeriodChange(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <OutputLanguageToggle
                language={outputLanguage}
                onChange={setOutputLanguage}
                label="Answer language"
                description="Generate form answers in English or German."
              />
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleGenerateAll()}
                disabled={isGeneratingAll || (!hasResume && !hasJobDescription)}
                className="h-10"
              >
                {isGeneratingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {hasDrafts ? "Regenerate all drafts" : "Generate drafts"}
              </Button>
            </div>

            {guidance && (
              <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold">Salary guidance</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Salary guidance is an estimate and should be checked against current market data
                    before submission.
                  </p>
                </div>
                {guidance.suggestedRange && (
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Suggested range
                    </p>
                    <p className="text-sm font-semibold">{guidance.suggestedRange}</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["conservativeAnswer", "Conservative answer"],
                      ["confidentAnswer", "Confident answer"],
                      ["flexibleAnswer", "Flexible answer"],
                    ] as const
                  ).map(([key, label]) =>
                    guidance[key]?.trim() ? (
                      <div key={key} className="rounded-md border bg-background p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <p className="text-sm whitespace-pre-wrap">{guidance[key]}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => void handleCopy(guidance[key]!, label)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </Button>
                      </div>
                    ) : null,
                  )}
                </div>
                {guidance.assumptions && guidance.assumptions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Assumptions</p>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {guidance.assumptions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {UPLOAD_DETAILS_FIELD_META.map((field) => (
              <UploadDetailsFieldEditor
                key={field.key}
                fieldKey={field.key}
                label={field.label}
                description={field.description}
                rows={field.rows}
                value={draft[field.key] ?? ""}
                onChange={(value) => updateField(field.key, value)}
                onCopy={() => void handleCopy(draft[field.key] ?? "", field.label)}
                onRegenerate={() => void handleRegenerateField(field.key)}
                isRegenerating={regeneratingField === field.key}
                disabled={isGeneratingAll}
              />
            ))}
          </div>
        </div>

        <DialogFooter
          className={cn(
            "px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2 sm:justify-between",
          )}
        >
          <p className="text-xs text-muted-foreground text-left sm:max-w-[55%]">
            Copy individual answers into employer forms. Save when you are happy with your edits.
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save to application
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
