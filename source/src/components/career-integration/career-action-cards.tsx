"use client"

import type { CareerActionCard } from "@/lib/career-integration-platform"
import { CAREER_ACTION_CARDS } from "@/lib/career-integration-platform"
import { cn } from "@/lib/utils"

type CareerActionCardsProps = {
  onAction: (card: CareerActionCard) => void
  className?: string
}

export function CareerActionCards({ onAction, className }: CareerActionCardsProps) {
  return (
    <section className={cn("space-y-4", className)} aria-labelledby="career-actions-heading">
      <div>
        <h2 id="career-actions-heading" className="text-base font-semibold tracking-tight">
          Your career integration toolkit
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything in one place — documents, job search, language, recognition, and support.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CAREER_ACTION_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onAction(card)}
              className={cn(
                "group flex flex-col rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm",
                "transition-all hover:border-[var(--color-primary-light)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]/40",
              )}
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-light)]/10 text-[var(--color-primary-light)] transition-colors group-hover:bg-[var(--color-primary-light)]/15">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-medium leading-snug text-foreground">{card.title}</span>
              <span className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {card.description}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
