/**
 * GDPR — delete all job-agent rows for the workspace user.
 * Does NOT touch resumes, job_applications, cover_letters, or folders.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

/** Tables owned by the job agents feature (delete order respects FKs). */
export const AGENT_DATA_TABLES = [
  "agent_drafts",
  "agent_jobs",
  "agent_companies",
  "agent_activity",
  "agent_profile_facts",
  "agent_search_settings",
] as const

export type AgentDataTable = (typeof AGENT_DATA_TABLES)[number]

export type DeleteAgentDataResult = {
  deleted: Record<AgentDataTable, number>
  total: number
}

async function deleteTableRows(
  client: SupabaseClient,
  table: AgentDataTable,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  let query = client.from(table).delete().eq("user_id", userId).select("id")
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data as Array<{ id: string }> | null)?.length ?? 0
}

/**
 * Wipe all agent_* rows for userId. Safe to call when tables are empty.
 * Returns per-table delete counts (best-effort from SELECT after DELETE).
 */
export async function deleteAllAgentData(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<DeleteAgentDataResult> {
  const deleted = {} as Record<AgentDataTable, number>
  let total = 0

  for (const table of AGENT_DATA_TABLES) {
    const count = await deleteTableRows(input.client, table, input.userId, input.signal)
    deleted[table] = count
    total += count
  }

  console.info("[agents/gdpr] deleted agent data", { total, tables: deleted })

  return { deleted, total }
}
