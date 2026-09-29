import { sanitizeMatchingSkills } from "@/lib/role-matches/present"

function slugId(title: string, index: number): string {
  return `match-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}-${index}`
}

function isLikelyJobTitle(title: string): boolean {
  const trimmed = title.trim()
  if (trimmed.length < 4 || trimmed.length > 100) return false
  if (trimmed.split(/\s+/).length < 2) return false
  // Reject company/tagline blobs
  if (/—|–|\.\.\.|we're open|about us|contribut/i.test(trimmed)) return false
  if (/^(the|a|an)\s/i.test(trimmed)) return false
  return true
}

function normalizeFitLevel(value: unknown): RoleFitLevel {
  return value === "strong" ? "strong" : "growing"
}

function normalizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const skills: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (trimmed.length < 2 || trimmed.length > 80 || seen.has(key)) continue
    seen.add(key)
    skills.push(trimmed)
  }
  return skills.slice(0, 5)
}

export function parseRoleMatchesResponse(text: string): RoleMatchResult[] | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { matches?: unknown }
    if (!Array.isArray(parsed.matches)) return null

    const results: RoleMatchResult[] = []
    const seenTitles = new Set<string>()

    for (const raw of parsed.matches) {
      if (typeof raw !== "object" || raw === null) continue
      const row = raw as {
        title?: unknown
        matchingSkills?: unknown
        fitLevel?: unknown
      }
      if (typeof row.title !== "string") continue
      const title = row.title.trim()
      if (!isLikelyJobTitle(title)) continue
      const titleKey = title.toLowerCase()
      if (seenTitles.has(titleKey)) continue
      seenTitles.add(titleKey)

      const matchingSkills = sanitizeMatchingSkills(normalizeSkills(row.matchingSkills))

      results.push({
        id: slugId(title, results.length),
        title,
        matchingSkills,
        fitLevel: normalizeFitLevel(row.fitLevel),
      })
    }

    return results.length > 0 ? results.slice(0, 10) : null
  } catch {
    return null
  }
}
