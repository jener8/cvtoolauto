"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { MobileAiCoach } from "@/components/mobile/mobile-ai-coach"
import { ExportMetadataPreviewPanel } from "@/components/export-metadata-preview-panel"
import { ResumePreview } from "@/components/resume-preview"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AiResumeEditPayload, AiResumeEditResult } from "@/lib/cv-edit-types"
import { compressProfilePhotoToDataUrl } from "@/lib/compress-image"
import {
  applyPortfolioSlotUpdate,
  defaultResumeContactInfo,
  normalizeContactInfo,
  portfolioInputSlots,
  type ResumeContactInfo,
} from "@/lib/contact-info"
import { isSavedResumeId } from "@/lib/pdf-export-presets"
import {
  createNewResumeId,
  defaultResumeTitle,
  foldersStorage,
  normalizeResumeVersion,
  saveResume,
} from "@/lib/storage"
import type { ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Camera,
  Download,
  FileText,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react"

type MobileResumesProps = {
  resumes: ResumeVersion[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onResumesChange: (resumes: ResumeVersion[]) => void
  openResumeId?: string | null
  onOpenResumeConsumed?: () => void
}

type EditorTab = "preview" | "content" | "details"

function formatUpdated(timestamp: number | undefined): string | null {
  if (!timestamp || timestamp <= 0) return null
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function previewText(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0)
  return line?.slice(0, 100) ?? "Empty resume"
}

async function defaultFolderId(): Promise<string | undefined> {
  try {
    const folders = await foldersStorage.list()
    return folders[0]?.id
  } catch {
    return undefined
  }
}

function pdfFilename(name: string): string {
  const safe = name.trim().replace(/[^\w\-]+/g, "_").replace(/_+/g, "_") || "resume"
  return `${safe}.pdf`
}

async function downloadResumePdfBlob(resumeId: string, filename: string): Promise<void> {
  const params = new URLSearchParams({
    preset: "ats",
    metadata: "1",
  })
  const response = await fetch(`/api/pdf/resume/${resumeId}?${params.toString()}`)
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `PDF export failed (${response.status})`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 250)
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"

function ResumeEditor({
  resume,
  onBack,
  onSaved,
}: {
  resume: ResumeVersion
  onBack: () => void
  onSaved: (next: ResumeVersion) => void
}) {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<EditorTab>("preview")
  const [name, setName] = useState(resume.name)
  const [text, setText] = useState(resume.resumeText ?? "")
  const [contact, setContact] = useState<ResumeContactInfo>(() =>
    normalizeContactInfo(resume.contactInfo ?? defaultResumeContactInfo()),
  )
  const [profileImage, setProfileImage] = useState<string | null>(resume.profileImage ?? null)
  const [profilePhotoBorder, setProfilePhotoBorder] = useState(
    resume.profilePhotoBorder !== false,
  )
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const draft = useMemo(
    () =>
      normalizeResumeVersion({
        ...resume,
        name: name.trim() || defaultResumeTitle(contact) || "Untitled Resume",
        resumeText: text,
        contactInfo: normalizeContactInfo(contact),
        profileImage,
        profilePhotoBorder,
        updatedAt: resume.updatedAt ?? resume.timestamp ?? Date.now(),
        timestamp: resume.timestamp || Date.now(),
      }),
    [resume, name, text, contact, profileImage, profilePhotoBorder],
  )

  const dirty =
    draft.name !== resume.name ||
    draft.resumeText !== (resume.resumeText ?? "") ||
    JSON.stringify(draft.contactInfo) !== JSON.stringify(normalizeContactInfo(resume.contactInfo)) ||
    (draft.profileImage ?? null) !== (resume.profileImage ?? null) ||
    Boolean(draft.profilePhotoBorder) !== (resume.profilePhotoBorder !== false)

  const portfolioSlots = portfolioInputSlots(contact.portfolios, contact.portfolio)

  const persistDraft = async (): Promise<ResumeVersion> => {
    const next = normalizeResumeVersion({
      ...draft,
      updatedAt: Date.now(),
    })
    const result = await saveResume(next)
    onSaved(next)
    if (result.remoteError) {
      setSaveError("Saved on this device. Cloud sync pending — PDF may use the last synced version.")
    }
    return next
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await persistDraft()
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
    } catch (err) {
      console.error("[mobile] Resume save failed:", err)
      setSaveError(err instanceof Error ? err.message : "Couldn’t save resume.")
    } finally {
      setSaving(false)
    }
  }

  const handleExportPdf = async () => {
    setExporting(true)
    setSaveError(null)
    try {
      const saved = dirty ? await persistDraft() : draft
      if (!isSavedResumeId(saved.id)) {
        throw new Error("Save the resume before exporting a PDF.")
      }
      try {
        await downloadResumePdfBlob(saved.id, pdfFilename(saved.name))
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 1600)
      } catch (apiError) {
        console.warn("[mobile] Server PDF failed, opening print view:", apiError)
        window.open(`/print/resume/${saved.id}?autoprint=1`, "_blank", "noopener,noreferrer")
        setSaveError("Opened print view — use Share → Save as PDF if the download didn’t start.")
      }
    } catch (err) {
      console.error("[mobile] PDF export failed:", err)
      setSaveError(err instanceof Error ? err.message : "Couldn’t export PDF.")
    } finally {
      setExporting(false)
    }
  }

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await compressProfilePhotoToDataUrl(file, 400)
      setProfileImage(dataUrl)
    } catch (err) {
      console.error("[mobile] Photo compress failed:", err)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") setProfileImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const patchContact = (patch: Partial<ResumeContactInfo>) => {
    setContact((prev) => normalizeContactInfo({ ...prev, ...patch }))
  }

  const handleAiResumeEdit = useCallback(
    async (payload: AiResumeEditPayload): Promise<AiResumeEditResult> => {
      try {
        const nextText = payload.newResumeText
        setText(nextText)
        const next = normalizeResumeVersion({
          ...resume,
          name: name.trim() || defaultResumeTitle(contact) || "Untitled Resume",
          resumeText: nextText,
          contactInfo: normalizeContactInfo(contact),
          profileImage,
          profilePhotoBorder,
          updatedAt: Date.now(),
          timestamp: resume.timestamp || Date.now(),
        })
        await saveResume(next)
        onSaved(next)
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 1600)
        return { success: true, newVersionId: next.id, newVersionName: next.name }
      } catch (err) {
        console.error("[mobile] AI resume apply failed:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Couldn’t apply AI edit.",
        }
      }
    },
    [resume, name, contact, profileImage, profilePhotoBorder, onSaved],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"
            aria-label="Back to resumes"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {name.trim() || "Untitled Resume"}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {savedFlash ? "Saved" : dirty ? "Unsaved changes" : "Resume"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exporting || saving}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100 disabled:opacity-40"
            aria-label="Export PDF"
            title="Export PDF"
          >
            <Download className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="mr-1 min-h-11 rounded-xl bg-zinc-900 px-3.5 text-sm font-medium text-white disabled:opacity-40 active:bg-zinc-800"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div
          className="mx-3 mb-2 grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1"
          role="tablist"
          aria-label="Resume editor sections"
        >
          {(
            [
              ["preview", "Preview"],
              ["content", "Content"],
              ["details", "Details"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "min-h-10 rounded-lg text-sm font-medium",
                tab === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === "preview" ? (
          <div className="flex min-h-full flex-col px-2 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between gap-2 px-2">
              <p className="text-xs text-zinc-500">Live A4 preview</p>
              <div className="flex items-center gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50"
                      aria-label="Export info"
                      title="Export info"
                    >
                      <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[min(100vw-1.5rem,22rem)] max-h-[70vh] overflow-y-auto p-3"
                  >
                    <ExportMetadataPreviewPanel resume={draft} />
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={() => void handleExportPdf()}
                  disabled={exporting || saving}
                  className="flex min-h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {exporting ? "Exporting…" : "Export PDF"}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-100">
              <ResumePreview
                version={draft}
                panel="preview"
                exportIncludeTransparencyPage={false}
                exportIncludeMetadata={false}
              />
            </div>
            {saveError ? <p className="mt-3 px-2 text-xs text-amber-800">{saveError}</p> : null}
          </div>
        ) : null}

        {tab === "content" ? (
          <div className="flex min-h-full flex-col gap-3 px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Field label="Title">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Resume title"
              />
            </Field>
            <Field label="Content">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[55vh] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 font-mono text-[15px] leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                placeholder={"# PROFILE\nYour summary…\n\n# EXPERIENCE\n## Role\n### Company — dates\n- Achievement"}
                spellCheck
              />
            </Field>
            <p className="text-xs leading-relaxed text-zinc-500">
              Use # for sections. Switch to Preview to see the PDF layout.
            </p>
            {saveError ? <p className="text-xs text-amber-800">{saveError}</p> : null}
          </div>
        ) : null}

        {tab === "details" ? (
          <div className="flex flex-col gap-5 px-4 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <section>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Photo</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                  {profileImage ? (
                    <img src={profileImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <Camera className="h-6 w-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      void handlePhotoChange(file)
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="min-h-11 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white"
                  >
                    {profileImage ? "Change photo" : "Add photo"}
                  </button>
                  {profileImage ? (
                    <button
                      type="button"
                      onClick={() => setProfileImage(null)}
                      className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-sm text-zinc-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={profilePhotoBorder}
                  onChange={(e) => setProfilePhotoBorder(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Show photo border
              </label>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Job target
              </p>
              <Field label="Target role">
                <input
                  value={contact.targetRole}
                  onChange={(e) => patchContact({ targetRole: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Product Manager"
                />
              </Field>
              <Field label="Target company">
                <input
                  value={contact.targetCompany}
                  onChange={(e) => patchContact({ targetCompany: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Acme GmbH"
                />
              </Field>
              <Field label="Professional title">
                <input
                  value={contact.professionalTitle}
                  onChange={(e) => patchContact({ professionalTitle: e.target.value })}
                  className={inputClass}
                  placeholder="Shown under your name"
                />
              </Field>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Contact
              </p>
              <Field label="Name">
                <input
                  value={contact.name}
                  onChange={(e) => patchContact({ name: e.target.value })}
                  className={inputClass}
                  autoComplete="name"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => patchContact({ email: e.target.value })}
                  className={inputClass}
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => patchContact({ phone: e.target.value })}
                  className={inputClass}
                  autoComplete="tel"
                />
              </Field>
              <Field label="LinkedIn">
                <input
                  value={contact.linkedin}
                  onChange={(e) => patchContact({ linkedin: e.target.value })}
                  className={inputClass}
                  placeholder="linkedin.com/in/…"
                />
              </Field>
              <Field label="Address">
                <input
                  value={contact.address}
                  onChange={(e) => patchContact({ address: e.target.value })}
                  className={inputClass}
                  autoComplete="street-address"
                />
              </Field>
              <Field label="Citizenship">
                <input
                  value={contact.citizenship}
                  onChange={(e) => patchContact({ citizenship: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="CV language">
                <select
                  value={contact.language}
                  onChange={(e) =>
                    patchContact({ language: e.target.value === "de" ? "de" : "en" })
                  }
                  className={inputClass}
                >
                  <option value="en">English</option>
                  <option value="de">German</option>
                </select>
              </Field>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Portfolio
                </p>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={contact.showPortfolio}
                    onChange={(e) => patchContact({ showPortfolio: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Show on CV
                </label>
              </div>
              {portfolioSlots.map((slot, index) => (
                <Field key={index} label={`Website ${index + 1}`}>
                  <input
                    value={slot}
                    onChange={(e) =>
                      setContact((prev) =>
                        normalizeContactInfo(applyPortfolioSlotUpdate(prev, index, e.target.value)),
                      )
                    }
                    className={inputClass}
                    placeholder="https://…"
                    inputMode="url"
                  />
                </Field>
              ))}
            </section>

            {saveError ? <p className="text-xs text-amber-800">{saveError}</p> : null}
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={exporting || saving}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? "Exporting PDF…" : "Export PDF"}
            </button>
          </div>
        ) : null}
      </div>

      <MobileAiCoach
        folderId={resume.folderId}
        resumeSessionId={resume.id}
        resumeText={text}
        coverLetterText={resume.coverLetter?.contentEn || resume.coverLetter?.contentDe || ""}
        outputLanguage={contact.language}
        currentVersionId={resume.id}
        currentVersionName={name}
        versions={[resume]}
        requireResume
        requireCoverLetter={false}
        onResumeEdit={handleAiResumeEdit}
        fabLabel="AI CV Coach"
        fabTooltip="Get help improving your CV"
      />
    </div>
  )
}

export function MobileResumes({
  resumes,
  loading = false,
  error = null,
  onRefresh,
  onResumesChange,
  openResumeId = null,
  onOpenResumeConsumed,
}: MobileResumesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!openResumeId) return
    if (resumes.some((resume) => resume.id === openResumeId)) {
      setSelectedId(openResumeId)
    }
    onOpenResumeConsumed?.()
  }, [openResumeId, resumes, onOpenResumeConsumed])

  const sorted = useMemo(
    () =>
      [...resumes].sort(
        (a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0),
      ),
    [resumes],
  )

  const selected = selectedId ? resumes.find((r) => r.id === selectedId) ?? null : null

  const handleCreate = async () => {
    setCreating(true)
    try {
      const now = Date.now()
      const folderId = await defaultFolderId()
      const contactInfo = defaultResumeContactInfo()
      const blank = normalizeResumeVersion({
        id: createNewResumeId(),
        name: "Untitled Resume",
        resumeText: "",
        profileImage: null,
        companyLogo: null,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        contactInfo,
        coverLetter: null,
        folderId,
      })
      await saveResume(blank)
      onResumesChange([blank, ...resumes.filter((r) => r.id !== blank.id)])
      setSelectedId(blank.id)
    } catch (err) {
      console.error("[mobile] Create resume failed:", err)
      alert(err instanceof Error ? err.message : "Couldn’t create resume.")
    } finally {
      setCreating(false)
    }
  }

  if (selected) {
    return (
      <ResumeEditor
        key={selected.id}
        resume={selected}
        onBack={() => setSelectedId(null)}
        onSaved={(next) => {
          onResumesChange(resumes.map((r) => (r.id === next.id ? next : r)))
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-zinc-200/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              EquitAI
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900">Resumes</h1>
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-sm font-medium text-white disabled:opacity-50 active:bg-zinc-800"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {creating ? "Creating…" : "New"}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="space-y-3 px-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-700">{error}</p>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 min-h-11 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <FileText className="h-5 w-5 text-zinc-500" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-900">No resumes yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
              Create one here, or open resumes you already saved on desktop.
            </p>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="mt-6 min-h-11 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white"
            >
              Create resume
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 px-2 py-1 pb-4">
            {sorted.map((resume) => {
              const updated = formatUpdated(resume.updatedAt ?? resume.timestamp)
              return (
                <li key={resume.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(resume.id)}
                    className="flex w-full min-h-[4.5rem] flex-col gap-1 rounded-xl px-3 py-3.5 text-left active:bg-zinc-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold text-zinc-900">
                        {resume.name || "Untitled Resume"}
                      </p>
                      {updated ? (
                        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-zinc-400">
                          {updated}
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-zinc-600">
                      {previewText(resume.resumeText ?? "")}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
