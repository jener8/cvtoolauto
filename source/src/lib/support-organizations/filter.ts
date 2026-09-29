import type { SupportOrgCategory, SupportOrgCost, SupportOrganization } from "@/lib/support-organizations/types"

export type SupportDirectoryFilters = {
  categories: SupportOrgCategory[]
  location: string | null
  costFreeOnly: boolean
}

export function inferUserCity(hints: Array<string | undefined>): string | null {
  const cities = [
    "Berlin",
    "Munich",
    "Hamburg",
    "Cologne",
    "Frankfurt",
    "Stuttgart",
    "Düsseldorf",
    "Leipzig",
    "Dresden",
    "Bremen",
  ]
  const haystack = hints.filter(Boolean).join(" ").toLowerCase()
  if (!haystack.trim()) return null
  for (const city of cities) {
    if (haystack.includes(city.toLowerCase())) return city
  }
  return null
}

export function matchesChipFilters(
  org: SupportOrganization,
  filters: SupportDirectoryFilters,
): boolean {
  if (filters.costFreeOnly && org.cost !== "free") return false

  if (filters.location) {
    const loc = org.location.toLowerCase()
    const target = filters.location.toLowerCase()
    if (loc !== "remote" && !loc.includes(target)) return false
  }

  if (filters.categories.length > 0) {
    const hasCategory = filters.categories.some((cat) => org.categories.includes(cat))
    if (!hasCategory) return false
  }

  return true
}

export function filterOrganizationsByChips(
  organizations: SupportOrganization[],
  filters: SupportDirectoryFilters,
): SupportOrganization[] {
  return organizations.filter((org) => matchesChipFilters(org, filters))
}

export function localMatchOrganizations(
  query: string,
  organizations: SupportOrganization[],
): SupportOrganization[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)

  if (terms.length === 0) return organizations

  const scored = organizations
    .map((org) => {
      const haystack = `${org.name} ${org.description} ${org.location} ${org.categories.join(" ")} ${org.cost}`.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (haystack.includes(term)) score += 1
      }
      return { org, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map((item) => item.org)
}

export function orderOrganizationsByIds(
  organizations: SupportOrganization[],
  ids: string[],
): SupportOrganization[] {
  const map = new Map(organizations.map((org) => [org.id, org]))
  const ordered: SupportOrganization[] = []
  for (const id of ids) {
    const org = map.get(id)
    if (org) ordered.push(org)
  }
  return ordered
}

export function countInArea(
  organizations: SupportOrganization[],
  city: string | null,
): number {
  if (!city) return organizations.length
  return organizations.filter((org) => {
    const loc = org.location.toLowerCase()
    return loc === "remote" || loc.includes(city.toLowerCase())
  }).length
}

export const QUICK_FILTER_CATEGORIES: SupportOrgCategory[] = [
  "mentoring",
  "career-coaching",
  "refugee-migrant-support",
  "childcare",
]

export const FREE_COST_FILTER = "free" as SupportOrgCost
