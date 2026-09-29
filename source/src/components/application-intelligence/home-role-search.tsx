"use client"

import { Sparkles } from "lucide-react"
import "./role-match-section.css"

type HomeRoleSearchProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void | Promise<void>
  placeholder?: string
  ariaLabel?: string
  buttonLabel?: string
}

/** Pill search bar from the Home page — styling unchanged, layout only moves into a card. */
export function HomeRoleSearch({
  value,
  onChange,
  onSubmit,
  placeholder = "What kind of role are you exploring?",
  ariaLabel = "What kind of role are you exploring?",
  buttonLabel = "Find matches",
}: HomeRoleSearchProps) {
  return (
    <div className="home-role-match__search">
      <Sparkles className="home-role-match__search-icon" aria-hidden />
      <input
        type="search"
        className="home-role-match__search-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void onSubmit()
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button type="button" className="home-role-match__search-btn" onClick={() => void onSubmit()}>
        {buttonLabel}
      </button>
    </div>
  )
}
