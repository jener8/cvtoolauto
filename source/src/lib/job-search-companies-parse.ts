import type { CompanySearchTarget } from "@/lib/job-search-focus"

type ParsedCompany = {
  name?: unknown
  location?: unknown
  sector?: unknown
  whyFit?: unknown
  rolesToSearch?: unknown
}

function slugId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

function normalizeCompanyName(value: string): string {
  return value.trim().toLowerCase()
}

export function parseJobSearchCompaniesResponse(
  text: string,
  excludeCompanies: string[] = [],
): CompanySearchTarget[] | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  const excluded = new Set(excludeCompanies.map(normalizeCompanyName))

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { companies?: unknown }
    if (!Array.isArray(parsed.companies)) return null

    const seen = new Set<string>()
    const targets: CompanySearchTarget[] = []

    for (const item of parsed.companies as ParsedCompany[]) {
      const name = typeof item.name === "string" ? item.name.trim() : ""
      if (name.length < 2) continue

      const key = normalizeCompanyName(name)
      if (seen.has(key) || excluded.has(key)) continue
      seen.add(key)

      const location =
        typeof item.location === "string" && item.location.trim()
          ? item.location.trim()
          : "Berlin / Europe"
      const sector =
        typeof item.sector === "string" && item.sector.trim()
          ? item.sector.trim()
          : "Employers in your field"
      const whyFit =
        typeof item.whyFit === "string" && item.whyFit.trim() ? item.whyFit.trim() : undefined
      const rolesToSearch =
        typeof item.rolesToSearch === "string" && item.rolesToSearch.trim()
          ? item.rolesToSearch.trim()
          : undefined

      targets.push({
        id: slugId(`${location}-${name}`),
        company: name,
        area: `${sector} · ${location}`,
        roleHint: rolesToSearch ?? whyFit,
      })
    }

    return targets.length > 0 ? targets.slice(0, 12) : null
  } catch {
    return null
  }
}
