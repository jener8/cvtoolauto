"use client"

import { useState } from "react"
import { AiEditReviewPanel } from "@/components/ai-edit-review-panel"
import { AiMarkdownContent } from "@/components/ai/ai-markdown-content"
import { CvEditDiffDialog } from "@/components/cv-edit-diff-dialog"
import { Button } from "@/components/ui/button"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"
import type { AiEditReviewStatus } from "@/lib/ai-edit-review"
import { cn } from "@/lib/utils"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GitCompare,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"

import type { AssistantDocumentContext } from "@/lib/assistant-selection-context"

const COLLAPSE_THRESHOLD = 700

export interface AiCareerChatMessageProps {
  message: AssistantChatMessage
  documentContext?: AssistantDocumentContext
  onApplyRecommendations?: (messageId: string) => void
  onPreviewRecommendations?: (messageId: string) => void
  onExplainRecommendations?: (messageId: string) => void
  onDismissAdvice?: (messageId: string) => void
  onApplyPendingEdit?: (messageId: string) => void
  onInsertResumeVersion?: (messageId: string) => void
  onConfirmRiskyEdit?: (messageId: string) => void
  onConfirmBypassValidation?: (messageId: string) => void
  onRejectEdit?: (messageId: string) => void
  onUndoEdit?: (messageId: string) => void
  onKeepEdit?: (messageId: string) => void
  onApplyCoverLetter?: (messageId: string) => void
  onInsertCoverLetterVersion?: (messageId: string) => void
  onRejectCoverLetterEdit?: (messageId: string) => void
}

export function AiCareerChatMessage({
  message,
  documentContext = "resume",
  onApplyRecommendations,
  onPreviewRecommendations,
  onExplainRecommendations,
  onDismissAdvice,
  onApplyPendingEdit,
  onInsertResumeVersion,
  onConfirmRiskyEdit,
  onConfirmBypassValidation,
  onRejectEdit,
  onUndoEdit,
  onKeepEdit,
  onApplyCoverLetter,
  onInsertCoverLetterVersion,
  onRejectCoverLetterEdit,
}: AiCareerChatMessageProps) {
  const isUser = message.role === "user"
  const isError = message.status === "error"
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showFullDiff, setShowFullDiff] = useState(false)

  const edit = message.cvEdit
  const letterEdit = message.coverLetterEdit
  const activeEdit = letterEdit ?? edit

  const isAdvice =
    (message.mode === "career_advice" || message.mode === "application_analysis") &&
    message.canApplyRecommendations &&
    !message.adviceDismissed

  const isRiskyPending = Boolean(
    edit?.pendingConfirmation && edit.riskReasons?.length && !edit.applied && !edit.rejected,
  )

  const isValidationOverridePending = Boolean(
    edit?.requiresValidationOverride && edit.pendingConfirmation && !edit.applied && !edit.rejected,
  )

  const isResumePending = Boolean(
    edit?.pendingConfirmation && !edit.applied && !edit.rejected,
  )

  const isLetterPending = Boolean(
    letterEdit?.pendingConfirmation && !letterEdit.applied && !letterEdit.rejected,
  )

  const isPending = isResumePending || isLetterPending
  const isApplied = Boolean(edit?.applied || letterEdit?.applied)
  const isRejected = Boolean(edit?.rejected || letterEdit?.rejected)

  const documentLabel = letterEdit ? "Cover Letter" : "Resume"
  const adviceApplyLabel =
    documentContext === "cover_letter"
      ? "Apply recommendations to cover letter"
      : "Apply recommendations to CV"

  const reviewStatus: AiEditReviewStatus = isApplied
    ? "applied"
    : isRejected
      ? "rejected"
      : "pending"

  const proposedText =
    letterEdit?.selectionReplacement?.trim() ||
    letterEdit?.newLetterText ||
    edit?.newResumeText ||
    ""

  const previousText =
    letterEdit?.previousLetterText || edit?.previousResumeText || ""

  const proposedChanges =
    activeEdit?.proposedChanges ??
    (activeEdit?.changes?.map((c) => c.description ?? `${c.section}: ${c.type}`) ?? [])

  const isLong = !isUser && message.content.length > COLLAPSE_THRESHOLD
  const displayContent =
    isLong && !expanded ? `${message.content.slice(0, COLLAPSE_THRESHOLD).trim()}…` : message.content

  const handleCopyProposed = async () => {
    if (!proposedText.trim()) return
    try {
      await navigator.clipboard.writeText(proposedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleCopyReply = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const showEditReview = Boolean(activeEdit && (isPending || isApplied || isRejected))

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isRejected && "AI suggestion rejected. Your document was not modified."}
        {isApplied && `AI changes accepted and applied to your ${documentLabel.toLowerCase()}.`}
        {isPending && "AI suggestion awaiting your review."}
      </div>

      <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "w-full max-w-full rounded-2xl px-4 py-3 shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md max-w-[95%]"
              : isError
                ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-md"
                : "bg-card text-foreground border border-border/70 rounded-bl-md",
          )}
        >
          {message.selectionContext && isUser && (
            <p className="mb-2 text-[11px] opacity-80 border-b border-primary-foreground/20 pb-2">
              Using selection: &ldquo;{message.selectionContext.slice(0, 120)}
              {message.selectionContext.length > 120 ? "…" : ""}&rdquo;
            </p>
          )}

          {isUser || isError ? (
            <span className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="space-y-3">
              {message.intent && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {message.intent}
                </p>
              )}

              {showEditReview && activeEdit ? (
                <AiEditReviewPanel
                  documentLabel={documentLabel}
                  proposedChanges={proposedChanges}
                  changes={activeEdit.changes}
                  previousText={previousText}
                  proposedText={letterEdit?.newLetterText ?? edit?.newResumeText ?? ""}
                  selectionReplacement={letterEdit?.selectionReplacement ?? edit?.selectionReplacement ?? message.selectionReplacement}
                  selectionContext={message.selectionContext}
                  summary={activeEdit.summary}
                  model={activeEdit.model}
                  providerLabel={activeEdit.providerLabel}
                  timestamp={message.timestamp}
                  status={reviewStatus}
                  explainability={activeEdit.explainability}
                />
              ) : (
                <AiMarkdownContent content={displayContent} />
              )}

              {!showEditReview && isLong && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      Show full answer
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {!isUser && !isError && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
              {isLetterPending && (
                <>
                  {onApplyCoverLetter && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onApplyCoverLetter(message.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply to Cover Letter
                    </Button>
                  )}
                  {onInsertCoverLetterVersion && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onInsertCoverLetterVersion(message.id)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Insert as New Version
                    </Button>
                  )}
                  {proposedText.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => void handleCopyProposed()}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy Text"}
                    </Button>
                  ) : null}
                  {onRejectCoverLetterEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground"
                      onClick={() => onRejectCoverLetterEdit(message.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                    onClick={() => setShowFullDiff(true)}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Full diff
                  </Button>
                </>
              )}

              {isResumePending && !letterEdit && (
                <>
                  {isValidationOverridePending && onConfirmBypassValidation ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onConfirmBypassValidation(message.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply anyway
                    </Button>
                  ) : null}
                  {isRiskyPending && onConfirmRiskyEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onConfirmRiskyEdit(message.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply to Resume
                    </Button>
                  ) : onApplyPendingEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onApplyPendingEdit(message.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isValidationOverridePending ? "Apply cleaned version" : "Apply to Resume"}
                    </Button>
                  ) : null}
                  {onInsertResumeVersion && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onInsertResumeVersion(message.id)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Insert as New Version
                    </Button>
                  )}
                  {proposedText.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => void handleCopyProposed()}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy Text"}
                    </Button>
                  ) : null}
                  {onRejectEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground"
                      onClick={() => onRejectEdit(message.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                    onClick={() => setShowFullDiff(true)}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Full diff
                  </Button>
                </>
              )}

              {isAdvice && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => onApplyRecommendations?.(message.id)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {adviceApplyLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => onPreviewRecommendations?.(message.id)}
                  >
                    Preview changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => onExplainRecommendations?.(message.id)}
                  >
                    Explain changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                    onClick={() => onDismissAdvice?.(message.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                </>
              )}

              {isApplied && onUndoEdit && edit?.applied && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onUndoEdit(message.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore previous version
                </Button>
              )}

              {isApplied && onKeepEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onKeepEdit(message.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Keep this version
                </Button>
              )}

              {!isPending && !isAdvice && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => void handleCopyReply()}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy answer"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {edit && (
        <CvEditDiffDialog
          open={showFullDiff}
          onOpenChange={setShowFullDiff}
          changes={edit.changes}
          previousResumeText={edit.previousResumeText}
          newResumeText={edit.newResumeText}
          title="Resume changes"
        />
      )}
      {letterEdit && (
        <CvEditDiffDialog
          open={showFullDiff}
          onOpenChange={setShowFullDiff}
          changes={letterEdit.changes}
          previousResumeText={letterEdit.previousLetterText}
          newResumeText={letterEdit.newLetterText}
          title="Cover letter changes"
        />
      )}
    </>
  )
}
