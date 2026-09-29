"use client"

import type { JourneyStepState } from "@/lib/workspace-journey-progress"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type JourneyStripProps = {
  steps: Array<{ id: string; label: string; state: JourneyStepState }>
}

export function JourneyStrip({ steps }: JourneyStripProps) {
  return (
    <nav
      className="border-b border-border/60 bg-muted/20 px-6 py-4 lg:px-8"
      aria-label="Your career journey"
    >
      <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium sm:px-3",
                step.state === "done" && "text-[var(--color-primary-light)]",
                step.state === "active" && "bg-[var(--color-primary-light)]/10 text-[#1a5c47]",
                step.state === "future" && "text-muted-foreground",
              )}
              aria-current={step.state === "active" ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  step.state === "done" &&
                    "border-[var(--ds-accent-teal)] bg-[var(--ds-accent-teal)] text-white",
                  step.state === "active" && "border-[var(--ds-accent-teal)] bg-background",
                  step.state === "future" && "border-border bg-background",
                )}
              >
                {step.state === "done" ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <span
                className="mx-1 hidden h-px w-6 bg-border sm:mx-2 sm:inline-block sm:w-10"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  )
}
