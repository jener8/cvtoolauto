"use client"

import { CAREER_STORY_SECTIONS, storySectionValue } from "@/lib/career-story-sections"
import type { CareerStoryFieldKey } from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { cn } from "@/lib/utils"

type CareerStoryProgressDotsProps = {
  profile: StrategicProfile
  activeIndex: number
  skippedKeys?: CareerStoryFieldKey[]
  visitedUpTo?: number
  onNavigate?: (index: number) => void
}

export function CareerStoryProgressDots({
  profile,
  activeIndex,
  skippedKeys = [],
  visitedUpTo = 0,
  onNavigate,
}: CareerStoryProgressDotsProps) {
  const total = CAREER_STORY_SECTIONS.length
  const completed = CAREER_STORY_SECTIONS.filter((section) =>
    Boolean(storySectionValue(profile, section.key)),
  ).length
  const displayStep = Math.min(activeIndex + 1, total)
  const skippedSet = new Set(skippedKeys)

  return (
    <div
      className="career-story-progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={displayStep}
      aria-label={`Story progress: ${displayStep} of ${total}`}
    >
      <div className="career-story-progress__dots">
        {CAREER_STORY_SECTIONS.map((section, index) => {
          const done = Boolean(storySectionValue(profile, section.key))
          const active = index === activeIndex
          const skipped = skippedSet.has(section.key)
          const isClickable =
            index === activeIndex || done || skipped || index <= Math.max(visitedUpTo, activeIndex)
          return (
            <button
              key={section.key}
              type="button"
              disabled={!isClickable || !onNavigate}
              onClick={() => onNavigate?.(index)}
              className={cn(
                "career-story-progress__dot",
                done && !active && "career-story-progress__dot--done",
                active && "career-story-progress__dot--active",
                done && active && "career-story-progress__dot--done",
                skipped && !done && "career-story-progress__dot--skipped",
              )}
              aria-label={`Question ${index + 1} of ${total}${done ? " — answered" : skipped ? " — skipped" : index === activeIndex ? " — current" : ""}`}
            />
          )
        })}
      </div>
      <span className="career-story-progress__label">
        {completed === total ? `${total} of ${total}` : `${displayStep} of ${total}`}
      </span>
    </div>
  )
}
