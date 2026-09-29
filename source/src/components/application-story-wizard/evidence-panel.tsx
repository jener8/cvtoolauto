"use client"

import type { YourStoryCvEvidenceItem } from "@/lib/types"
import { YOUR_STORY_SUPPORT_LABELS } from "@/lib/your-story"
import { cn } from "@/lib/utils"

type EvidencePanelProps = {
  evidence: YourStoryCvEvidenceItem[]
  highlightedIds?: string[]
  selectedEvidenceId?: string | null
  onSelectEvidence?: (id: string) => void
  outputLanguage: "en" | "de"
  className?: string
}

function supportTone(level: YourStoryCvEvidenceItem["supportLevel"]): "ok" | "warn" | "risk" {
  return YOUR_STORY_SUPPORT_LABELS[level].tone
}

export function EvidencePanel({
  evidence,
  highlightedIds = [],
  selectedEvidenceId,
  onSelectEvidence,
  outputLanguage,
  className,
}: EvidencePanelProps) {
  const lang = outputLanguage === "de" ? "de" : "en"

  if (!evidence.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No evidence mapping yet. Run the wizard to link story claims to your CV.
      </p>
    )
  }

  return (
    <ul className={cn("your-story-evidence-list space-y-3", className)} aria-label="CV evidence mapping">
      {evidence.map((item) => {
        const isHighlighted = highlightedIds.includes(item.id) || selectedEvidenceId === item.id
        const labels = YOUR_STORY_SUPPORT_LABELS[item.supportLevel]
        return (
          <li
            key={item.id}
            className={cn(
              "your-story-evidence-item rounded-xl border p-4 transition-colors",
              isHighlighted ? "border-[var(--color-primary-light)] bg-[var(--color-primary-light)]/5" : "border-border bg-card",
              onSelectEvidence && "cursor-pointer hover:border-[var(--color-primary-light)]/50",
            )}
            onClick={() => onSelectEvidence?.(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelectEvidence?.(item.id)
            }}
            role={onSelectEvidence ? "button" : undefined}
            tabIndex={onSelectEvidence ? 0 : undefined}
          >
            <div className="your-story-evidence-item__top flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "your-story-evidence-badge",
                  `your-story-evidence-badge--${supportTone(item.supportLevel)}`,
                )}
              >
                {labels[lang]}
              </span>
              <span className="your-story-evidence-item__section text-xs text-muted-foreground">
                {item.cvSection}
              </span>
            </div>
            <p className="your-story-evidence-item__story mt-2 text-sm">{item.storyExcerpt}</p>
            <p className="your-story-evidence-item__cv mt-2 text-xs text-muted-foreground">
              CV: {item.cvReference}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
