import {
  averageDaysBetween,
  daysBetween,
  isInterviewReceived,
  isOfferStage,
  isPositiveOffer,
  isSecondInterviewOrBeyond,
} from "@/lib/application-outcome"
import {
  APPLICATION_STAGES,
  getPipeline,
  getStageRecord,
  isHired,
  isTerminalOutcome,
  type ApplicationStage,
  type StageOutcome,
} from "@/lib/application-pipeline"
import type {
  StatisticsJobSummary,
  StatisticsVersionSummary,
} from "@/lib/statistics-strategy-payload"
import type { JobApplication, ResumeVersion } from "@/lib/types"

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "will",
  "our",
  "are",
  "this",
  "that",
  "from",
  "have",
  "been",
  "work",
  "team",
  "role",
  "experience",
  "skills",
  "ability",
  "using",
  "years",
  "year",
])

const INDUSTRY_HINTS: { label: string; terms: string[] }[] = [
  { label: "Public sector & government", terms: ["government", "public sector", "federal", "municipal", "civil service"] },
  { label: "Healthcare", terms: ["healthcare", "hospital", "clinical", "medical", "pharma"] },
  { label: "Finance & banking", terms: ["bank", "finance", "fintech", "insurance", "investment"] },
  { label: "Technology & software", terms: ["saas", "software", "startup", "tech", "engineering", "developer"] },
  { label: "Education & research", terms: ["university", "education", "research", "academic"] },
  { label: "AI & responsible tech", terms: ["artificial intelligence", "machine learning", "ai governance", "responsible ai", "ethics"] },
  { label: "Design & UX", terms: ["ux", "user experience", "product design", "design system", "accessibility"] },
]

export type RankedItem = {
  label: string
  total: number
  successful: number
  successRate: number | null
}

export type MonthlyTrend = {
  monthKey: string
  label: string
  applications: number
  interview: number
  offer: number
  rejected: number
  withdrawn: number
  noResponse: number
  hired: number
}

export type StageFunnelStep = {
  stage: ApplicationStage
  entered: number
  passed: number
  pending: number
  lost: number
  conversionFromPrevious: number | null
  lossBreakdown: Partial<Record<StageOutcome, number>>
}

export type ApplicationStatistics = {
  folderId: string
  totalApplications: number
  submittedApplications: number
  applicationsPerMonth: number | null
  interviewsReceived: number
  secondInterviews: number
  offersReceived: number
  offersAccepted: number
  rejections: number
  declined: number
  noResponse: number
  withdrawn: number
  appliedOnly: number
  hired: number
  interviewConversionRate: number | null
  secondInterviewConversionRate: number | null
  offerConversionRate: number | null
  acceptanceRate: number | null
  rejectionRate: number | null
  bestJobTitles: RankedItem[]
  bestIndustries: RankedItem[]
  bestResumeVersions: RankedItem[]
  bestKeywords: RankedItem[]
  trendsOverTime: MonthlyTrend[]
  stageFunnel: StageFunnelStep[]
  avgDaysToInterview: number | null
  avgDaysToRejection: number | null
  avgDaysToOffer: number | null
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

function inferIndustry(job: JobApplication): string {
  if (job.industry?.trim()) return job.industry.trim()
  const blob = [
    job.company,
    job.jobTitle,
    job.jobDescription,
    job.companyInfo?.researchNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  for (const hint of INDUSTRY_HINTS) {
    if (hint.terms.some((t) => blob.includes(t))) return hint.label
  }
  return "Other / unspecified"
}

function monthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-")
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function buildRanked(
  entries: Map<string, { total: Set<string>; success: Set<string> }>,
  minTotal = 1,
): RankedItem[] {
  return [...entries.entries()]
    .map(([label, sets]) => {
      const total = sets.total.size
      const successful = sets.success.size
      return {
        label,
        total,
        successful,
        successRate: total > 0 ? successful / total : null,
      }
    })
    .filter((r) => r.total >= minTotal)
    .sort((a, b) => b.successful - a.successful || b.successRate! - a.successRate!)
}

function computeStageFunnel(jobs: JobApplication[]): StageFunnelStep[] {
  const funnel: StageFunnelStep[] = APPLICATION_STAGES.map((stage) => ({
    stage,
    entered: 0,
    passed: 0,
    pending: 0,
    lost: 0,
    conversionFromPrevious: null,
    lossBreakdown: {},
  }))

  for (const job of jobs) {
    const pipeline = getPipeline(job)
    for (const step of funnel) {
      const record = pipeline.find((entry) => entry.stage === step.stage)
      if (!record) continue

      step.entered++
      if (record.outcome === "passed") {
        step.passed++
      } else if (record.outcome === "pending") {
        step.pending++
      } else if (isTerminalOutcome(record.outcome)) {
        step.lost++
        step.lossBreakdown[record.outcome] = (step.lossBreakdown[record.outcome] ?? 0) + 1
      }
    }
  }

  for (let i = 0; i < funnel.length; i++) {
    if (i === 0) {
      funnel[i].conversionFromPrevious =
        funnel[i].entered > 0 ? funnel[i].passed / funnel[i].entered : null
      continue
    }
    const previousPassed = funnel[i - 1].passed
    funnel[i].conversionFromPrevious =
      previousPassed > 0 ? funnel[i].passed / previousPassed : null
  }

  return funnel
}

export function computeApplicationStatistics(input: {
  folderId: string
  jobs: JobApplication[]
  versions: ResumeVersion[]
}): ApplicationStatistics {
  const folderJobs = input.jobs.filter(
    (j) => !j.folderId || j.folderId === input.folderId,
  )
  const versionNames = new Map(input.versions.map((v) => [v.id, v.name?.trim() || "Untitled resume"]))

  let interviewsReceived = 0
  let secondInterviews = 0
  let offersReceived = 0
  let offersAccepted = 0
  let rejections = 0
  let declined = 0
  let noResponse = 0
  let withdrawn = 0
  let appliedOnly = 0
  let hired = 0

  const daysToInterview: number[] = []
  const daysToRejection: number[] = []
  const daysToOffer: number[] = []

  const titleMap = new Map<string, { total: Set<string>; success: Set<string> }>()
  const industryMap = new Map<string, { total: Set<string>; success: Set<string> }>()
  const resumeMap = new Map<string, { total: Set<string>; success: Set<string> }>()
  const keywordMap = new Map<string, { total: Set<string>; success: Set<string> }>()
  const trendMap = new Map<string, MonthlyTrend>()

  for (const job of folderJobs) {
    if (isInterviewReceived(job)) interviewsReceived++
    if (isSecondInterviewOrBeyond(job)) secondInterviews++
    if (isOfferStage(job)) offersReceived++
    if (isHired(job)) {
      offersAccepted++
      hired++
    }
    if (getStageRecord(job, "offer")?.outcome === "declined") declined++
    if (getPipeline(job).some((record) => record.outcome === "rejected")) rejections++
    if (getPipeline(job).some((record) => record.outcome === "no_response")) noResponse++
    if (getPipeline(job).some((record) => record.outcome === "withdrawn")) withdrawn++
    if (getCurrentStageOnly(job) === "applied" && getCurrentOutcomeOnly(job) === "pending") appliedOnly++

    const appliedAt = job.appliedDate || job.lastModified
    const hrDate = getStageRecord(job, "hr_screening")?.date
    if (hrDate) {
      const delta = daysBetween(appliedAt, hrDate)
      if (delta != null) daysToInterview.push(delta)
    }

    const terminal = getPipeline(job).find((record) =>
      ["rejected", "declined"].includes(record.outcome),
    )
    if (terminal?.date) {
      const delta = daysBetween(appliedAt, terminal.date)
      if (delta != null) daysToRejection.push(delta)
    }

    const offerDate = getStageRecord(job, "offer")?.date
    if (offerDate) {
      const delta = daysBetween(appliedAt, offerDate)
      if (delta != null) daysToOffer.push(delta)
    }

    const success = isInterviewReceived(job) || isPositiveOffer(job)
    const title = job.jobTitle?.trim() || "Untitled role"
    const industry = inferIndustry(job)

    const bump = (map: Map<string, { total: Set<string>; success: Set<string> }>, key: string) => {
      const cur = map.get(key) ?? { total: new Set(), success: new Set() }
      cur.total.add(job.id)
      if (success) cur.success.add(job.id)
      map.set(key, cur)
    }

    bump(titleMap, title)
    bump(industryMap, industry)

    if (job.resumeVersionId) {
      const name = versionNames.get(job.resumeVersionId) ?? "Unknown resume"
      bump(resumeMap, name)
    }

    for (const kw of [...new Set(tokenize(job.jobDescription ?? ""))]) {
      bump(keywordMap, kw)
    }

    const mk = monthKey(appliedAt || Date.now())
    const trend =
      trendMap.get(mk) ??
      ({
        monthKey: mk,
        label: monthLabel(mk),
        applications: 0,
        interview: 0,
        offer: 0,
        rejected: 0,
        withdrawn: 0,
        noResponse: 0,
        hired: 0,
      } satisfies MonthlyTrend)

    trend.applications++
    if (isHired(job)) trend.hired++
    else if (isOfferStage(job)) trend.offer++
    else if (hasInterviewOnly(job)) trend.interview++
    else if (getPipeline(job).some((record) => record.outcome === "rejected" || record.outcome === "declined")) {
      trend.rejected++
    } else if (getPipeline(job).some((record) => record.outcome === "withdrawn")) trend.withdrawn++
    else if (getPipeline(job).some((record) => record.outcome === "no_response")) trend.noResponse++
    trendMap.set(mk, trend)
  }

  const totalApplications = folderJobs.length
  const submittedApplications = totalApplications
  const interviewConversionRate =
    submittedApplications > 0 ? interviewsReceived / submittedApplications : null
  const secondInterviewConversionRate =
    interviewsReceived > 0 ? secondInterviews / interviewsReceived : null
  const offerConversionRate =
    interviewsReceived > 0 ? offersReceived / interviewsReceived : null
  const acceptanceRate = offersReceived > 0 ? offersAccepted / offersReceived : null
  const rejectionRate = submittedApplications > 0 ? rejections / submittedApplications : null

  const trendsOverTime = [...trendMap.values()].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  )
  const applicationsPerMonth =
    trendsOverTime.length > 0
      ? trendsOverTime.reduce((sum, trend) => sum + trend.applications, 0) / trendsOverTime.length
      : null

  return {
    folderId: input.folderId,
    totalApplications,
    submittedApplications,
    applicationsPerMonth,
    interviewsReceived,
    secondInterviews,
    offersReceived,
    offersAccepted,
    rejections,
    declined,
    noResponse,
    withdrawn,
    appliedOnly,
    hired,
    interviewConversionRate,
    secondInterviewConversionRate,
    offerConversionRate,
    acceptanceRate,
    rejectionRate,
    bestJobTitles: buildRanked(titleMap, 1).slice(0, 8),
    bestIndustries: buildRanked(industryMap, 1).slice(0, 8),
    bestResumeVersions: buildRanked(resumeMap, 1).slice(0, 8),
    bestKeywords: buildRanked(keywordMap, 2).slice(0, 12),
    trendsOverTime,
    stageFunnel: computeStageFunnel(folderJobs),
    avgDaysToInterview: averageDaysBetween(daysToInterview),
    avgDaysToRejection: averageDaysBetween(daysToRejection),
    avgDaysToOffer: averageDaysBetween(daysToOffer),
  }
}

function getCurrentStageOnly(job: JobApplication): ApplicationStage {
  const pipeline = getPipeline(job)
  return pipeline[pipeline.length - 1]?.stage ?? "applied"
}

function getCurrentOutcomeOnly(job: JobApplication): StageOutcome {
  const pipeline = getPipeline(job)
  return pipeline[pipeline.length - 1]?.outcome ?? "pending"
}

function hasInterviewOnly(job: JobApplication): boolean {
  return getPipeline(job).some((record) =>
    ["hr_screening", "hiring_manager_interview_1", "hiring_manager_interview_2", "final_interview"].includes(
      record.stage,
    ),
  )
}

export function formatStatisticsForPrompt(
  stats: ApplicationStatistics,
  jobs: StatisticsJobSummary[] | JobApplication[],
  versions: StatisticsVersionSummary[] | ResumeVersion[],
): string {
  const lines: string[] = [
    `WORKSPACE STATISTICS (folder ${stats.folderId} only):`,
    `Total applications: ${stats.totalApplications}`,
    `Interviews received: ${stats.interviewsReceived}`,
    `Second interviews: ${stats.secondInterviews}`,
    `Offers received: ${stats.offersReceived}`,
    `Offers accepted / hired: ${stats.offersAccepted}`,
    `Rejections: ${stats.rejections}`,
    `Declined offers: ${stats.declined}`,
    `No response: ${stats.noResponse}`,
    `Withdrawn: ${stats.withdrawn}`,
    stats.interviewConversionRate != null
      ? `Interview conversion (interviews / applications): ~${Math.round(stats.interviewConversionRate * 100)}%`
      : "Interview conversion: insufficient data",
    stats.secondInterviewConversionRate != null
      ? `Second interview conversion: ~${Math.round(stats.secondInterviewConversionRate * 100)}%`
      : "",
    stats.offerConversionRate != null
      ? `Offer conversion (offers / interviews): ~${Math.round(stats.offerConversionRate * 100)}%`
      : "",
    stats.acceptanceRate != null
      ? `Offer acceptance rate: ~${Math.round(stats.acceptanceRate * 100)}%`
      : "",
    stats.avgDaysToInterview != null
      ? `Avg days application → interview: ${stats.avgDaysToInterview}`
      : "",
    stats.avgDaysToRejection != null
      ? `Avg days application → rejection: ${stats.avgDaysToRejection}`
      : "",
    stats.avgDaysToOffer != null
      ? `Avg days application → offer: ${stats.avgDaysToOffer}`
      : "",
    "",
    "Stage funnel (entered / passed / lost):",
    ...stats.stageFunnel.map((step) => {
      const conversion =
        step.conversionFromPrevious != null
          ? ` · conversion ${Math.round(step.conversionFromPrevious * 100)}%`
          : ""
      const losses = Object.entries(step.lossBreakdown)
        .map(([outcome, count]) => `${outcome}: ${count}`)
        .join(", ")
      return `- ${step.stage}: ${step.entered} entered, ${step.passed} passed, ${step.lost} lost${conversion}${losses ? ` (${losses})` : ""}`
    }),
    "",
    "Best job titles (by interview+offer count):",
    ...stats.bestJobTitles
      .slice(0, 6)
      .map((r) => `- ${r.label}: ${r.successful}/${r.total} success`),
    "",
    "Best industries (inferred from JD/company):",
    ...stats.bestIndustries
      .slice(0, 6)
      .map((r) => `- ${r.label}: ${r.successful}/${r.total} success`),
    "",
    "Best resume versions:",
    ...stats.bestResumeVersions
      .slice(0, 5)
      .map((r) => `- ${r.label}: ${r.successful}/${r.total} success`),
    "",
    "Top keywords in successful applications' job descriptions:",
    ...stats.bestKeywords
      .filter((k) => k.successful > 0)
      .slice(0, 10)
      .map((k) => `- ${k.label}: ${k.successful}/${k.total}`),
    "",
    "Monthly trends:",
    ...stats.trendsOverTime.map(
      (t) =>
        `- ${t.label}: ${t.applications} applications, ${t.interview} interview stages, ${t.offer} offers, ${t.hired} hired, ${t.rejected} rejected, ${t.noResponse} no response`,
    ),
    "",
    "APPLICATION RECORDS (pipeline + context):",
  ]

  const versionNameById = new Map(versions.map((v) => [v.id, v.name?.trim() || "Untitled resume"]))

  for (const job of jobs.filter((j) => !j.folderId || j.folderId === stats.folderId).slice(0, 40)) {
    const pipeline =
      "pipeline" in job && Array.isArray((job as StatisticsJobSummary).pipeline)
        ? (job as StatisticsJobSummary).pipeline
        : getPipeline(job as JobApplication)
    const resume = versionNameById.get(job.resumeVersionId) ?? "—"
    const pipelineSummary = pipeline
      .map((record) => `${record.stage}=${record.outcome}`)
      .join(" → ")
    lines.push(
      `- ${job.company} | ${job.jobTitle} | pipeline: ${pipelineSummary} | resume: ${resume} | applied: ${job.appliedDate ? new Date(job.appliedDate).toISOString().slice(0, 10) : "?"}`,
    )
    if (job.strategySummary?.trim()) {
      lines.push(`  strategy: ${job.strategySummary.trim().slice(0, 200)}`)
    }
    const stageNotes = pipeline
      .filter((record) => record.notes?.trim())
      .map((record) => `${record.stage}: ${record.notes!.trim().slice(0, 80)}`)
    if (stageNotes.length > 0) {
      lines.push(`  stage notes: ${stageNotes.join(" | ")}`)
    }
  }

  return lines.filter(Boolean).join("\n")
}
