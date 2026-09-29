import type { ApplicationStatistics } from "@/lib/application-statistics"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { hasStrategicProfileContent } from "@/lib/strategic-profile"
import type { ResumeVersion } from "@/lib/types"

export type CareerHealthScore = {
  score: number
  trend: "up" | "down" | "stable"
  breakdown: {
    profileCompleteness: number
    applicationActivity: number
    interviewRate: number
    marketAlignment: number
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function profileCompletenessScore(
  versions: ResumeVersion[],
  strategicProfile: StrategicProfile | null,
  userName?: string,
): number {
  let score = 0
  if (userName?.trim()) score += 20
  if (versions.length > 0) score += 35
  if (versions.some((v) => (v.resumeText?.trim().length ?? 0) > 400)) score += 25
  if (hasStrategicProfileContent(strategicProfile)) score += 20
  return clamp(score)
}

function applicationActivityScore(stats: ApplicationStatistics): number {
  if (stats.totalApplications === 0) return 15
  if (stats.totalApplications < 3) return 40
  if (stats.applicationsPerMonth != null && stats.applicationsPerMonth >= 4) return 90
  if (stats.totalApplications >= 10) return 75
  return 55
}

function interviewRateScore(stats: ApplicationStatistics): number {
  const rate = stats.interviewConversionRate
  if (rate == null) return stats.totalApplications > 0 ? 35 : 20
  if (rate >= 0.35) return 95
  if (rate >= 0.2) return 75
  if (rate >= 0.1) return 55
  return 30
}

function marketAlignmentScore(stats: ApplicationStatistics): number {
  const topIndustry = stats.bestIndustries[0]
  const topTitle = stats.bestJobTitles[0]
  if (!topIndustry && !topTitle) return 50
  const industryRate = topIndustry?.successRate ?? null
  const titleRate = topTitle?.successRate ?? null
  const best = Math.max(industryRate ?? 0, titleRate ?? 0)
  if (best >= 0.4) return 90
  if (best >= 0.25) return 70
  if (best > 0) return 55
  return 45
}

export function computeCareerHealthScore(input: {
  versions: ResumeVersion[]
  stats: ApplicationStatistics
  strategicProfile: StrategicProfile | null
  userName?: string
  previousScore?: number | null
}): CareerHealthScore {
  const profileCompleteness = profileCompletenessScore(
    input.versions,
    input.strategicProfile,
    input.userName,
  )
  const applicationActivity = applicationActivityScore(input.stats)
  const interviewRate = interviewRateScore(input.stats)
  const marketAlignment = marketAlignmentScore(input.stats)

  const score = clamp(
    profileCompleteness * 0.25 +
      applicationActivity * 0.2 +
      interviewRate * 0.35 +
      marketAlignment * 0.2,
  )

  let trend: CareerHealthScore["trend"] = "stable"
  if (input.previousScore != null) {
    if (score > input.previousScore + 2) trend = "up"
    else if (score < input.previousScore - 2) trend = "down"
  }

  return {
    score,
    trend,
    breakdown: {
      profileCompleteness,
      applicationActivity,
      interviewRate,
      marketAlignment,
    },
  }
}
