/** Instructions for AI to cite evidence when using personal learning. */

export const AI_EXPLAINABILITY_RULES = `EXPLAINABILITY (required when personal learning data is provided):
- Treat learned patterns as evidence, not guaranteed facts. State confidence (low / medium / high) when relevant.
- When a recommendation is influenced by the user's history, explain WHY in plain language.
- Cite which data was used, e.g. "Based on 4 applications in this workspace that reached interview…", "From your job descriptions in this folder…", "From resume version X linked to Y applications…"
- Never claim patterns from other users or other workspaces.
- If evidence is weak, say so and suggest what would strengthen the insight (more applications, outcomes, etc.).
- Format example: "**Why:** This keyword appeared in 5 job descriptions you applied to, including 2 that reached interview stage. **Confidence:** Medium — based only on your folder history."`

export function formatInsightForPrompt(insight: {
  text: string
  why?: string
  confidence: string
  userCorrection?: string | null
  evidence?: {
    applicationLabels?: string[]
    pattern?: string
    sampleCount?: number
    totalConsidered?: number
    documentTypes?: string[]
  }
}): string {
  const text = insight.userCorrection?.trim() || insight.text
  const parts = [`[${insight.confidence}] ${text}`]
  if (insight.why) parts.push(`Why: ${insight.why}`)
  const e = insight.evidence
  if (e?.applicationLabels?.length) {
    parts.push(`Applications: ${e.applicationLabels.slice(0, 5).join("; ")}`)
  }
  if (e?.pattern) parts.push(`Pattern: ${e.pattern}`)
  if (e?.sampleCount != null && e?.totalConsidered != null) {
    parts.push(`Evidence: ${e.sampleCount} of ${e.totalConsidered} applications`)
  }
  if (e?.documentTypes?.length) {
    parts.push(`Documents analyzed: ${e.documentTypes.join(", ")}`)
  }
  return parts.join(" | ")
}
