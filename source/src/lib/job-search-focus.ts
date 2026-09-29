import { computeApplicationStatistics } from "@/lib/application-statistics"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"

export type CompanySearchTarget = {
  id: string
  company: string
  area: string
  roleHint?: string
}

export type JobSearchFocus = {
  recommendedJobTitles: string[]
}

function looksLikeJobTitle(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 4) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return true
  const single = words[0]?.toLowerCase() ?? ""
  return ["manager", "lead", "director", "specialist", "consultant", "analyst", "designer"].some(
    (suffix) => single.endsWith(suffix) && single.length > suffix.length + 2,
  )
}

export function buildFallbackJobTitles(input: {
  jobs: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  folderId: string
}): string[] {
  const stats = computeApplicationStatistics({
    folderId: input.folderId,
    jobs: input.jobs,
    versions: input.versions,
  })

  const seen = new Set<string>()
  const titles: string[] = []
  const add = (value: string) => {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (!looksLikeJobTitle(trimmed) || seen.has(key)) return
    seen.add(key)
    titles.push(trimmed)
  }

  for (const item of stats.bestJobTitles) {
    add(item.label)
  }

  const sortedJobs = [...input.jobs].sort(
    (a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0),
  )
  for (const job of sortedJobs) {
    if (job.jobTitle?.trim()) add(job.jobTitle.trim())
  }

  const direction = input.strategicProfile?.careerDirection
  if (direction) {
    for (const phrase of direction.split(/[,;|\n]+/)) {
      if (phrase.trim()) add(phrase.trim())
    }
  }

  return titles.slice(0, 8)
}

export function appliedCompanyNames(jobs: JobApplication[]): string[] {
  const names = new Set<string>()
  for (const job of jobs) {
    const company = job.company?.trim()
    if (company) names.add(company)
  }
  return [...names]
}

export function computeJobSearchFocus(input: {
  folderId: string
  jobs: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
}): JobSearchFocus {
  return {
    recommendedJobTitles: buildFallbackJobTitles(input),
  }
}

export function isCompanyTargetDone(
  target: CompanySearchTarget,
  checklist: Record<string, boolean>,
): boolean {
  return Boolean(checklist[target.id])
}

export function primaryResumeText(versions: ResumeVersion[]): string {
  const withText = versions.filter((v) => v.resumeText?.trim())
  if (withText.length === 0) return ""
  return [...withText].sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0))[0]!
    .resumeText!
}
