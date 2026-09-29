"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Map,
  Sparkles,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormatterOverviewBack } from "@/components/formatter-overview-back"
import { generateYourStory } from "@/app/actions/generate-your-story"
import {
  refineYourStoryWithAi,
  suggestCvEditsFromYourStory,
  type RefineYourStoryMode,
} from "@/app/actions/refine-your-story"
import { toast } from "@/hooks/use-toast"
import type { AiErrorCode } from "@/lib/ai/errors"
import {
  AI_NOT_CONFIGURED_MESSAGE,
  OPENAI_NOT_CONFIGURED_HINT_LOCAL,
} from "@/lib/ai/messages"
import { autosaveStatusLabel, useDebouncedAutosave } from "@/lib/use-debounced-autosave"
import type { JobApplication, ResumeVersion, YourStory } from "@/lib/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import {
  YOUR_STORY_SUPPORT_LABELS,
  createEmptyYourStory,
  hasUsableYourStory,
} from "@/lib/your-story"
import { CAREER_STORY_LABEL } from "@/lib/career-integration-platform"
import { ApplicationStoryResults } from "@/components/application-story-wizard/application-story-results"
import { hasApplicationStoryWizard } from "@/lib/application-story-wizard/helpers"

function yourStoryErrorDescription(code?: AiErrorCode, fallback?: string): string {
  if (code === "missing_api_key" || code === "invalid_api_key") {
    return `${AI_NOT_CONFIGURED_MESSAGE} ${OPENAI_NOT_CONFIGURED_HINT_LOCAL}`
  }
  return fallback ?? "Try again."
}

function notifyYourStoryError(title: string, code?: AiErrorCode, fallback?: string): void {
  toast({
    title,
    description: yourStoryErrorDescription(code, fallback),
    variant: "destructive",
  })
}

type YourStoryViewProps = {
  job: JobApplication
  resumeVersion?: ResumeVersion | null
  outputLanguage: "en" | "de"
  strategicProfile?: StrategicProfile | null
  onUpdate: (updates: Partial<JobApplication>) => void | Promise<void>
  onBack: () => void
  onOpenStoryWizard?: () => void
  onApplyCvSuggestions?: (suggestionsMarkdown: string) => void
}

const REFINE_ACTIONS: { mode: RefineYourStoryMode; labelEn: string; labelDe: string }[] = [
  { mode: "more_strategic", labelEn: "More strategic", labelDe: "Strategischer" },
  { mode: "more_human", labelEn: "More human", labelDe: "Menschlicher" },
  { mode: "more_confident", labelEn: "More confident", labelDe: "Selbstbewusster" },
  { mode: "more_concise", labelEn: "More concise", labelDe: "Kürzer" },
  { mode: "align_to_job", labelEn: "Align to job", labelDe: "An Stelle anpassen" },
]

function supportBadgeClass(tone: "ok" | "warn" | "risk"): string {
  if (tone === "ok") return "your-story-evidence-badge your-story-evidence-badge--ok"
  if (tone === "risk") return "your-story-evidence-badge your-story-evidence-badge--risk"
  return "your-story-evidence-badge your-story-evidence-badge--warn"
}

export function YourStoryView({
  job,
  resumeVersion,
  outputLanguage,
  strategicProfile,
  onUpdate,
  onBack,
  onOpenStoryWizard,
  onApplyCvSuggestions,
}: YourStoryViewProps) {
  const lang = outputLanguage === "de" ? "de" : "en"
  const resumeText = resumeVersion?.resumeText?.trim() ?? ""
  const resumeVersionId = resumeVersion?.id ?? job.resumeVersionId

  const [story, setStory] = useState<YourStory>(
    () => job.yourStory ?? createEmptyYourStory(resumeVersionId),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [cvSuggestionsOpen, setCvSuggestionsOpen] = useState(false)
  const [cvSuggestionsMarkdown, setCvSuggestionsMarkdown] = useState("")

  const persistStory = useCallback(
    async (next: YourStory) => {
      await onUpdate({
        yourStory: {
          ...next,
          resumeVersionId,
          lastModified: Date.now(),
        },
      })
    },
    [onUpdate, resumeVersionId],
  )

  const { status: autosaveStatus, markDirty } = useDebouncedAutosave({
    delayMs: 900,
    onSave: async () => {
      await persistStory(story)
    },
  })

  const handleStoryChange = (content: string) => {
    const next = { ...story, content, lastModified: Date.now() }
    setStory(next)
    markDirty()
  }

  const handleGenerate = async () => {
    if (!resumeText) return
    setBusy("generate")
    try {
      const result = await generateYourStory({
        language: outputLanguage,
        jobTitle: job.jobTitle,
        company: job.company,
        jobDescription: job.jobDescription,
        resumeContent: resumeText,
        resumeVersionId,
        strategicProfile,
      })
      if (!result.success || !result.yourStory) {
        notifyYourStoryError("Could not generate Your Story", result.errorCode, result.error)
        return
      }
      setStory(result.yourStory)
      await persistStory(result.yourStory)
    } finally {
      setBusy(null)
    }
  }

  const handleRefine = async (mode: RefineYourStoryMode) => {
    if (!resumeText || !story.content.trim()) return
    setBusy(`refine-${mode}`)
    try {
      const result = await refineYourStoryWithAi({
        language: outputLanguage,
        jobTitle: job.jobTitle,
        company: job.company,
        jobDescription: job.jobDescription,
        resumeContent: resumeText,
        resumeVersionId,
        currentStory: story,
        mode,
        strategicProfile,
      })
      if (!result.success || !result.yourStory) {
        notifyYourStoryError("Could not refine Your Story", result.errorCode, result.error)
        return
      }
      setStory(result.yourStory)
      await persistStory(result.yourStory)
    } finally {
      setBusy(null)
    }
  }

  const handleSuggestCv = async () => {
    if (!resumeText || !story.content.trim()) return
    setBusy("cv-suggest")
    try {
      const result = await suggestCvEditsFromYourStory({
        language: outputLanguage,
        jobTitle: job.jobTitle,
        company: job.company,
        jobDescription: job.jobDescription,
        resumeContent: resumeText,
        storyContent: story.content,
      })
      if (!result.success || !result.suggestionsMarkdown) {
        notifyYourStoryError("Could not suggest CV edits", result.errorCode, result.error)
        return
      }
      setCvSuggestionsMarkdown(result.suggestionsMarkdown)
      setCvSuggestionsOpen(true)
    } finally {
      setBusy(null)
    }
  }

  const evidenceRows = useMemo(() => story.cvEvidence ?? [], [story.cvEvidence])
  const staleCv =
    Boolean(story.resumeVersionId) &&
    Boolean(resumeVersionId) &&
    story.resumeVersionId !== resumeVersionId

  return (
    <div className="your-story-view">
      <header className="your-story-view__header">
        <FormatterOverviewBack onClick={onBack} />
        <div className="your-story-view__titles">
          <h1 className="your-story-view__title">{CAREER_STORY_LABEL}</h1>
          <p className="your-story-view__subtitle">
            {lang === "de"
              ? "Deine Berufsgeschichte — informelle Arbeit, Care-Arbeit, Migration, Bildung und Erfahrung in eine starke Erzählung übersetzen. Nicht das Anschreiben."
              : "Your employment narrative — translate lived experience, informal work, care work, migration, education, and professional history into confident positioning. Not your cover letter."}
          </p>
          <p className="your-story-view__meta">
            {job.jobTitle}
            {job.company ? ` · ${job.company}` : ""}
            {autosaveStatus !== "idle" ? (
              <span className="your-story-view__autosave">
                {autosaveStatusLabel(autosaveStatus)}
              </span>
            ) : null}
          </p>
          {staleCv ? (
            <p className="your-story-view__stale" role="status">
              {lang === "de"
                ? "Diese Story wurde aus einer älteren CV-Version erstellt. Regenerieren empfohlen."
                : "This story was generated from an older CV version. Regenerate recommended."}
            </p>
          ) : null}
        </div>
        <div className="your-story-view__header-actions flex flex-wrap gap-2">
          {onOpenStoryWizard ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={Boolean(busy) || !resumeText}
              onClick={onOpenStoryWizard}
            >
              <Map className="h-4 w-4" aria-hidden />
              {lang === "de" ? "Story-Wizard" : "Story Wizard"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Boolean(busy) || !resumeText}
            onClick={() => void handleGenerate()}
          >
            {busy === "generate" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {hasUsableYourStory(story)
              ? lang === "de"
                ? "Neu generieren"
                : "Regenerate"
              : lang === "de"
                ? "Story generieren"
                : "Generate story"}
          </Button>
        </div>
      </header>

      <div className="your-story-view__toolbar">
        <span className="your-story-view__toolbar-label">
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          {lang === "de" ? "KI anpassen" : "AI refine"}
        </span>
        {REFINE_ACTIONS.map((action) => (
          <Button
            key={action.mode}
            type="button"
            variant="ghost"
            size="sm"
            className="your-story-view__chip"
            disabled={Boolean(busy) || !story.content.trim()}
            onClick={() => void handleRefine(action.mode)}
          >
            {busy === `refine-${action.mode}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            {lang === "de" ? action.labelDe : action.labelEn}
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={Boolean(busy) || !story.content.trim()}
          onClick={() => void handleSuggestCv()}
        >
          {busy === "cv-suggest" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <BookOpen className="h-4 w-4" aria-hidden />
          )}
          {lang === "de" ? "CV aus Story verbessern" : "Use story to improve CV"}
        </Button>
      </div>

      <div className="your-story-view__grid">
        <section className="your-story-panel" aria-labelledby="your-story-editor-heading">
          <h2 id="your-story-editor-heading" className="your-story-panel__heading">
            {lang === "de" ? "Deine Erzählung" : "Your narrative"}
          </h2>
          <Textarea
            value={story.content}
            onChange={(e) => handleStoryChange(e.target.value)}
            placeholder={
              lang === "de"
                ? "Generiere oder schreibe deine Positionierung für diese Bewerbung…"
                : "Generate or write your positioning for this application…"
            }
            className="your-story-panel__textarea"
            rows={18}
          />
        </section>

        <section className="your-story-panel" aria-labelledby="your-story-evidence-heading">
          <h2 id="your-story-evidence-heading" className="your-story-panel__heading">
            {lang === "de" ? "CV-Belege" : "CV evidence"}
          </h2>
          <p className="your-story-panel__hint">
            {lang === "de"
              ? "Wo dein aktuelles CV die Story stützt — oder wo Belege fehlen."
              : "Where your current CV supports the story — or where evidence is thin."}
          </p>
          {evidenceRows.length === 0 ? (
            <p className="your-story-panel__empty">
              {lang === "de"
                ? "Noch keine Zuordnung. Generiere die Story oder passe sie mit KI an."
                : "No mapping yet. Generate the story or refine with AI."}
            </p>
          ) : (
            <ul className="your-story-evidence-list">
              {evidenceRows.map((row) => {
                const label = YOUR_STORY_SUPPORT_LABELS[row.supportLevel]
                const text = lang === "de" ? label.de : label.en
                return (
                  <li key={row.id} className="your-story-evidence-item">
                    <div className="your-story-evidence-item__top">
                      <span className={supportBadgeClass(label.tone)}>
                        {label.tone === "ok" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                        ) : (
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                        )}
                        {text}
                      </span>
                      <span className="your-story-evidence-item__section">{row.cvSection}</span>
                    </div>
                    <p className="your-story-evidence-item__story">{row.storyExcerpt}</p>
                    <p className="your-story-evidence-item__cv">{row.cvReference}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {hasApplicationStoryWizard(story) ? (
        <section className="mt-10 border-t pt-8">
          <ApplicationStoryResults
            job={job}
            story={story}
            outputLanguage={outputLanguage}
            onUpdateStory={async (next) => {
              setStory(next)
              await persistStory(next)
            }}
            onRegenerate={onOpenStoryWizard}
          />
        </section>
      ) : null}

      <Dialog open={cvSuggestionsOpen} onOpenChange={setCvSuggestionsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lang === "de" ? "Vorgeschlagene CV-Anpassungen" : "Suggested CV improvements"}
            </DialogTitle>
            <DialogDescription>
              {lang === "de"
                ? "Überprüfe die Vorschläge. Der CV wird erst geändert, wenn du sie bestätigst."
                : "Review these suggestions. Your CV is only changed when you confirm."}
            </DialogDescription>
          </DialogHeader>
          <pre className="your-story-suggestions-pre whitespace-pre-wrap font-sans text-sm">
            {cvSuggestionsMarkdown}
          </pre>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCvSuggestionsOpen(false)}>
              {lang === "de" ? "Schließen" : "Close"}
            </Button>
            {onApplyCvSuggestions ? (
              <Button
                type="button"
                onClick={() => {
                  onApplyCvSuggestions(cvSuggestionsMarkdown)
                  setCvSuggestionsOpen(false)
                }}
              >
                {lang === "de" ? "Im CV-Editor anwenden" : "Apply in CV editor"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
