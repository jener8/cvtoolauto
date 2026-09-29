/** Folder-scoped personal AI memory — never shared across folders/users. */

export type InsightConfidence = "low" | "medium" | "high"

export type InsightDocumentType =
  | "resume"
  | "job_description"
  | "cover_letter"
  | "interview_notes"
  | "application_record"

export type InsightEvidence = {
  /** Human-readable labels e.g. "Acme — Product Designer" */
  applicationLabels?: string[]
  applicationIds?: string[]
  documentTypes?: InsightDocumentType[]
  /** What pattern was detected */
  pattern?: string
  /** e.g. 4 of 7 applications */
  sampleCount?: number
  totalConsidered?: number
}

export type LearnedInsight = {
  id: string
  category:
    | "writing_style"
    | "career_goals"
    | "strengths"
    | "keywords"
    | "success_patterns"
    | "industries"
    | "cover_letter"
    | "interview"
    | "rejection"
    | "resume_versions"
    | "other"
  /** Primary user-facing statement */
  text: string
  /** Transparent explanation (why we suggest this) */
  why?: string
  evidence?: InsightEvidence
  source: "workspace_analysis" | "conversation" | "user_correction"
  confidence: InsightConfidence
  /** User override — takes precedence when set */
  userCorrection?: string | null
  dismissed?: boolean
  updatedAt: number
}

export type RoleTypeStat = {
  role: string
  total: number
  interviewOrOffer: number
}

export type KeywordStat = {
  keyword: string
  totalApps: number
  successfulApps: number
}

export type ResumeVersionStat = {
  versionId: string
  name: string
  linkedApplications: number
  successfulApplications: number
}

export type LearningDashboardMetrics = {
  interviewRate: number | null
  offerRate: number | null
  rejectionCount: number
  withdrawnCount: number
  roleTypeStats: RoleTypeStat[]
  topKeywords: KeywordStat[]
  resumeVersionStats: ResumeVersionStat[]
  documentsAnalyzed: {
    resumes: number
    jobDescriptions: number
    coverLetters: number
    interviewNotes: number
  }
  applicationsExcludedFromLearning: number
}

export type PersonalLearningSettings = {
  enabled: boolean
  excludedApplicationIds: string[]
  updatedAt: number
}

export type PersonalLearningMemory = {
  folderId: string
  insights: LearnedInsight[]
  metrics: LearningDashboardMetrics
  stats: {
    totalApplications: number
    interviewOrOfferCount: number
    resumeVersionCount: number
    topStatuses: Record<string, number>
    lastAnalyzedAt: number
  }
  updatedAt: number
}

export const DEFAULT_LEARNING_SETTINGS: PersonalLearningSettings = {
  enabled: true,
  excludedApplicationIds: [],
  updatedAt: Date.now(),
}

export function emptyDashboardMetrics(): LearningDashboardMetrics {
  return {
    interviewRate: null,
    offerRate: null,
    rejectionCount: 0,
    withdrawnCount: 0,
    roleTypeStats: [],
    topKeywords: [],
    resumeVersionStats: [],
    documentsAnalyzed: {
      resumes: 0,
      jobDescriptions: 0,
      coverLetters: 0,
      interviewNotes: 0,
    },
    applicationsExcludedFromLearning: 0,
  }
}

export function emptyLearningMemory(folderId: string): PersonalLearningMemory {
  return {
    folderId,
    insights: [],
    metrics: emptyDashboardMetrics(),
    stats: {
      totalApplications: 0,
      interviewOrOfferCount: 0,
      resumeVersionCount: 0,
      topStatuses: {},
      lastAnalyzedAt: 0,
    },
    updatedAt: Date.now(),
  }
}

/** Normalize legacy stored memory */
export function normalizeLearningMemory(raw: PersonalLearningMemory): PersonalLearningMemory {
  return {
    ...raw,
    metrics: raw.metrics ?? emptyDashboardMetrics(),
    insights: (raw.insights ?? []).map((i) => ({
      ...i,
      why: i.why ?? undefined,
      evidence: i.evidence ?? undefined,
      dismissed: i.dismissed ?? false,
      userCorrection: i.userCorrection ?? undefined,
    })),
  }
}
