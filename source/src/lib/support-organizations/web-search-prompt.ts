import type { SupportDirectoryFilters } from "@/lib/support-organizations/filter"

export type WebSupportSearchInput = {
  query: string
  userCity?: string | null
  filters?: SupportDirectoryFilters
}

export function buildWebSupportSearchPrompt(input: WebSupportSearchInput): string {
  const city = input.userCity?.trim() || input.filters?.location?.trim() || "Germany"
  const filterHints: string[] = []
  if (input.filters?.categories.length) {
    filterHints.push(`Categories: ${input.filters.categories.join(", ")}`)
  }
  if (input.filters?.costFreeOnly) {
    filterHints.push("Prefer free or low-cost services")
  }
  const filterBlock = filterHints.length > 0 ? `\n${filterHints.join("\n")}` : ""

  return `Use web search to find real support organisations, programmes, or public services in ${city} that could help someone with:

"${input.query.trim()}"${filterBlock}

Focus on: mentoring, career coaching, refugee/migrant support, women's career groups, childcare resources, legal aid, Jobcenter-related services, and NGO programmes.

Return ONLY valid JSON (no markdown):
{
  "results": [
    {
      "name": "Organisation name",
      "type": "Short free-text type, e.g. Mentoring programme or Legal aid clinic",
      "location": "City or Remote",
      "description": "1-2 sentences on what they offer and who they help",
      "url": "https://official-website-or-contact-page (omit if none found)"
    }
  ]
}

Rules:
- Suggest 4–8 results maximum.
- Prefer official websites and established NGOs.
- Do NOT invent organisations — only include results you found via search.
- These results are UNVERIFIED by our team.`
}

export function parseWebSupportSearchResponse(text: string): Array<{
  name: string
  type: string
  location: string
  description: string
  externalUrl?: string
}> {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { results?: unknown }
    if (!Array.isArray(parsed.results)) return []

    const seen = new Set<string>()
    const rows: Array<{
      name: string
      type: string
      location: string
      description: string
      externalUrl?: string
    }> = []

    for (const item of parsed.results) {
      if (typeof item !== "object" || item === null) continue
      const row = item as Record<string, unknown>
      const name = typeof row.name === "string" ? row.name.trim() : ""
      const type =
        typeof row.type === "string" && row.type.trim()
          ? row.type.trim()
          : typeof row.category === "string" && row.category.trim()
            ? row.category.trim()
            : ""
      const location =
        typeof row.location === "string" && row.location.trim() ? row.location.trim() : "Germany"
      const description =
        typeof row.description === "string" ? row.description.trim() : ""
      const urlRaw =
        (typeof row.url === "string"
          ? row.url
          : typeof row.externalUrl === "string"
            ? row.externalUrl
            : ""
        ).trim()
      const externalUrl = urlRaw.startsWith("http") ? urlRaw : undefined

      if (name.length < 2 || !description) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      rows.push({
        name,
        type: type || description.split(/[.!?]/)[0]?.slice(0, 80) || "Support organisation",
        location,
        description,
        externalUrl,
      })
    }

    return rows.slice(0, 8)
  } catch {
    return []
  }
}
