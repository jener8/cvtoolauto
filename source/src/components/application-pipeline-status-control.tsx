"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ApplicationStage, StageOutcome } from "@/lib/application-pipeline"
import {
  getOutcomeVisual,
  getStageOutcomeDescription,
  getStageShortLabel,
  STAGE_OUTCOMES,
} from "@/lib/application-pipeline-ui"
import { getStageOutcomeLabel, type Language } from "@/lib/translations"
import { cn } from "@/lib/utils"
import { Check, ChevronDown } from "lucide-react"
import { PipelineStageOutcomeBadge } from "@/components/pipeline-stage-outcome-badge"

export interface ApplicationPipelineStatusControlProps {
  stage: ApplicationStage
  outcome: StageOutcome
  language: Language
  onOutcomeChange: (outcome: StageOutcome) => void
  className?: string
}

export function ApplicationPipelineStatusControl({
  stage,
  outcome,
  language,
  onOutcomeChange,
  className,
}: ApplicationPipelineStatusControlProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-auto min-h-11 gap-1.5 border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-none",
            className,
          )}
          aria-label={`Update outcome for ${getStageShortLabel(language, stage)}. Current: ${getStageOutcomeLabel(language, outcome)}`}
        >
          <PipelineStageOutcomeBadge stage={stage} outcome={outcome} language={language} size="md" />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,22rem)] p-0 overflow-hidden"
      >
        <div className="border-b bg-muted/40 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {language === "de" ? "Aktuelle Stufe" : "Current stage"}
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {getStageShortLabel(language, stage)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {language === "de"
              ? "Wähle das Ergebnis für diese Stufe:"
              : "Set the outcome for this stage:"}
          </p>
        </div>
        <div className="p-1.5 space-y-1 max-h-80 overflow-y-auto">
          {STAGE_OUTCOMES.map((option) => (
            <OutcomeMenuOption
              key={option}
              stage={stage}
              outcome={option}
              selected={option === outcome}
              language={language}
              onSelect={() => onOutcomeChange(option)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function OutcomeOptionGrid({
  stage,
  outcome,
  language,
  onOutcomeChange,
}: {
  stage: ApplicationStage
  outcome: StageOutcome
  language: Language
  onOutcomeChange: (outcome: StageOutcome) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {language === "de"
          ? `Ergebnis für ${getStageShortLabel(language, stage)}:`
          : `Outcome for ${getStageShortLabel(language, stage)}:`}
      </p>
      <div className="grid gap-1.5">
        {STAGE_OUTCOMES.map((option) => (
          <OutcomeMenuOption
            key={option}
            stage={stage}
            outcome={option}
            selected={option === outcome}
            language={language}
            onSelect={() => onOutcomeChange(option)}
          />
        ))}
      </div>
    </div>
  )
}

function OutcomeMenuOption({
  stage,
  outcome,
  selected,
  language,
  onSelect,
}: {
  stage: ApplicationStage
  outcome: StageOutcome
  selected: boolean
  language: Language
  onSelect: () => void
}) {
  const visual = getOutcomeVisual(outcome)
  const Icon = visual.icon
  const description = getStageOutcomeDescription(language, stage, outcome)

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected ? visual.menuSelectedClass : visual.menuClass,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base",
          selected ? visual.badgeClass : "bg-muted/80",
        )}
        aria-hidden
      >
        <Icon className={cn("h-4 w-4", visual.iconClass)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {getStageOutcomeLabel(language, outcome)}
          </span>
          <span className="text-sm" aria-hidden>
            {visual.emoji}
          </span>
          {selected && (
            <Check className="h-4 w-4 shrink-0 text-foreground" aria-label="Selected" />
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}
