"use client"

import { ArrowLeft } from "lucide-react"

type FormatterOverviewBackProps = {
  onClick: () => void
  label?: string
}

export function FormatterOverviewBack({
  onClick,
  label = "Overview",
}: FormatterOverviewBackProps) {
  return (
    <button
      type="button"
      className="ui-formatter-back"
      onClick={onClick}
      aria-label="Back to overview"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  )
}
