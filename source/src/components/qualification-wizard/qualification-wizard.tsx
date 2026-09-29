"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  BookOpen,
  Briefcase,
  Check,
  FileUp,
  GraduationCap,
  HelpCircle,
  ShieldCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Illustration } from "@/components/illustrations/illustration"
import type { IllustrationSlot } from "@/lib/illustration-slots"
import {
  clearQualificationWizardDraft,
  completeQualificationWizard,
  createInitialWizardDraft,
  loadQualificationProfile,
  loadQualificationWizardDraft,
  saveQualificationWizardDraft,
} from "@/lib/qualification-profile/storage"
import type {
  DocumentUploadChoice,
  EducationType,
  QualificationProfile,
  QualificationWizardDraft,
  QualificationWizardStep,
  RecognitionStatus,
} from "@/lib/qualification-profile/types"
import {
  QUALIFICATION_WIZARD_STEPS,
  stepIndex,
  stepProgressLabel,
} from "@/lib/qualification-profile/types"
import { cn } from "@/lib/utils"
import "./qualification-wizard.css"

const WIZARD_STEP_ILLUSTRATIONS: Record<QualificationWizardStep, IllustrationSlot> = {
  intro: "wizard.intro",
  study: "wizard.study",
  field: "wizard.field",
  experience: "wizard.experience",
  recognition: "wizard.recognition",
  documents: "wizard.documents",
  complete: "wizard.complete",
}

function WizardStepVisual({ step }: { step: QualificationWizardStep }) {
  const size = step === "intro" || step === "complete" ? "large" : "medium"
  return (
    <div className="qual-wizard__visual">
      <Illustration slot={WIZARD_STEP_ILLUSTRATIONS[step]} size={size} />
    </div>
  )
}

type QualificationWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (profile: QualificationProfile) => void
  onContinueCareerProfile?: () => void
  onSeeRecognitionPathways?: () => void
}

const REASSURANCE = [
  "There are no right or wrong answers.",
  "You can skip questions.",
  "You can come back later.",
  "Your information stays private.",
] as const

const EDUCATION_OPTIONS: { value: EducationType; label: string; hint: string }[] = [
  { value: "university", label: "University", hint: "Degree, diploma, or academic study" },
  { value: "vocational", label: "Vocational", hint: "Trade, apprenticeship, or professional training" },
  { value: "other", label: "Other", hint: "Informal study, online courses, or mixed paths" },
]

const RECOGNITION_OPTIONS: { value: RecognitionStatus; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "in_progress", label: "In progress" },
  { value: "not_sure", label: "Not sure" },
]

function nextStep(step: QualificationWizardStep): QualificationWizardStep {
  if (step === "intro") return "study"
  const index = stepIndex(step)
  if (index < 0 || index >= QUALIFICATION_WIZARD_STEPS.length - 1) return "complete"
  return QUALIFICATION_WIZARD_STEPS[index + 1]!
}

function previousStep(step: QualificationWizardStep): QualificationWizardStep {
  if (step === "study") return "intro"
  const index = stepIndex(step)
  if (index <= 0) return "intro"
  return QUALIFICATION_WIZARD_STEPS[index - 1]!
}

function progressPercent(step: QualificationWizardStep): number {
  if (step === "intro") return 0
  if (step === "complete") return 100
  const index = stepIndex(step)
  return Math.round(((index + 1) / QUALIFICATION_WIZARD_STEPS.length) * 100)
}

function recognitionLabel(status?: RecognitionStatus): string {
  return RECOGNITION_OPTIONS.find((o) => o.value === status)?.label ?? "—"
}

function educationLabel(type?: EducationType): string {
  return EDUCATION_OPTIONS.find((o) => o.value === type)?.label ?? "—"
}

export function QualificationWizard({
  open,
  onOpenChange,
  onComplete,
  onContinueCareerProfile,
  onSeeRecognitionPathways,
}: QualificationWizardProps) {
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState<QualificationWizardDraft>(() => createInitialWizardDraft())
  const [resumeOffer, setResumeOffer] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const savedDraft = loadQualificationWizardDraft()
    const existing = loadQualificationProfile()
    if (savedDraft && savedDraft.step !== "complete") {
      setDraft(savedDraft)
      setResumeOffer(savedDraft.step !== "intro")
    } else if (existing.completedAt) {
      setDraft(
        createInitialWizardDraft({
          ...existing,
          step: "complete",
        }),
      )
      setResumeOffer(false)
    } else {
      setDraft(createInitialWizardDraft())
      setResumeOffer(false)
    }
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    saveQualificationWizardDraft(draft)
  }, [draft, open])

  const updateDraft = useCallback((patch: Partial<QualificationWizardDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const closeWizard = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const goNext = useCallback(() => {
    setDraft((prev) => {
      const next = nextStep(prev.step)
      return { ...prev, step: next }
    })
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const goBack = useCallback(() => {
    setDraft((prev) => ({ ...prev, step: previousStep(prev.step) }))
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const finishWizard = useCallback(() => {
    const profile = completeQualificationWizard(draft)
    setDraft(createInitialWizardDraft({ ...profile, step: "complete" }))
    onComplete?.(profile)
  }, [draft, onComplete])

  const handleDocumentsContinue = useCallback(() => {
    if (draft.step !== "documents") return
    finishWizard()
  }, [draft.step, finishWizard])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return
    const newDocs = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      addedAt: Date.now(),
    }))
    updateDraft({
      documentChoice: "now",
      documents: [...(draft.documents ?? []), ...newDocs],
    })
    event.target.value = ""
  }

  const progressLabel = useMemo(() => stepProgressLabel(draft.step), [draft.step])
  const showProgress = draft.step !== "complete"

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="qual-wizard-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qual-wizard-title"
    >
      <div className="qual-wizard-overlay__top">
        <button
          type="button"
          className="qual-wizard-overlay__close"
          onClick={closeWizard}
          aria-label="Close and save progress"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="qual-wizard-overlay__save-note">Progress saved automatically</span>
        <div className="w-9" aria-hidden />
      </div>

      <div ref={contentRef} className="qual-wizard-overlay__body">
        <div className="qual-wizard">
          {showProgress ? (
            <div className="qual-wizard__progress" aria-hidden={draft.step === "intro"}>
              <div className="qual-wizard__progress-label">
                <span>{draft.step === "intro" ? "5 quick steps" : progressLabel}</span>
                <span>{progressPercent(draft.step)}%</span>
              </div>
              <div className="qual-wizard__progress-track">
                <div
                  className="qual-wizard__progress-fill"
                  style={{ width: `${progressPercent(draft.step)}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="qual-wizard__card">
            {draft.step === "intro" ? (
              <>
                {resumeOffer ? (
                  <div className="qual-wizard__resume-banner">
                    Welcome back — you can pick up where you left off or start fresh.
                    <button
                      type="button"
                      className="ml-1 font-medium text-[var(--color-primary-light)] underline"
                      onClick={() => {
                        clearQualificationWizardDraft()
                        setDraft(createInitialWizardDraft())
                        setResumeOffer(false)
                      }}
                    >
                      Start over
                    </button>
                  </div>
                ) : null}
                <WizardStepVisual step="intro" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  Let&apos;s learn about your qualifications
                </h1>
                <p className="qual-wizard__subtitle">
                  We&apos;ll ask a few simple questions so we can better understand your education
                  and help you prepare for qualification recognition if needed.
                </p>
                <ul className="qual-wizard__reassurance">
                  {REASSURANCE.map((line) => (
                    <li key={line} className="qual-wizard__reassurance-item">
                      <Check className="qual-wizard__reassurance-check h-4 w-4" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {draft.step === "study" ? (
              <>
                <WizardStepVisual step="study" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  Where did you study?
                </h1>
                <p className="qual-wizard__subtitle">
                  Start with the qualification that feels most important right now. You can add more
                  later.
                </p>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-country">
                    Country
                  </label>
                  <Input
                    id="qual-country"
                    placeholder="e.g. Syria, India, Nigeria"
                    value={draft.studyCountry ?? ""}
                    onChange={(e) => updateDraft({ studyCountry: e.target.value })}
                    autoComplete="country-name"
                  />
                </div>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-institution">
                    Institution
                  </label>
                  <Input
                    id="qual-institution"
                    placeholder="School, college, or training centre"
                    value={draft.institution ?? ""}
                    onChange={(e) => updateDraft({ institution: e.target.value })}
                  />
                </div>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-degree">
                    Degree / qualification
                  </label>
                  <Input
                    id="qual-degree"
                    placeholder="e.g. Bachelor of Nursing, Meisterbrief"
                    value={draft.degree ?? ""}
                    onChange={(e) => updateDraft({ degree: e.target.value })}
                  />
                </div>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-years">
                    Years attended
                  </label>
                  <Input
                    id="qual-years"
                    placeholder="e.g. 2012 – 2016"
                    value={draft.yearsAttended ?? ""}
                    onChange={(e) => updateDraft({ yearsAttended: e.target.value })}
                  />
                </div>
              </>
            ) : null}

            {draft.step === "field" ? (
              <>
                <WizardStepVisual step="field" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  What did you study?
                </h1>
                <p className="qual-wizard__subtitle">
                  A rough answer is perfectly fine — we&apos;re building a picture, not checking
                  facts.
                </p>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-field">
                    Field
                  </label>
                  <Input
                    id="qual-field"
                    placeholder="e.g. Nursing, Engineering, Business"
                    value={draft.fieldOfStudy ?? ""}
                    onChange={(e) => updateDraft({ fieldOfStudy: e.target.value })}
                  />
                </div>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-specialisation">
                    Specialisation <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="qual-specialisation"
                    placeholder="e.g. Paediatric care, Software development"
                    value={draft.specialisation ?? ""}
                    onChange={(e) => updateDraft({ specialisation: e.target.value })}
                  />
                </div>
                <fieldset className="qual-wizard__field">
                  <legend className="qual-wizard__field-label">Type of education</legend>
                  <div className="qual-wizard__choice-grid">
                    {EDUCATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "qual-wizard__choice",
                          draft.educationType === option.value && "qual-wizard__choice--selected",
                        )}
                        onClick={() => updateDraft({ educationType: option.value })}
                        aria-pressed={draft.educationType === option.value}
                      >
                        <span className="qual-wizard__choice-icon">
                          <GraduationCap className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block">{option.label}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {option.hint}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}

            {draft.step === "experience" ? (
              <>
                <WizardStepVisual step="experience" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  Tell us about your work experience
                </h1>
                <p className="qual-wizard__subtitle">
                  Paid work, volunteering, internships, care work, self-employment — it all counts.
                </p>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-experience">
                    Your experience in your own words
                  </label>
                  <Textarea
                    id="qual-experience"
                    rows={5}
                    placeholder="What kind of work have you done? What are you proud of?"
                    value={draft.workExperience ?? ""}
                    onChange={(e) => updateDraft({ workExperience: e.target.value })}
                  />
                </div>
                <div className="qual-wizard__field">
                  <label className="qual-wizard__field-label" htmlFor="qual-exp-years">
                    Years of experience <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="qual-exp-years"
                    placeholder="e.g. About 8 years"
                    value={draft.yearsOfExperience ?? ""}
                    onChange={(e) => updateDraft({ yearsOfExperience: e.target.value })}
                  />
                </div>
              </>
            ) : null}

            {draft.step === "recognition" ? (
              <>
                <WizardStepVisual step="recognition" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  Have you already had your qualification recognised in Germany?
                </h1>
                <p className="qual-wizard__subtitle">
                  Many people aren&apos;t sure yet — that&apos;s completely normal.
                </p>
                <div className="qual-wizard__choice-grid" role="radiogroup" aria-label="Recognition status">
                  {RECOGNITION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={draft.recognitionStatus === option.value}
                      className={cn(
                        "qual-wizard__choice",
                        draft.recognitionStatus === option.value && "qual-wizard__choice--selected",
                      )}
                      onClick={() => updateDraft({ recognitionStatus: option.value })}
                    >
                      <span className="qual-wizard__choice-icon">
                        {option.value === "not_sure" ? (
                          <HelpCircle className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {draft.step === "documents" ? (
              <>
                <WizardStepVisual step="documents" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  Do you have documents to hand?
                </h1>
                <p className="qual-wizard__subtitle">
                  Certificates, transcripts, or reference letters help later — but you don&apos;t need
                  them right now.
                </p>
                <div className="qual-wizard__choice-grid">
                  <button
                    type="button"
                    className={cn(
                      "qual-wizard__choice",
                      draft.documentChoice === "now" && "qual-wizard__choice--selected",
                    )}
                    onClick={() => updateDraft({ documentChoice: "now" })}
                    aria-pressed={draft.documentChoice === "now"}
                  >
                    <span className="qual-wizard__choice-icon">
                      <FileUp className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block">Add documents now</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        We&apos;ll note what you have — secure storage is coming soon
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "qual-wizard__choice",
                      draft.documentChoice === "later" && "qual-wizard__choice--selected",
                    )}
                    onClick={() => updateDraft({ documentChoice: "later", documents: [] })}
                    aria-pressed={draft.documentChoice === "later"}
                  >
                    <span className="qual-wizard__choice-icon">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block">I&apos;ll do this later</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        No problem — you can return any time
                      </span>
                    </span>
                  </button>
                </div>
                {draft.documentChoice === "now" ? (
                  <div className="qual-wizard__field">
                    <label className="qual-wizard__field-label" htmlFor="qual-files">
                      Choose files from your device
                    </label>
                    <Input
                      id="qual-files"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    <p className="qual-wizard__field-hint">
                      For now we only record file names on this device. Full secure upload is coming
                      soon.
                    </p>
                    {draft.documents && draft.documents.length > 0 ? (
                      <ul className="qual-wizard__file-list">
                        {draft.documents.map((doc) => (
                          <li key={`${doc.name}-${doc.addedAt}`} className="qual-wizard__file-item">
                            <FileUp className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary-light)]" />
                            {doc.name}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {draft.step === "complete" ? (
              <>
                <WizardStepVisual step="complete" />
                <h1 id="qual-wizard-title" className="qual-wizard__title">
                  Great! We now understand your background much better.
                </h1>
                <p className="qual-wizard__subtitle">
                  You&apos;ve taken a real step forward. This is exactly the kind of preparation that
                  makes conversations with advisors easier.
                </p>
                <div className="qual-wizard__benefits">
                  <p className="qual-wizard__benefits-title">We&apos;ll use this information to:</p>
                  <ul className="qual-wizard__benefits-list">
                    <li>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                      Help prepare for advisor conversations
                    </li>
                    <li>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                      Identify whether recognition may be relevant
                    </li>
                    <li>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                      Personalise career guidance
                    </li>
                    <li>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                      Build stronger CVs and applications
                    </li>
                  </ul>
                </div>
                <div className="qual-wizard__summary-grid">
                  {draft.degree || draft.institution ? (
                    <div className="qual-wizard__summary-item">
                      <p className="qual-wizard__summary-label">Education</p>
                      <p className="qual-wizard__summary-value">
                        {[draft.degree, draft.institution, draft.studyCountry]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  {draft.fieldOfStudy ? (
                    <div className="qual-wizard__summary-item">
                      <p className="qual-wizard__summary-label">Field</p>
                      <p className="qual-wizard__summary-value">
                        {draft.fieldOfStudy}
                        {draft.specialisation ? ` — ${draft.specialisation}` : ""}
                        {draft.educationType ? ` (${educationLabel(draft.educationType)})` : ""}
                      </p>
                    </div>
                  ) : null}
                  {draft.recognitionStatus ? (
                    <div className="qual-wizard__summary-item">
                      <p className="qual-wizard__summary-label">Recognition in Germany</p>
                      <p className="qual-wizard__summary-value">
                        {recognitionLabel(draft.recognitionStatus)}
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="qual-wizard__next-actions">
                  <Button
                    type="button"
                    className="qual-wizard__btn-primary w-full"
                    onClick={() => {
                      closeWizard()
                      onContinueCareerProfile?.()
                    }}
                  >
                    <Briefcase className="mr-2 h-4 w-4" />
                    Continue building your career profile
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      closeWizard()
                      onSeeRecognitionPathways?.()
                    }}
                  >
                    See possible recognition pathways
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {draft.step !== "complete" ? (
        <footer className="qual-wizard__footer">
          <div className="qual-wizard__footer-inner">
            {draft.step !== "intro" ? (
              <button type="button" className="qual-wizard__btn-skip" onClick={goBack}>
                Back
              </button>
            ) : (
              <span />
            )}
            {draft.step !== "intro" ? (
              <button type="button" className="qual-wizard__btn-skip" onClick={goNext}>
                Skip for now
              </button>
            ) : null}
            <Button
              type="button"
              className="qual-wizard__btn-primary"
              onClick={draft.step === "documents" ? handleDocumentsContinue : goNext}
            >
              {draft.step === "intro"
                ? resumeOffer
                  ? "Continue where I left off"
                  : "Let's begin"
                : draft.step === "documents"
                  ? "Finish"
                  : "Continue"}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>,
    document.body,
  )
}

export function QualificationProfileSummary({
  profile,
  onEdit,
  className,
}: {
  profile: QualificationProfile
  onEdit: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-primary-light)]/20 bg-[var(--color-primary-light)]/[0.04] px-6 py-8 text-center sm:px-10",
        className,
      )}
    >
      <h2 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
        Your qualifications are on file
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {profile.degree || profile.fieldOfStudy
          ? `We've noted your background in ${profile.fieldOfStudy || profile.degree}. You can update this any time.`
          : "You've started sharing your background. You can add more detail any time."}
      </p>
      <div className="qual-wizard__summary-grid mx-auto mt-4 max-w-md text-left">
        {profile.degree ? (
          <div className="qual-wizard__summary-item">
            <p className="qual-wizard__summary-label">Qualification</p>
            <p className="qual-wizard__summary-value">{profile.degree}</p>
          </div>
        ) : null}
        {profile.recognitionStatus ? (
          <div className="qual-wizard__summary-item">
            <p className="qual-wizard__summary-label">Recognition status</p>
            <p className="qual-wizard__summary-value">
              {recognitionLabel(profile.recognitionStatus)}
            </p>
          </div>
        ) : null}
      </div>
      <Button type="button" className="mt-6" variant="outline" onClick={onEdit}>
        Update my qualifications
      </Button>
    </div>
  )
}
