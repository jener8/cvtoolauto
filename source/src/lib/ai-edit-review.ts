import type { AiExplainability } from "@/lib/ai-transparency"
import type { CvEditChange } from "@/lib/cv-edit-types"
import { formatCvEditSummary } from "@/lib/cv-diff"

export type AiEditReviewStatus = "pending" | "applied" | "rejected"

export function buildProposedChangesList(opts: {
  changes: CvEditChange[]
  summary?: string
  explainability?: AiExplainability
}): string[] {
  const bullets = formatCvEditSummary(opts.changes)
  const meaningful =
    bullets.length > 0 &&
    !(
      bullets.length === 1 &&
      bullets[0] === "Refined wording and emphasis across the CV."
    )

  const items = meaningful ? [...bullets] : []

  const rationale = opts.explainability?.rationale?.trim()
  if (rationale && !items.some((item) => item.includes(rationale))) {
    items.unshift(rationale)
  }

  const summaryLines = parseSummaryBullets(opts.summary)
  for (const line of summaryLines) {
    if (!items.some((item) => item.toLowerCase() === line.toLowerCase())) {
      items.push(line)
    }
  }

  if (items.length === 0 && opts.summary?.trim()) {
    items.push(opts.summary.trim())
  }

  return items.slice(0, 8)
}

function parseSummaryBullets(summary?: string): string[] {
  if (!summary?.trim()) return []
  return summary
    .split("\n")
    .map((line) => line.replace(/^[-*✓•]\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("Why:"))
}

export function buildEditReviewIntro(documentLabel: "Resume" | "Cover Letter"): string {
  return `I've prepared a ${documentLabel.toLowerCase()} edit for your review. Nothing has been changed yet — approve below to apply.`
}

export function formatProposedChangesMarkdown(items: string[]): string {
  if (items.length === 0) {
    return "**What I would change:**\n\n- Refine wording and structure based on your request."
  }
  return [
    "**What I would change:**",
    "",
    ...items.map((item) => `✓ ${item}`),
  ].join("\n")
}
