"use client"

import type { LucideIcon } from "lucide-react"
import { Check, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

export type StepCardStatus = "empty" | "active" | "complete" | "locked"

interface StepCardProps {
  step: number
  title: string
  subtitle: string
  icon: LucideIcon
  status: StepCardStatus
  onClick: () => void
}

export function StepCard({
  step,
  title,
  subtitle,
  icon: Icon,
  status,
  onClick,
}: StepCardProps) {
  const isLocked = status === "locked"
  const isComplete = status === "complete"
  const isActive = status === "active"
  const isClickable = !isLocked

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      aria-label={`${title}${isComplete ? " — completed, click to edit" : isLocked ? " — locked" : " — click to open"}`}
      className={cn(
        "application-step-card group relative z-10 flex w-full flex-col items-center rounded-2xl border-2 bg-card p-6 text-center shadow-sm",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2",
        isClickable && "cursor-pointer hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        isClickable && !isActive && !isComplete && "border-[#cfe3ff] bg-card",
        isActive &&
          isClickable &&
          "border-sky-500 bg-sky-50/40 shadow-[0_4px_20px_rgba(59,130,246,0.12)] ring-2 ring-sky-300/40 dark:bg-sky-950/20",
        isComplete &&
          isClickable &&
          "border-[#cfe3ff] bg-card hover:border-sky-400",
        isLocked && "cursor-not-allowed border-border/60 bg-muted/20 opacity-50 hover:translate-y-0 hover:shadow-sm",
      )}
    >
      <div
        className={cn(
          "relative z-10 mb-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
          isComplete &&
            "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.15)]",
          isActive && "border-sky-500 bg-sky-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.2)]",
          status === "empty" && isClickable && "border-sky-300 bg-white text-sky-700 dark:bg-card dark:text-sky-300",
          isLocked && "border-border bg-muted text-muted-foreground",
        )}
      >
        {isComplete ? (
          <Check className="h-5 w-5 animate-in zoom-in-50 duration-300" strokeWidth={2.5} aria-hidden />
        ) : (
          <span>{step}</span>
        )}
      </div>

      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
          isComplete && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          isActive && "bg-sky-500/10 text-sky-600 dark:text-sky-400",
          (status === "empty" || isLocked) && "bg-sky-50 text-sky-600/70 dark:bg-sky-950/30 dark:text-sky-400/80",
          isLocked && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </div>

      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-muted-foreground">{subtitle}</p>

      <div className="mt-4 flex min-h-[1.25rem] flex-col items-center gap-0.5">
        {isComplete && (
          <>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Complete</span>
            <span className="flex items-center gap-1 text-[11px] text-sky-600/80 opacity-0 transition-opacity group-hover:opacity-100 dark:text-sky-400/80">
              <Pencil className="h-3 w-3" aria-hidden />
              Click to edit
            </span>
          </>
        )}
        {isActive && <span className="text-xs font-medium text-sky-600 dark:text-sky-400">In progress</span>}
        {status === "empty" && isClickable && (
          <span className="text-[11px] text-sky-600/70 opacity-0 transition-opacity group-hover:opacity-100 dark:text-sky-400/70">
            Click to open
          </span>
        )}
        {isLocked && (
          <span className="text-xs text-muted-foreground">Complete previous step</span>
        )}
      </div>
    </button>
  )
}
