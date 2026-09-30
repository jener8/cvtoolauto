import { z } from "zod"

/** Structured Claude fit result — no scores, percentages, or rankings. */
export const agentRelevanceSchema = z.object({
  relevant: z.boolean(),
  requirements_met: z.array(
    z.object({
      requirement: z.string().min(1),
      evidence_fact_ids: z.array(z.string().min(1)).min(1),
    }),
  ),
  requirements_not_met: z.array(z.string().min(1)),
  summary: z.string().min(1).max(800),
  listing_language: z.enum(["de", "en"]),
})

export type AgentRelevanceResult = z.infer<typeof agentRelevanceSchema>

export function parseAgentRelevanceJson(raw: unknown): AgentRelevanceResult {
  return agentRelevanceSchema.parse(raw)
}

/**
 * Keep only evidence IDs that were in the confirmed-facts set sent to the model.
 * Requirements left with no valid evidence move to requirements_not_met.
 */
export function sanitizeRelevanceEvidence(
  result: AgentRelevanceResult,
  allowedFactIds: Set<string>,
): AgentRelevanceResult {
  const met: AgentRelevanceResult["requirements_met"] = []
  const notMet = [...result.requirements_not_met]

  for (const item of result.requirements_met) {
    const ids = item.evidence_fact_ids.filter((id) => allowedFactIds.has(id))
    if (ids.length > 0) {
      met.push({ requirement: item.requirement, evidence_fact_ids: ids })
    } else {
      notMet.push(item.requirement)
    }
  }

  return {
    ...result,
    requirements_met: met,
    requirements_not_met: notMet,
  }
}
