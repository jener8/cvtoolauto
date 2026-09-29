import { deriveApplicationName } from "@/lib/application-flow-complete"
import { isCvTextUsable } from "@/lib/cv-text-quality"
import type { JobApplication } from "@/lib/types"

export type CvSource = "upload" | "paste" | "workspace" | "blank" | null

/** Legacy values persisted before the honest CV source redesign */
export type LegacyCvSource = "linkedin" | "manual"

export type ApplicationFlowDraft = {
  applicationName: string
  generalCv: string
  jobDescription: string
  jobDescriptionUrl: string
  company: string
  focusedCv: string
  outputLanguage: "en" | "de"
  /** Step 1: null = source picker not chosen yet */
  cvSource?: CvSource | LegacyCvSource
}

export type ApplicationFlowPersistedDraft = {
  sessionId: string
  draft: ApplicationFlowDraft
  updatedAt: number
  /** Stable application row id for this wizard session (idempotency). */
  applicationId?: string
  /** Stable resume version id for this wizard session. */
  resumeVersionId?: string
}

const STORAGE_KEY = "cv_application_flow_draft"

export const EMPTY_APPLICATION_FLOW_DRAFT: ApplicationFlowDraft = {
  applicationName: "",
  generalCv: "",
  jobDescription: "",
  jobDescriptionUrl: "",
  company: "",
  focusedCv: "",
  outputLanguage: "en",
  cvSource: null,
}

export function createApplicationFlowSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeCvSource(
  source: CvSource | LegacyCvSource | undefined | null,
): CvSource {
  if (source === "linkedin" || source === "manual") return "paste"
  if (source === "upload" || source === "paste" || source === "workspace" || source === "blank") {
    return source
  }
  return null
}

export function isCvSourceStepComplete(draft: ApplicationFlowDraft): boolean {
  const source = normalizeCvSource(draft.cvSource)
  if (!source) return false
  if (source === "blank") return true
  const text = draft.generalCv.trim()
  if (!text) return false
  return isCvTextUsable(text).ok
}

function readPersistedDraft(): ApplicationFlowPersistedDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ApplicationFlowPersistedDraft> & Partial<ApplicationFlowDraft>

    // Legacy format: plain ApplicationFlowDraft JSON without session envelope.
    if (!parsed.sessionId || !parsed.draft) {
      const legacyDraft = parsed as Partial<ApplicationFlowDraft>
      const draft: ApplicationFlowDraft = {
        ...EMPTY_APPLICATION_FLOW_DRAFT,
        ...legacyDraft,
        cvSource: normalizeCvSource(legacyDraft.cvSource) ?? null,
      }
      return {
        sessionId: createApplicationFlowSessionId(),
        draft,
        updatedAt: Date.now(),
      }
    }

    const draft = parsed.draft
    return {
      sessionId: parsed.sessionId,
      draft: {
        ...EMPTY_APPLICATION_FLOW_DRAFT,
        ...draft,
        cvSource: normalizeCvSource(draft.cvSource) ?? null,
      },
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      applicationId: typeof parsed.applicationId === "string" ? parsed.applicationId : undefined,
      resumeVersionId:
        typeof parsed.resumeVersionId === "string" ? parsed.resumeVersionId : undefined,
    }
  } catch {
    return null
  }
}

export function loadApplicationFlowDraft(): ApplicationFlowDraft | null {
  return readPersistedDraft()?.draft ?? null
}

export function loadApplicationFlowSessionId(): string | null {
  return readPersistedDraft()?.sessionId ?? null
}

export function hasRecoverableApplicationFlowDraft(): boolean {
  const persisted = readPersistedDraft()
  if (!persisted) return false

  const draft = persisted.draft
  return Boolean(
    draft.applicationName.trim() ||
      draft.generalCv.trim() ||
      draft.jobDescription.trim() ||
      draft.company.trim() ||
      draft.jobDescriptionUrl.trim() ||
      draft.focusedCv.trim() ||
      normalizeCvSource(draft.cvSource),
  )
}

export function saveApplicationFlowDraft(
  draft: ApplicationFlowDraft,
  sessionId?: string | null,
): void {
  if (typeof window === "undefined") return
  try {
    const existing = readPersistedDraft()
    const nextSessionId = sessionId ?? existing?.sessionId ?? createApplicationFlowSessionId()
    const payload: ApplicationFlowPersistedDraft = {
      sessionId: nextSessionId,
      draft: {
        ...EMPTY_APPLICATION_FLOW_DRAFT,
        ...draft,
        cvSource: normalizeCvSource(draft.cvSource) ?? null,
      },
      updatedAt: Date.now(),
      applicationId: existing?.sessionId === nextSessionId ? existing.applicationId : undefined,
      resumeVersionId: existing?.sessionId === nextSessionId ? existing.resumeVersionId : undefined,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors for draft helper
  }
}

export function loadWizardApplicationIds(sessionId: string): {
  applicationId?: string
  resumeVersionId?: string
} {
  const persisted = readPersistedDraft()
  if (!persisted || persisted.sessionId !== sessionId) return {}
  return {
    applicationId: persisted.applicationId,
    resumeVersionId: persisted.resumeVersionId,
  }
}

export function saveWizardApplicationIds(
  sessionId: string,
  ids: { applicationId?: string; resumeVersionId?: string },
): void {
  if (typeof window === "undefined") return
  const persisted = readPersistedDraft()
  const draft = persisted?.sessionId === sessionId ? persisted.draft : EMPTY_APPLICATION_FLOW_DRAFT
  const payload: ApplicationFlowPersistedDraft = {
    sessionId,
    draft,
    updatedAt: Date.now(),
    applicationId: ids.applicationId ?? persisted?.applicationId,
    resumeVersionId: ids.resumeVersionId ?? persisted?.resumeVersionId,
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

export function getOrCreateWizardApplicationIds(sessionId: string): {
  applicationId: string
  resumeVersionId: string
} {
  const existing = loadWizardApplicationIds(sessionId)
  const applicationId = existing.applicationId ?? createApplicationFlowSessionId()
  const resumeVersionId = existing.resumeVersionId ?? createApplicationFlowSessionId()
  saveWizardApplicationIds(sessionId, { applicationId, resumeVersionId })
  return { applicationId, resumeVersionId }
}

export function clearWizardApplicationIds(sessionId: string): void {
  if (typeof window === "undefined") return
  const persisted = readPersistedDraft()
  if (!persisted || persisted.sessionId !== sessionId) return
  saveApplicationFlowDraft(persisted.draft, sessionId)
}

export function clearApplicationFlowDraft(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(STORAGE_KEY)
}

/** Clears any saved wizard draft and returns a new session id for a fresh flow. */
export function startFreshApplicationFlowDraft(): string {
  const sessionId = createApplicationFlowSessionId()
  clearApplicationFlowDraft()
  saveApplicationFlowDraft(EMPTY_APPLICATION_FLOW_DRAFT, sessionId)
  return sessionId
}

/** Pre-fill the wizard for an existing application that is missing a CV. */
export function startApplicationFlowForJob(job: JobApplication): string {
  const sessionId = createApplicationFlowSessionId()
  clearApplicationFlowDraft()

  const lang = typeof window !== "undefined" ? sessionStorage.getItem("cvLanguage") : null
  const outputLanguage = lang === "de" || lang === "en" ? lang : "en"
  const applicationName =
    job.jobTitle?.trim() ||
    deriveApplicationName({
      applicationName: "",
      company: job.company || "",
      jobDescription: job.jobDescription || "",
    })

  const draft: ApplicationFlowDraft = {
    applicationName,
    generalCv: "",
    jobDescription: job.jobDescription || "",
    jobDescriptionUrl: job.jobDescriptionUrl || "",
    company: job.company || "",
    focusedCv: "",
    outputLanguage,
    cvSource: null,
  }

  const resumeVersionId = job.resumeVersionId?.trim() || createApplicationFlowSessionId()
  const payload: ApplicationFlowPersistedDraft = {
    sessionId,
    draft,
    updatedAt: Date.now(),
    applicationId: job.id,
    resumeVersionId,
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  return sessionId
}

export function createInitialApplicationFlowDraft(
  restoreDraft: boolean,
  sessionId?: string,
): {
  draft: ApplicationFlowDraft
  sessionId: string
} {
  const lang = typeof window !== "undefined" ? sessionStorage.getItem("cvLanguage") : null
  const outputLanguage = lang === "de" || lang === "en" ? lang : "en"

  if (restoreDraft && typeof window !== "undefined") {
    const persisted = readPersistedDraft()
    if (persisted) {
      return {
        sessionId: persisted.sessionId,
        draft: {
          ...persisted.draft,
          outputLanguage: persisted.draft.outputLanguage ?? outputLanguage,
          cvSource: persisted.draft.cvSource ?? null,
        },
      }
    }
  }

  return {
    sessionId: sessionId ?? createApplicationFlowSessionId(),
    draft: { ...EMPTY_APPLICATION_FLOW_DRAFT, outputLanguage },
  }
}
