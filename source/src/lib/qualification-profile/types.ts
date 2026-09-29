export type EducationType = "vocational" | "university" | "other" | ""

export type RecognitionStatus = "yes" | "no" | "in_progress" | "not_sure" | ""

export type DocumentUploadChoice = "now" | "later" | ""

export type QualificationWizardStep =
  | "intro"
  | "study"
  | "field"
  | "experience"
  | "recognition"
  | "documents"
  | "complete"

export type QualificationDocumentMeta = {
  name: string
  size: number
  addedAt: number
}

export type QualificationAchievementTag =
  | "paid_work"
  | "informal_work"
  | "volunteering"
  | "family_caregiving"
  | "community"
  | "self_taught"

export type QualificationAchievement = {
  id: string
  description: string
  duration?: string
  scale?: string
  outcome?: string
  tags: QualificationAchievementTag[]
  createdFrom: "qualifications_page"
  createdAt: number
}

export type LanguageLevelPlain = "basic" | "conversational" | "fluent" | "native"
export type LanguageLevelCefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

export type QualificationLanguage = {
  id: string
  name: string
  level: LanguageLevelPlain
  cefr?: LanguageLevelCefr
}

export type AbilityCategory =
  | "languages"
  | "digital_tools"
  | "working_with_people"
  | "organising_planning"
  | "craft_technical"
  | "teaching_explaining"
  | "other"

export type QualificationAbility = {
  id: string
  name: string
  category?: AbilityCategory
  languageLevel?: LanguageLevelPlain
  cefr?: LanguageLevelCefr
  evidenceAchievementIds: string[]
}

/** Saved qualification background — localStorage, user-level. */
export interface QualificationProfile {
  studyCountry?: string
  institution?: string
  degree?: string
  yearsAttended?: string
  fieldOfStudy?: string
  specialisation?: string
  educationType?: EducationType
  workExperience?: string
  yearsOfExperience?: string
  recognitionStatus?: RecognitionStatus
  documentChoice?: DocumentUploadChoice
  documents?: QualificationDocumentMeta[]
  achievements?: QualificationAchievement[]
  abilities?: QualificationAbility[]
  languages?: QualificationLanguage[]
  completedAt?: number
  updatedAt?: number
}

export interface QualificationWizardDraft extends QualificationProfile {
  step: QualificationWizardStep
  startedAt?: number
}

export const QUALIFICATION_WIZARD_STEPS: QualificationWizardStep[] = [
  "study",
  "field",
  "experience",
  "recognition",
  "documents",
]

export function stepIndex(step: QualificationWizardStep): number {
  if (step === "intro" || step === "complete") return -1
  return QUALIFICATION_WIZARD_STEPS.indexOf(step)
}

export function stepProgressLabel(step: QualificationWizardStep): string | null {
  const index = stepIndex(step)
  if (index < 0) return null
  return `Step ${index + 1} of ${QUALIFICATION_WIZARD_STEPS.length}`
}
