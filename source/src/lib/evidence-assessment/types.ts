/** Qualitative evidence fit — not a job-match score or percentage. */
export type EvidenceFit = "direct" | "transferable" | "partial" | "not_evidenced"

/** Status of the cited work — independent of fit. */
export type EvidenceMaturity = "delivered" | "in_progress" | "proposed"

export type EvidenceSourceKind = "experience" | "project" | "research" | "other"

export type EvidenceAssessmentConfidence = "high" | "medium" | "low"

export type EvidenceTableLayout = "two_column" | "three_column"

export type EvidenceAssessmentRow = {
  id: string
  requirementPhrase: string
  requirementSourceText?: string
  evidenceText: string
  evidenceSource: EvidenceSourceKind
  evidenceSourceRef?: string
  fit: EvidenceFit
  fitRationale: string
  maturity: EvidenceMaturity
  maturityRationale?: string
  /** Short verifiable outcome/status for optional CV column 3. Never a match %. */
  outcomeLabel?: string
  confidence: EvidenceAssessmentConfidence
  /** True when the user edited classification or text. */
  userOverride?: boolean
  /** User marked this row ready for CV inclusion. */
  approved?: boolean
}

export type EvidenceAssessmentPlan = {
  employerProblemSummary?: string
  rows: EvidenceAssessmentRow[]
  /** Soft note when 3-col may crowd the page — never auto-shrink fonts. */
  layoutHint?: string
}

export const EVIDENCE_FITS: EvidenceFit[] = [
  "direct",
  "transferable",
  "partial",
  "not_evidenced",
]

export const EVIDENCE_MATURITIES: EvidenceMaturity[] = [
  "delivered",
  "in_progress",
  "proposed",
]

export const EVIDENCE_SOURCES: EvidenceSourceKind[] = [
  "experience",
  "project",
  "research",
  "other",
]
