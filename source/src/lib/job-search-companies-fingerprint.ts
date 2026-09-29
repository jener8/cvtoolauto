import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"

export function jobSearchCompaniesFingerprint(input: {
  folderId: string
  strategicProfile: StrategicProfile | null
  versions: ResumeVersion[]
  jobs: JobApplication[]
  jobTitles: string[]
}): string {
  const primaryCv = input.versions.find((v) => v.resumeText?.trim())
  const cvStamp = primaryCv?.lastModified ?? 0
  const profileStamp = input.strategicProfile?.updatedAt ?? 0
  const jobStamp = input.jobs.reduce((max, job) => Math.max(max, job.lastModified ?? 0), 0)
  const titlesKey = [...input.jobTitles].sort().join("|").toLowerCase()

  return [input.folderId, profileStamp, cvStamp, input.jobs.length, jobStamp, titlesKey].join(":")
}
