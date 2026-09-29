"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface CvSourceCardProps {
  title: string
  description: string
  icon: LucideIcon
  badge?: string
  selected?: boolean
  onClick: () => void
}

export function CvSourceCard({
  title,
  description,
  icon: Icon,
  badge,
  selected,
  onClick,
}: CvSourceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-2xl border-2 bg-card p-6 text-left shadow-sm transition-all duration-200",
        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
          : "border-border/80",
      )}
    >
      <div className="mb-4 flex w-full items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        {badge && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </button>
  )
}
