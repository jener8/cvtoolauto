"use client"

import type { ApplicationIllustration } from "@/lib/application-story-wizard/types"
import { cn } from "@/lib/utils"

type IllustrationViewProps = {
  illustration: ApplicationIllustration
  selectedHotspotId?: string | null
  highlightedEvidenceIds?: string[]
  onSelectHotspot?: (hotspotId: string) => void
  className?: string
}

export function IllustrationView({
  illustration,
  selectedHotspotId,
  highlightedEvidenceIds = [],
  onSelectHotspot,
  className,
}: IllustrationViewProps) {
  return (
    <div className={cn("illustration-view relative overflow-hidden rounded-2xl border bg-muted/20", className)}>
      {illustration.imageDataUrl ? (
        <div className="relative aspect-square w-full max-w-2xl mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustration.imageDataUrl}
            alt="Conceptual illustration of your application story"
            className="h-full w-full object-cover"
          />
          {illustration.hotspots.map((hotspot) => {
            const isSelected = selectedHotspotId === hotspot.id
            const hasHighlight = hotspot.evidenceIds.some((id) =>
              highlightedEvidenceIds.includes(id),
            )
            return (
              <button
                key={hotspot.id}
                type="button"
                title={hotspot.label}
                className={cn(
                  "absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform",
                  isSelected || hasHighlight
                    ? "border-[var(--color-primary-light)] bg-[var(--color-primary-light)]/30 scale-125"
                    : "border-white bg-white/80 hover:scale-110",
                )}
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                onClick={() => onSelectHotspot?.(hotspot.id)}
                aria-label={hotspot.label}
              />
            )
          })}
        </div>
      ) : (
        <div className="flex aspect-square max-w-2xl mx-auto flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-foreground">Illustration not generated yet</p>
          <p className="max-w-md text-xs text-muted-foreground">{illustration.prompt}</p>
        </div>
      )}
      {selectedHotspotId ? (
        <div className="border-t bg-white px-4 py-3 text-sm">
          {illustration.hotspots
            .filter((h) => h.id === selectedHotspotId)
            .map((h) => (
              <p key={h.id}>
                <span className="font-medium">{h.label}</span>
                {h.symbolism ? ` — ${h.symbolism}` : null}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  )
}
