import type { QualificationProfile, QualificationWizardDraft } from "@/lib/qualification-profile/types"

export const QUALIFICATION_PROFILE_STORAGE_KEY = "qualification-profile"
const DRAFT_KEY = "qualification-wizard-draft"

export const QUALIFICATION_PROFILE_UPDATED_EVENT = "qualification-profile-updated"

function notifyUpdated(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(QUALIFICATION_PROFILE_UPDATED_EVENT))
}

export function emptyQualificationProfile(): QualificationProfile {
  return {}
}

export function hasQualificationProfileContent(
  profile: QualificationProfile | null | undefined,
): boolean {
  if (!profile) return false
  if (profile.completedAt) return true
  return Boolean(
    profile.studyCountry?.trim() ||
      profile.institution?.trim() ||
      profile.degree?.trim() ||
      profile.fieldOfStudy?.trim() ||
      profile.workExperience?.trim() ||
      profile.recognitionStatus ||
      (profile.achievements && profile.achievements.length > 0) ||
      (profile.languages && profile.languages.length > 0) ||
      (profile.abilities && profile.abilities.length > 0),
  )
}

export function isQualificationWizardComplete(
  profile: QualificationProfile | null | undefined,
): boolean {
  return Boolean(profile?.completedAt)
}

export function loadQualificationProfile(): QualificationProfile {
  if (typeof window === "undefined") return emptyQualificationProfile()
  try {
    const raw = localStorage.getItem(QUALIFICATION_PROFILE_STORAGE_KEY)
    if (!raw) return emptyQualificationProfile()
    const parsed = JSON.parse(raw) as Partial<QualificationProfile>
    if (typeof parsed !== "object" || parsed === null) return emptyQualificationProfile()
    return normalizeProfile(parsed)
  } catch {
    return emptyQualificationProfile()
  }
}

function normalizeProfile(parsed: Partial<QualificationProfile>): QualificationProfile {
  return {
    studyCountry: stringOrUndefined(parsed.studyCountry),
    institution: stringOrUndefined(parsed.institution),
    degree: stringOrUndefined(parsed.degree),
    yearsAttended: stringOrUndefined(parsed.yearsAttended),
    fieldOfStudy: stringOrUndefined(parsed.fieldOfStudy),
    specialisation: stringOrUndefined(parsed.specialisation),
    educationType: parsed.educationType ?? undefined,
    workExperience: stringOrUndefined(parsed.workExperience),
    yearsOfExperience: stringOrUndefined(parsed.yearsOfExperience),
    recognitionStatus: parsed.recognitionStatus ?? undefined,
    documentChoice: parsed.documentChoice ?? undefined,
    documents: Array.isArray(parsed.documents) ? parsed.documents : undefined,
    achievements: Array.isArray(parsed.achievements) ? (parsed.achievements as QualificationProfile["achievements"]) : undefined,
    abilities: Array.isArray(parsed.abilities) ? (parsed.abilities as QualificationProfile["abilities"]) : undefined,
    languages: Array.isArray(parsed.languages) ? (parsed.languages as QualificationProfile["languages"]) : undefined,
    completedAt: typeof parsed.completedAt === "number" ? parsed.completedAt : undefined,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function saveQualificationProfile(profile: QualificationProfile): QualificationProfile {
  if (typeof window === "undefined") return profile
  const normalized: QualificationProfile = { ...profile, updatedAt: Date.now() }
  localStorage.setItem(QUALIFICATION_PROFILE_STORAGE_KEY, JSON.stringify(normalized))
  notifyUpdated()
  return normalized
}

export function createInitialWizardDraft(
  partial?: Partial<QualificationWizardDraft>,
): QualificationWizardDraft {
  return {
    step: "intro",
    ...partial,
    startedAt: partial?.startedAt ?? Date.now(),
  }
}

export function loadQualificationWizardDraft(): QualificationWizardDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as QualificationWizardDraft
    if (!parsed || typeof parsed !== "object") return null
    return { ...createInitialWizardDraft(), ...parsed }
  } catch {
    return null
  }
}

export function saveQualificationWizardDraft(draft: QualificationWizardDraft): void {
  if (typeof window === "undefined") return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function clearQualificationWizardDraft(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(DRAFT_KEY)
}

export function completeQualificationWizard(
  draft: QualificationWizardDraft,
): QualificationProfile {
  const { step: _step, startedAt: _startedAt, ...profile } = draft
  const completed = saveQualificationProfile({
    ...profile,
    completedAt: Date.now(),
  })
  clearQualificationWizardDraft()
  return completed
}
