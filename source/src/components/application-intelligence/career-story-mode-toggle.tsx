"use client"

import type { CareerStoryInputMode } from "@/lib/career-story-mode-storage"
import { Mic } from "lucide-react"

type CareerStoryModeToggleProps = {
  mode: CareerStoryInputMode
  onChange: (mode: CareerStoryInputMode) => void
  voiceSupported: boolean
}

export function CareerStoryModeToggle({
  mode,
  onChange,
  voiceSupported,
}: CareerStoryModeToggleProps) {
  if (mode === "type") {
    if (!voiceSupported) return null

    return (
      <div className="career-story-mode-toggle career-story-mode-toggle--type">
        <button
          type="button"
          className="career-story-mode-toggle__prefer-link"
          onClick={() => onChange("voice")}
        >
          Prefer to talk it through
        </button>
      </div>
    )
  }

  return (
    <div className="career-story-mode-toggle career-story-mode-toggle--voice">
      <p className="career-story-mode-toggle__voice-label">
        <Mic className="h-3.5 w-3.5" aria-hidden />
        Talk it through
      </p>
      <button
        type="button"
        className="career-story-mode-toggle__prefer-link"
        onClick={() => onChange("type")}
      >
        Prefer to type
      </button>
    </div>
  )
}
