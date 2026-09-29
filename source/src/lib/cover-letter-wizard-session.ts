export type CoverLetterWizardSession = {
  active: true
  step: number
  contentEn?: string
  contentDe?: string
  language?: "en" | "de"
}

const MAX_WIZARD_DRAFT_CHARS = 80_000

function trimDraft(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (value.length <= MAX_WIZARD_DRAFT_CHARS) return value
  return value.slice(0, MAX_WIZARD_DRAFT_CHARS)
}

function storageKey(resumeId: string): string {
  return `cover-letter-wizard:${resumeId}`
}

export function readCoverLetterWizardSession(resumeId: string): CoverLetterWizardSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(storageKey(resumeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CoverLetterWizardSession>
    if (parsed.active !== true) return null
    const step = typeof parsed.step === "number" ? parsed.step : 1
    return {
      active: true,
      step: Math.min(4, Math.max(1, step)),
      contentEn: typeof parsed.contentEn === "string" ? parsed.contentEn : undefined,
      contentDe: typeof parsed.contentDe === "string" ? parsed.contentDe : undefined,
      language: parsed.language === "de" ? "de" : parsed.language === "en" ? "en" : undefined,
    }
  } catch {
    return null
  }
}

export function writeCoverLetterWizardSession(
  resumeId: string,
  step: number,
  draft?: Pick<CoverLetterWizardSession, "contentEn" | "contentDe" | "language">,
): void {
  if (typeof window === "undefined") return
  try {
    const existing = readCoverLetterWizardSession(resumeId)
    sessionStorage.setItem(
      storageKey(resumeId),
      JSON.stringify({
        active: true,
        step: Math.min(4, Math.max(1, step)),
        contentEn: trimDraft(draft?.contentEn ?? existing?.contentEn),
        contentDe: trimDraft(draft?.contentDe ?? existing?.contentDe),
        language: draft?.language ?? existing?.language,
      } satisfies CoverLetterWizardSession),
    )
  } catch {
    /* ignore quota errors */
  }
}

export function clearCoverLetterWizardSession(resumeId: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(storageKey(resumeId))
  } catch {
    /* ignore */
  }
}
