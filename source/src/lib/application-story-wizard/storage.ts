import type { ApplicationStoryWizardDraft } from "@/lib/application-story-wizard/types"

const DRAFT_KEY = "cv_application_story_wizard_draft"

export function createInitialStoryWizardDraft(
  partial?: Partial<ApplicationStoryWizardDraft>,
): ApplicationStoryWizardDraft {
  return {
    companyWebsiteUrl: "",
    jobDescription: "",
    tailoredResumeVersionId: "",
    jobTitle: "",
    company: "",
    resumeContent: "",
    outputLanguage: "en",
    optionalSources: {},
    ...partial,
  }
}

export function loadStoryWizardDraft(): ApplicationStoryWizardDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ApplicationStoryWizardDraft
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

export function saveStoryWizardDraft(draft: ApplicationStoryWizardDraft): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function clearStoryWizardDraft(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(DRAFT_KEY)
}

export function isStoryWizardInputsComplete(draft: ApplicationStoryWizardDraft): boolean {
  return Boolean(
    draft.companyWebsiteUrl.trim() &&
      draft.jobDescription.trim() &&
      draft.resumeContent.trim() &&
      draft.tailoredResumeVersionId.trim(),
  )
}
