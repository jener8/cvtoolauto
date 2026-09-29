"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CvSourceCard } from "@/components/application-flow/cv-source-card"
import type { ApplicationFlowDraft, CvSource } from "@/lib/application-flow-storage"
import { normalizeCvSource } from "@/lib/application-flow-storage"
import {
  extractCvFileWithDiagnostics,
  SUPPORTED_CV_FILE_ACCEPT,
  SUPPORTED_CV_FILE_TYPES,
  type CvFileExtractionResult,
} from "@/lib/extract-document-text"
import { prepareImportedCvText } from "@/lib/prepare-imported-cv"
import { assessCvTextQuality } from "@/lib/cv-text-quality"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  FileText,
  FolderInput,
  Globe,
  PenLine,
  Loader2,
  Upload,
} from "lucide-react"

interface CvSourceStepProps {
  draft: ApplicationFlowDraft
  versions: ResumeVersion[]
  jobApplications?: JobApplication[]
  onPatch: (patch: Partial<ApplicationFlowDraft>) => void
  onCvSourceChange: (source: CvSource) => void
  onImportFromVersion: (versionId: string) => void
  onLanguageChange: (lang: "en" | "de") => void
}

type WorkspaceImportOption = {
  versionId: string
  label: string
  hint?: string
  /** Extra tokens for search (company, role, resume name). */
  searchText: string
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Score how well an option matches a typed query (exact, same tokens, related prefixes). */
function scoreWorkspaceImportMatch(option: WorkspaceImportOption, search: string): number {
  const query = normalizeSearchText(search)
  if (!query) return 1

  const haystack = normalizeSearchText(
    [option.label, option.hint, option.searchText].filter(Boolean).join(" "),
  )
  if (!haystack) return 0
  if (haystack === query) return 1
  if (haystack.includes(query)) return 0.95

  const queryWords = query.split(" ").filter(Boolean)
  const hayTokens = haystack.split(" ").filter(Boolean)
  if (queryWords.length === 0) return 1

  let hits = 0
  for (const word of queryWords) {
    if (hayTokens.some((token) => token === word || token.startsWith(word) || word.startsWith(token))) {
      hits += 1
    }
  }
  if (hits === 0) return 0
  if (hits === queryWords.length) return 0.85
  return 0.4 * (hits / queryWords.length)
}

function buildWorkspaceImportOptions(
  versions: ResumeVersion[],
  jobApplications: JobApplication[],
): WorkspaceImportOption[] {
  const byVersionId = new Map(versions.map((v) => [v.id, v]))
  const usedVersionIds = new Set<string>()
  const options: WorkspaceImportOption[] = []

  for (const job of jobApplications) {
    const versionId = job.resumeVersionId
    if (!versionId) continue
    const version = byVersionId.get(versionId)
    if (!version?.resumeText?.trim()) continue
    usedVersionIds.add(versionId)

    const role = job.jobTitle?.trim() || version.name
    const company = job.company?.trim()
    options.push({
      versionId,
      label: company ? `${role} — ${company}` : role,
      hint: version.name !== role ? version.name : undefined,
      searchText: [role, company, version.name, job.location, job.jobTitle]
        .filter(Boolean)
        .join(" "),
    })
  }

  for (const version of versions) {
    if (usedVersionIds.has(version.id)) continue
    if (!version.resumeText?.trim()) continue
    options.push({
      versionId: version.id,
      label: version.name?.trim() || "Untitled resume",
      hint: version.isReusableTemplate ? "Reusable template" : "Saved CV",
      searchText: [
        version.name,
        version.contactInfo?.targetRole,
        version.contactInfo?.targetCompany,
        version.contactInfo?.professionalTitle,
      ]
        .filter(Boolean)
        .join(" "),
    })
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}

export function CvSourceStep({
  draft,
  versions,
  jobApplications = [],
  onPatch,
  onCvSourceChange,
  onImportFromVersion,
  onLanguageChange,
}: CvSourceStepProps) {
  const cvSource = normalizeCvSource(draft.cvSource)
  const workspaceOptions = useMemo(
    () => buildWorkspaceImportOptions(versions, jobApplications),
    [versions, jobApplications],
  )

  const selectSource = (source: CvSource) => {
    onCvSourceChange(source)
    if (source === "blank") {
      onPatch({ generalCv: "" })
    }
  }

  const backToSourcePicker = () => {
    onCvSourceChange(null)
  }

  if (cvSource === null) {
    return (
      <div className="space-y-6 py-1">
        <p className="text-sm text-muted-foreground">
          Start from a CV file, another application in your workspace, pasted text, or a blank
          resume.
        </p>
        <div className="grid gap-4">
          <CvSourceCard
            title="Upload CV file"
            description="Upload a PDF, TXT, or Markdown resume."
            icon={Upload}
            onClick={() => selectSource("upload")}
          />
          {workspaceOptions.length > 0 && (
            <CvSourceCard
              title="Import from workspace"
              description="Reuse a CV from another application or saved resume in this folder."
              icon={FolderInput}
              onClick={() => selectSource("workspace")}
            />
          )}
          <CvSourceCard
            title="Paste CV or LinkedIn text"
            description="Paste your existing CV or copied LinkedIn profile text."
            icon={FileText}
            onClick={() => selectSource("paste")}
          />
          <CvSourceCard
            title="Start from blank"
            description="Build your resume manually in the editor."
            icon={PenLine}
            onClick={() => selectSource("blank")}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 py-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1.5 text-muted-foreground"
        onClick={backToSourcePicker}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Change source
      </Button>

      {cvSource === "upload" && (
        <UploadSourcePanel draft={draft} onPatch={onPatch} onLanguageChange={onLanguageChange} />
      )}

      {cvSource === "workspace" && (
        <WorkspaceImportPanel
          draft={draft}
          options={workspaceOptions}
          versions={versions}
          onImportFromVersion={onImportFromVersion}
          onLanguageChange={onLanguageChange}
        />
      )}

      {cvSource === "paste" && (
        <PasteSourcePanel draft={draft} onPatch={onPatch} onLanguageChange={onLanguageChange} />
      )}

      {cvSource === "blank" && (
        <BlankSourcePanel draft={draft} onLanguageChange={onLanguageChange} />
      )}
    </div>
  )
}

function LanguageToggle({
  language,
  onChange,
}: {
  language: "en" | "de"
  onChange: (lang: "en" | "de") => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">CV language</Label>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={language === "en" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange("en")}
        >
          English
        </Button>
        <Button
          type="button"
          variant={language === "de" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange("de")}
        >
          Deutsch
        </Button>
      </div>
    </div>
  )
}

function WorkspaceImportPanel({
  draft,
  options,
  versions,
  onImportFromVersion,
  onLanguageChange,
}: {
  draft: ApplicationFlowDraft
  options: WorkspaceImportOption[]
  versions: ResumeVersion[]
  onImportFromVersion: (versionId: string) => void
  onLanguageChange: (lang: "en" | "de") => void
}) {
  const initialId =
    versions.find((v) => v.resumeText.trim() === draft.generalCv.trim())?.id ?? ""
  const [selectedId, setSelectedId] = useState(initialId)
  const [open, setOpen] = useState(false)

  const handleSelect = (versionId: string) => {
    setSelectedId(versionId)
    onImportFromVersion(versionId)
    setOpen(false)
  }

  const selectedOption = options.find((o) => o.versionId === selectedId)
  const optionById = useMemo(() => {
    const map = new Map<string, WorkspaceImportOption>()
    for (const option of options) map.set(option.versionId, option)
    return map
  }, [options])

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Briefcase className="h-4 w-4 shrink-0 mt-0.5 text-foreground" />
          <div>
            <p className="font-medium text-foreground">Import from workspace</p>
            <p className="mt-1">
              Choose an existing application or saved CV from this folder. The resume text will be
              used as the starting point for tailoring.
            </p>
          </div>
        </div>
      </div>

      <LanguageToggle language={draft.outputLanguage} onChange={onLanguageChange} />

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No CVs found in this workspace yet. Upload a file or paste text instead.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="workspace-cv-import" className="text-sm">
            Application or saved CV
          </Label>
          <Popover modal open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="workspace-cv-import"
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-10 w-full justify-between px-3 font-normal"
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left",
                    !selectedOption && "text-muted-foreground",
                  )}
                >
                  {selectedOption
                    ? selectedOption.hint
                      ? `${selectedOption.label} · ${selectedOption.hint}`
                      : selectedOption.label
                    : "Choose an application…"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,36rem)] overflow-hidden p-0"
              align="start"
              sideOffset={4}
            >
              <Command
                filter={(value, search) => {
                  const versionId = value.split("::", 1)[0] ?? ""
                  const option = optionById.get(versionId)
                  if (!option) return 0
                  return scoreWorkspaceImportMatch(option, search)
                }}
              >
                <CommandInput placeholder="Search company, role, or CV…" />
                <CommandList
                  className="max-h-[min(16rem,50vh)] overflow-y-auto overscroll-contain"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <CommandEmpty>No matching applications or CVs.</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => {
                      const value = `${option.versionId}::${[
                        option.label,
                        option.hint,
                        option.searchText,
                      ]
                        .filter(Boolean)
                        .join(" ")}`
                      return (
                        <CommandItem
                          key={option.versionId}
                          value={value}
                          onSelect={() => handleSelect(option.versionId)}
                          className="items-start gap-2 py-2"
                        >
                          <Check
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              selectedId === option.versionId ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{option.label}</p>
                            {option.hint ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {option.hint}
                              </p>
                            ) : null}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {selectedOption && draft.generalCv.trim() && (
        <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2.5 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{selectedOption.label}</p>
              <p className="text-muted-foreground mt-0.5">
                CV imported — review below before continuing.
              </p>
            </div>
          </div>
        </div>
      )}

      {draft.generalCv.trim() && (
        <ImportedTextPreview text={draft.generalCv} label="Imported content" />
      )}
    </div>
  )
}

function UploadSourcePanel({
  draft,
  onPatch,
  onLanguageChange,
}: {
  draft: ApplicationFlowDraft
  onPatch: (patch: Partial<ApplicationFlowDraft>) => void
  onLanguageChange: (lang: "en" | "de") => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<
    | { status: "idle" }
    | { status: "loading"; fileName: string; phase: "reading" | "formatting" }
    | {
        status: "success"
        fileName: string
        charCount: number
        formatted: boolean
        needsReview: boolean
        warnings: string[]
      }
    | { status: "error"; result: CvFileExtractionResult & { ok: false } }
  >({ status: "idle" })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState({ status: "loading", fileName: file.name, phase: "reading" })

    const result = await extractCvFileWithDiagnostics(file)
    if (!result.ok) {
      onPatch({ generalCv: "" })
      setUploadState({ status: "error", result })
      e.target.value = ""
      return
    }

    setUploadState({ status: "loading", fileName: file.name, phase: "formatting" })
    const prepared = await prepareImportedCvText(result.text, {
      outputLanguage: draft.outputLanguage,
    })

    if (prepared.ok) {
      onPatch({ generalCv: prepared.text })
      setUploadState({
        status: "success",
        fileName: result.fileName,
        charCount: prepared.text.length,
        formatted: prepared.formatted,
        needsReview: prepared.needsReview,
        warnings: prepared.warnings,
      })
    } else {
      onPatch({ generalCv: "" })
      setUploadState({
        status: "error",
        result: {
          ok: false,
          fileName: result.fileName,
          error: prepared.error,
          supportedTypes: SUPPORTED_CV_FILE_TYPES,
          textDetected: true,
        },
      })
    }
    e.target.value = ""
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Supported file types</p>
        <p className="mt-1">
          {SUPPORTED_CV_FILE_TYPES.join(", ")} — DOCX is not supported yet. LinkedIn profile URLs
          cannot be imported automatically.
        </p>
      </div>

      <LanguageToggle language={draft.outputLanguage} onChange={onLanguageChange} />

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={uploadState.status === "loading"}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadState.status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploadState.status === "loading"
            ? uploadState.phase === "formatting"
              ? "Formatting CV…"
              : "Reading file…"
            : "Choose file"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_CV_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => void handleUpload(e)}
        />

        {uploadState.status === "success" && (
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2.5 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{uploadState.fileName}</p>
                <p className="text-muted-foreground mt-0.5">
                  {uploadState.charCount.toLocaleString()} characters
                  {uploadState.formatted ? " — formatted for the resume builder" : " detected"} —
                  review below before continuing.
                </p>
              </div>
            </div>
          </div>
        )}

        {uploadState.status === "error" && (
          <FileUploadError result={uploadState.result} />
        )}
      </div>

      {draft.generalCv.trim() && (
        <ImportedTextPreview
          text={draft.generalCv}
          label="Imported content"
          needsReview={uploadState.status === "success" ? uploadState.needsReview : false}
          warnings={uploadState.status === "success" ? uploadState.warnings : []}
        />
      )}
    </div>
  )
}

function PasteSourcePanel({
  draft,
  onPatch,
  onLanguageChange,
}: {
  draft: ApplicationFlowDraft
  onPatch: (patch: Partial<ApplicationFlowDraft>) => void
  onLanguageChange: (lang: "en" | "de") => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<
    (CvFileExtractionResult & { ok: false }) | null
  >(null)
  const [uploadLoading, setUploadLoading] = useState(false)

  const handleFileAsPaste = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    const result = await extractCvFileWithDiagnostics(file)
    if (!result.ok) {
      onPatch({ generalCv: "" })
      setUploadError(result)
      setUploadLoading(false)
      e.target.value = ""
      return
    }

    const prepared = await prepareImportedCvText(result.text, {
      outputLanguage: draft.outputLanguage,
    })
    if (prepared.ok) {
      onPatch({ generalCv: prepared.text })
      setUploadError(null)
    } else {
      onPatch({ generalCv: "" })
      setUploadError({
        ok: false,
        fileName: result.fileName,
        error: prepared.error,
        supportedTypes: SUPPORTED_CV_FILE_TYPES,
        textDetected: true,
      })
    }
    setUploadLoading(false)
    e.target.value = ""
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Paste CV or LinkedIn profile text</p>
        <p className="mt-1 text-muted-foreground">
          LinkedIn profile URLs cannot be imported automatically. Open your LinkedIn profile, select
          and copy the text (About, Experience, Education, Skills), then paste it here. You can also
          paste any existing CV.
        </p>
      </div>

      <LanguageToggle language={draft.outputLanguage} onChange={onLanguageChange} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="generalCv-paste" className="text-sm">
            CV or profile text
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={uploadLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploadLoading ? "Reading…" : "Upload PDF / TXT"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_CV_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => void handleFileAsPaste(e)}
          />
        </div>
        <Textarea
          id="generalCv-paste"
          placeholder="Paste your CV or copied LinkedIn profile text here…"
          value={draft.generalCv}
          onChange={(e) => {
            onPatch({ generalCv: e.target.value })
            setUploadError(null)
          }}
          className="min-h-[220px] text-sm bg-muted/20"
        />
      </div>

      {uploadError && <FileUploadError result={uploadError} />}

      {draft.generalCv.trim() && (
        <ImportedTextPreview text={draft.generalCv} label="Content ready" />
      )}
    </div>
  )
}

function BlankSourcePanel({
  draft,
  onLanguageChange,
}: {
  draft: ApplicationFlowDraft
  onLanguageChange: (lang: "en" | "de") => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Start from blank</p>
        <p className="mt-1">
          You will build your resume manually in the editor. AI tailoring still needs a job
          description — add your experience in the editor after the application is created.
        </p>
      </div>
      <LanguageToggle language={draft.outputLanguage} onChange={onLanguageChange} />
    </div>
  )
}

function FileUploadError({
  result,
}: {
  result: CvFileExtractionResult & { ok: false }
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm space-y-2">
      <p className="font-medium text-destructive">Could not import {result.fileName}</p>
      <p className="text-muted-foreground">{result.error}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground border-t pt-2">
        <dt>Supported types</dt>
        <dd>{result.supportedTypes.join(", ")}</dd>
        <dt>Text detected</dt>
        <dd>{result.textDetected ? "Some text found" : "No usable text"}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        Next: paste your CV or LinkedIn profile text manually, or try a plain .txt export.
      </p>
    </div>
  )
}

function ImportedTextPreview({
  text,
  label,
  needsReview = false,
  warnings = [],
}: {
  text: string
  label: string
  needsReview?: boolean
  warnings?: string[]
}) {
  const trimmed = text.trim()
  const lines = trimmed.split("\n").filter((l) => l.trim()).length
  const quality = assessCvTextQuality(trimmed)

  return (
    <div className="rounded-lg border bg-card px-3 py-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-muted-foreground">
        {trimmed.length.toLocaleString()} characters · {lines} lines
      </p>
      {!quality.ok ? (
        <p className="text-sm text-destructive">{quality.reason}</p>
      ) : needsReview ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Import needs review — some sections may have been detected incorrectly.
        </p>
      ) : (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Text looks readable — review the full extract below before continuing.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/30 p-3">
        <pre className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-mono">
          {trimmed}
        </pre>
      </div>
    </div>
  )
}
