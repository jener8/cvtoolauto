/**
 * Phase 9 — per-agent pause / resume controls.
 * Keys: job_scout | company_scout | assessor | writer
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export const AGENT_CONTROL_KEYS = [
  "job_scout",
  "company_scout",
  "assessor",
  "writer",
] as const

export type AgentControlKey = (typeof AGENT_CONTROL_KEYS)[number]

export type AgentControlsMap = Record<AgentControlKey, { paused: boolean }>

const DEFAULT_CONTROLS: AgentControlsMap = {
  job_scout: { paused: false },
  company_scout: { paused: false },
  assessor: { paused: false },
  writer: { paused: false },
}

export function isAgentControlKey(value: unknown): value is AgentControlKey {
  return typeof value === "string" && (AGENT_CONTROL_KEYS as readonly string[]).includes(value)
}

export async function getAgentControls(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<AgentControlsMap> {
  let query = input.client
    .from("agent_agent_controls")
    .select("agent_key, paused")
    .eq("user_id", input.userId)
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const out: AgentControlsMap = { ...DEFAULT_CONTROLS }
  for (const row of data ?? []) {
    const key = (row as { agent_key?: string }).agent_key
    if (!isAgentControlKey(key)) continue
    out[key] = { paused: Boolean((row as { paused?: boolean }).paused) }
  }
  return out
}

export async function isAgentPaused(input: {
  userId: string
  client: SupabaseClient
  agentKey: AgentControlKey
  signal?: AbortSignal
}): Promise<boolean> {
  const controls = await getAgentControls(input)
  return controls[input.agentKey].paused
}

export async function setAgentPaused(input: {
  userId: string
  client: SupabaseClient
  agentKey: AgentControlKey
  paused: boolean
  signal?: AbortSignal
}): Promise<AgentControlsMap> {
  const now = new Date().toISOString()
  let query = input.client.from("agent_agent_controls").upsert(
    {
      user_id: input.userId,
      agent_key: input.agentKey,
      paused: input.paused,
      updated_at: now,
    },
    { onConflict: "user_id,agent_key" },
  )
  if (input.signal) query = query.abortSignal(input.signal)

  const { error } = await query
  if (error) throw new Error(error.message)
  return getAgentControls(input)
}
