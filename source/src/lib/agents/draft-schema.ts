import { z } from "zod"
import type { CitedFactSnapshot } from "@/lib/agents/types"

/** Writer model output — CV + cover from confirmed facts only. */
export const agentWriterSchema = z.object({
  cv_text: z.string().min(1),
  cover_text: z.string().min(1),
  cited_fact_ids: z.array(z.string().min(1)).min(1),
  listing_language: z.enum(["de", "en"]),
})

export type AgentWriterResult = z.infer<typeof agentWriterSchema>

export const fabricationFlagSchema = z.object({
  claim: z.string().min(1),
  location: z.enum(["cv", "cover", "both"]),
  reason: z.string().min(1),
})

export type FabricationFlag = z.infer<typeof fabricationFlagSchema>

/** Fact Checker model output — unsupported claims only. */
export const agentFactCheckSchema = z.object({
  unsupported_claims: z.array(fabricationFlagSchema),
})

export type AgentFactCheckResult = z.infer<typeof agentFactCheckSchema>

export function parseAgentWriterJson(raw: unknown): AgentWriterResult {
  return agentWriterSchema.parse(raw)
}

export function parseAgentFactCheckJson(raw: unknown): AgentFactCheckResult {
  return agentFactCheckSchema.parse(raw)
}

/** Keep cited IDs that exist in the confirmed set; build snapshot from current fact text. */
export function buildCitedFactsSnapshot(
  citedIds: string[],
  factsById: Map<string, { id: string; factText: string }>,
): CitedFactSnapshot[] {
  const seen = new Set<string>()
  const snapshot: CitedFactSnapshot[] = []
  for (const id of citedIds) {
    if (seen.has(id)) continue
    const fact = factsById.get(id)
    if (!fact) continue
    seen.add(id)
    snapshot.push({ id: fact.id, text: fact.factText })
  }
  return snapshot
}

/**
 * Max tailored drafts per UTC day.
 * Primary: JOB_DRAFTS_DAILY_CAP. Alias: JOB_AGENT_DAILY_CAP (legacy Phase 5–7 name).
 */
export function getJobDraftsDailyCap(): number {
  const raw =
    process.env.JOB_DRAFTS_DAILY_CAP?.trim() || process.env.JOB_AGENT_DAILY_CAP?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 5
  if (!Number.isFinite(n) || n < 1) return 5
  return Math.min(n, 50)
}

/** @deprecated Prefer getJobDraftsDailyCap — kept as alias for call sites. */
export function getJobAgentDailyCap(): number {
  return getJobDraftsDailyCap()
}
