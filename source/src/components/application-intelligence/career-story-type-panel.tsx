"use client"

import type { ReactNode } from "react"
import { PhraseAwareTextarea } from "@/components/phrase-library/phrase-aware-field"
import {
  CAREER_STORY_SECTIONS,
  JOB_SEARCH_HARD_CHIPS,
} from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { cn } from "@/lib/utils"
import { Calendar, Info, MessageSquare } from "lucide-react"

const TONE_OPTIONS = [
  { value: "", label: "Choose a tone…" },
  { value: "warm", label: "Warm & approachable" },
  { value: "strategic", label: "Strategic & professional" },
  { value: "confident", label: "Confident & direct" },
  { value: "executive", label: "Executive & concise" },
]

type CareerStoryTypePanelProps = {
  profile: StrategicProfile
  onUpdate: (patch: Partial<StrategicProfile>) => void
  selectedHardships: string[]
  onToggleHardship: (chip: string) => void
}

function TypeField({
  id,
  icon,
  iconTone,
  label,
  hint,
  why: _why,
  value,
  placeholder,
  onChange,
  chips,
}: {
  id: string
  icon: ReactNode
  iconTone: string
  label: string
  hint: string
  why: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  chips?: string[]
}) {
  const appendChip = (chip: string) => {
    const parts = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.some((p) => p.toLowerCase() === chip.toLowerCase())) return
    onChange(parts.length ? `${parts.join(", ")}, ${chip}` : chip)
  }

  return (
    <div
      className={cn("career-brain-field", value.trim() && "career-brain-field--filled")}
      id={id}
    >
      <div className={cn("career-brain-field__icon-wrap", `career-brain-field__icon-wrap--${iconTone}`)}>
        {icon}
      </div>
      <div className="min-w-0">
        <span className="career-brain-field__label">{label}</span>
        <p className="career-brain-field__hint">{hint}</p>
        <PhraseAwareTextarea
          id={`${id}-input`}
          label={label}
          className="career-brain-field__input"
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
        />
        {chips ? (
          <div className="career-brain-field__chips">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="career-brain-field__chip"
                onClick={() => appendChip(chip)}
              >
                + {chip}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function CareerStoryTypePanel({
  profile,
  onUpdate,
  selectedHardships,
  onToggleHardship,
}: CareerStoryTypePanelProps) {
  return (
    <div className="career-story-type-panel">
      {CAREER_STORY_SECTIONS.map((section) => {
        const iconTone =
          section.accent === "rose" ? "heart" : section.accent === "amber" ? "sprout" : "target"
        return (
          <TypeField
            key={section.key}
            id={`field-${section.key}`}
            icon={<section.icon className="h-4 w-4" />}
            iconTone={iconTone}
            label={section.label}
            hint={section.hint}
            why={section.why}
            value={profile[section.key] ?? ""}
            placeholder={section.placeholder}
            onChange={(value) => onUpdate({ [section.key]: value })}
            chips={section.chips}
          />
        )
      })}

      <div className="career-brain-field career-brain-field__hardship-chips">
        <p className="career-brain-field__label">
          What&apos;s making the job search hard right now?
        </p>
        <div className="career-brain-field__chips">
          {JOB_SEARCH_HARD_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={cn(
                "career-brain-field__chip",
                selectedHardships.includes(chip) && "career-brain-field__chip--selected",
              )}
              onClick={() => onToggleHardship(chip)}
              aria-pressed={selectedHardships.includes(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="career-brain-form__row-pair">
        <div
          className={cn(
            "career-brain-field",
            profile.writingTone?.trim() && "career-brain-field--filled",
          )}
        >
          <div className="career-brain-field__icon-wrap career-brain-field__icon-wrap--message">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="career-brain-field__label">How do you like to communicate?</span>
            <p className="career-brain-field__hint">
              e.g. I prefer written instructions, I work well in meetings, I need time to think
              before I answer...
            </p>
            <select
              className="career-brain-field__select"
              value={profile.writingTone ?? ""}
              onChange={(event) => onUpdate({ writingTone: event.target.value })}
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          className={cn(
            "career-brain-field",
            profile.noticePeriod?.trim() && "career-brain-field--filled",
          )}
        >
          <div className="career-brain-field__icon-wrap career-brain-field__icon-wrap--calendar">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="career-brain-field__label-row">
              <span className="career-brain-field__label">When can you start?</span>
              <span className="career-brain-field__optional">Optional</span>
            </div>
            <p className="career-brain-field__hint">For application forms and interviews.</p>
            <input
              className="career-brain-field__input career-brain-field__input--single"
              value={profile.noticePeriod ?? ""}
              placeholder="e.g. Immediately, 1 month…"
              onChange={(event) => onUpdate({ noticePeriod: event.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
