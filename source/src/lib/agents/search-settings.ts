import type { SupabaseClient } from "@supabase/supabase-js"
import type { AgentSearchSettings, AgentSearchSettingsInput } from "@/lib/agents/types"
import { sanitizeSearchSettingsInput } from "@/lib/agents/normalize"

type SearchSettingsRow = {
  id: string
  user_id: string
  keywords: string[] | null
  location: string | null
  remote: boolean | null
  languages: string[] | null
  seniority: string | null
  target_companies?: string[] | null
  created_at: string
  updated_at: string
}

export function mapSearchSettingsRow(row: SearchSettingsRow): AgentSearchSettings {
  return {
    id: row.id,
    userId: row.user_id,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    location: row.location?.trim() || "Berlin",
    remote: Boolean(row.remote),
    languages: Array.isArray(row.languages) ? row.languages : [],
    seniority: row.seniority,
    targetCompanies: Array.isArray(row.target_companies) ? row.target_companies : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getOrCreateSearchSettings(input: {
  userId: string
  client: SupabaseClient
  signal?: AbortSignal
}): Promise<AgentSearchSettings> {
  let selectQuery = input.client
    .from("agent_search_settings")
    .select("*")
    .eq("user_id", input.userId)
  if (input.signal) selectQuery = selectQuery.abortSignal(input.signal)

  const { data, error } = await selectQuery.maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (data) {
    return mapSearchSettingsRow(data as SearchSettingsRow)
  }

  let insertQuery = input.client.from("agent_search_settings").insert({
    user_id: input.userId,
    keywords: [],
    location: "Berlin",
    remote: false,
    languages: [],
    seniority: null,
    target_companies: [],
    updated_at: new Date().toISOString(),
  })
  if (input.signal) insertQuery = insertQuery.abortSignal(input.signal)

  const { data: created, error: insertError } = await insertQuery.select("*").single()

  if (insertError) {
    let againQuery = input.client
      .from("agent_search_settings")
      .select("*")
      .eq("user_id", input.userId)
    if (input.signal) againQuery = againQuery.abortSignal(input.signal)
    const { data: again, error: againError } = await againQuery.maybeSingle()
    if (againError || !again) throw new Error(insertError.message)
    return mapSearchSettingsRow(again as SearchSettingsRow)
  }

  return mapSearchSettingsRow(created as SearchSettingsRow)
}

export async function upsertSearchSettings(input: {
  userId: string
  client: SupabaseClient
  patch: AgentSearchSettingsInput
  signal?: AbortSignal
}): Promise<AgentSearchSettings> {
  const sanitized = sanitizeSearchSettingsInput(input.patch)
  const now = new Date().toISOString()

  let query = input.client.from("agent_search_settings").upsert(
    {
      user_id: input.userId,
      keywords: sanitized.keywords,
      location: sanitized.location,
      remote: sanitized.remote,
      languages: sanitized.languages,
      seniority: sanitized.seniority,
      target_companies: sanitized.targetCompanies,
      updated_at: now,
    },
    { onConflict: "user_id" },
  )
  if (input.signal) query = query.abortSignal(input.signal)

  const { data, error } = await query.select("*").single()

  if (error) throw new Error(error.message)
  return mapSearchSettingsRow(data as SearchSettingsRow)
}
