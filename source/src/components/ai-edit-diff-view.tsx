"use client"

import { computeTextLineDiff, countDiffStats } from "@/lib/text-line-diff"
import { cn } from "@/lib/utils"
import { ArrowDown } from "lucide-react"

export function AiEditDiffView({
  previousText,
  proposedText,
  previousLabel = "Current text",
  proposedLabel = "Proposed text",
  compact = false,
}: {
  previousText: string
  proposedText: string
  previousLabel?: string
  proposedLabel?: string
  compact?: boolean
}) {
  const diffLines = computeTextLineDiff(previousText, proposedText)
  const stats = countDiffStats(diffLines)
  const hasChanges = stats.added > 0 || stats.removed > 0

  if (!hasChanges && previousText.trim() === proposedText.trim()) {
    return (
      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        No visible text changes detected.
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <DiffColumn label={previousLabel} text={previousText} variant="before" />
        <div className="flex justify-center text-muted-foreground" aria-hidden>
          <ArrowDown className="h-4 w-4" />
        </div>
        <DiffColumn label={proposedLabel} text={proposedText} variant="after" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700">
          +{stats.added} added
        </span>
        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
          −{stats.removed} removed
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          <div className="min-w-0">
            <p className="border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {previousLabel}
            </p>
            <div className="max-h-56 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
              {diffLines.map((line, index) =>
                line.type === "insert" ? null : (
                  <div
                    key={`before-${index}`}
                    className={cn(
                      "whitespace-pre-wrap rounded px-1 py-0.5",
                      line.type === "delete" && "bg-destructive/10 text-destructive line-through",
                      line.type === "equal" && "text-muted-foreground",
                    )}
                  >
                    {line.text || " "}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="min-w-0">
            <p className="border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {proposedLabel}
            </p>
            <div className="max-h-56 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
              {diffLines.map((line, index) =>
                line.type === "delete" ? null : (
                  <div
                    key={`after-${index}`}
                    className={cn(
                      "whitespace-pre-wrap rounded px-1 py-0.5",
                      line.type === "insert" && "bg-emerald-500/10 text-emerald-800",
                      line.type === "equal" && "text-foreground",
                    )}
                  >
                    {line.text || " "}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DiffColumn({
  label,
  text,
  variant,
}: {
  label: string
  text: string
  variant: "before" | "after"
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <p className="border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre
        className={cn(
          "max-h-48 overflow-y-auto p-3 text-[11px] leading-relaxed whitespace-pre-wrap",
          variant === "before" ? "text-muted-foreground bg-destructive/5" : "text-foreground bg-emerald-500/5",
        )}
      >
        {text.trim() || "(empty)"}
      </pre>
    </div>
  )
}
