import { parseCombinedApplicationLabel, resolveDraftApplicationRole } from "@/lib/application-role-label"
import type { ResumeVersion } from "@/lib/types"

const GENERIC_RESUME_NAME_PATTERNS = [
  /^untitled resume$/i,
  /^general cv$/i,
  /^master (cv|resume)$/i,
  /— resume$/i,
  /^my (cv|resume)$/i,
]

export function isGenericResumeName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true
  return GENERIC_RESUME_NAME_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/** Role-specific CV tied to a company/role — should be tracked as a job application. */
export function isApplicationResumeVersion(version: ResumeVersion): boolean {
  if (version.isReusableTemplate) return false
  if (isGenericResumeName(version.name)) return false

  if (version.jobDescription?.trim()) return true

  const role = resolveDraftApplicationRole(version)
  if (role.company.trim() && role.jobTitle.trim() && role.company !== role.jobTitle) {
    return true
  }

  if (parseCombinedApplicationLabel(version.name.trim())) return true
  if (version.contactInfo?.targetCompany?.trim()) return true
  if (version.contactInfo?.targetRole?.trim()) return true

  return false
}

/** Reusable base CV — not tied to a specific job application. */
export function isResumeTemplateVersion(version: ResumeVersion): boolean {
  if (version.isReusableTemplate) return true
  return !isApplicationResumeVersion(version)
}
