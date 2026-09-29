"use client"

import {
  CAREER_STORY_SECTIONS,
  storySectionValue,
  type CareerStoryFieldKey,
  type CareerStorySection,
} from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { cn } from "@/lib/utils"
import { Pencil } from "lucide-react"

type CareerStoryCardsProps = {
  profile: StrategicProfile
  editingKey: CareerStoryFieldKey | null
  editDraft: string
  onStartEdit: (key: CareerStoryFieldKey, value: string) => void
  onEditDraftChange: (value: string) => void
  onSaveEdit: (key: CareerStoryFieldKey) => void
  onCancelEdit: () => void
  nextSectionKey?: CareerStoryFieldKey | null
}

function placeholderFor(section: CareerStorySection, nextSectionKey?: CareerStoryFieldKey | null) {
  if (section.key === nextSectionKey) {
    return "Not added yet — this comes up next in your conversation."
  }
  return "Not added yet — you can fill this in when you're ready."
}

export function CareerStoryCards({
  profile,
  editingKey,
  editDraft,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  nextSectionKey,
}: CareerStoryCardsProps) {
  return (
    <div className="career-story-cards" aria-label="Your story so far">
      {CAREER_STORY_SECTIONS.map((section) => {
        const value = storySectionValue(profile, section.key)
        const completed = Boolean(value)
        const editing = editingKey === section.key
        const Icon = section.icon

        return (
          <article
            key={section.key}
            className={cn(
              "career-story-card",
              `career-story-card--${section.accent}`,
              !completed && "career-story-card--empty",
            )}
          >
            <div className="career-story-card__header">
              <span className="career-story-card__icon" aria-hidden>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="career-story-card__label">{section.cardLabel}</p>
              {completed ? (
                <button
                  type="button"
                  className="career-story-card__edit"
                  onClick={() => onStartEdit(section.key, value)}
                  aria-label={`Edit ${section.cardLabel}`}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>

            {editing ? (
              <div className="career-story-card__editor">
                <textarea
                  className="career-story-card__textarea"
                  value={editDraft}
                  onChange={(event) => onEditDraftChange(event.target.value)}
                  rows={4}
                  aria-label={`Edit ${section.cardLabel}`}
                />
                <div className="career-story-card__editor-actions">
                  <button
                    type="button"
                    className="career-story-card__editor-save"
                    onClick={() => onSaveEdit(section.key)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="career-story-card__editor-cancel"
                    onClick={onCancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : completed ? (
              <p className="career-story-card__narrative">{value}</p>
            ) : (
              <p className="career-story-card__placeholder">
                {placeholderFor(section, nextSectionKey)}
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
