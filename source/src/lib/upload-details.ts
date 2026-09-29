export interface UploadDetailsSalaryGuidance {
  suggestedRange?: string
  conservativeAnswer?: string
  confidentAnswer?: string
  flexibleAnswer?: string
  assumptions?: string[]
}

export interface UploadDetails {
  /** Language for generated form answers (English or German). */
  outputLanguage?: "en" | "de"
  salaryExpectation?: string
  availability?: string
  whyRole?: string
  whyCompany?: string
  fitStatement?: string
  shortMotivation?: string
  locationPreference?: string
  additionalNotes?: string
  salaryGuidance?: UploadDetailsSalaryGuidance
  generatedAt?: number
  updatedAt?: number
}

export type UploadDetailsFieldKey =
  | "salaryExpectation"
  | "availability"
  | "whyRole"
  | "whyCompany"
  | "fitStatement"
  | "shortMotivation"
  | "locationPreference"
  | "additionalNotes"

export const UPLOAD_DETAILS_FIELD_META: Array<{
  key: UploadDetailsFieldKey
  label: string
  description: string
  rows: number
}> = [
  {
    key: "salaryExpectation",
    label: "Salary expectation",
    description: "Paste-ready answer for salary fields on application forms.",
    rows: 2,
  },
  {
    key: "availability",
    label: "Availability / notice period",
    description: "Uses your profile notice period when set. Paste-ready start date or notice answer.",
    rows: 2,
  },
  {
    key: "whyRole",
    label: "Why I want this role",
    description: "Motivation focused on the role itself.",
    rows: 4,
  },
  {
    key: "whyCompany",
    label: "What I like about this company",
    description: "Company-specific interest without generic praise.",
    rows: 4,
  },
  {
    key: "fitStatement",
    label: "Why I am a good fit",
    description: "Evidence-based fit statement tied to the CV.",
    rows: 4,
  },
  {
    key: "shortMotivation",
    label: "Short application motivation",
    description: "Concise statement for short text boxes (2–4 sentences).",
    rows: 3,
  },
  {
    key: "locationPreference",
    label: "Location / hybrid / remote preference",
    description: "Work location and flexibility preferences.",
    rows: 2,
  },
  {
    key: "additionalNotes",
    label: "Additional notes",
    description: "Other form answers or talking points to remember.",
    rows: 3,
  },
]

export function emptyUploadDetails(): UploadDetails {
  return {}
}

export function hasUploadDetailsContent(details?: UploadDetails | null): boolean {
  if (!details) return false
  return UPLOAD_DETAILS_FIELD_META.some((field) => Boolean(details[field.key]?.trim()))
}

export function normalizeUploadDetails(raw: unknown): UploadDetails | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const source = raw as Record<string, unknown>
  const guidanceRaw = source.salaryGuidance
  let salaryGuidance: UploadDetailsSalaryGuidance | undefined
  if (guidanceRaw && typeof guidanceRaw === "object") {
    const g = guidanceRaw as Record<string, unknown>
    salaryGuidance = {
      suggestedRange: typeof g.suggestedRange === "string" ? g.suggestedRange : undefined,
      conservativeAnswer:
        typeof g.conservativeAnswer === "string" ? g.conservativeAnswer : undefined,
      confidentAnswer: typeof g.confidentAnswer === "string" ? g.confidentAnswer : undefined,
      flexibleAnswer: typeof g.flexibleAnswer === "string" ? g.flexibleAnswer : undefined,
      assumptions: Array.isArray(g.assumptions)
        ? g.assumptions.filter((item): item is string => typeof item === "string")
        : undefined,
    }
  }

  const details: UploadDetails = {
    outputLanguage:
      source.outputLanguage === "de" ? "de" : source.outputLanguage === "en" ? "en" : undefined,
    salaryExpectation:
      typeof source.salaryExpectation === "string" ? source.salaryExpectation : undefined,
    availability: typeof source.availability === "string" ? source.availability : undefined,
    whyRole: typeof source.whyRole === "string" ? source.whyRole : undefined,
    whyCompany: typeof source.whyCompany === "string" ? source.whyCompany : undefined,
    fitStatement: typeof source.fitStatement === "string" ? source.fitStatement : undefined,
    shortMotivation:
      typeof source.shortMotivation === "string" ? source.shortMotivation : undefined,
    locationPreference:
      typeof source.locationPreference === "string" ? source.locationPreference : undefined,
    additionalNotes:
      typeof source.additionalNotes === "string" ? source.additionalNotes : undefined,
    salaryGuidance,
    generatedAt: typeof source.generatedAt === "number" ? source.generatedAt : undefined,
    updatedAt: typeof source.updatedAt === "number" ? source.updatedAt : undefined,
  }

  return hasUploadDetailsContent(details) ||
    Boolean(details.salaryGuidance?.suggestedRange?.trim()) ||
    Boolean(details.salaryGuidance?.conservativeAnswer?.trim()) ||
    Boolean(details.salaryGuidance?.confidentAnswer?.trim()) ||
    Boolean(details.salaryGuidance?.flexibleAnswer?.trim()) ||
    Boolean(details.salaryGuidance?.assumptions?.length)
    ? details
    : undefined
}

export function mergeUploadDetails(
  existing: UploadDetails | undefined,
  patch: Partial<UploadDetails>,
): UploadDetails {
  const now = Date.now()
  return {
    ...existing,
    ...patch,
    salaryGuidance: patch.salaryGuidance
      ? { ...existing?.salaryGuidance, ...patch.salaryGuidance }
      : existing?.salaryGuidance,
    updatedAt: now,
    generatedAt: patch.generatedAt ?? existing?.generatedAt ?? now,
  }
}

export function parseUploadDetailsJson(text: string): UploadDetails | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed

  try {
    const parsed = JSON.parse(candidate) as unknown
    return normalizeUploadDetails(parsed) ?? null
  } catch {
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown
        return normalizeUploadDetails(parsed) ?? null
      } catch {
        return null
      }
    }
    return null
  }
}
