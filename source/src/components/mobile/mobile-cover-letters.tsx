"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FormattedLetterContent } from "@/components/formatted-letter-content"
import {
  MobileAiCoach,
  type CoverLetterApplyPayload,
} from "@/components/mobile/mobile-ai-coach"
import {
  formatCoverLetterDate,
  buildNewCoverLetterApplicantPrefill,
  coverLetterHasSavedApplicantDetails,
  resolveCoverLetterApplicantContact,
  resolveCoverLetterSalutation,
} from "@/lib/cover-letter-contact"
import {
  buildCoverLetterExportElement,
  type CoverLetterExportData,
} from "@/lib/cover-letter-export-html"
import { defaultResumeContactInfo } from "@/lib/contact-info"
import {
  coverLetterPdfMaxBytesForPreset,
  downloadDomAsCompressedPdf,
} from "@/lib/export-dom-to-pdf"
import {
  createEmptyResumeCoverLetter,
  hasResumeCoverLetterContent,
  hiringManagerFields,
} from "@/lib/resume-cover-letter"
import {
  createNewResumeId,
  foldersStorage,
  normalizeResumeVersion,
  saveResume,
} from "@/lib/storage"
import type { ResumeEmbeddedCoverLetter, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowLeft, Download, Mail, Plus } from "lucide-react"

type MobileCoverLettersProps = {
  resumes: ResumeVersion[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onResumesChange: (resumes: ResumeVersion[]) => void
  openResumeId?: string | null
  onOpenResumeConsumed?: () => void
}

type LetterLang = "en" | "de"
type EditorTab = "preview" | "edit"

function formatUpdated(timestamp: number | undefined): string | null {
  if (!timestamp || timestamp <= 0) return null
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function letterPreview(resume: ResumeVersion): string {
  const cl = resume.coverLetter
  if (!cl || !hasResumeCoverLetterContent(cl)) return "No letter yet — tap to write"
  const text = (cl.contentEn || cl.contentDe || "").trim()
  return text.slice(0, 100) || cl.name || "Cover letter"
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
  const safe = name.trim().replace(/[^\w\-]+/g, "_").replace(/_+/g, "_") || "cover-letter"
  return `${safe}.pdf`
}

function closingLine(language: LetterLang): string {
  return language === "en" ? "Sincerely," : "Mit freundlichen Grüßen,"
}

function CoverLetterEditor({
  resume,
  onBack,
  onSaved,
}: {
  resume: ResumeVersion
  onBack: () => void
  onSaved: (next: ResumeVersion) => void
}) {
  const initial =
    resume.coverLetter ?? createEmptyResumeCoverLetter(resume.name || "Untitled Resume")
  const initialLang: LetterLang =
    resume.contactInfo?.language === "de"
      ? "de"
      : initial.contentDe.trim() && !initial.contentEn.trim()
        ? "de"
        : "en"

  const seededApplicant = coverLetterHasSavedApplicantDetails(initial)
    ? resolveCoverLetterApplicantContact({
        coverLetter: {
          ...(initial.applicantName?.trim() ? { applicantName: initial.applicantName } : {}),
          ...(initial.applicantAddress?.trim() ? { applicantAddress: initial.applicantAddress } : {}),
          ...(initial.applicantEmail?.trim() ? { applicantEmail: initial.applicantEmail } : {}),
          ...(initial.applicantPhone?.trim() ? { applicantPhone: initial.applicantPhone } : {}),
          ...(initial.letterDate?.trim() ? { letterDate: initial.letterDate } : {}),
        },
        resumeContact: resume.contactInfo,
        language: initialLang,
      })
    : buildNewCoverLetterApplicantPrefill({
        resumeContact: resume.contactInfo,
        language: initialLang,
      })

  const [tab, setTab] = useState<EditorTab>("preview")
  const [letterName, setLetterName] = useState(initial.name)
  const [applicantName, setApplicantName] = useState(seededApplicant.applicantName)
  const [applicantAddress, setApplicantAddress] = useState(seededApplicant.applicantAddress)
  const [applicantEmail, setApplicantEmail] = useState(seededApplicant.applicantEmail)
  const [applicantPhone, setApplicantPhone] = useState(seededApplicant.applicantPhone)
  const [company, setCompany] = useState(
    initial.recipientCompany?.trim() || resume.contactInfo?.targetCompany?.trim() || "",
  )
  const [manager, setManager] = useState(
    initial.hiringManager ?? initial.contactPersonName ?? "",
  )
  const [lang, setLang] = useState<LetterLang>(initialLang)
  const [contentEn, setContentEn] = useState(initial.contentEn ?? "")
  const [contentDe, setContentDe] = useState(initial.contentDe ?? "")
  const [baseline, setBaseline] = useState({
    name: initial.name,
    applicantName: seededApplicant.applicantName,
    applicantAddress: seededApplicant.applicantAddress,
    applicantEmail: seededApplicant.applicantEmail,
    applicantPhone: seededApplicant.applicantPhone,
    company: initial.recipientCompany?.trim() || resume.contactInfo?.targetCompany?.trim() || "",
    manager: initial.hiringManager ?? initial.contactPersonName ?? "",
    contentEn: initial.contentEn ?? "",
    contentDe: initial.contentDe ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const currentText = lang === "de" ? contentDe : contentEn
  const setCurrentText = (value: string) => {
    if (lang === "de") setContentDe(value)
    else setContentEn(value)
  }

  const dirty =
    letterName.trim() !== baseline.name.trim() ||
    applicantName.trim() !== baseline.applicantName.trim() ||
    applicantAddress.trim() !== baseline.applicantAddress.trim() ||
    applicantEmail.trim() !== baseline.applicantEmail.trim() ||
    applicantPhone.trim() !== baseline.applicantPhone.trim() ||
    company.trim() !== baseline.company.trim() ||
    manager.trim() !== baseline.manager.trim() ||
    contentEn !== baseline.contentEn ||
    contentDe !== baseline.contentDe

  const draftLetter = useMemo((): ResumeEmbeddedCoverLetter => {
    const now = Date.now()
    return {
      ...initial,
      name:
        letterName.trim() ||
        `Cover Letter - ${resume.name || "Untitled Resume"}`,
      applicantName: applicantName.trim(),
      applicantAddress: applicantAddress.trim(),
      applicantEmail: applicantEmail.trim(),
      applicantPhone: applicantPhone.trim(),
      recipientCompany: company.trim(),
      ...hiringManagerFields(manager),
      contentEn,
      contentDe,
      updatedAt: now,
      createdAt: initial.createdAt || now,
    }
  }, [
    initial,
    letterName,
    applicantName,
    applicantAddress,
    applicantEmail,
    applicantPhone,
    company,
    manager,
    contentEn,
    contentDe,
    resume.name,
  ])

  const profileImage =
    draftLetter.profileImage?.trim() || resume.profileImage?.trim() || null
  const companyLogo =
    draftLetter.companyLogo?.trim() || resume.companyLogo?.trim() || null
  const dateLabel =
    draftLetter.letterDate?.trim() || formatCoverLetterDate(lang)
  const addressLines = applicantAddress
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const buildExportData = (): CoverLetterExportData => ({
    applicantName: applicantName.trim(),
    applicantAddress: applicantAddress.trim(),
    applicantEmail: applicantEmail.trim(),
    applicantPhone: applicantPhone.trim(),
    profileImage,
    companyLogo,
    recipientCompany: company.trim(),
    hiringManager: manager.trim(),
    language: lang,
    dateLabel,
    bodyText: currentText,
  })

  const persistDraft = async (): Promise<ResumeVersion> => {
    const next = normalizeResumeVersion({
      ...resume,
      coverLetter: draftLetter,
      updatedAt: Date.now(),
    })
    const result = await saveResume(next)
    onSaved(next)
    setBaseline({
      name: draftLetter.name,
      applicantName: draftLetter.applicantName ?? "",
      applicantAddress: draftLetter.applicantAddress ?? "",
      applicantEmail: draftLetter.applicantEmail ?? "",
      applicantPhone: draftLetter.applicantPhone ?? "",
      company: draftLetter.recipientCompany ?? "",
      manager: draftLetter.hiringManager ?? draftLetter.contactPersonName ?? "",
      contentEn: draftLetter.contentEn,
      contentDe: draftLetter.contentDe,
    })
    if (result.remoteError) {
      setSaveError("Saved on this device. Cloud sync pending.")
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
      console.error("[mobile] Cover letter save failed:", err)
      setSaveError(err instanceof Error ? err.message : "Couldn’t save cover letter.")
    } finally {
      setSaving(false)
    }
  }

  const handleExportPdf = async () => {
    setExporting(true)
    setSaveError(null)
    try {
      if (dirty) await persistDraft()
      const exportRoot = await buildCoverLetterExportElement(buildExportData())
      const filename = pdfFilename(draftLetter.name)

      try {
        const response = await fetch("/api/pdf/cover-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: exportRoot.outerHTML,
            filename,
          }),
        })
        if (response.ok) {
          const blob = await response.blob()
          if (blob.type === "application/pdf" && blob.size > 500) {
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
            setSavedFlash(true)
            window.setTimeout(() => setSavedFlash(false), 1600)
            return
          }
        }
        console.warn("[mobile] Text PDF unavailable, using canvas fallback", response.status)
      } catch (err) {
        console.warn("[mobile] Text PDF failed, using canvas fallback", err)
      }

      const preset = "ats" as const
      const maxBytes = coverLetterPdfMaxBytesForPreset(preset)
      const { withinLimit, sizeBytes } = await downloadDomAsCompressedPdf({
        element: exportRoot,
        filename,
        preset,
        maxBytes,
        useExportRootDirectly: true,
      })
      if (!withinLimit) {
        setSaveError(
          `PDF saved (${Math.round(sizeBytes / 1024)}KB) but is above the ${Math.round(maxBytes / 1024)}KB guide. Shorten the letter or remove large images.`,
        )
      } else {
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 1600)
      }
    } catch (err) {
      console.error("[mobile] Cover letter PDF failed:", err)
      setSaveError(err instanceof Error ? err.message : "Couldn’t export PDF.")
    } finally {
      setExporting(false)
    }
  }

  const handleAiCoverLetterApply = useCallback(
    async (payload: CoverLetterApplyPayload): Promise<boolean> => {
      try {
        const nextEn = payload.language === "en" ? payload.newLetterText : contentEn
        const nextDe = payload.language === "de" ? payload.newLetterText : contentDe
        if (payload.language === "de") setContentDe(payload.newLetterText)
        else setContentEn(payload.newLetterText)

        const now = Date.now()
        const coverLetter: ResumeEmbeddedCoverLetter = {
          ...draftLetter,
          contentEn: nextEn,
          contentDe: nextDe,
          updatedAt: now,
        }
        const next = normalizeResumeVersion({
          ...resume,
          coverLetter,
          updatedAt: now,
        })
        await saveResume(next)
        onSaved(next)
        setBaseline({
          name: coverLetter.name,
          applicantName: coverLetter.applicantName ?? "",
          applicantAddress: coverLetter.applicantAddress ?? "",
          applicantEmail: coverLetter.applicantEmail ?? "",
          applicantPhone: coverLetter.applicantPhone ?? "",
          company: coverLetter.recipientCompany ?? "",
          manager: coverLetter.hiringManager ?? coverLetter.contactPersonName ?? "",
          contentEn: coverLetter.contentEn,
          contentDe: coverLetter.contentDe,
        })
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 1600)
        return true
      } catch (err) {
        console.error("[mobile] AI cover letter apply failed:", err)
        return false
      }
    },
    [contentEn, contentDe, draftLetter, resume, onSaved],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"
            aria-label="Back to cover letters"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {letterName.trim() || "Cover letter"}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {savedFlash ? "Saved" : dirty ? "Unsaved changes" : resume.name}
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
          className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1"
          role="tablist"
          aria-label="Cover letter sections"
        >
          {(
            [
              ["preview", "Preview"],
              ["edit", "Edit"],
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
              <p className="text-xs text-zinc-500">Letter preview</p>
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

            <div
              className="rounded-xl border border-zinc-200 bg-white px-5 py-6 shadow-sm"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, lineHeight: 1.6 }}
            >
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-b border-neutral-200 pb-3">
                <div className="min-w-0 text-sm leading-snug text-neutral-800">
                  <p className="font-semibold text-[15px] text-neutral-900">
                    {applicantName.trim() || "Your name"}
                  </p>
                  {addressLines.length > 0 ? (
                    addressLines.map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p className="text-neutral-400">Your address</p>
                  )}
                  {applicantEmail.trim() ? <p>{applicantEmail.trim()}</p> : null}
                </div>
                <div className="flex w-max max-w-[10rem] flex-col items-end gap-2 text-sm leading-snug text-neutral-800">
                  {applicantPhone.trim() ? (
                    <p className="whitespace-nowrap text-right">{applicantPhone.trim()}</p>
                  ) : null}
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt=""
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] shrink-0 rounded-full border border-neutral-200 object-cover"
                    />
                  ) : null}
                </div>
              </div>

              {dateLabel ? (
                <p className="mb-2.5 text-sm text-neutral-800">{dateLabel}</p>
              ) : null}

              <div className="mb-2.5 space-y-1 text-sm text-neutral-800">
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt=""
                    className="mb-2 max-h-12 max-w-[160px] object-contain"
                  />
                ) : null}
                <p className="font-semibold text-[15px] text-neutral-900">
                  {company.trim() || "Company name"}
                </p>
                {manager.trim() ? <p>{manager.trim()}</p> : null}
              </div>

              {(() => {
                const greeting = resolveCoverLetterSalutation({
                  hiringManager: manager,
                  language: lang,
                  bodyText: currentText,
                })
                return greeting ? (
                  <p className="mb-2.5 text-sm text-neutral-900">{greeting}</p>
                ) : null
              })()}

              <FormattedLetterContent
                text={currentText}
                className="text-sm text-neutral-900"
                emptyFallback={
                  <p className="text-sm italic text-neutral-400">
                    No letter text yet — switch to Edit to write.
                  </p>
                }
              />

              <div className="mt-3 break-inside-avoid">
                <p className="text-sm text-neutral-900">{closingLine(lang)}</p>
                <p className="mt-4 text-sm font-semibold text-neutral-900">
                  {applicantName.trim() || "Your name"}
                </p>
              </div>
            </div>

            {saveError ? <p className="mt-3 px-2 text-xs text-amber-800">{saveError}</p> : null}
          </div>
        ) : null}

        {tab === "edit" ? (
          <div className="flex min-h-full flex-col gap-3 px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Title
              </span>
              <input
                value={letterName}
                onChange={(e) => setLetterName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                placeholder="Cover letter title"
              />
            </label>

            <section className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Your details (letter header)
              </p>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Name</span>
                <input
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Address</span>
                <textarea
                  value={applicantAddress}
                  onChange={(e) => setApplicantAddress(e.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder={"Street\nCity, postcode"}
                  autoComplete="street-address"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-zinc-500">Email</span>
                  <input
                    type="email"
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-400"
                    autoComplete="email"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-zinc-500">Phone</span>
                  <input
                    type="tel"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-400"
                    autoComplete="tel"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Recipient
              </p>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Company</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder="Company name"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Hiring manager</span>
                <input
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder="Optional"
                />
              </label>
            </section>

            <div
              className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1"
              role="tablist"
              aria-label="Letter language"
            >
              {(["en", "de"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  role="tab"
                  aria-selected={lang === code}
                  onClick={() => setLang(code)}
                  className={cn(
                    "min-h-10 flex-1 rounded-lg text-sm font-medium",
                    lang === code ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500",
                  )}
                >
                  {code === "en" ? "English" : "German"}
                </button>
              ))}
            </div>

            <label className="flex min-h-0 flex-1 flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Letter ({lang === "en" ? "EN" : "DE"})
              </span>
              <textarea
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                className="mt-1 min-h-[40vh] w-full flex-1 resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[15px] leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                placeholder="Dear …,"
                spellCheck
              />
            </label>

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
        resumeSessionId={`cover-letter-${resume.id}`}
        resumeText={resume.resumeText ?? ""}
        coverLetterText={currentText}
        coverLetterLanguage={lang}
        outputLanguage={lang}
        currentVersionId={resume.id}
        currentVersionName={resume.name}
        versions={[resume]}
        requireResume={false}
        requireCoverLetter
        onCoverLetterApply={handleAiCoverLetterApply}
        fabLabel="AI Letter Coach"
        fabTooltip="Get help improving your cover letter"
      />
    </div>
  )
}

export function MobileCoverLetters({
  resumes,
  loading = false,
  error = null,
  onRefresh,
  onResumesChange,
  openResumeId = null,
  onOpenResumeConsumed,
}: MobileCoverLettersProps) {
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
      [...resumes].sort((a, b) => {
        const aHas = hasResumeCoverLetterContent(a.coverLetter) ? 1 : 0
        const bHas = hasResumeCoverLetterContent(b.coverLetter) ? 1 : 0
        if (aHas !== bHas) return bHas - aHas
        const aT = a.coverLetter?.updatedAt ?? a.updatedAt ?? a.timestamp ?? 0
        const bT = b.coverLetter?.updatedAt ?? b.updatedAt ?? b.timestamp ?? 0
        return bT - aT
      }),
    [resumes],
  )

  const selected = selectedId ? resumes.find((r) => r.id === selectedId) ?? null : null

  const handleCreate = async () => {
    setCreating(true)
    try {
      const now = Date.now()
      const folderId = await defaultFolderId()
      const contactInfo = defaultResumeContactInfo()
      const name = "Untitled Resume"
      const coverLetter = createEmptyResumeCoverLetter(name)
      const blank = normalizeResumeVersion({
        id: createNewResumeId(),
        name,
        resumeText: "",
        profileImage: null,
        companyLogo: null,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        contactInfo,
        coverLetter,
        folderId,
      })
      await saveResume(blank)
      onResumesChange([blank, ...resumes.filter((r) => r.id !== blank.id)])
      setSelectedId(blank.id)
    } catch (err) {
      console.error("[mobile] Create cover letter failed:", err)
      alert(err instanceof Error ? err.message : "Couldn’t create cover letter.")
    } finally {
      setCreating(false)
    }
  }

  if (selected) {
    return (
      <CoverLetterEditor
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
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900">
              Cover letters
            </h1>
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
              <Mail className="h-5 w-5 text-zinc-500" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-900">No cover letters yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
              Create a letter here, or open one linked to a resume from desktop.
            </p>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="mt-6 min-h-11 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white"
            >
              Create cover letter
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 px-2 py-1 pb-4">
            {sorted.map((resume) => {
              const hasLetter = hasResumeCoverLetterContent(resume.coverLetter)
              const updated = formatUpdated(
                resume.coverLetter?.updatedAt ?? resume.updatedAt ?? resume.timestamp,
              )
              return (
                <li key={resume.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(resume.id)}
                    className="flex w-full min-h-[4.5rem] flex-col gap-1 rounded-xl px-3 py-3.5 text-left active:bg-zinc-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold text-zinc-900">
                        {resume.coverLetter?.name ||
                          `Cover Letter - ${resume.name || "Untitled"}`}
                      </p>
                      {updated ? (
                        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-zinc-400">
                          {updated}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-zinc-500">{resume.name}</p>
                    <p
                      className={cn(
                        "line-clamp-2 text-sm leading-snug",
                        hasLetter ? "text-zinc-600" : "text-teal-800",
                      )}
                    >
                      {letterPreview(resume)}
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
