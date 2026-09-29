"use client"

import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { generateTailoredCv, getTailoredCvAiStatus } from "@/app/actions/generate-tailored-cv"
import { recoverCvFromAiResponse } from "@/lib/ai-cv-response"
import type { CvParseDiagnostics } from "@/lib/ai-cv-response"
import { GenerationErrorPanel } from "@/components/application-flow/generation-error-panel"
import { GenerationLoading } from "@/components/application-flow/generation-loading"
import { AiWizardProgress } from "@/components/ai-wizard-progress"
import type { AiErrorCode } from "@/lib/ai/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { captureTextareaSelection } from "@/lib/assistant-selection-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StepCard, type StepCardStatus } from "@/components/application-flow/step-card"
import { CvSourceStep } from "@/components/application-flow/cv-source-step"
import {
  deriveApplicationName,
  type ApplicationFlowCompletePayload,
} from "@/lib/application-flow-complete"
import {
  clearApplicationFlowDraft,
  createInitialApplicationFlowDraft,
  getOrCreateWizardApplicationIds,
  isCvSourceStepComplete,
  normalizeCvSource,
  saveApplicationFlowDraft,
  type ApplicationFlowDraft,
  type CvSource,
} from "@/lib/application-flow-storage"
import { isCvTextUsable } from "@/lib/cv-text-quality"
import { finalizeTailoredCv, type CvSectionValidation } from "@/lib/cv-tailor-sections"
import { loadStrategicProfile } from "@/lib/strategic-profile"
import { COMBINED_PROMPT } from "@/lib/tailored-cv-prompt"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Sparkles,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"

export type { ApplicationFlowCompletePayload } from "@/lib/application-flow-complete"

export type ApplicationFlowState = ApplicationFlowDraft & {
  completedSteps: number[]
  activeStep?: number
}

type GenerationState = "idle" | "generating" | "success" | "error" | "section-warning" | "saving"

interface ApplicationFlowProps {
  onComplete: (payload: ApplicationFlowCompletePayload) => boolean | void | Promise<boolean | void>
  onCancel: () => void
  versions?: ResumeVersion[]
  jobApplications?: JobApplication[]
  /** Unique id for this wizard run — prevents stale generation state attaching to a new flow. */
  flowSessionKey: string
  /** When false, open with a blank draft (still autosaves as the user types). */
  restoreDraft?: boolean
}

const PROFILE_LOAD_ERROR =
  "Profile could not be loaded. Please try again or choose another CV source."

const STEPS = [
  {
    id: 1,
    title: "Choose CV source",
    subtitle: "File, workspace, paste, or blank",
    icon: FileText,
  },
  {
    id: 2,
    title: "Job Description",
    subtitle: "Add the role you're targeting",
    icon: Briefcase,
  },
] as const

function completedStepsFromDraft(draft: ApplicationFlowDraft): number[] {
  const done: number[] = []
  if (isCvSourceStepComplete(draft)) done.push(1)
  if (draft.jobDescription.trim()) done.push(2)
  return done
}

function canCreateApplication(draft: ApplicationFlowDraft): boolean {
  return isCvSourceStepComplete(draft) && draft.jobDescription.trim().length > 0
}

type StepModalErrorBoundaryProps = {
  children: ReactNode
  onReset: () => void
}

type StepModalErrorBoundaryState = { hasError: boolean }

type ApplicationFlowShellErrorBoundaryProps = {
  children: ReactNode
  onCancel: () => void
  onRetry: () => void
}

type ApplicationFlowShellErrorBoundaryState = {
  hasError: boolean
  message: string | null
}

class ApplicationFlowShellErrorBoundary extends Component<
  ApplicationFlowShellErrorBoundaryProps,
  ApplicationFlowShellErrorBoundaryState
> {
  state: ApplicationFlowShellErrorBoundaryState = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): ApplicationFlowShellErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Something went wrong loading the wizard.",
    }
  }

  componentDidCatch(error: unknown) {
    console.error("[application-flow] Wizard failed to load:", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-lg border bg-card px-6 py-8 text-center space-y-4 shadow-sm">
            <h1 className="text-lg font-semibold text-foreground">Could not open the application wizard</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.message ??
                "Your workspace data may still be loading. Try again, or go back to the dashboard."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button type="button" onClick={this.props.onRetry}>
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={this.props.onCancel}>
                Back to dashboard
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

class StepModalErrorBoundary extends Component<
  StepModalErrorBoundaryProps,
  StepModalErrorBoundaryState
> {
  state: StepModalErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): StepModalErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error("[application-flow] Step modal error:", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            This step could not be displayed. Your progress is saved — try opening it again.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false })
              this.props.onReset()
            }}
          >
            Close and try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export function ApplicationFlow({
  flowSessionKey,
  restoreDraft = false,
  ...props
}: ApplicationFlowProps) {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <ApplicationFlowShellErrorBoundary
      key={`${flowSessionKey}-${restoreDraft ? "resume" : "fresh"}-${retryKey}`}
      onCancel={props.onCancel}
      onRetry={() => setRetryKey((key) => key + 1)}
    >
      <ApplicationFlowInner
        key={flowSessionKey}
        flowSessionKey={flowSessionKey}
        restoreDraft={restoreDraft}
        {...props}
      />
    </ApplicationFlowShellErrorBoundary>
  )
}

function resetGenerationUiState(): {
  generationState: GenerationState
  failureCount: number
  lastErrorCode: AiErrorCode | undefined
  lastErrorMessage: string | undefined
  fallbackPrompt: string | null
  manualCvFallback: string
  rawAiResponse: string | undefined
  parseDiagnostics: CvParseDiagnostics | undefined
  copiedPrompt: boolean
  pendingResumeContent: string | null
  sectionValidation: CvSectionValidation | null
  activeStep: number | undefined
} {
  return {
    generationState: "idle",
    failureCount: 0,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
    fallbackPrompt: null,
    manualCvFallback: "",
    rawAiResponse: undefined,
    parseDiagnostics: undefined,
    copiedPrompt: false,
    pendingResumeContent: null,
    sectionValidation: null,
    activeStep: undefined,
  }
}

function ApplicationFlowInner({
  onComplete,
  onCancel,
  versions = [],
  jobApplications = [],
  flowSessionKey,
  restoreDraft = false,
}: ApplicationFlowProps) {
  const [draft, setDraft] = useState<ApplicationFlowDraft>(() =>
    createInitialApplicationFlowDraft(restoreDraft, flowSessionKey).draft,
  )

  const [activeStep, setActiveStep] = useState<number | undefined>(undefined)
  const [generationState, setGenerationState] = useState<GenerationState>("idle")
  const [failureCount, setFailureCount] = useState(0)
  const [lastErrorCode, setLastErrorCode] = useState<AiErrorCode | undefined>()
  const [lastErrorMessage, setLastErrorMessage] = useState<string | undefined>()
  const [fallbackPrompt, setFallbackPrompt] = useState<string | null>(null)
  const [manualCvFallback, setManualCvFallback] = useState("")
  const [rawAiResponse, setRawAiResponse] = useState<string | undefined>()
  const [parseDiagnostics, setParseDiagnostics] = useState<CvParseDiagnostics | undefined>()
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [pendingResumeContent, setPendingResumeContent] = useState<string | null>(null)
  const [sectionValidation, setSectionValidation] = useState<CvSectionValidation | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completingRef = useRef(false)

  const isProcessing =
    generationState === "generating" || generationState === "saving" || completingRef.current

  useEffect(() => {
    const initial = createInitialApplicationFlowDraft(restoreDraft, flowSessionKey)
    setDraft(initial.draft)
    const reset = resetGenerationUiState()
    setActiveStep(reset.activeStep)
    setGenerationState(reset.generationState)
    setFailureCount(reset.failureCount)
    setLastErrorCode(reset.lastErrorCode)
    setLastErrorMessage(reset.lastErrorMessage)
    setFallbackPrompt(reset.fallbackPrompt)
    setManualCvFallback(reset.manualCvFallback)
    setRawAiResponse(reset.rawAiResponse)
    setParseDiagnostics(reset.parseDiagnostics)
    setCopiedPrompt(reset.copiedPrompt)
    setPendingResumeContent(reset.pendingResumeContent)
    setSectionValidation(reset.sectionValidation)
  }, [flowSessionKey, restoreDraft])

  const completedSteps = useMemo(() => completedStepsFromDraft(draft), [draft])
  const readyToCreate = canCreateApplication(draft)

  const patchDraft = useCallback((patch: Partial<ApplicationFlowDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const setCvSource = useCallback((source: CvSource) => {
    setDraft((prev) => ({ ...prev, cvSource: source }))
  }, [])

  useEffect(() => {
    getOrCreateWizardApplicationIds(flowSessionKey)
  }, [flowSessionKey])

  useEffect(() => {
    void getTailoredCvAiStatus().then((status) => setAiConfigured(status.configured))
  }, [])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveApplicationFlowDraft(draft, flowSessionKey)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cvLanguage", draft.outputLanguage)
      }
    }, 400)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [draft, flowSessionKey])

  const setLanguage = (lang: "en" | "de") => {
    patchDraft({ outputLanguage: lang })
    if (typeof window !== "undefined") sessionStorage.setItem("cvLanguage", lang)
  }

  const canOpenStep = (stepId: number) => {
    if (stepId === 1) return true
    if (stepId === 2) return completedSteps.includes(1)
    return false
  }

  const getStepStatus = (stepId: number): StepCardStatus => {
    if (completedSteps.includes(stepId)) return "complete"
    if (activeStep === stepId) return "active"
    if (!canOpenStep(stepId)) return "locked"
    return "empty"
  }

  const handleOpenStep = (stepId: number) => {
    if (!canOpenStep(stepId)) return
    if (!STEPS.some((s) => s.id === stepId)) {
      toast({
        title: "Step unavailable",
        description: "This step is not available yet. Complete the previous step first.",
        variant: "destructive",
      })
      return
    }
    try {
      setActiveStep(stepId)
    } catch (error) {
      console.error("[application-flow] Failed to open step:", error)
      toast({
        title: "Could not open step",
        description: "Please try again. Your draft is still saved.",
        variant: "destructive",
      })
    }
  }

  const closeModal = () => setActiveStep(undefined)

  const buildCompletePayload = (resumeContent: string): ApplicationFlowCompletePayload => ({
    applicationName: deriveApplicationName(draft),
    resumeContent,
    jobDescription: draft.jobDescription.trim(),
    company: draft.company.trim(),
    jobDescriptionUrl: draft.jobDescriptionUrl.trim(),
    outputLanguage: draft.outputLanguage,
    wizardSessionId: flowSessionKey,
  })

  const finishWithContent = async (resumeContent: string) => {
    if (completingRef.current) return
    completingRef.current = true
    setGenerationState("saving")
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cvLanguage", draft.outputLanguage)
      }
      setPendingResumeContent(null)
      setSectionValidation(null)
      const saved = await onComplete(buildCompletePayload(resumeContent))
      if (saved !== false) {
        clearApplicationFlowDraft()
      }
    } finally {
      completingRef.current = false
      setGenerationState("idle")
    }
  }

  const handleCreateApplication = async () => {
    if (!readyToCreate || isProcessing) return

    const cvSource = normalizeCvSource(draft.cvSource)
    if (cvSource !== "blank") {
      const quality = isCvTextUsable(draft.generalCv)
      if (!quality.ok) {
        toast({
          title: "CV text could not be used",
          description: quality.reason,
          variant: "destructive",
        })
        return
      }
    }

    if (cvSource === "blank") {
      if (completingRef.current) return
      completingRef.current = true
      setGenerationState("saving")
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("cvLanguage", draft.outputLanguage)
        }
        const saved = await onComplete(buildCompletePayload(""))
        if (saved !== false) {
          clearApplicationFlowDraft()
        }
      } catch (error) {
        console.error("[application-flow] Blank application creation failed:", error)
        toast({
          title: "Could not create application",
          description: PROFILE_LOAD_ERROR,
          variant: "destructive",
        })
      } finally {
        completingRef.current = false
        setGenerationState("idle")
      }
      return
    }

    setGenerationState("generating")
    setFallbackPrompt(null)
    setManualCvFallback("")
    setRawAiResponse(undefined)
    setParseDiagnostics(undefined)
    setLastErrorCode(undefined)
    setLastErrorMessage(undefined)

    let strategicProfile = null

    try {
      const cvContent = draft.generalCv.trim()
      if (!cvContent) {
        throw new Error(PROFILE_LOAD_ERROR)
      }

      try {
        strategicProfile = typeof window !== "undefined" ? loadStrategicProfile() : null
      } catch (profileError) {
        console.error("[application-flow] Strategic profile load failed:", profileError)
        throw new Error(PROFILE_LOAD_ERROR)
      }

      const result = await generateTailoredCv({
        jobDescription: draft.jobDescription,
        cvContent,
        outputLanguage: draft.outputLanguage,
        strategicProfile,
      })

      if (result.success && result.cvText) {
        const finalized = finalizeTailoredCv({
          sourceCv: cvContent,
          generatedCv: result.cvText,
        })

        console.log("Generated Resume:", {
          resumeText: finalized.resumeText,
          validation: finalized.validation,
          restoredSections: finalized.restoredSections,
          experienceBullets: finalized.validation.generated.experienceBullets,
          educationBullets: finalized.validation.generated.educationBullets,
        })

        if (finalized.validation.missingExperience || finalized.validation.missingEducation) {
          setPendingResumeContent(finalized.resumeText)
          setSectionValidation(finalized.validation)
          setGenerationState("section-warning")
          return
        }

        setGenerationState("success")
        setFailureCount(0)
        patchDraft({ focusedCv: finalized.resumeText })
        toast({
          title: "Your tailored CV is ready",
          description:
            finalized.restoredSections.length > 0
              ? `Restored ${finalized.restoredSections.join(" and ")} from your source CV.`
              : "Opening the resume editor for review…",
        })
        await finishWithContent(finalized.resumeText)
        return
      }

      setFailureCount((c) => c + 1)
      setGenerationState("error")
      setLastErrorCode(result.errorCode)
      setLastErrorMessage(result.error)
      setRawAiResponse(result.rawAiResponse)
      setParseDiagnostics(result.parseDiagnostics)
      const recovered =
        result.extractedText?.trim() ||
        (result.rawAiResponse ? recoverCvFromAiResponse(result.rawAiResponse).text : "")
      if (recovered) setManualCvFallback(recovered)
      setFallbackPrompt(
        result.prompt ??
          COMBINED_PROMPT(
            draft.jobDescription,
            cvContent,
            draft.outputLanguage,
            strategicProfile,
          ),
      )
      toast({
        title: "Automatic generation failed",
        description:
          result.errorCode === "missing_api_key" || result.errorCode === "invalid_api_key"
            ? "Configure OPENAI_API_KEY in .env.local, then try again."
            : (result.error ?? "Tap Try again to regenerate."),
        variant: "destructive",
      })
    } catch (error) {
      console.error("[application-flow] Generation failed:", error)
      setGenerationState("error")
      setLastErrorCode(undefined)
      setLastErrorMessage(
        error instanceof Error && error.message ? error.message : PROFILE_LOAD_ERROR,
      )
      toast({
        title: "Could not create tailored CV",
        description:
          error instanceof Error && error.message ? error.message : PROFILE_LOAD_ERROR,
        variant: "destructive",
      })
    }
  }

  const handleCopyFallbackPrompt = async () => {
    if (!fallbackPrompt) return
    try {
      await navigator.clipboard.writeText(fallbackPrompt)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleManualFallbackContinue = async () => {
    const text = recoverCvFromAiResponse(manualCvFallback.trim()).text
    if (!text) return
    await finishWithContent(text)
  }

  const handleUseGeneratedAnyway = async () => {
    const text =
      recoverCvFromAiResponse(manualCvFallback.trim() || rawAiResponse || "").text
    if (!text) return
    await finishWithContent(text)
  }

  const importFromVersion = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId)
    if (!version?.resumeText?.trim()) return
    patchDraft({ generalCv: version.resumeText, cvSource: "workspace" })
  }

  const activeMeta = STEPS.find((s) => s.id === activeStep)
  const isAiWorking = generationState === "generating" || generationState === "saving"

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-background">
      <div className="border-b bg-card/80 backdrop-blur-sm">
        {isAiWorking ? (
          <AiWizardProgress
            variant="banner"
            phases={[
              {
                title: "Reading your source CV and job description",
                detail: "Preparing a role-specific draft.",
              },
              {
                title: "Tailoring experience and skills",
                detail: "Aligning evidence with employer needs.",
              },
              {
                title: "Formatting for the resume builder",
                detail: "Almost ready for your review.",
              },
            ]}
            headline={
              generationState === "saving"
                ? "Saving your application…"
                : "AI is tailoring your CV…"
            }
            footnote="Please keep this tab open while the wizard works."
          />
        ) : null}
        <div className="container mx-auto max-w-5xl px-4 py-5">
          <div className="flex items-center gap-3">
            <Button onClick={onCancel} variant="ghost" size="icon" aria-label="Back" disabled={isAiWorking}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">New Application</h1>
              <p className="text-sm text-muted-foreground">
                Add your CV source and job description — we generate the tailored CV for you
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl flex-1 px-4 py-10 sm:py-14">
        {!isAiWorking ? (
        <div className="mx-auto max-w-md space-y-2 sm:max-w-none">
          <Label htmlFor="applicationName" className="text-xs text-muted-foreground uppercase tracking-wide">
            Application name
          </Label>
          <Input
            id="applicationName"
            placeholder="e.g. AI Design Leader"
            value={draft.applicationName}
            onChange={(e) => patchDraft({ applicationName: e.target.value })}
            className="h-11 bg-card"
          />
          <p className="text-xs text-muted-foreground -mt-1">
            This title becomes the default name for the generated resume.
          </p>
        </div>
        ) : null}

        {aiConfigured === false && generationState === "idle" && (
          <p className="mt-6 text-center text-xs text-amber-700 dark:text-amber-400 max-w-lg mx-auto">
            AI generation is not configured. Add OPENAI_API_KEY to .env.local and restart the dev
            server.
          </p>
        )}

        {(generationState === "generating" || generationState === "saving") && (
          <GenerationLoading
            headline={
              generationState === "saving"
                ? "Saving your application…"
                : "AI is tailoring your CV…"
            }
          />
        )}

        {generationState === "section-warning" && sectionValidation && pendingResumeContent && (
          <div className="mx-auto mt-8 max-w-xl rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 px-5 py-4 space-y-4">
            <div>
              <p className="font-medium text-foreground">Experience or education is incomplete</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The generated CV is missing content that exists in your source profile. Saving was
                blocked so nothing is lost.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground list-disc pl-5">
                {sectionValidation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  setPendingResumeContent(null)
                  setSectionValidation(null)
                  setGenerationState("idle")
                  void handleCreateApplication()
                }}
              >
                Regenerate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void finishWithContent(pendingResumeContent)}
              >
                Continue anyway
              </Button>
            </div>
          </div>
        )}

        {generationState === "error" && (
          <GenerationErrorPanel
            errorMessage={lastErrorMessage}
            errorCode={lastErrorCode}
            failureCount={failureCount}
            copiedPrompt={copiedPrompt}
            manualCvFallback={manualCvFallback}
            rawAiResponse={rawAiResponse}
            parseDiagnostics={parseDiagnostics}
            onRetry={() => void handleCreateApplication()}
            onCopyPrompt={() => void handleCopyFallbackPrompt()}
            onManualChange={setManualCvFallback}
            onManualContinue={() => void handleManualFallbackContinue()}
            onUseGeneratedAnyway={() => void handleUseGeneratedAnyway()}
          />
        )}

        {generationState !== "generating" &&
          generationState !== "saving" &&
          generationState !== "error" &&
          generationState !== "section-warning" && (
          <>
            <div className="mt-12 sm:mt-16">
              <div className="grid gap-6 md:grid-cols-2 md:gap-8 max-w-3xl mx-auto">
                {STEPS.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step.id}
                    title={step.title}
                    subtitle={step.subtitle}
                    icon={step.icon}
                    status={getStepStatus(step.id)}
                    onClick={() => handleOpenStep(step.id)}
                  />
                ))}
              </div>

              <div className="mt-10 flex flex-col items-center gap-3">
                <Button
                  size="lg"
                  className="min-w-[240px] gap-2"
                  disabled={!readyToCreate || isProcessing}
                  onClick={() => void handleCreateApplication()}
                >
                  <Sparkles className="h-4 w-4" />
                  {generationState === "saving" ? "Saving application…" : "Create application"}
                </Button>
                {!readyToCreate && (
                  <p className="text-center text-xs text-muted-foreground">
                    Complete CV source and job description to continue
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={activeStep !== undefined} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="flex max-h-[min(90vh,820px)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {activeMeta ? (
            <StepModalErrorBoundary onReset={closeModal}>
              <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pt-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="flex min-w-0 items-center gap-2 text-xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {activeMeta.id}
                    </span>
                    {activeStep === 1 ? "Choose CV source" : activeMeta.title}
                  </DialogTitle>
                  <DialogDescription>
                    {activeStep === 1 &&
                      "Upload a CV, import from another application in your workspace, paste text, or start from blank."}
                    {activeStep === 2 && "Paste the full posting — we use it to tailor your CV automatically."}
                  </DialogDescription>
                </DialogHeader>

                {activeStep === 1 && (
                  <CvSourceStep
                    draft={draft}
                    versions={versions}
                    jobApplications={jobApplications}
                    onPatch={patchDraft}
                    onCvSourceChange={setCvSource}
                    onImportFromVersion={importFromVersion}
                    onLanguageChange={setLanguage}
                  />
                )}

                {activeStep === 2 && (
                  <div className="min-w-0 space-y-5 py-1">
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company (optional)</Label>
                        <Input
                          id="company"
                          placeholder="e.g. Acme Corp"
                          value={draft.company}
                          onChange={(e) => patchDraft({ company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobUrl">Job posting URL (optional)</Label>
                        <Input
                          id="jobUrl"
                          type="url"
                          placeholder="https://…"
                          value={draft.jobDescriptionUrl}
                          onChange={(e) => patchDraft({ jobDescriptionUrl: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="jobDescription">Job description</Label>
                      <Textarea
                        id="jobDescription"
                        placeholder="Paste the full job description…"
                        value={draft.jobDescription}
                        onChange={(e) => patchDraft({ jobDescription: e.target.value })}
                        onMouseUp={(e) =>
                          captureTextareaSelection("job_description", e.currentTarget)
                        }
                        onKeyUp={(e) =>
                          captureTextareaSelection("job_description", e.currentTarget)
                        }
                        className="min-h-[260px] max-w-full min-w-0 [field-sizing:fixed] text-sm bg-muted/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="sticky bottom-0 z-10 shrink-0 gap-2 border-t bg-background px-6 py-4 sm:gap-3">
                <Button type="button" variant="outline" onClick={closeModal} className="sm:min-w-[100px]">
                  Close
                </Button>
                <Button
                  type="button"
                  className="flex-1 sm:flex-none sm:min-w-[140px]"
                  onClick={closeModal}
                  disabled={
                    isProcessing ||
                    (activeStep === 1 && !isCvSourceStepComplete(draft)) ||
                    (activeStep === 2 && !draft.jobDescription.trim())
                  }
                >
                  Continue
                </Button>
              </DialogFooter>
            </StepModalErrorBoundary>
          ) : (
            <div className="px-6 py-8 text-center space-y-4">
              <p className="text-sm text-muted-foreground">This step is not available.</p>
              <Button type="button" variant="outline" onClick={closeModal}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** @deprecated Use ApplicationFlow — kept for existing imports */
export const ApplicationCreationWizard = ApplicationFlow
