"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { generateScenarioStrategy } from "@/app/actions/generate-scenario-strategy"
import { AiWizardProgress } from "@/components/ai-wizard-progress"
import { Button } from "@/components/ui/button"
import { usePageTitle } from "@/hooks/use-page-title"
import type { AiErrorCode } from "@/lib/ai/errors"
import { AI_NOT_CONFIGURED_MESSAGE, OPENAI_NOT_CONFIGURED_HINT_LOCAL } from "@/lib/ai/messages"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import {
  isScenarioLabReadyForAnalysis,
  loadScenarioLabDraft,
  saveScenarioLabDraft,
} from "@/lib/scenario-lab/storage"
import type { ScenarioLabStepIndex, ScenarioStrategyReport } from "@/lib/scenario-lab/types"
import { parseScenarioStrategyResponse } from "@/lib/scenario-lab/parse-response"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import { cn } from "@/lib/utils"
import { Check, Sparkles } from "lucide-react"
import "./scenario-lab-page.css"

const WIZARD_PHASES = [
  { title: "Reading your ideal scenario…", detail: "What good looks like for you." },
  { title: "Mapping blockers…", detail: "Constraints without judgement." },
  { title: "Weighing your options…", detail: "Trade-offs and feasibility." },
  { title: "Building your strategy…", detail: "Concrete next steps for this week." },
] as const

const STEPS: Array<{ index: ScenarioLabStepIndex; title: string; hint: string; placeholder: string }> =
  [
    {
      index: 1,
      title: "Your ideal job or scenario",
      hint: "Describe the role, context, or situation you want — titles optional, feelings and goals welcome.",
      placeholder:
        "e.g. I want to facilitate workshops for public-sector teams, hybrid, 3–4 days a week, using my UX and accessibility experience…",
    },
    {
      index: 2,
      title: "What is blocking you",
      hint: "What feels stuck right now? Skills, language, recognition, confidence, geography, childcare — anything honest.",
      placeholder:
        "e.g. Most roles ask for fluent German C1, I’m B2. I’m not sure which job titles to search. Recognition of my degree is unclear…",
    },
    {
      index: 3,
      title: "Your options",
      hint: "List paths you can imagine — even imperfect ones. Apply widely, upskill, freelance, bridge role, networking…",
      placeholder:
        "e.g. 1) Apply for UX roles anyway 2) Take a B2 German course 3) Start with contract workshop facilitation 4) Ask a mentor…",
    },
  ]

function wizardErrorDescription(code?: AiErrorCode, fallback?: string): string {
  if (code === "missing_api_key" || code === "invalid_api_key") {
    return `${AI_NOT_CONFIGURED_MESSAGE} ${OPENAI_NOT_CONFIGURED_HINT_LOCAL}`
  }
  return fallback ?? "Try again."
}

export type ScenarioLabPageProps = {
  folderId: string
  strategicProfile: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  outputLanguage?: "en" | "de"
}

type Phase = "steps" | "generating" | "results"

export function ScenarioLabPage({
  folderId,
  strategicProfile,
  qualificationProfile,
  outputLanguage = "en",
}: ScenarioLabPageProps) {
  usePageTitle(pageTitleForSection("scenarioLab"))

  const [phase, setPhase] = useState<Phase>("steps")
  const [step, setStep] = useState<ScenarioLabStepIndex>(1)
  const [draft, setDraft] = useState(() => loadScenarioLabDraft(folderId))
  const [report, setReport] = useState<ScenarioStrategyReport | null>(null)
  const [fallbackRaw, setFallbackRaw] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loaded = loadScenarioLabDraft(folderId)
    setDraft(loaded)
    setPhase("steps")
    setStep(1)
    setReport(null)
    setFallbackRaw(null)
    setError(null)

    if (loaded.strategy?.trim()) {
      const parsed = parseScenarioStrategyResponse(loaded.strategy)
      if (
        parsed.report.summary ||
        parsed.report.recommendedActions.length > 0 ||
        parsed.report.optionsRanked.length > 0
      ) {
        setReport(parsed.report)
        setFallbackRaw(parsed.usedFallback ? loaded.strategy : null)
        setPhase("results")
      }
    }
  }, [folderId])

  useEffect(() => {
    saveScenarioLabDraft(folderId, draft)
  }, [draft, folderId])

  const currentStep = STEPS.find((row) => row.index === step) ?? STEPS[0]!

  const stepComplete = useCallback(
    (index: ScenarioLabStepIndex): boolean => {
      if (index === 1) return draft.idealScenario.trim().length >= 12
      if (index === 2) return draft.blockers.trim().length >= 8
      return draft.options.trim().length >= 8
    },
    [draft.blockers, draft.idealScenario, draft.options],
  )

  const canGoNext = stepComplete(step)
  const readyForAnalysis = useMemo(() => isScenarioLabReadyForAnalysis(draft), [draft])

  const updateField = useCallback(
    (field: "idealScenario" | "blockers" | "options", value: string) => {
      setDraft((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const runAnalysis = useCallback(async () => {
    if (!readyForAnalysis) return
    setError(null)
    setPhase("generating")
    const result = await generateScenarioStrategy({
      draft,
      strategicProfile,
      qualificationProfile,
      outputLanguage,
    })
    if (!result.success || !result.report) {
      setPhase("steps")
      setStep(3)
      setError(wizardErrorDescription(result.errorCode, result.error))
      return
    }
    setReport(result.report)
    setFallbackRaw(result.usedFallback ? result.rawText ?? null : null)
    const saved = saveScenarioLabDraft(folderId, {
      ...draft,
      strategy: result.rawText ?? JSON.stringify(result.report),
      strategyGeneratedAt: Date.now(),
    })
    setDraft(saved)
    setPhase("results")
  }, [draft, folderId, outputLanguage, qualificationProfile, readyForAnalysis, strategicProfile])

  const handleNext = () => {
    if (!canGoNext) return
    if (step < 3) {
      setStep((step + 1) as ScenarioLabStepIndex)
      return
    }
    void runAnalysis()
  }

  const handleBack = () => {
    if (phase === "results") {
      setPhase("steps")
      setStep(3)
      return
    }
    if (step > 1) setStep((step - 1) as ScenarioLabStepIndex)
  }

  const fieldKey =
    step === 1 ? "idealScenario" : step === 2 ? "blockers" : ("options" as const)

  return (
    <div className="scenario-lab">
      <header className="scenario-lab__header">
        <h1 className="scenario-lab__title">Analyse laboratory</h1>
        <p className="scenario-lab__subtitle">
          My scenario — three short steps, then AI recommends a strategy to improve your path.
        </p>
      </header>

      <div className="scenario-lab__layout">
        {phase === "generating" ? (
          <AiWizardProgress
            variant="panel"
            phases={WIZARD_PHASES}
            headline="Analysing your scenario…"
            footnote="This usually takes under a minute."
          />
        ) : null}

        {phase !== "generating" ? (
          <div className="scenario-lab__stepper" aria-label="Progress">
            {STEPS.map((row) => {
              const done = stepComplete(row.index)
              const active = phase === "steps" && step === row.index
              return (
                <span
                  key={row.index}
                  className={cn(
                    "scenario-lab__step-pill",
                    active && "scenario-lab__step-pill--active",
                    done && !active && "scenario-lab__step-pill--done",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                  Step {row.index}
                </span>
              )
            })}
            {phase === "results" ? (
              <span className="scenario-lab__step-pill scenario-lab__step-pill--done">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Strategy
              </span>
            ) : null}
          </div>
        ) : null}

        {phase === "steps" ? (
          <section className="scenario-lab__card" aria-labelledby="scenario-step-title">
            <h2 id="scenario-step-title" className="scenario-lab__card-title">
              {currentStep.title}
            </h2>
            <p className="scenario-lab__card-hint">{currentStep.hint}</p>
            <textarea
              className="scenario-lab__textarea"
              value={draft[fieldKey]}
              onChange={(event) => updateField(fieldKey, event.target.value)}
              placeholder={currentStep.placeholder}
              aria-label={currentStep.title}
            />
            {error && step === 3 ? <p className="scenario-lab__error">{error}</p> : null}
            <div className="scenario-lab__actions">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              ) : null}
              <Button type="button" onClick={handleNext} disabled={!canGoNext}>
                {step < 3 ? "Next" : "Analyse my scenario"}
              </Button>
            </div>
          </section>
        ) : null}

        {phase === "results" && report ? (
          <section className="scenario-lab__card scenario-lab__strategy" aria-labelledby="strategy-heading">
            <h2 id="strategy-heading" className="scenario-lab__card-title">
              Your strategy
            </h2>
            {fallbackRaw && !report.recommendedActions.length ? (
              <p className="scenario-lab__fallback">{fallbackRaw}</p>
            ) : (
              <>
                {report.summary ? (
                  <p className="scenario-lab__strategy-summary">{report.summary}</p>
                ) : null}

                {report.strengthsToLeverage.length > 0 ? (
                  <div>
                    <h3 className="scenario-lab__strategy-section-title">Strengths to leverage</h3>
                    <ul className="scenario-lab__list">
                      {report.strengthsToLeverage.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {report.blockersReframed.length > 0 ? (
                  <div>
                    <h3 className="scenario-lab__strategy-section-title">Blockers reframed</h3>
                    <ul className="scenario-lab__list">
                      {report.blockersReframed.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {report.optionsRanked.length > 0 ? (
                  <div>
                    <h3 className="scenario-lab__strategy-section-title">Your options ranked</h3>
                    <ul className="scenario-lab__list">
                      {report.optionsRanked.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {report.recommendedActions.length > 0 ? (
                  <div>
                    <h3 className="scenario-lab__strategy-section-title">Recommended actions</h3>
                    <div className="flex flex-col gap-2">
                      {report.recommendedActions.map((row) => (
                        <div key={`${row.action}-${row.firstStep}`} className="scenario-lab__action-card">
                          <p className="scenario-lab__action-title">{row.action}</p>
                          {row.why ? <p className="scenario-lab__action-meta">{row.why}</p> : null}
                          {row.firstStep ? (
                            <p className="scenario-lab__action-meta">
                              <strong>First step:</strong> {row.firstStep}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {report.mindsetNote ? (
                  <p className="scenario-lab__mindset">{report.mindsetNote}</p>
                ) : null}
              </>
            )}

            <div className="scenario-lab__actions">
              <Button type="button" variant="outline" onClick={handleBack}>
                Edit my answers
              </Button>
              <Button type="button" onClick={() => void runAnalysis()} disabled={!readyForAnalysis}>
                Regenerate strategy
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
