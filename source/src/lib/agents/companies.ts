import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeCompanyName } from "@/lib/agents/normalize"

export async function findOrCreateCompany(input: {
  userId: string
  client: SupabaseClient
  name: string
  website?: string | null
  signal?: AbortSignal
}): Promise<string> {
  const name = input.name.trim()
  const normalized = normalizeCompanyName(name) || name.toLowerCase()
  const website = input.website?.trim() || null

  let findQuery = input.client
    .from("agent_companies")
    .select("id, website")
    .eq("user_id", input.userId)
    .eq("normalized_name", normalized)
    .limit(1)
  if (input.signal) findQuery = findQuery.abortSignal(input.signal)

  const { data: existing, error: findError } = await findQuery.maybeSingle()

  if (findError) throw new Error(findError.message)

  if (existing?.id) {
    if (website && !existing.website) {
      let updateQuery = input.client
        .from("agent_companies")
        .update({ website, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("user_id", input.userId)
      if (input.signal) updateQuery = updateQuery.abortSignal(input.signal)
      await updateQuery
    }
    return existing.id as string
  }

  let insertQuery = input.client.from("agent_companies").insert({
    user_id: input.userId,
    name,
    normalized_name: normalized,
    website,
    updated_at: new Date().toISOString(),
  })
  if (input.signal) insertQuery = insertQuery.abortSignal(input.signal)

  const { data: created, error: insertError } = await insertQuery.select("id").single()

  if (insertError) {
    let againQuery = input.client
      .from("agent_companies")
      .select("id")
      .eq("user_id", input.userId)
      .eq("normalized_name", normalized)
      .limit(1)
    if (input.signal) againQuery = againQuery.abortSignal(input.signal)
    const { data: again, error: againError } = await againQuery.maybeSingle()
    if (againError || !again?.id) throw new Error(insertError.message)
    return again.id as string
  }

  return created.id as string
}
