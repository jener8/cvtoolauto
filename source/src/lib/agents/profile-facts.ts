import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerServiceSupabaseClient } from "@/lib/supabase/server-service-client"
import type { AgentFactStatus, AgentProfileFact } from "@/lib/agents/types"

type FactRow = {
  id: string
  user_id: string
  category: string
  fact_text: string
  status: string
  source: string
  source_ref: Record<string, unknown> | null
  source_key: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export function mapAgentProfileFactRow(row: FactRow): AgentProfileFact {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    factText: row.fact_text,
    status: row.status as AgentFactStatus,
    source: row.source as AgentProfileFact["source"],
    sourceRef: (row.source_ref ?? {}) as Record<string, unknown>,
    sourceKey: row.source_key,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient | null> {
  if (client) return client
  return createServerServiceSupabaseClient()
}

async function resolveUserId(supabase: SupabaseClient, userId?: string): Promise<string | null> {
  if (userId) return userId
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) return null
  return data.user.id
}

/**
 * Returns only confirmed profile facts for Writer / Fact Checker consumers.
 * Unconfirmed and deleted facts are never included.
 */
export async function getConfirmedFacts(options?: {
  userId?: string
  client?: SupabaseClient
  signal?: AbortSignal
}): Promise<AgentProfileFact[]> {
  const supabase = await resolveClient(options?.client)
  if (!supabase) return []

  const uid = await resolveUserId(supabase, options?.userId)
  if (!uid) return []

  let query = supabase
    .from("agent_profile_facts")
    .select("*")
    .eq("user_id", uid)
    .eq("status", "confirmed")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (options?.signal) {
    query = query.abortSignal(options.signal)
  }

  const { data, error } = await query
  if (error) {
    console.error("[agents/getConfirmedFacts]", error.message)
    return []
  }

  return (data as FactRow[] | null)?.map(mapAgentProfileFactRow) ?? []
}

/** All facts for the master-profile review UI (any status). */
export async function listProfileFacts(options?: {
  userId?: string
  client?: SupabaseClient
  status?: AgentFactStatus
  signal?: AbortSignal
}): Promise<AgentProfileFact[]> {
  const supabase = await resolveClient(options?.client)
  if (!supabase) return []

  const uid = await resolveUserId(supabase, options?.userId)
  if (!uid) return []

  let query = supabase
    .from("agent_profile_facts")
    .select("*")
    .eq("user_id", uid)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (options?.status) {
    query = query.eq("status", options.status)
  }
  if (options?.signal) {
    query = query.abortSignal(options.signal)
  }

  const { data, error } = await query
  if (error) {
    console.error("[agents/listProfileFacts]", error.message)
    return []
  }

  return (data as FactRow[] | null)?.map(mapAgentProfileFactRow) ?? []
}
