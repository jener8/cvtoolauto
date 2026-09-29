"use client"

import { Button } from "@/components/ui/button"
import { BookOpen, Info, Shield, Sparkles } from "lucide-react"

export function TrustComplianceToolbar({
  onScrollToTransparency,
  onOpenHowAiWorks,
  onOpenAiLiteracyGuide,
  onOpenPrivacyCentre,
}: {
  onScrollToTransparency?: () => void
  onOpenHowAiWorks: () => void
  onOpenAiLiteracyGuide: () => void
  onOpenPrivacyCentre: () => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2"
      role="toolbar"
      aria-label="AI transparency and data protection"
    >
      <span className="ui-meta font-semibold uppercase tracking-wide text-[var(--accent-primary)] mr-1 shrink-0">
        Trust &amp; privacy
      </span>
      {onScrollToTransparency && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-11 min-h-11 text-xs gap-1.5"
          onClick={onScrollToTransparency}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI Transparency
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ui-utility-btn h-11 min-h-11 text-xs gap-1.5"
        onClick={onOpenHowAiWorks}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        How AI is used
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ui-utility-btn h-11 min-h-11 text-xs gap-1.5"
        onClick={onOpenAiLiteracyGuide}
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden />
        AI Literacy Guide
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ui-utility-btn h-11 min-h-11 text-xs gap-1.5"
        onClick={onOpenPrivacyCentre}
      >
        <Shield className="h-3.5 w-3.5" aria-hidden />
        Privacy Centre
      </Button>
    </div>
  )
}
