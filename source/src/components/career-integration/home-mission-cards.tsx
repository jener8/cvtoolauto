"use client"

import type { WorkspaceNavId } from "@/lib/workspace-navigation"
import { cn } from "@/lib/utils"
import {
  ArrowUpRight,
  Compass,
  FilePen,
  Puzzle,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

export type HomeMissionCard = {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  navId: WorkspaceNavId
}

export const HOME_MISSION_CARDS: HomeMissionCard[] = [
  {
    id: "see-what-you-bring",
    title: "See what you bring",
    subtitle: "Your experience, strengths and story — in your own words",
    icon: Sparkles,
    navId: "careerBrain",
  },
  {
    id: "match-skills",
    title: "Match your skills",
    subtitle: "Find roles that fit what you already know how to do",
    icon: Puzzle,
    navId: "workplaceGerman",
  },
  {
    id: "transition-confidence",
    title: "Transition with confidence",
    subtitle: "Explore new fields and see how your experience transfers",
    icon: ArrowUpRight,
    navId: "aiCoach",
  },
  {
    id: "build-documents",
    title: "Build your documents",
    subtitle: "A CV and cover letters that sound like you",
    icon: FilePen,
    navId: "applications",
  },
  {
    id: "find-footing",
    title: "Find your footing",
    subtitle: "Qualifications, permits, and what to expect in Germany",
    icon: Compass,
    navId: "recognitionPathways",
  },
]

type HomeMissionCardsProps = {
  onNavigate: (id: WorkspaceNavId) => void
  className?: string
}

export function HomeMissionCards({ onNavigate, className }: HomeMissionCardsProps) {
  return (
    <section className={cn("px-6 lg:px-8", className)} aria-label="Ways EquitAI can help">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {HOME_MISSION_CARDS.map((card, index) => {
          const Icon = card.icon
          const spanClass =
            index < 3 ? "lg:col-span-2" : "sm:col-span-1 lg:col-span-3"
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.navId)}
              className={cn(
                "group flex flex-col rounded-2xl border border-border/50 bg-card p-5 text-left shadow-sm",
                "transition-all hover:border-[var(--color-primary-light)]/45 hover:bg-[var(--color-primary-light)]/[0.03] hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]/40",
                spanClass,
              )}
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)]/10 text-[var(--color-primary-light)] transition-colors group-hover:bg-[var(--color-primary-light)]/15">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-base font-semibold leading-snug text-foreground">{card.title}</span>
              <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.subtitle}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
