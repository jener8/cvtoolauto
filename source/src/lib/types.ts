export type ApplicationStage =
  | "applied"
  | "hr_screening"
  | "hiring_manager_interview_1"
  | "hiring_manager_interview_2"
  | "final_interview"
  | "offer"
  | "hired"

export type StageOutcome =
  | "pending"
  | "passed"
  | "rejected"
  | "declined"
  | "withdrawn"
  | "no_response"

export interface ApplicationStageRecord {
  stage: ApplicationStage
  outcome: StageOutcome
  date?: number
  notes?: string
}

export interface FitScore {
  score: number // 1-5 rating
  summary: string // Short explanation
}

export interface RedFlag {
  id: string
  question: string
  answer: string
}

export type YourStorySupportLevel =
  | "strong"
  | "needs_stronger_cv_evidence"
  | "could_be_added_to_cv"
  | "risk_story_stronger_than_cv_proof"

export interface YourStoryCvEvidenceItem {
  id: string
  storyExcerpt: string
  cvSection: string
  cvReference: string
  supportLevel: YourStorySupportLevel
}

export interface YourStory {
  content: string
  lastModified: number
  resumeVersionId: string
  cvEvidence: YourStoryCvEvidenceItem[]
  aiMetadata?: {
    model?: string
    provider?: string
    providerLabel?: string
    generatedAt?: number
  }
  /** Application Story Wizard artefacts — story map, illustration, analysis. */
  applicationStoryWizard?: import("@/lib/application-story-wizard/types").ApplicationStoryWizardArtifact
}

export interface JobApplication {
  id: string
  jobTitle: string
  company: string
  /** Optional job location (city, country, or remote). */
  location?: string
  jobDescription: string
  jobDescriptionSummary?: string // Short summary for job card display
  jobDescriptionUrl?: string // Link to job posting
  strategySummary?: string // Added strategy summary for card display
  why?: string // One powerful motivating sentence explaining why you're applying
  resumeVersionId: string // Links to a saved resume version
  contactPersonName?: string // Optional name of the hiring manager/contact person
  salaryExpectation?: string // Salary expectation (e.g., "60,000-80,000€")
  employmentType?: "full-time" | "part-time" | "contract" | "freelance" // Employment type
  // Fit scores for evaluating job match
  fitScores?: {
    culture?: FitScore
    ambitions?: FitScore
    skills?: FitScore
    strategy?: FitScore
  }
  redFlags?: RedFlag[] // List of red flag questions and answers
  jobStrategy?: {
    intent: string
    strategicFit: string
    positioning: string
    constraints: string
    successCriteria: string
    lastModified: number
  }
  companyInfo: {
    website: string
    researchNotes: string
    linkedInContacts: Array<{
      id: string
      name: string
      role: string
      linkedInUrl: string
      outreachNotes: string
      contactDate: number | null
    }>
    lastModified: number
  }
  contacts: Array<{
    id: string
    name: string
    role: string
    email: string
    phone: string
    linkedIn: string // Added LinkedIn profile URL field
    location?: string // Added optional location field
    language?: string // Added optional language field
    notes: string
  }>
  coverLetterId?: string // Reference to standalone cover letter
  coverLetter?: {
    content: string
    lastModified: number
    /** Bilingual body used by CoverLetterFormatter (optional for legacy rows). */
    contentEn?: string
    contentDe?: string
    applicantName?: string
    applicantAddress?: string
    applicantEmail?: string
    applicantPhone?: string
    letterDate?: string
    aiMetadata?: import("@/lib/cover-letter-ai").CoverLetterAiMetadata
    versionHistory?: import("@/lib/cover-letter-ai").CoverLetterVersionSnapshot[]
  }
  /** Internal positioning narrative — not a cover letter. */
  yourStory?: YourStory
  interviewPrep: {
    questions: Array<{
      id: string
      question: string
      framework: string
      answer: string
      wasAsked?: boolean
      myAnswerNotes?: string
    }>
    possibleAnswers: Array<{
      id: string
      question: string
      answer: string
    }>
    personalDescription: string
    interviewers: Array<{
      id: string
      name: string
      role: string
      notes: string
    }>
    projectStories?: Array<{
      id: string
      projectName: string
      role: string
      challenge: string
      action: string
      result: string
      technologies: string
    }>
    generalNotes: string
    lastModified: number
  }
  /** Stage-based hiring pipeline — source of truth for application progress. */
  pipeline?: ApplicationStageRecord[]
  /**
   * @deprecated Legacy flat status — kept for DB migration reads only.
   * Use `pipeline` instead. Written on save for backward compatibility.
   */
  status?:
    | "applied"
    | "rejected"
    | "interview_invited"
    | "interview_completed"
    | "second_interview"
    | "final_interview"
    | "offer_received"
    | "offer_accepted"
    | "offer_rejected"
    | "withdrawn"
    | "no_response"
  /** Optional sector label for statistics (editable in company research). */
  industry?: string
  appliedDate: number
  /** @deprecated Derived from pipeline stage dates — kept for legacy reads. */
  firstInterviewDate?: number
  /** @deprecated Derived from pipeline stage dates — kept for legacy reads. */
  additionalInterviewDates?: number[]
  /** @deprecated Derived from pipeline terminal stage — kept for legacy reads. */
  rejectionDate?: number
  /** @deprecated Derived from pipeline offer stage — kept for legacy reads. */
  offerDate?: number
  lastModified: number
  folderId?: string // Adding folder association
  /** Draft answers for online application forms (salary, motivation, availability, etc.). */
  uploadDetails?: import("@/lib/upload-details").UploadDetails
}

/** Cover letter stored on a resume (scoped by resume id, not global). */
export interface ResumeEmbeddedCoverLetter {
  id: string
  name: string
  contentEn: string
  contentDe: string
  /** Hiring manager / recipient name (optional). Same value as hiringManager when set. */
  contactPersonName: string
  /** Optional alias for contactPersonName — used in forms and newer saves. */
  hiringManager?: string
  /** Recipient company name shown above the salutation. */
  recipientCompany?: string
  /** Optional profile photo (JPEG data URL) in the letter header. */
  profileImage?: string | null
  /** Optional company logo (JPEG data URL) in the recipient block. */
  companyLogo?: string | null
  /** Sender block on the letter (overrides resume contact when set). */
  applicantName?: string
  applicantAddress?: string
  applicantEmail?: string
  applicantPhone?: string
  letterDate?: string
  aiMetadata?: import("@/lib/cover-letter-ai").CoverLetterAiMetadata
  versionHistory?: import("@/lib/cover-letter-ai").CoverLetterVersionSnapshot[]
  createdAt: number
  updatedAt: number
}

export interface ResumeVersion {
  id: string
  name: string
  /** Stable link to the owning job application (one resume per application). */
  applicationId?: string
  /** Content snapshots — edits create history entries, not new resume records. */
  versionHistory?: ResumeContentSnapshot[]
  /** When true, this CV is a reusable base template — not a role-specific application. */
  isReusableTemplate?: boolean
  resumeText: string
  profileImage: string | null
  companyLogo: string | null
  /** @deprecated Prefer createdAt — kept for backward compatibility */
  timestamp: number
  createdAt?: number
  updatedAt?: number
  contactInfo: {
    email: string
    linkedin: string
    phone: string
    address: string
    citizenship: string
    /** @deprecated Use portfolios[0] — kept for older saved resumes */
    portfolio: string
    /** Up to 3 portfolio / website URLs shown on the resume */
    portfolios: string[]
    showPortfolio: boolean
    professionalTitle: string
    name: string // Adding name field to store user's name
    language: "en" | "de" // Adding language preference for contact info labels
    targetCompany: string // Adding company and role fields for application-specific customization
    targetRole: string
    jobAdvertSource: string // Added jobAdvertSource to contactInfo
  }
  accentColor?: string
  accentColorHex?: string // Store the original hex value for accurate PDF generation
  profilePhotoBorder?: boolean // Whether to show border around profile photo
  targetBoxBgColor?: string // Background color for the job target box
  targetBoxBorderColor?: string // Left border color for the job target box
  jobAdvertSource?: string // Deprecated: keeping for backward compatibility, but now stored in contactInfo
  jobDescription?: string // Job description specific to this resume version/application
  folderId?: string // Adding folder association
  /** Per-resume cover letter — never shared across resumes */
  coverLetter?: ResumeEmbeddedCoverLetter | null
  /** Chronological log of AI actions on this resume */
  aiAuditLog?: AiAuditEntry[]
  /** Cached summary for AI transparency UI */
  aiProvenance?: AiProvenanceSummary
}

export type ContactInfo = ResumeVersion["contactInfo"]

export type AiApprovalStatus = "pending" | "approved" | "rejected" | "edited_after_ai"

export type AiContributionSummary = {
  userAuthoredPercent: number
  aiAssistedPercent: number
  aiGeneratedPercent: number
}

export type AiAuditEntry = {
  id: string
  createdAt: number
  action: string
  model: string
  provider: string
  providerLabel?: string
  approvalStatus: AiApprovalStatus
  approvedAt?: number
  rejectedAt?: number
  instruction?: string
  changes?: import("@/lib/cv-edit-types").CvEditChange[]
  explainability?: import("@/lib/ai-transparency").AiExplainability
  feature?: string
  snapshotId?: string
  assistantMessageId?: string
}

export type AiProvenanceSummary = {
  lastModel?: string
  lastProvider?: string
  lastProviderLabel?: string
  lastAiUpdateAt?: number
  firstAiGeneratedAt?: number
  featuresUsed: string[]
  contribution: AiContributionSummary
}

export type ResumeContentSnapshot = {
  id: string
  resumeText: string
  contactInfo: ContactInfo
  profileImage: string | null
  companyLogo: string | null
  accentColor?: string
  accentColorHex?: string
  targetBoxBgColor?: string
  targetBoxBorderColor?: string
  profilePhotoBorder?: boolean
  jobDescription?: string
  coverLetter?: ResumeEmbeddedCoverLetter | null
  label: string
  createdAt: number
  source: "manual" | "ai_edit" | "restore" | "generation" | "autosave"
  aiMetadata?: import("@/lib/ai-transparency").AiSnapshotMetadata
}

export interface FolderContactInfo {
  name: string
  email: string
  phone: string
  address: string
  linkedin: string
  citizenship: string
  /** @deprecated Use portfolios[0] */
  portfolio: string
  portfolios: string[]
  professionalTitle: string
  language: "en" | "de"
}

export interface Folder {
  id: string
  name: string
  profileImage: string | null
  contactInfo: FolderContactInfo
  createdAt: number
  updatedAt: number
}

export interface CoverLetter {
  id: string
  name: string
  contentEn: string
  contentDe: string
  contactPersonName: string
  hiringManager?: string
  recipientCompany?: string
  profileImage?: string | null
  companyLogo?: string | null
  applicantName?: string
  applicantAddress?: string
  applicantEmail?: string
  applicantPhone?: string
  letterDate?: string
  folderId?: string
  aiMetadata?: import("@/lib/cover-letter-ai").CoverLetterAiMetadata
  versionHistory?: import("@/lib/cover-letter-ai").CoverLetterVersionSnapshot[]
  createdAt: number
  updatedAt: number
}
