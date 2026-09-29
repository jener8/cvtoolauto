"use client"

import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import "./ai-wizard-progress.css"

export type AiWizardProgressPhase = {
  title: string
  detail: string
}

type AiWizardProgressProps = {
  phases: readonly AiWizardProgressPhase[]
  headline?: string
  footnote?: string
  phaseIntervalMs?: number
  variant?: "panel" | "banner" | "overlay" | "scoped-overlay"
  className?: string
}

function useRotatingPhaseIndex(
  phaseCount: number,
  intervalMs: number,
  enabled = true,
): number {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    if (!enabled || phaseCount <= 1) return
    const id = window.setInterval(() => {
      setPhaseIndex((index) => (index + 1) % phaseCount)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, phaseCount])

  return phaseIndex
}

export function AiWizardProgress({
  phases,
  headline = "AI is working…",
  footnote = "This may take a minute or two. Please keep this tab open.",
  phaseIntervalMs = 3500,
  variant = "panel",
  className,
}: AiWizardProgressProps) {
  const safePhases =
    phases.length > 0
      ? phases
      : [{ title: "Processing your request…", detail: "The AI is analysing your documents." }]
  const phaseIndex = useRotatingPhaseIndex(safePhases.length, phaseIntervalMs)
  const phase = safePhases[phaseIndex]!

  if (variant === "banner") {
    return (
      <div
        className={cn("ai-wizard-banner", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="ai-wizard-banner__track" aria-hidden>
          <div className="ai-wizard-banner__fill" />
        </div>
        <div className="ai-wizard-banner__body">
          <div className="ai-wizard-banner__icon" aria-hidden>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="ai-wizard-banner__text">
            <p className="ai-wizard-banner__headline">{headline}</p>
            <p className="ai-wizard-banner__phase">{phase.title}</p>
          </div>
          <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-[var(--color-primary-light)]" aria-hidden />
        </div>
      </div>
    )
  }

  const panel = (
    <div
      className={cn("ai-wizard-panel", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={headline}
    >
      <div className="ai-wizard-panel__track" aria-hidden>
        <div className="ai-wizard-panel__fill" />
      </div>
      <div className="ai-wizard-panel__inner">
        <div className="ai-wizard-panel__spinner" aria-hidden>
          <div className="ai-wizard-panel__ring" />
          <Sparkles className="ai-wizard-panel__sparkle h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="ai-wizard-panel__title">{headline}</p>
          <p className="ai-wizard-panel__detail">{phase.title}</p>
          <p className="ai-wizard-panel__detail">{phase.detail}</p>
        </div>
        <p className="ai-wizard-panel__footnote">{footnote}</p>
        <div className="ai-wizard-panel__dots" aria-hidden>
          {safePhases.map((_, index) => (
            <span
              key={index}
              className={cn(
                "ai-wizard-panel__dot",
                index === phaseIndex && "ai-wizard-panel__dot--active",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )

  if (variant === "overlay" || variant === "scoped-overlay") {
    return (
      <div
        className={cn(
          "ai-wizard-overlay",
          variant === "scoped-overlay" && "ai-wizard-overlay--scoped",
        )}
        aria-hidden={false}
      >
        {panel}
      </div>
    )
  }

  return panel
}
