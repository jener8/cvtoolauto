import type {
  SupportOrgCategory,
  SupportOrgCost,
  SupportOrganization,
} from "@/lib/support-organizations/types"

const VALID_CATEGORIES = new Set<SupportOrgCategory>([
  "mentoring",
  "career-coaching",
  "refugee-migrant-support",
  "childcare",
  "legal-aid",
  "womens-network",
  "jobcenter",
  "language",
  "mental-health",
])

const VALID_COSTS = new Set<SupportOrgCost>(["free", "paid", "sliding-scale"])

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

export type CsvImportResult =
  | { ok: true; organizations: SupportOrganization[] }
  | { ok: false; error: string }

/**
 * Import curated organisations from CSV.
 *
 * Expected header (order flexible if header row present):
 * id,name,categories,location,cost,description,externalUrl,isPlaceholder
 *
 * - categories: pipe-separated (e.g. mentoring|career-coaching)
 * - isPlaceholder: true/false (optional, default false)
 */
export function importSupportOrganizationsFromCsv(csv: string): CsvImportResult {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { ok: false, error: "CSV is empty." }
  }

  const header = parseCsvLine(lines[0]!).map((cell) => cell.toLowerCase())
  const hasHeader = header.includes("name")
  const dataLines = hasHeader ? lines.slice(1) : lines

  const col = (name: string): number => header.indexOf(name)

  const organizations: SupportOrganization[] = []
  const seenIds = new Set<string>()

  for (const line of dataLines) {
    const cells = parseCsvLine(line)
    const name = (hasHeader ? cells[col("name")] : cells[1])?.trim() ?? ""
    if (!name) continue

    const idRaw = (hasHeader ? cells[col("id")] : cells[0])?.trim()
    const id = idRaw && idRaw.length > 0 ? idRaw : slugId(name)
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const categoriesRaw =
      (hasHeader ? cells[col("categories")] : cells[2])?.trim() ?? ""
    const categories = categoriesRaw
      .split(/[|;]/)
      .map((c) => c.trim().toLowerCase().replace(/\s+/g, "-") as SupportOrgCategory)
      .filter((c): c is SupportOrgCategory => VALID_CATEGORIES.has(c))

    if (categories.length === 0) continue

    const location = ((hasHeader ? cells[col("location")] : cells[3]) ?? "Remote").trim()
    const costRaw = ((hasHeader ? cells[col("cost")] : cells[4]) ?? "free")
      .trim()
      .toLowerCase() as SupportOrgCost
    const cost: SupportOrgCost = VALID_COSTS.has(costRaw) ? costRaw : "free"

    const description = (hasHeader ? cells[col("description")] : cells[5])?.trim() ?? ""
    const externalUrl = (hasHeader ? cells[col("externalurl")] : cells[6])?.trim() ?? ""
    const placeholderRaw = (hasHeader ? cells[col("isplaceholder")] : cells[7])?.trim().toLowerCase()

    if (!description || !externalUrl) continue

    organizations.push({
      id,
      name,
      categories,
      location: location || "Remote",
      cost,
      description,
      externalUrl,
      vetted: true,
      isPlaceholder: placeholderRaw === "true" || placeholderRaw === "1",
    })
  }

  if (organizations.length === 0) {
    return { ok: false, error: "No valid rows found. Check column names and required fields." }
  }

  return { ok: true, organizations }
}

export function exportSupportOrganizationsToCsv(organizations: SupportOrganization[]): string {
  const header =
    "id,name,categories,location,cost,description,externalUrl,isPlaceholder"
  const rows = organizations.map((org) => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
    return [
      escape(org.id),
      escape(org.name),
      escape(org.categories.join("|")),
      escape(org.location),
      escape(org.cost),
      escape(org.description),
      escape(org.externalUrl),
      escape(org.isPlaceholder ? "true" : "false"),
    ].join(",")
  })
  return [header, ...rows].join("\n")
}
