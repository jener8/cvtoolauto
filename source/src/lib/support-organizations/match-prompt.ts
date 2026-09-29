import type { SupportOrganization } from "@/lib/support-organizations/types"

export type MatchSupportOrganizationsInput = {
  query: string
  organizations: SupportOrganization[]
  userCity?: string | null
}

function catalogForPrompt(organizations: SupportOrganization[]) {
  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    categories: org.categories,
    location: org.location,
    cost: org.cost,
    description: org.description.slice(0, 220),
  }))
}

export function buildMatchSupportOrganizationsPrompt(input: MatchSupportOrganizationsInput): string {
  const catalog = JSON.stringify(catalogForPrompt(input.organizations), null, 2)
  const cityHint = input.userCity?.trim()
    ? `The user is likely in or near ${input.userCity.trim()}. Prefer matches in that area when relevant.`
    : "No user city is known — rank by query relevance only."

  return `You help someone in Germany find support from a FIXED curated directory of organisations.

USER QUERY:
"${input.query.trim()}"

${cityHint}

CURATED DIRECTORY (this is the COMPLETE list — you may ONLY return ids from here):
${catalog}

TASK:
1. Interpret the natural-language query (topics, location, cost preferences, audience).
2. Rank organisations from the directory by relevance. Do NOT invent organisations, urls, or ids.
3. Return 0–${input.organizations.length} matches. If nothing fits, return an empty array.

Return ONLY valid JSON:
{
  "organizationIds": ["id-from-directory", "..."],
  "reasoning": "One short sentence explaining the match (no new facts about orgs)."
}`
}

export function parseMatchSupportOrganizationsResponse(
  text: string,
  allowedIds: Set<string>,
): { organizationIds: string[]; reasoning?: string } | null {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      organizationIds?: unknown
      reasoning?: unknown
    }
    if (!Array.isArray(parsed.organizationIds)) return null

    const organizationIds = parsed.organizationIds
      .filter((id): id is string => typeof id === "string" && allowedIds.has(id))
      .filter((id, index, arr) => arr.indexOf(id) === index)

    const reasoning =
      typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : undefined

    return { organizationIds, reasoning }
  } catch {
    return null
  }
}
