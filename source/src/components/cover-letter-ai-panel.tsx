"use client"

import { useState } from "react"
import { generateCoverLetter } from "@/app/actions/generate-cover-letter"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  logCoverLetterAiActivity,
  type CoverLetterAiMetadata,
} from "@/lib/cover-letter-ai"
import { loadStrategicProfile } from "@/lib/strategic-profile"
import type { ResumeVersion } from "@/lib/types"
import { Check, FileEdit, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { AiWizardProgress } from "@/components/ai-wizard-progress"

function formatGeneratedAt(ts?: number): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CoverLetterAiTransparencyNote({
  metadata,
}: {
  metadata: CoverLetterAiMetadata | null
}) {
  if (!metadata) return null
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs space-y-1.5"
      role="note"
      aria-label="AI generation transparency"
    >
      <p className="font-medium text-foreground">AI-generated text must be reviewed before sending.</p>
      <div className="flex flex-wrap gap-2 text-muted-foreground">
        <span>
          Model: <strong className="text-foreground">{metadata.model}</strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          Generated:{" "}
          <time dateTime={new Date(metadata.generatedAt).toISOString()}>
            {formatGeneratedAt(metadata.generatedAt)}
          </time>
        </span>
        {metadata.providerLabel && (
          <>
            <span aria-hidden>·</span>
            <span>Provider: {metadata.providerLabel}</span>
          </>
        )}
      </div>
    </div>
  )
}

type CoverLetterGenerationContact = {
  applicantName?: string
  applicantEmail?: string
  applicantAddress?: string
  applicantPhone?: string
  contactPerson?: string
}

type GenerateStepProps = CoverLetterGenerationContact & {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  resumeVersions?: ResumeVersion[]
  selectedResumeVersionId?: string
  onResumeVersionChange?: (id: string) => void
  hasExistingContent: boolean
  folderId?: string
  documentName?: string
  onGenerated: (text: string, metadata: CoverLetterAiMetadata) => void
  onSaveVersionBeforeReplace?: () => void
  embedded?: boolean
}

export function CoverLetterGenerateStep({
  language,
  jobTitle,
  company,
  jobDescription,
  resumeContent,
  applicantName,
  applicantEmail,
  applicantAddress,
  applicantPhone,
  contactPerson,
  resumeVersions,
  selectedResumeVersionId,
  onResumeVersionChange,
  hasExistingContent,
  folderId,
  documentName,
  onGenerated,
  onSaveVersionBeforeReplace,
  embedded = false,
}: GenerateStepProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)

  const runGeneration = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await generateCoverLetter({
        language,
        jobTitle,
        company,
        jobDescription,
        resumeContent,
        strategicProfile: loadStrategicProfile(),
        bodyOnly: true,
        applicantName,
        applicantEmail,
        applicantAddress,
        applicantPhone,
        contactPerson,
      })

      if (!result.success || !result.coverLetterText) {
        setError(result.error ?? "Cover letter generation failed.")
        toast({
          title: "Generation failed",
          description: result.error ?? "Could not generate cover letter.",
          variant: "destructive",
        })
        return
      }

      const metadata: CoverLetterAiMetadata = {
        model: result.model ?? "Unknown",
        provider: result.provider ?? "unknown",
        providerLabel: result.providerLabel,
        generatedAt: result.generatedAt ?? Date.now(),
        status: "pending_review",
      }

      logCoverLetterAiActivity({
        folderId,
        action: "Generated Cover Letter",
        model: metadata.model,
        provider: metadata.provider,
        approvalStatus: "pending",
        documentName,
      })

      onGenerated(result.coverLetterText, metadata)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cover letter generation failed."
      setError(message)
      toast({ title: "Generation failed", description: message, variant: "destructive" })
    } finally {
      setIsGenerating(false)
      setShowReplaceDialog(false)
    }
  }

  const handleGenerateClick = () => {
    if (hasExistingContent) {
      setShowReplaceDialog(true)
      return
    }
    void runGeneration()
  }

  const body = (
    <div className="space-y-4">
          {isGenerating ? (
            <AiWizardProgress
              phases={[
                {
                  title: "Reading your resume and job description",
                  detail: "Understanding role fit and your strongest evidence.",
                },
                {
                  title: "Drafting a tailored cover letter",
                  detail: "Writing a professional letter in your chosen language.",
                },
                {
                  title: "Polishing tone and structure",
                  detail: "Making it ready for your review.",
                },
              ]}
              headline="AI is writing your cover letter…"
              footnote="This usually takes under a minute. Please keep this tab open."
            />
          ) : null}

          {resumeVersions && resumeVersions.length > 0 && onResumeVersionChange && (
            <div className="space-y-2">
              <Label>Resume used for generation</Label>
              <Select value={selectedResumeVersionId} onValueChange={onResumeVersionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resume" />
                </SelectTrigger>
                <SelectContent>
                  {resumeVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Role: </span>
              <span className="font-medium">{jobTitle || "—"}</span>
              {company ? ` at ${company}` : ""}
            </p>
            <p className="text-muted-foreground text-xs line-clamp-2">
              Job description: {jobDescription.trim() ? `${jobDescription.slice(0, 140)}…` : "Not set"}
            </p>
          </div>

          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-busy={isGenerating}
          >
            {isGenerating ? "AI is writing your cover letter…" : ""}
          </div>

          {!isGenerating ? (
          <Button
            type="button"
            onClick={handleGenerateClick}
            disabled={!resumeContent.trim() || !jobDescription.trim()}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Generate cover letter
          </Button>
          ) : null}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            AI-generated text must be reviewed before sending. You can edit, regenerate, or reject the
            result on the next step.
          </p>
    </div>
  )

  return (
    <>
      {embedded ? (
        body
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              Generate Cover Letter
            </CardTitle>
            <CardDescription>
              AI writes a tailored cover letter using your selected resume and the saved job description.
              Your resume is not modified.
            </CardDescription>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      )}

      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing cover letter?</AlertDialogTitle>
            <AlertDialogDescription>
              This application already has cover letter content. Choose whether to replace it or keep
              the previous version in history before generating a new draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onSaveVersionBeforeReplace?.()
                void runGeneration()
              }}
            >
              Create new version
            </Button>
            <Button type="button" onClick={() => void runGeneration()}>
              Replace existing
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type ReviewStepProps = CoverLetterGenerationContact & {
  content: string
  onContentChange: (text: string) => void
  metadata: CoverLetterAiMetadata | null
  onMetadataChange: (metadata: CoverLetterAiMetadata | null) => void
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  hasExistingContent: boolean
  folderId?: string
  documentName?: string
  onAccepted?: () => void
  onBackToGenerate: () => void
  onCreateVersionBeforeRegenerate?: () => void
  embedded?: boolean
}

export function CoverLetterReviewStep({
  content,
  onContentChange,
  metadata,
  onMetadataChange,
  language,
  jobTitle,
  company,
  jobDescription,
  resumeContent,
  applicantName,
  applicantEmail,
  applicantAddress,
  applicantPhone,
  contactPerson,
  hasExistingContent,
  folderId,
  documentName,
  onAccepted,
  onBackToGenerate,
  onCreateVersionBeforeRegenerate,
  embedded = false,
}: ReviewStepProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)

  const regenerate = async (saveVersionFirst: boolean) => {
    if (saveVersionFirst && onCreateVersionBeforeRegenerate) {
      onCreateVersionBeforeRegenerate()
    }
    setIsRegenerating(true)
    try {
      const result = await generateCoverLetter({
        language,
        jobTitle,
        company,
        jobDescription,
        resumeContent,
        strategicProfile: loadStrategicProfile(),
        bodyOnly: true,
        applicantName,
        applicantEmail,
        applicantAddress,
        applicantPhone,
        contactPerson,
      })
      if (!result.success || !result.coverLetterText) {
        toast({
          title: "Regeneration failed",
          description: result.error ?? "Could not regenerate cover letter.",
          variant: "destructive",
        })
        return
      }
      onContentChange(result.coverLetterText)
      onMetadataChange({
        model: result.model ?? "Unknown",
        provider: result.provider ?? "unknown",
        providerLabel: result.providerLabel,
        generatedAt: result.generatedAt ?? Date.now(),
        status: "pending_review",
      })
      logCoverLetterAiActivity({
        folderId,
        action: "Regenerated Cover Letter",
        model: result.model ?? "Unknown",
        provider: result.provider ?? "unknown",
        approvalStatus: "pending",
        documentName,
      })
    } finally {
      setIsRegenerating(false)
      setShowRegenerateDialog(false)
    }
  }

  const handleAccept = () => {
    if (metadata) {
      onMetadataChange({
        ...metadata,
        status: "accepted",
        acceptedAt: Date.now(),
      })
      logCoverLetterAiActivity({
        folderId,
        action: "Accepted Cover Letter",
        model: metadata.model,
        provider: metadata.provider,
        approvalStatus: "approved",
        documentName,
      })
    }
    onAccepted?.()
  }

  const handleReject = () => {
    if (metadata) {
      logCoverLetterAiActivity({
        folderId,
        action: "Rejected Cover Letter",
        model: metadata.model,
        provider: metadata.provider,
        approvalStatus: "rejected",
        documentName,
      })
    }
    onContentChange("")
    onMetadataChange(null)
    onBackToGenerate()
  }

  const reviewBody = (
    <div className="space-y-4">
          <CoverLetterAiTransparencyNote metadata={metadata} />

          {metadata && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[11px]">
                {metadata.providerLabel ?? metadata.provider}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {metadata.model}
              </Badge>
            </div>
          )}

          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[360px] text-sm leading-relaxed"
            aria-label="Cover letter draft"
            disabled={isRegenerating}
          />

          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-busy={isRegenerating}
          >
            {isRegenerating ? "AI is writing your cover letter…" : ""}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={handleAccept} disabled={!content.trim() || isRegenerating} className="gap-1.5">
              <Check className="h-4 w-4" aria-hidden />
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (content.trim() && hasExistingContent) setShowRegenerateDialog(true)
                else void regenerate(false)
              }}
              disabled={isRegenerating}
              className="gap-1.5"
            >
              {isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Regenerate
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReject}
              disabled={isRegenerating}
              className="gap-1.5 text-muted-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
              Reject
            </Button>
          </div>
    </div>
  )

  return (
    <>
      {embedded ? (
        reviewBody
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" aria-hidden />
              Review &amp; Edit
            </CardTitle>
            <CardDescription>
              Review the AI draft, edit if needed, then accept to continue. Your resume stays unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent>{reviewBody}</CardContent>
        </Card>
      )}

      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate cover letter?</AlertDialogTitle>
            <AlertDialogDescription>
              Replace existing cover letter or create a new version?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => void regenerate(true)}>
              Create new version
            </Button>
            <Button type="button" onClick={() => void regenerate(false)}>
              Replace existing
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
