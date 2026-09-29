"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  IMPORT_CV_SECTION_LABELS,
  parseImportedCvSections,
  validateAndRepairImportedCv,
  type ImportCvApplicationContext,
  type ImportCvConfidence,
  type ImportCvSection,
} from "@/lib/import-cv-structure"

export type ImportCvPreviewPayload = {
  jobId: string
  fileName: string
  formattedText: string
  confidence: ImportCvConfidence
  needsReview: boolean
  warnings: string[]
  issues: string[]
  score: number
  replacesExistingGoodCv: boolean
  existingResumeName?: string
  applicationContext?: ImportCvApplicationContext
}

export interface ImportCvPreviewDialogProps {
  open: boolean
  payload: ImportCvPreviewPayload | null
  isSaving?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (text: string) => void | Promise<void>
}

const REVIEW_SECTION_ORDER = [
  "OTHER",
  "PROFILE",
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "LANGUAGES",
  "PROJECTS",
  "CERTIFICATIONS",
] as const

function renderSectionLine(line: string, lineIndex: number): React.ReactNode {
  const trimmed = line.trim()
  if (!trimmed) return null
  const key = `line-${lineIndex}`
  if (trimmed.startsWith("###")) {
    return (
      <p key={key} className="text-xs italic text-muted-foreground mt-1">
        {trimmed.replace(/^###\s+/, "")}
      </p>
    )
  }
  if (trimmed.startsWith("##")) {
    return (
      <p key={key} className="text-sm font-semibold mt-2">
        {trimmed.replace(/^##\s+/, "")}
      </p>
    )
  }
  if (trimmed.startsWith("#")) {
    return (
      <p key={key} className="text-sm font-semibold text-primary mt-3 first:mt-0">
        {trimmed.replace(/^#\s+/, "")}
      </p>
    )
  }
  if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
    return (
      <li key={key} className="text-sm leading-relaxed">
        {trimmed.replace(/^[-•]\s+/, "")}
      </li>
    )
  }
  return (
    <p key={key} className="text-sm leading-relaxed">
      {trimmed}
    </p>
  )
}

function ImportSectionCard({ section }: { section: ImportCvSection }) {
  const label = IMPORT_CV_SECTION_LABELS[section.key] ?? section.title
  const lines = section.lines.filter((l) => l.trim().length > 0)
  const bullets = lines.filter((l) => /^[-•]/.test(l.trim()))
  const hasList = bullets.length > 0

  return (
    <section className="rounded-lg border bg-card px-4 py-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No content detected</p>
      ) : hasList && bullets.length === lines.length ? (
        <ul className="list-disc pl-5 space-y-1">
          {lines.map((line, lineIndex) => renderSectionLine(line, lineIndex))}
        </ul>
      ) : (
        <div className="space-y-0.5">
          {lines.map((line, lineIndex) => renderSectionLine(line, lineIndex))}
        </div>
      )}
    </section>
  )
}

export function ImportCvPreviewDialog({
  open,
  payload,
  isSaving = false,
  onOpenChange,
  onConfirm,
}: ImportCvPreviewDialogProps) {
  const [draftText, setDraftText] = useState("")
  const [showRawEditor, setShowRawEditor] = useState(false)

  useEffect(() => {
    if (open && payload) {
      setDraftText(payload.formattedText)
      setShowRawEditor(false)
    }
  }, [open, payload])

  const liveValidation = useMemo(
    () =>
      validateAndRepairImportedCv(draftText, {
        applicationContext: payload?.applicationContext,
      }),
    [draftText, payload?.applicationContext],
  )

  const sections = useMemo(() => {
    const parsed = parseImportedCvSections(liveValidation.text || draftText)
    return [...parsed].sort((a, b) => {
      const ai = REVIEW_SECTION_ORDER.indexOf(
        a.key as (typeof REVIEW_SECTION_ORDER)[number],
      )
      const bi = REVIEW_SECTION_ORDER.indexOf(
        b.key as (typeof REVIEW_SECTION_ORDER)[number],
      )
      return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99)
    })
  }, [draftText, liveValidation.text])

  if (!payload) return null

  const showReviewBanner =
    payload.needsReview ||
    payload.confidence === "low" ||
    liveValidation.needsReview

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        busy={isSaving}
        className="flex h-[min(92vh,900px)] max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Import review</DialogTitle>
          <DialogDescription>
            Check how <span className="font-medium">{payload.fileName}</span> was
            structured before saving. Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
          {payload.replacesExistingGoodCv && (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
            >
              <p className="font-medium">This will replace an existing CV</p>
              <p className="mt-1">
                {payload.existingResumeName
                  ? `"${payload.existingResumeName}" already has structured content. Confirm only if you want to overwrite it.`
                  : "This application already has a structured CV. Confirm only if you want to overwrite it."}
              </p>
            </div>
          )}

          {showReviewBanner && (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm flex gap-2 text-amber-950 dark:text-amber-100"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  Import needs review — some sections may have been detected incorrectly.
                </p>
                <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
                  Confidence score: {liveValidation.score}/100. Review each section below
                  or edit the source text before saving.
                </p>
              </div>
            </div>
          )}

          {!showReviewBanner && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm flex gap-2 text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Structure looks good. Review each section, then save to the application.</p>
            </div>
          )}

          {(payload.warnings.length > 0 ||
            payload.issues.length > 0 ||
            liveValidation.warnings.length > 0) && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
              {[...new Set([...payload.warnings, ...liveValidation.warnings])].map(
                (warning, index) => (
                  <p key={`warning-${index}`} className="text-muted-foreground">
                    • {warning}
                  </p>
                ),
              )}
              {[...new Set([...payload.issues, ...liveValidation.issues])].map(
                (issue, index) => (
                  <p key={`issue-${index}`} className="text-amber-800 dark:text-amber-200">
                    • {issue}
                  </p>
                ),
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Structured preview
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((section, sectionIndex) => (
                <ImportSectionCard
                  key={`${section.key}-${sectionIndex}`}
                  section={section}
                />
              ))}
            </div>
          </div>

          <Collapsible open={showRawEditor} onOpenChange={setShowRawEditor}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between"
              >
                Edit source text
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showRawEditor && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={isSaving}
                className="min-h-[min(40vh,320px)] font-mono text-xs leading-relaxed resize-y"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground text-left sm:max-w-[55%]">
            Repairs run again when you save. Confirm only when profile, experience,
            education, skills, and languages look correct.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving || !draftText.trim()}
              onClick={() => void onConfirm(draftText.trim())}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm import
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
