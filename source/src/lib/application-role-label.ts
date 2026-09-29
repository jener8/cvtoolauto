import type { JobApplication, ResumeVersion } from "@/lib/types"

const LABEL_SEPARATORS = [" — ", " - ", " | ", ": "] as const

/** Split combined labels like "Heraeus Responsible AI Manager" into company + role. */
export function parseCombinedApplicationLabel(
  label: string,
): { company: string; role: string } | null {
  const trimmed = label.trim()
  if (!trimmed) return null

  for (const sep of LABEL_SEPARATORS) {
    const index = trimmed.indexOf(sep)
    if (index > 0) {
      const company = trimmed.slice(0, index).trim()
      const role = trimmed.slice(index + sep.length).trim()
      if (company && role) return { company, role }
    }
  }

  return null
}

export function buildCombinedApplicationLabel(company: string, role: string): string {
  const c = company.trim()
  const r = role.trim()
  if (c && r) return `${c} ${r}`
  return c || r
}

export type ResolvedApplicationRole = {
  jobTitle: string
  company: string
  location: string
  /** True when values are inferred from the linked CV, not stored on the application row. */
  inferredFromVersion: boolean
}

export function resolveApplicationRole(
  job: JobApplication,
  version?: ResumeVersion | null,
): ResolvedApplicationRole {
  const storedTitle = job.jobTitle?.trim() ?? ""
  const storedCompany = job.company?.trim() ?? ""
  const storedLocation = job.location?.trim() ?? ""

  const versionRole = version?.contactInfo?.targetRole?.trim() ?? ""
  const versionCompany = version?.contactInfo?.targetCompany?.trim() ?? ""
  const versionName = version?.name?.trim() ?? ""
  const parsedFromName = versionName ? parseCombinedApplicationLabel(versionName) : null
  const parsedFromTitle = storedTitle ? parseCombinedApplicationLabel(storedTitle) : null

  let jobTitle = storedTitle || versionRole || parsedFromName?.role || parsedFromTitle?.role || ""
  let company = storedCompany || versionCompany || parsedFromName?.company || parsedFromTitle?.company || ""

  if (!jobTitle && versionName) {
    jobTitle = versionName
  }

  const inferredFromVersion =
    !storedTitle &&
    !storedCompany &&
    Boolean(versionRole || versionCompany || parsedFromName || versionName)

  const location = storedLocation || version?.contactInfo?.address?.trim() || ""

  return {
    jobTitle,
    company,
    location,
    inferredFromVersion,
  }
}

export function resolveDraftApplicationRole(version: ResumeVersion): ResolvedApplicationRole {
  const versionRole = version.contactInfo?.targetRole?.trim() ?? ""
  const versionCompany = version.contactInfo?.targetCompany?.trim() ?? ""
  const versionName = version.name?.trim() ?? ""
  const parsed = versionName ? parseCombinedApplicationLabel(versionName) : null

  return {
    jobTitle: versionRole || parsed?.role || versionName,
    company: versionCompany || parsed?.company || "",
    location: version.contactInfo?.address?.trim() || "",
    inferredFromVersion: !versionRole && !versionCompany && Boolean(parsed || versionName),
  }
}
