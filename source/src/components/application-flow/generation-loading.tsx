"use client"

import { AiWizardProgress } from "@/components/ai-wizard-progress"

const PHASES = [
  {
    title: "Analyzing your experience and the role requirements",
    detail: "Mapping your background to what this employer is looking for.",
  },
  {
    title: "Matching the job description",
    detail: "Highlighting relevant skills, keywords, and proof points.",
  },
  {
    title: "Optimizing structure and impact",
    detail: "Sharpening clarity for recruiters and ATS systems.",
  },
] as const

export function GenerationLoading({
  headline = "AI is tailoring your CV…",
  footnote = "This usually takes under a minute. Please keep this tab open.",
}: {
  headline?: string
  footnote?: string
}) {
  return (
    <AiWizardProgress
      phases={PHASES}
      headline={headline}
      footnote={footnote}
      phaseIntervalMs={3500}
    />
  )
}

export { PHASES as GENERATION_LOADING_PHASES }
