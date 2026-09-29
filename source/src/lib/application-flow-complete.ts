import type { JobApplication } from "@/lib/types"

export type ApplicationFlowCompletePayload = {
  applicationName: string
  resumeContent: string
  jobDescription: string
  company: string
  jobDescriptionUrl: string
  outputLanguage: "en" | "de"
  wizardSessionId: string
}

export function deriveApplicationName(draft: {
  applicationName: string
  company: string
  jobDescription: string
}): string {
  if (draft.applicationName.trim()) return draft.applicationName.trim()
  const company = draft.company.trim()
  const firstLine = draft.jobDescription.trim().split("\n")[0]?.slice(0, 60).trim()
  if (company && firstLine) return `${company} — ${firstLine}`
  if (company) return company
  if (firstLine) return firstLine
  return "Untitled Application"
}

export function deriveJobTitleFromDraft(
  applicationName: string,
  company: string,
  jobDescription: string,
): string {
  if (applicationName.trim()) return applicationName.trim()
  const firstLine = jobDescription.trim().split("\n")[0]?.slice(0, 80).trim()
  if (company.trim() && firstLine) return `${company.trim()} — ${firstLine}`
  if (company.trim()) return company.trim()
  return firstLine || "New Application"
}

export function emptyJobApplicationFields(
  overrides: Partial<JobApplication> & Pick<JobApplication, "resumeVersionId">,
): Omit<JobApplication, "id"> {
  const now = Date.now()
  return {
    jobTitle: "",
    company: "",
    jobDescription: "",
    jobDescriptionSummary: "",
    jobDescriptionUrl: "",
    resumeVersionId: overrides.resumeVersionId,
    coverLetterId: "",
    companyInfo: {
      website: "",
      researchNotes: "",
      linkedInContacts: [],
      lastModified: now,
    },
    contacts: [],
    coverLetter: {
      content: "",
      contentEn: "",
      contentDe: "",
      lastModified: now,
    },
    interviewPrep: {
      questions: [],
      personalDescription: "",
      interviewers: [],
      generalNotes: "",
      lastModified: now,
    },
    pipeline: [{ stage: "applied", outcome: "pending", date: now }],
    appliedDate: now,
    additionalInterviewDates: [],
    lastModified: now,
    salaryExpectation: "",
    employmentType: "full-time",
    why: "",
    ...overrides,
  }
}
