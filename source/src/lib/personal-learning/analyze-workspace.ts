import {
  isInterviewReceived,
  isOfferStage,
} from "@/lib/application-outcome"
import { getPipeline, isHired } from "@/lib/application-pipeline"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type {
  KeywordStat,
  LearnedInsight,
  PersonalLearningMemory,
  ResumeVersionStat,
  RoleTypeStat,
} from "@/lib/personal-learning/types"
import { emptyLearningMemory } from "@/lib/personal-learning/types"

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
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

function jobLabel(job: JobApplication): string {
  const c = job.company?.trim() || "Unknown company"
  const t = job.jobTitle?.trim() || "Role"
  return `${c} — ${t}`
}

function isSuccessful(job: JobApplication): boolean {
  return isInterviewReceived(job) || isOfferStage(job) || isHired(job)
}

function stableInsightId(category: string, pattern: string): string {
  const slug = pattern.replace(/[^a-z0-9]+/gi, "_").slice(0, 48)
  return `ws-${category}-${slug}`
}

function confidenceFromRatio(success: number, total: number): "low" | "medium" | "high" {
  if (total < 2) return "low"
  const rate = success / total
  if (total >= 5 && rate >= 0.4) return "high"
  if (total >= 3 && rate >= 0.25) return "medium"
  return "low"
}

export type WorkspaceAnalysisInput = {
  folderId: string
  versions: ResumeVersion[]
  jobs: JobApplication[]
  excludedApplicationIds?: string[]
}

export function analyzeWorkspaceForLearning(
  input: WorkspaceAnalysisInput,
): PersonalLearningMemory {
  const excluded = new Set(input.excludedApplicationIds ?? [])
  const folderVersions = input.versions.filter(
    (v) => !v.folderId || v.folderId === input.folderId,
  )
  const folderJobs = input.jobs.filter(
    (j) => (!j.folderId || j.folderId === input.folderId) && !excluded.has(j.id),
  )

  const memory = emptyLearningMemory(input.folderId)
  const insights: LearnedInsight[] = []
  const now = Date.now()

  const statusCounts: Record<string, number> = {}
  let interviewOrOffer = 0
  let offers = 0
  let interviews = 0
  let rejections = 0
  let withdrawn = 0

  for (const job of folderJobs) {
    const current = getPipeline(job).at(-1)
    const stageKey = current ? `${current.stage}:${current.outcome}` : "applied:pending"
    statusCounts[stageKey] = (statusCounts[stageKey] ?? 0) + 1
    if (isOfferStage(job) || isHired(job)) {
      offers++
      interviewOrOffer++
    } else if (isInterviewReceived(job)) {
      interviews++
      interviewOrOffer++
    } else if (getPipeline(job).some((record) => record.outcome === "rejected")) rejections++
    else if (getPipeline(job).some((record) => record.outcome === "withdrawn")) withdrawn++
  }

  const total = folderJobs.length
  const interviewRate = total > 0 ? interviews / total : null
  const offerRate = total > 0 ? offers / total : null

  memory.stats = {
    totalApplications: total,
    interviewOrOfferCount: interviewOrOffer,
    resumeVersionCount: folderVersions.length,
    topStatuses: statusCounts,
    lastAnalyzedAt: now,
  }

  const successfulJobs = folderJobs.filter(isSuccessful)
  const successfulLabels = successfulJobs.map(jobLabel).slice(0, 8)

  memory.metrics = {
    interviewRate,
    offerRate,
    rejectionCount: rejections,
    withdrawnCount: withdrawn,
    roleTypeStats: buildRoleStats(folderJobs),
    topKeywords: buildKeywordStats(folderJobs),
    resumeVersionStats: buildResumeVersionStats(folderJobs, folderVersions),
    documentsAnalyzed: {
      resumes: folderVersions.filter((v) => v.resumeText?.trim()).length,
      jobDescriptions: folderJobs.filter((j) => j.jobDescription?.trim()).length,
      coverLetters: folderJobs.filter((j) => j.coverLetter?.content || j.coverLetter?.contentEn).length,
      interviewNotes: folderJobs.filter((j) => j.interviewPrep?.generalNotes?.trim()).length,
    },
    applicationsExcludedFromLearning: excluded.size,
  }

  if (total > 0) {
    const ratePct =
      interviewRate != null ? Math.round((interviewOrOffer / total) * 100) : 0
    insights.push({
      id: stableInsightId("success_patterns", "interview_or_offer_status"),
      category: "success_patterns",
      text: `${interviewOrOffer} of ${total} applications (${ratePct}%) reached interview or offer in this workspace.`,
      why: "Counted application statuses marked interview or offer — evidence from your own tracked outcomes, not other users.",
      evidence: {
        applicationLabels: successfulLabels,
        applicationIds: successfulJobs.map((j) => j.id).slice(0, 10),
        documentTypes: ["application_record"],
        pattern: "interview_or_offer_status",
        sampleCount: interviewOrOffer,
        totalConsidered: total,
      },
      source: "workspace_analysis",
      confidence: confidenceFromRatio(interviewOrOffer, total),
      updatedAt: now,
    })
  }

  const roleStats = memory.metrics.roleTypeStats.filter((r) => r.total >= 2)
  for (const role of roleStats.slice(0, 3)) {
    if (role.interviewOrOffer === 0) continue
    const roleJobs = folderJobs.filter((j) => (j.jobTitle?.trim() || "Other") === role.role)
    insights.push({
      id: stableInsightId("career_goals", `role_type:${role.role}`),
      category: "career_goals",
      text: `Role type "${role.role}": ${role.interviewOrOffer}/${role.total} reached interview or offer.`,
      why: "Grouped applications by job title in this workspace and compared outcomes.",
      evidence: {
        applicationLabels: roleJobs.filter(isSuccessful).map(jobLabel).slice(0, 5),
        applicationIds: roleJobs.map((j) => j.id).slice(0, 8),
        documentTypes: ["application_record", "job_description"],
        pattern: `role_type:${role.role}`,
        sampleCount: role.interviewOrOffer,
        totalConsidered: role.total,
      },
      source: "workspace_analysis",
      confidence: confidenceFromRatio(role.interviewOrOffer, role.total),
      updatedAt: now,
    })
  }

  const topKw = memory.metrics.topKeywords.filter((k) => k.successfulApps >= 2).slice(0, 5)
  for (const kw of topKw) {
    const appsWithKw = folderJobs.filter((j) =>
      tokenize(j.jobDescription ?? "").includes(kw.keyword),
    )
    const successApps = appsWithKw.filter(isSuccessful)
    insights.push({
      id: stableInsightId("keywords", `keyword:${kw.keyword}`),
      category: "keywords",
      text: `Keyword "${kw.keyword}" appears in ${kw.totalApps} job description(s), including ${kw.successfulApps} that reached interview/offer.`,
      why: "Matched terms from job descriptions in this workspace against outcome status.",
      evidence: {
        applicationLabels: successApps.map(jobLabel).slice(0, 5),
        applicationIds: appsWithKw.map((j) => j.id).slice(0, 8),
        documentTypes: ["job_description", "application_record"],
        pattern: `keyword:${kw.keyword}`,
        sampleCount: kw.successfulApps,
        totalConsidered: kw.totalApps,
      },
      source: "workspace_analysis",
      confidence: confidenceFromRatio(kw.successfulApps, kw.totalApps),
      updatedAt: now,
    })
  }

  const topResume = memory.metrics.resumeVersionStats
    .filter((r) => r.linkedApplications >= 2)
    .sort((a, b) => b.successfulApplications - a.successfulApplications)
    .slice(0, 3)

  for (const rv of topResume) {
    if (rv.successfulApplications === 0) continue
    const linked = folderJobs.filter((j) => j.resumeVersionId === rv.versionId)
    insights.push({
      id: stableInsightId("resume_versions", `resume_version:${rv.versionId}`),
      category: "resume_versions",
      text: `Resume "${rv.name}" was used for ${rv.linkedApplications} application(s); ${rv.successfulApplications} reached interview/offer.`,
      why: "Linked resume versions to applications via resumeVersionId in this workspace.",
      evidence: {
        applicationLabels: linked.filter(isSuccessful).map(jobLabel).slice(0, 5),
        applicationIds: linked.map((j) => j.id).slice(0, 8),
        documentTypes: ["resume", "application_record"],
        pattern: `resume_version:${rv.versionId}`,
        sampleCount: rv.successfulApplications,
        totalConsidered: rv.linkedApplications,
      },
      source: "workspace_analysis",
      confidence: confidenceFromRatio(rv.successfulApplications, rv.linkedApplications),
      updatedAt: now,
    })
  }

  if (rejections > 0) {
    const rejected = folderJobs.filter((j) =>
      getPipeline(j).some((record) => record.outcome === "rejected"),
    )
    insights.push({
      id: stableInsightId("rejection", "status_rejected"),
      category: "rejection",
      text: `${rejections} application(s) marked rejected in this workspace.`,
      why: "Based on status you set on applications — add notes in interview prep or company info to enrich future insights.",
      evidence: {
        applicationLabels: rejected.map(jobLabel).slice(0, 6),
        applicationIds: rejected.map((j) => j.id).slice(0, 8),
        documentTypes: ["application_record"],
        pattern: "status:rejected",
        sampleCount: rejections,
        totalConsidered: total,
      },
      source: "workspace_analysis",
      confidence: rejections >= 3 ? "medium" : "low",
      updatedAt: now,
    })
  }

  const withCoverLetter = successfulJobs.filter(
    (j) => j.coverLetter?.content?.trim() || j.coverLetter?.contentEn?.trim(),
  )
  if (withCoverLetter.length >= 2) {
    insights.push({
      id: stableInsightId("cover_letter", "cover_letter_on_success"),
      category: "cover_letter",
      text: `${withCoverLetter.length} successful-track applications included a saved cover letter.`,
      why: "Compared cover letter presence on applications that reached interview/offer.",
      evidence: {
        applicationLabels: withCoverLetter.map(jobLabel).slice(0, 5),
        applicationIds: withCoverLetter.map((j) => j.id).slice(0, 6),
        documentTypes: ["cover_letter", "application_record"],
        pattern: "cover_letter_on_success",
        sampleCount: withCoverLetter.length,
        totalConsidered: successfulJobs.length || 1,
      },
      source: "workspace_analysis",
      confidence: "low",
      updatedAt: now,
    })
  }

  memory.insights = insights.slice(0, 30)
  memory.updatedAt = now
  return memory
}

function buildRoleStats(jobs: JobApplication[]): RoleTypeStat[] {
  const map = new Map<string, RoleTypeStat>()
  for (const job of jobs) {
    const role = job.jobTitle?.trim() || "Other"
    const cur = map.get(role) ?? { role, total: 0, interviewOrOffer: 0 }
    cur.total++
    if (isSuccessful(job)) cur.interviewOrOffer++
    map.set(role, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function buildKeywordStats(jobs: JobApplication[]): KeywordStat[] {
  const map = new Map<string, { total: Set<string>; success: Set<string> }>()
  for (const job of jobs) {
    const words = [...new Set(tokenize(job.jobDescription ?? ""))]
    for (const w of words) {
      const cur = map.get(w) ?? { total: new Set(), success: new Set() }
      cur.total.add(job.id)
      if (isSuccessful(job)) cur.success.add(job.id)
      map.set(w, cur)
    }
  }
  return [...map.entries()]
    .map(([keyword, sets]) => ({
      keyword,
      totalApps: sets.total.size,
      successfulApps: sets.success.size,
    }))
    .filter((k) => k.totalApps >= 2)
    .sort((a, b) => b.successfulApps - a.successfulApps || b.totalApps - a.totalApps)
    .slice(0, 15)
}

function buildResumeVersionStats(
  jobs: JobApplication[],
  versions: ResumeVersion[],
): ResumeVersionStat[] {
  const versionMap = new Map(versions.map((v) => [v.id, v]))
  const stats = new Map<string, ResumeVersionStat>()

  for (const job of jobs) {
    const vid = job.resumeVersionId
    if (!vid) continue
    const ver = versionMap.get(vid)
    const name = ver?.name?.trim() || "Untitled resume"
    const cur = stats.get(vid) ?? {
      versionId: vid,
      name,
      linkedApplications: 0,
      successfulApplications: 0,
    }
    cur.linkedApplications++
    if (isSuccessful(job)) cur.successfulApplications++
    stats.set(vid, cur)
  }

  return [...stats.values()].sort((a, b) => b.linkedApplications - a.linkedApplications)
}
