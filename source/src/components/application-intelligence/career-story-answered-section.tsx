"use client"

import {
  CAREER_STORY_SECTIONS,
  storySectionValue,
  type CareerStoryFieldKey,
} from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { cn } from "@/lib/utils"
import { Pencil } from "lucide-react"

type CareerStoryAnsweredSectionProps = {
  profile: StrategicProfile
  onEdit: (key: CareerStoryFieldKey) => void
}

export function CareerStoryAnsweredSection({ profile, onEdit }: CareerStoryAnsweredSectionProps) {
  const answered = CAREER_STORY_SECTIONS.filter((section) =>
    Boolean(storySectionValue(profile, section.key)),
  )

  return (
    <section className="career-story-answered" aria-labelledby="career-story-answered-heading">
      <p id="career-story-answered-heading" className="career-story-answered__heading">
        Already answered
      </p>
      {answered.length === 0 ? (
        <div className="career-story-answered__empty">
          <p>Nothing yet — this is your first question.</p>
        </div>
      ) : (
        <div className="career-story-answered__list">
          {answered.map((section) => {
            const value = storySectionValue(profile, section.key)
            const Icon = section.icon
            return (
              <article
                key={section.key}
                className={cn("career-story-card", `career-story-card--${section.accent}`)}
              >
                <div className="career-story-card__header">
                  <span className="career-story-card__icon" aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="career-story-card__label">{section.cardLabel}</p>
                  <button
                    type="button"
                    className="career-story-card__edit"
                    onClick={() => onEdit(section.key)}
                    aria-label={`Edit ${section.cardLabel}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <p className="career-story-card__narrative">{value}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
