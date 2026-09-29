"use client"

import { AiEditDiffView } from "@/components/ai-edit-diff-view"
import { Badge } from "@/components/ui/badge"
import type { AiExplainability } from "@/lib/ai-transparency"
import { confidenceLabel } from "@/lib/ai-transparency"
import type { CvEditChange } from "@/lib/cv-edit-types"
import type { AiEditReviewStatus } from "@/lib/ai-edit-review"
import { Check } from "lucide-react"

export function AiEditReviewPanel({
  documentLabel,
  proposedChanges,
  changes,
  previousText,
  proposedText,
  selectionReplacement,
  selectionContext,
  summary,
  model,
  providerLabel,
  timestamp,
  status,
  explainability,
}: {
  documentLabel: "Resume" | "Cover Letter"
  proposedChanges: string[]
  changes: CvEditChange[]
  previousText: string
  proposedText: string
  selectionReplacement?: string
  selectionContext?: string
  summary?: string
  model?: string
  providerLabel?: string
  timestamp?: number
  status: AiEditReviewStatus
  explainability?: AiExplainability
}) {
  const isSelection = Boolean(selectionReplacement?.trim())
  const beforeText = isSelection ? (selectionContext || previousText) : previousText
  const afterText = isSelection ? selectionReplacement! : proposedText

  return (
    <div
      className="rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-3 text-xs space-y-4"
      role="region"
      aria-label={`${documentLabel} edit review`}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {status === "pending"
            ? `Review ${documentLabel.toLowerCase()} changes`
            : status === "applied"
              ? `${documentLabel} updated`
              : `${documentLabel} change rejected`}
        </p>
        {summary?.trim() && status === "pending" ? (
          <p className="text-muted-foreground leading-relaxed">{summary}</p>
        ) : null}
      </div>

      {proposedChanges.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            What I would change
          </p>
          <ul className="space-y-1.5">
            {proposedChanges.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-foreground leading-relaxed">
                <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "pending" && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Before and after
          </p>
          <AiEditDiffView
            previousText={beforeText}
            proposedText={afterText}
            previousLabel="Current text"
            proposedLabel="Proposed text"
            compact={isSelection}
          />
        </div>
      )}

      {changes.length > 0 && status !== "pending" && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Changes recorded
          </p>
          {changes.slice(0, 4).map((change, index) => (
            <p key={index} className="text-muted-foreground">
              {change.description ?? `${change.section}: ${change.type}`}
            </p>
          ))}
        </div>
      )}

      {(explainability || model || timestamp) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
          {explainability?.rationale && proposedChanges.length === 0 ? (
            <p className="text-muted-foreground leading-relaxed w-full">
              {explainability.rationale}
            </p>
          ) : null}
          <Badge variant="outline" className="text-[10px] font-normal">
            Confidence: {confidenceLabel(explainability?.confidence)}
          </Badge>
          {model ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {model}
            </Badge>
          ) : null}
          {providerLabel ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {providerLabel}
            </Badge>
          ) : null}
          {timestamp ? (
            <time
              className="text-[10px] text-muted-foreground"
              dateTime={new Date(timestamp).toISOString()}
            >
              {new Date(timestamp).toLocaleString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          ) : null}
        </div>
      )}
    </div>
  )
}
