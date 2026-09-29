"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Building2,
  FileText,
  Globe,
  Sparkles,
} from "lucide-react"
import { AiWizardProgress } from "@/components/ai-wizard-progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApplicationStoryResults } from "@/components/application-story-wizard/application-story-results"
import { generateApplicationStoryWizard } from "@/app/actions/generate-application-story-wizard"
import type { JobApplication, ResumeVersion, YourStory } from "@/lib/types"
import type { IllustrationStyle } from "@/lib/application-story-wizard/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import {
  clearStoryWizardDraft,
  createInitialStoryWizardDraft,
  isStoryWizardInputsComplete,
  loadStoryWizardDraft,
  saveStoryWizardDraft,
  type ApplicationStoryWizardDraft,
} from "@/lib/application-story-wizard/storage"
import { createEmptyYourStory } from "@/lib/your-story"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import type { AiErrorCode } from "@/lib/ai/errors"
import {
  AI_NOT_CONFIGURED_MESSAGE,
  OPENAI_NOT_CONFIGURED_HINT_LOCAL,
} from "@/lib/ai/messages"

type WizardPhase = "inputs" | "optional" | "generating" | "results"

type ApplicationStoryWizardProps = {
  job: JobApplication
  resumeVersion?: ResumeVersion | null
  outputLanguage: "en" | "de"
  strategicProfile?: StrategicProfile | null
  onComplete: (yourStory: YourStory) => void | Promise<void>
  onCancel: () => void
}

const STORY_WIZARD_PHASES = [
  { title: "Analysing company intelligence…", detail: "Mission, values, and employer context." },
  { title: "Mapping candidate strengths…", detail: "Evidence-backed capabilities from your CV." },
  { title: "Building opportunity map…", detail: "Matches, gaps, and differentiators." },
  { title: "Creating story artefacts…", detail: "Narrative, story map, and illustration brief." },
] as const

function wizardErrorDescription(code?: AiErrorCode, fallback?: string): string {
  if (code === "missing_api_key" || code === "invalid_api_key") {
    return `${AI_NOT_CONFIGURED_MESSAGE} ${OPENAI_NOT_CONFIGURED_HINT_LOCAL}`
  }
  return fallback ?? "Try again."
}

function StoryWizardLoading() {
  return (
    <AiWizardProgress
      variant="scoped-overlay"
      phases={STORY_WIZARD_PHASES}
      headline="Application Story Wizard is running…"
      footnote="This may take up to two minutes. Keep this tab open."
      phaseIntervalMs={4000}
    />
  )
}

export function ApplicationStoryWizard({
  job,
  resumeVersion,
  outputLanguage,
  strategicProfile,
  onComplete,
  onCancel,
}: ApplicationStoryWizardProps) {
  const resumeText = resumeVersion?.resumeText?.trim() ?? ""
  const resumeVersionId = resumeVersion?.id ?? job.resumeVersionId

  const [phase, setPhase] = useState<WizardPhase>("inputs")
  const [draft, setDraft] = useState<ApplicationStoryWizardDraft>(() => {
    const saved = loadStoryWizardDraft()
    return (
      saved ??
      createInitialStoryWizardDraft({
        jobTitle: job.jobTitle,
        company: job.company,
        jobDescription: job.jobDescription,
        companyWebsiteUrl: job.companyInfo?.website ?? "",
        tailoredResumeVersionId: resumeVersionId,
        resumeContent: resumeText,
        outputLanguage,
      })
    )
  })
  const [story, setStory] = useState<YourStory>(
    () => job.yourStory ?? createEmptyYourStory(resumeVersionId),
  )
  const [illustrationStyle, setIllustrationStyle] = useState<IllustrationStyle>("professional")

  useEffect(() => {
    saveStoryWizardDraft(draft)
  }, [draft])

  const canGenerate = useMemo(() => isStoryWizardInputsComplete(draft), [draft])

  const updateDraft = useCallback((patch: Partial<ApplicationStoryWizardDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateOptional = useCallback(
    (key: keyof NonNullable<ApplicationStoryWizardDraft["optionalSources"]>, value: string) => {
      setDraft((prev) => ({
        ...prev,
        optionalSources: { ...prev.optionalSources, [key]: value },
      }))
    },
    [],
  )

  const handleGenerate = async () => {
    if (!canGenerate) return
    setPhase("generating")
    try {
      const result = await generateApplicationStoryWizard({
        language: outputLanguage,
        jobTitle: draft.jobTitle || job.jobTitle,
        company: draft.company || job.company,
        jobDescription: draft.jobDescription,
        resumeContent: draft.resumeContent,
        companyWebsiteUrl: draft.companyWebsiteUrl,
        optionalSources: draft.optionalSources,
        illustrationStyle,
        resumeVersionId,
        strategicProfile,
      })
      if (!result.success || !result.yourStory) {
        toast({
          title: "Wizard failed",
          description: wizardErrorDescription(result.errorCode, result.error),
          variant: "destructive",
        })
        setPhase("inputs")
        return
      }
      setStory(result.yourStory)
      await onComplete(result.yourStory)
      clearStoryWizardDraft()
      setPhase("results")
    } catch {
      toast({ title: "Wizard failed", description: "Unexpected error.", variant: "destructive" })
      setPhase("inputs")
    }
  }

  const handleUpdateStory = async (next: YourStory) => {
    setStory(next)
    await onComplete(next)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-background">
      {phase === "generating" ? <StoryWizardLoading /> : null}
      <div
        className={cn(
          "application-story-wizard mx-auto w-full max-w-4xl px-4 py-8 pb-24",
          phase === "generating" && "pointer-events-none opacity-40",
        )}
      >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          {phase === "results" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 mb-2"
              onClick={onCancel}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Done
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 mb-2"
              onClick={onCancel}
              disabled={phase === "generating"}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          <h1 className="text-2xl font-bold tracking-tight">Application Story Wizard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.jobTitle} · {job.company}
          </p>
        </div>
      </header>

      {phase === "results" ? (
        <ApplicationStoryResults
          job={job}
          story={story}
          outputLanguage={outputLanguage}
          onUpdateStory={handleUpdateStory}
          onRegenerate={() => setPhase("inputs")}
        />
      ) : null}

      {phase === "inputs" ? (
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Globe className="h-4 w-4 text-[var(--color-primary-light)]" />
              Required inputs
            </h2>
            <div className="space-y-2">
              <Label htmlFor="company-url">Company website URL</Label>
              <Input
                id="company-url"
                type="url"
                placeholder="https://company.com"
                value={draft.companyWebsiteUrl}
                onChange={(e) => updateDraft({ companyWebsiteUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-desc">Job description</Label>
              <Textarea
                id="job-desc"
                rows={8}
                value={draft.jobDescription}
                onChange={(e) => updateDraft({ jobDescription: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-preview">Tailored resume (read-only)</Label>
              <Textarea
                id="resume-preview"
                rows={6}
                readOnly
                className="bg-muted/30 font-mono text-xs"
                value={draft.resumeContent}
              />
              {!resumeText ? (
                <p className="text-sm text-destructive">
                  Link a tailored CV to this application before running the wizard.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Illustration style</Label>
              <Select
                value={illustrationStyle}
                onValueChange={(v) => setIllustrationStyle(v as IllustrationStyle)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setPhase("optional")}>
              <Building2 className="mr-2 h-4 w-4" />
              Optional company sources
            </Button>
            <Button type="button" disabled={!canGenerate || phase === "generating"} onClick={() => void handleGenerate()}>
              <Sparkles className="mr-2 h-4 w-4" />
              Run Application Story Wizard
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "optional" ? (
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-[var(--color-primary-light)]" />
              Optional company sources
            </h2>
            <p className="text-sm text-muted-foreground">
              Paste excerpts from company pages to enrich intelligence analysis.
            </p>
            {(
              [
                ["aboutPage", "About page"],
                ["companyValues", "Company values"],
                ["annualReport", "Annual report excerpt"],
                ["teamPage", "Team page"],
                ["productPages", "Product pages"],
                ["linkedInCompanyPage", "LinkedIn company page"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Textarea
                  rows={3}
                  value={draft.optionalSources?.[key] ?? ""}
                  onChange={(e) => updateOptional(key, e.target.value)}
                />
              </div>
            ))}
          </section>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setPhase("inputs")}>
              Back to required inputs
            </Button>
            <Button type="button" disabled={!canGenerate || phase === "generating"} onClick={() => void handleGenerate()}>
              <Sparkles className="mr-2 h-4 w-4" />
              Run wizard
            </Button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
