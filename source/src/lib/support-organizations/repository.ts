import seedData from "@/data/support-organizations.seed.json"
import type { SupportOrganization } from "@/lib/support-organizations/types"

const ADMIN_STORAGE_KEY = "support-organizations:v1"

function isSupportOrganization(value: unknown): value is SupportOrganization {
  if (typeof value !== "object" || value === null) return false
  const row = value as Partial<SupportOrganization>
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    Array.isArray(row.categories) &&
    row.categories.length > 0 &&
    typeof row.location === "string" &&
    typeof row.cost === "string" &&
    typeof row.description === "string" &&
    typeof row.externalUrl === "string" &&
    row.vetted === true
  )
}

function parseSeed(): SupportOrganization[] {
  if (!Array.isArray(seedData)) return []
  return seedData.filter(isSupportOrganization)
}

/** Default curated directory — from seed JSON. Replace seed file or use admin override. */
export function getDefaultSupportOrganizations(): SupportOrganization[] {
  return parseSeed()
}

/** Client-side admin override (e.g. after CSV import in a future admin UI). */
export function loadSupportOrganizations(): SupportOrganization[] {
  if (typeof window === "undefined") return getDefaultSupportOrganizations()
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (!raw) return getDefaultSupportOrganizations()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return getDefaultSupportOrganizations()
    const rows = parsed.filter(isSupportOrganization)
    return rows.length > 0 ? rows : getDefaultSupportOrganizations()
  } catch {
    return getDefaultSupportOrganizations()
  }
}

export function saveSupportOrganizations(organizations: SupportOrganization[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(organizations))
}

export function resetSupportOrganizationsToSeed(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ADMIN_STORAGE_KEY)
}

export function hasPlaceholderOrganizations(organizations: SupportOrganization[]): boolean {
  return organizations.some((org) => org.isPlaceholder)
}
