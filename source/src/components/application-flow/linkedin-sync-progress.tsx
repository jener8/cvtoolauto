"use client"

import { LINKEDIN_SYNC_UI_LABELS, type LinkedInSyncUiPhase } from "@/lib/linkedin-profile"
import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"

const STEPS: LinkedInSyncUiPhase[] = ["checking", "reading", "extracting"]

interface LinkedInSyncProgressProps {
  phase: LinkedInSyncUiPhase
  className?: string
}

export function LinkedInSyncProgress({ phase, className }: LinkedInSyncProgressProps) {
  const activeIndex = STEPS.indexOf(phase)
  const isActive = activeIndex >= 0

  if (!isActive && phase !== "success" && phase !== "partial") return null

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-[#0A66C2]" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {LINKEDIN_SYNC_UI_LABELS[phase] || "Syncing LinkedIn profile…"}
        </p>
      </div>
      <ul className="space-y-2 text-xs text-muted-foreground">
        {STEPS.map((step, i) => {
          const done = activeIndex > i
          const current = activeIndex === i
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-2",
                done && "text-foreground",
                current && "font-medium text-foreground",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : current ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0A66C2]" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
              )}
              {LINKEDIN_SYNC_UI_LABELS[step]}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
