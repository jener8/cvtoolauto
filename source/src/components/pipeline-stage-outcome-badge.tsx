"use client"

import type { ApplicationStage, StageOutcome } from "@/lib/application-pipeline"
import {
  getOutcomeVisual,
  getPipelineCardLabel,
  getStageShortLabel,
} from "@/lib/application-pipeline-ui"
import { getStageOutcomeLabel, type Language } from "@/lib/translations"
import { cn } from "@/lib/utils"

export interface PipelineStageOutcomeBadgeProps {
  stage: ApplicationStage
  outcome: StageOutcome
  language: Language
  size?: "sm" | "md"
  className?: string
}

export function PipelineStageOutcomeBadge({
  stage,
  outcome,
  language,
  size = "sm",
  className,
}: PipelineStageOutcomeBadgeProps) {
  const visual = getOutcomeVisual(outcome)
  const textSize = size === "md" ? "text-sm" : "text-xs"
  const pad = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5"

  const label = `${getStageShortLabel(language, stage)} · ${getStageOutcomeLabel(language, outcome)}`

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center",
        textSize,
        pad,
        visual.badgeClass,
        className,
      )}
      title={getPipelineCardLabel(language, stage, outcome)}
    >
      <span className="ui-status-pill__dot" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}
