"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AccordionContent } from "@/components/ui/accordion"
import { AccordionTrigger } from "@/components/ui/accordion"
import { AccordionItem } from "@/components/ui/accordion"
import { Accordion } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { captureTextareaSelection, captureVisibleTextSelection } from "@/lib/assistant-selection-context"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Check,
  Copy,
  Download,
  FileEdit,
  Globe,
  FileText,
  Save,
  Sparkles,
  User,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CoverLetter, ResumeVersion, ContactInfo } from "@/lib/types"
import { CoverLetterImageField } from "@/components/cover-letter-image-field"
import {
  coverLetterHeaderFields,
  coverLetterLayoutFields,
  getHiringManagerName,
  hiringManagerFields,
} from "@/lib/resume-cover-letter"
import { autosaveStatusLabel, useDebouncedAutosave } from "@/lib/use-debounced-autosave"
import {
  flattenImageDataUrl,
  imageDataUrlMayHaveTransparency,
} from "@/lib/compress-image"
import {
  buildCoverLetterExportElement,
  type CoverLetterExportData,
} from "@/lib/cover-letter-export-html"
import { PdfExportControls } from "@/components/pdf-export-controls"
import {
  coverLetterPdfMaxBytesForPreset,
  downloadDomAsCompressedPdf,
} from "@/lib/export-dom-to-pdf"
import { DEFAULT_PDF_EXPORT_PRESET, type PdfExportPreset } from "@/lib/pdf-export-presets"
import { estimatePdfSizeBytes } from "@/lib/pdf-size-estimate"
import { FormattedLetterContent } from "@/components/formatted-letter-content"
import {
  clearCoverLetterWizardSession,
  readCoverLetterWizardSession,
  writeCoverLetterWizardSession,
} from "@/lib/cover-letter-wizard-session"
import {
  CoverLetterAiTransparencyNote,
  CoverLetterGenerateStep,
  CoverLetterReviewStep,
} from "@/components/cover-letter-ai-panel"
import { subscribeAssistantCoverLetterApplied } from "@/lib/assistant-cover-letter-apply"
import {
  createCoverLetterVersionId,
  type CoverLetterAiMetadata,
  type CoverLetterVersionSnapshot,
} from "@/lib/cover-letter-ai"
import {
  formatCoverLetterDate,
  resolveCoverLetterApplicantContact,
  resolveCoverLetterSalutation,
  sanitizeCoverLetterField,
} from "@/lib/cover-letter-contact"
import { loadUserProfile } from "@/lib/user-profile"
import { FormatterOverviewBack } from "@/components/formatter-overview-back"

interface StandaloneCoverLetterProps {
  /** Resume this cover letter belongs to — required for per-resume scoping */
  resumeId: string
  coverLetter: CoverLetter
  resumeVersions: ResumeVersion[]
  onUpdate: (updates: Partial<CoverLetter>) => void
  onBack: () => void
  onBackToOverview?: () => void
  onRegisterExit?: (handler: () => void) => void
  initialMode?: "wizard" | "editor"
  contactInfo?: ContactInfo // Contact info from CV to pre-fill applicant details
  jobDescription?: string // Job description from the linked resume/application
  resumeText?: string // Resume text for the same resumeId only
}

type CoverLetterStored = CoverLetter & { content?: string }

function hasExistingStandaloneContent(cl: CoverLetterStored): boolean {
  const t = (v: string | undefined) => (v ?? "").trim()
  const legacy = typeof cl.content === "string" ? cl.content : ""
  if (t(legacy).length > 0 || t(cl.contentEn).length > 0 || t(cl.contentDe).length > 0) {
    return true
  }
  return Boolean(cl?.id?.trim())
}

/** Map legacy `content` into bodies for the editor (same idea as job applications). */
function getStandaloneBodies(cl: CoverLetterStored): { en: string; de: string } {
  const legacy = typeof cl.content === "string" ? cl.content : ""
  const en = cl.contentEn ?? ""
  const de = cl.contentDe ?? ""
  if (!en.trim() && !de.trim() && legacy.trim()) return { en: legacy, de: "" }
  return { en, de }
}

function applicantFieldsFromSource(
  source: CoverLetterStored,
  contactInfo?: ContactInfo,
  linked?: ResumeVersion | null,
  language: "en" | "de" = "en",
) {
  const header = coverLetterHeaderFields(source)
  const resolved = resolveCoverLetterApplicantContact({
    coverLetter: source,
    userProfile: loadUserProfile(),
    resumeContact: contactInfo ?? linked?.contactInfo,
    language,
  })
  return {
    ...resolved,
    recipientCompany:
      header.recipientCompany || linked?.contactInfo?.targetCompany?.trim() || "",
    profileImage: header.profileImage ?? linked?.profileImage ?? null,
    companyLogo: header.companyLogo ?? linked?.companyLogo ?? null,
  }
}

function coverLetterFormSignature(source: CoverLetterStored): string {
  const bodies = getStandaloneBodies(source)
  return JSON.stringify({
    updatedAt: source.updatedAt ?? 0,
    name: source.name ?? "",
    en: bodies.en,
    de: bodies.de,
    hiringManager: getHiringManagerName(source),
    ...coverLetterHeaderFields(source),
    letterDate: source.letterDate ?? "",
  })
}

export function StandaloneCoverLetter({
  resumeId,
  coverLetter,
  resumeVersions,
  onUpdate,
  onBack,
  onBackToOverview,
  onRegisterExit,
  initialMode = "wizard",
  contactInfo,
  jobDescription: propJobDescription,
  resumeText: propResumeText,
}: StandaloneCoverLetterProps) {
  const resumedWizard =
    typeof window !== "undefined" ? readCoverLetterWizardSession(resumeId) : null

  const [selectedCoverLetterMode, setSelectedCoverLetterMode] = useState<null | "edit" | "new">(() => {
    if (initialMode === "editor") return "edit"
    if (resumedWizard?.active) return "new"
    return hasExistingStandaloneContent(coverLetter as CoverLetterStored) ? null : "new"
  })
  const [showEditor, setShowEditor] = useState(initialMode === "editor")
  const [wizardStep, setWizardStep] = useState(() => resumedWizard?.step ?? 1)

  const [language, setLanguage] = useState<"en" | "de">(
    () => resumedWizard?.language ?? (contactInfo?.language as "en" | "de") ?? "en",
  )
  const [contentEn, setContentEn] = useState(() => {
    if (resumedWizard?.active) return resumedWizard.contentEn ?? ""
    return getStandaloneBodies(coverLetter as CoverLetterStored).en
  })
  const [contentDe, setContentDe] = useState(() => {
    if (resumedWizard?.active) return resumedWizard.contentDe ?? ""
    return getStandaloneBodies(coverLetter as CoverLetterStored).de
  })
  const [name, setName] = useState(coverLetter.name)
  const [hiringManager, setHiringManager] = useState(() =>
    getHiringManagerName(coverLetter),
  )
  const initialLinked = resumeVersions.find((v) => v.id === resumeId)
  const initialApplicant = applicantFieldsFromSource(
    coverLetter as CoverLetterStored,
    contactInfo,
    initialLinked,
    (contactInfo?.language as "en" | "de") ?? "en",
  )
  const [applicantName, setApplicantName] = useState(initialApplicant.applicantName)
  const [applicantAddress, setApplicantAddress] = useState(initialApplicant.applicantAddress)
  const [applicantEmail, setApplicantEmail] = useState(initialApplicant.applicantEmail)
  const [applicantPhone, setApplicantPhone] = useState(initialApplicant.applicantPhone)
  const [letterDate, setLetterDate] = useState(initialApplicant.letterDate)
  const [recipientCompany, setRecipientCompany] = useState(initialApplicant.recipientCompany)
  const [profileImage, setProfileImage] = useState<string | null>(initialApplicant.profileImage)
  const [companyLogo, setCompanyLogo] = useState<string | null>(initialApplicant.companyLogo)
  const [isSaving, setIsSaving] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pdfExportPreset, setPdfExportPreset] = useState<PdfExportPreset>(DEFAULT_PDF_EXPORT_PRESET)
  const [estimatedPdfBytes, setEstimatedPdfBytes] = useState<number | null>(null)
  const [selectedResumeVersionId, setSelectedResumeVersionId] = useState(resumeId)
  const [localJobDescription, setLocalJobDescription] = useState(propJobDescription || "")
  const [showBackDialog, setShowBackDialog] = useState(false)
  const [editLetterOpen, setEditLetterOpen] = useState(false)
  const [aiMetadata, setAiMetadata] = useState<CoverLetterAiMetadata | null>(
    () => coverLetter.aiMetadata ?? null,
  )
  const [versionHistory, setVersionHistory] = useState<CoverLetterVersionSnapshot[]>(
    () => coverLetter.versionHistory ?? [],
  )
  const [reviewAccepted, setReviewAccepted] = useState(false)

  // Use resume text from prop (the saved/tailored CV) or fall back to sessionStorage
  const [currentResumeText, setCurrentResumeText] = useState(propResumeText || "")

  const openedLetterKeyRef = useRef<string | null>(null)
  const lastHydratedFromPropRef = useRef("")
  const isNewDraftRef = useRef(Boolean(resumedWizard?.active))
  const flatteningLogoRef = useRef(false)
  const flatteningPhotoRef = useRef(false)

  useEffect(() => {
    return subscribeAssistantCoverLetterApplied((detail) => {
      setContentEn(detail.contentEn)
      setContentDe(detail.contentDe)
      if (detail.aiMetadata) setAiMetadata(detail.aiMetadata)
    })
  }, [])

  useEffect(() => {
    const updateEstimate = () => {
      const preview = document.getElementById("cover-letter-preview")
      const bodyText = language === "de" ? contentDe : contentEn
      const bytes = estimatePdfSizeBytes(preview instanceof HTMLElement ? preview : null, {
        preset: pdfExportPreset,
        pageCount: 1,
        extraImageDataUrls: [profileImage, companyLogo],
        textLength: bodyText.length,
      })
      setEstimatedPdfBytes(bytes)
    }

    updateEstimate()
    const timer = window.setTimeout(updateEstimate, 120)
    return () => window.clearTimeout(timer)
  }, [
    pdfExportPreset,
    contentEn,
    contentDe,
    language,
    profileImage,
    companyLogo,
    applicantName,
    applicantAddress,
    recipientCompany,
    hiringManager,
  ])

  useEffect(() => {
    if (!companyLogo || !imageDataUrlMayHaveTransparency(companyLogo) || flatteningLogoRef.current) {
      return
    }
    let cancelled = false
    flatteningLogoRef.current = true
    void flattenImageDataUrl(companyLogo, { maxWidth: 320, backgroundColor: "#ffffff" })
      .then((flat) => {
        if (!cancelled && flat !== companyLogo) setCompanyLogo(flat)
      })
      .finally(() => {
        flatteningLogoRef.current = false
      })
    return () => {
      cancelled = true
    }
  }, [companyLogo])

  useEffect(() => {
    if (
      !profileImage ||
      !imageDataUrlMayHaveTransparency(profileImage) ||
      flatteningPhotoRef.current
    ) {
      return
    }
    let cancelled = false
    flatteningPhotoRef.current = true
    void flattenImageDataUrl(profileImage, {
      maxWidth: 400,
      quality: 0.92,
      backgroundColor: "#ffffff",
    })
      .then((flat) => {
        if (!cancelled && flat !== profileImage) setProfileImage(flat)
      })
      .finally(() => {
        flatteningPhotoRef.current = false
      })
    return () => {
      cancelled = true
    }
  }, [profileImage])
  const letterScopeKey = `${resumeId}:${coverLetter.id}`
  const inWizardFlow = selectedCoverLetterMode === "new" && !showEditor

  const resolveStoredCoverLetter = useCallback((): CoverLetterStored => {
    const linked = resumeVersions.find((v) => v.id === resumeId)
    const embedded = linked?.coverLetter
    if (embedded && (embedded.contentEn?.trim() || embedded.contentDe?.trim())) {
      return embedded as CoverLetterStored
    }
    return (embedded ?? coverLetter) as CoverLetterStored
  }, [resumeVersions, resumeId, coverLetter])

  const storedSource = resolveStoredCoverLetter()
  const storedBodies = getStandaloneBodies(storedSource)
  const storedLinked = resumeVersions.find((v) => v.id === resumeId)
  const storedApplicant = applicantFieldsFromSource(storedSource, contactInfo, storedLinked)

  const hasUnsavedChanges =
    contentEn !== storedBodies.en ||
    contentDe !== storedBodies.de ||
    name !== storedSource.name ||
    hiringManager !== getHiringManagerName(storedSource) ||
    recipientCompany !== storedApplicant.recipientCompany ||
    profileImage !== storedApplicant.profileImage ||
    companyLogo !== storedApplicant.companyLogo ||
    applicantName !== storedApplicant.applicantName ||
    applicantAddress !== storedApplicant.applicantAddress ||
    applicantEmail !== storedApplicant.applicantEmail ||
    applicantPhone !== storedApplicant.applicantPhone ||
    letterDate !== storedApplicant.letterDate

  const standalonePersistRef = useRef({
    name,
    contentEn,
    contentDe,
    hiringManager,
    recipientCompany,
    profileImage,
    companyLogo,
    applicantName,
    applicantAddress,
    applicantEmail,
    applicantPhone,
    letterDate,
  })
  standalonePersistRef.current = {
    name,
    contentEn,
    contentDe,
    hiringManager,
    recipientCompany,
    profileImage,
    companyLogo,
    applicantName,
    applicantAddress,
    applicantEmail,
    applicantPhone,
    letterDate,
  }
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const standaloneSnapshot = useMemo(
    () =>
      JSON.stringify({
        name,
        contentEn,
        contentDe,
        hiringManager,
        recipientCompany,
        profileImage,
        companyLogo,
        applicantName,
        applicantAddress,
        applicantEmail,
        applicantPhone,
        letterDate,
      }),
    [
      name,
      contentEn,
      contentDe,
      hiringManager,
      recipientCompany,
      profileImage,
      companyLogo,
      applicantName,
      applicantAddress,
      applicantEmail,
      applicantPhone,
      letterDate,
    ],
  )

  const standaloneAutosaveStatus = useDebouncedAutosave({
    resetKey: `${resumeId}:${coverLetter.id}`,
    snapshot: standaloneSnapshot,
    enabled: !inWizardFlow,
    save: async () => {
      const s = standalonePersistRef.current
      await Promise.resolve(
        onUpdateRef.current({
          name: s.name,
          contentEn: s.contentEn,
          contentDe: s.contentDe,
          aiMetadata: aiMetadata ?? undefined,
          versionHistory,
          ...hiringManagerFields(s.hiringManager),
          ...coverLetterHeaderFields({
            recipientCompany: s.recipientCompany,
            profileImage: s.profileImage,
            companyLogo: s.companyLogo,
            applicantName: s.applicantName,
            applicantAddress: s.applicantAddress,
            applicantEmail: s.applicantEmail,
            applicantPhone: s.applicantPhone,
            letterDate: s.letterDate,
          }),
        }),
      )
    },
    debounceMs: 1000,
  })

  // Sync JD/resume text from the owning resume only (never sessionStorage or another resume).
  useEffect(() => {
    setSelectedResumeVersionId(resumeId)
    const linked = resumeVersions.find((v) => v.id === resumeId)
    setLocalJobDescription(propJobDescription ?? linked?.jobDescription ?? "")
    setCurrentResumeText(propResumeText ?? linked?.resumeText ?? "")
  }, [resumeId, resumeVersions, propJobDescription, propResumeText])

  const hydrateFromStoredLetter = useCallback(
    (source: CoverLetterStored, options?: { resetMode?: boolean }) => {
      const signature = coverLetterFormSignature(source)
      if (lastHydratedFromPropRef.current === signature && options?.resetMode !== true) {
        return
      }
      lastHydratedFromPropRef.current = signature

      const linked = resumeVersions.find((v) => v.id === resumeId)
      const fields = applicantFieldsFromSource(source, contactInfo, linked, language)

      if (!isNewDraftRef.current) {
        const bodies = getStandaloneBodies(source)
        setContentEn(bodies.en)
        setContentDe(bodies.de)
        setName(source.name)
        setHiringManager(getHiringManagerName(source))
        setApplicantName(fields.applicantName)
        setApplicantAddress(fields.applicantAddress)
        setApplicantEmail(fields.applicantEmail)
        setApplicantPhone(fields.applicantPhone)
        setLetterDate(fields.letterDate)
        setRecipientCompany(fields.recipientCompany)
        setProfileImage(fields.profileImage)
        setCompanyLogo(fields.companyLogo)
      }

      if (options?.resetMode) {
        const session = readCoverLetterWizardSession(resumeId)
        if (session?.active && initialMode !== "editor") {
          isNewDraftRef.current = true
          setSelectedCoverLetterMode("new")
          setShowEditor(false)
          setWizardStep(session.step)
          if (session.contentEn !== undefined) setContentEn(session.contentEn)
          if (session.contentDe !== undefined) setContentDe(session.contentDe)
          if (session.language) setLanguage(session.language)
        } else if (initialMode === "editor") {
          setSelectedCoverLetterMode("edit")
          setShowEditor(true)
        } else if (hasExistingStandaloneContent(source)) {
          setSelectedCoverLetterMode(null)
          setShowEditor(false)
        } else {
          setSelectedCoverLetterMode("new")
          setShowEditor(false)
        }
        if (!isNewDraftRef.current) {
          setWizardStep(1)
          setApplicantName(fields.applicantName)
          setApplicantAddress(fields.applicantAddress)
          setApplicantEmail(fields.applicantEmail)
          setApplicantPhone(fields.applicantPhone)
          setLetterDate(fields.letterDate)
          setRecipientCompany(fields.recipientCompany)
          setProfileImage(fields.profileImage)
          setCompanyLogo(fields.companyLogo)
        } else {
          const defaults = applicantFieldsFromSource(
            {} as CoverLetterStored,
            contactInfo,
            linked,
            language,
          )
          setApplicantName(defaults.applicantName)
          setApplicantAddress(defaults.applicantAddress)
          setApplicantEmail(defaults.applicantEmail)
          setApplicantPhone(defaults.applicantPhone)
          setLetterDate(defaults.letterDate)
          setRecipientCompany("")
          setProfileImage(null)
          setCompanyLogo(null)
        }
      }
    },
    [
      initialMode,
      resumeId,
      resumeVersions,
      contactInfo?.address,
      contactInfo?.email,
      contactInfo?.name,
      contactInfo?.phone,
      language,
    ],
  )

  const applyWizardSessionLayout = useCallback(() => {
    const session = readCoverLetterWizardSession(resumeId)
    if (!session?.active || initialMode === "editor") return false
    isNewDraftRef.current = true
    setSelectedCoverLetterMode("new")
    setShowEditor(false)
    setWizardStep(session.step)
    if (session.contentEn !== undefined) setContentEn(session.contentEn)
    if (session.contentDe !== undefined) setContentDe(session.contentDe)
    if (session.language) setLanguage(session.language)
    return true
  }, [resumeId, initialMode])

  // Sync from storage on scope change only — never while the create-new wizard is active.
  useEffect(() => {
    if (inWizardFlow || isNewDraftRef.current) return

    const source = resolveStoredCoverLetter()
    const scopeChanged = openedLetterKeyRef.current !== letterScopeKey

    if (scopeChanged) {
      openedLetterKeyRef.current = letterScopeKey
      if (applyWizardSessionLayout()) return
      hydrateFromStoredLetter(source, { resetMode: true })
      return
    }

    hydrateFromStoredLetter(source)
  }, [
    letterScopeKey,
    inWizardFlow,
    coverLetter.id,
    coverLetter.updatedAt,
    coverLetter.contentEn,
    coverLetter.contentDe,
    coverLetter.name,
    coverLetter.contactPersonName,
    coverLetter.recipientCompany,
    coverLetter.applicantName,
    coverLetter.applicantAddress,
    coverLetter.applicantEmail,
    coverLetter.applicantPhone,
    resumeVersions,
    resolveStoredCoverLetter,
    hydrateFromStoredLetter,
    applyWizardSessionLayout,
  ])

  // Persist wizard step + draft locally so paste/remount does not bounce to the entry screen.
  useEffect(() => {
    if (!inWizardFlow) return
    writeCoverLetterWizardSession(resumeId, wizardStep, {
      contentEn,
      contentDe,
      language,
    })
  }, [inWizardFlow, resumeId, wizardStep, contentEn, contentDe, language])

  const handleBackToOverview = onBackToOverview ?? onBack

  const requestExitToOverview = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowBackDialog(true)
    } else {
      handleBackToOverview()
    }
  }, [hasUnsavedChanges, handleBackToOverview])

  useEffect(() => {
    onRegisterExit?.(requestExitToOverview)
    return () => onRegisterExit?.(() => {})
  }, [requestExitToOverview, onRegisterExit])
  
  const handleBackDialogOpenChange = (open: boolean) => {
    if (!open && isSaving) return
    setShowBackDialog(open)
  }

  const handleSaveAndBack = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await onUpdate(buildCoverLetterUpdates())
      setShowBackDialog(false)
      handleBackToOverview()
    } catch (error) {
      console.error("[cover-letter] Save before back failed:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscardAndBack = () => {
    if (isSaving) return
    setShowBackDialog(false)
    handleBackToOverview()
  }

  const currentContent = language === "en" ? contentEn : contentDe
  const setCurrentContent = language === "en" ? setContentEn : setContentDe

  const linkedResume = resumeVersions.find((v) => v.id === selectedResumeVersionId)
  const resumeContentForAi = currentResumeText || linkedResume?.resumeText || ""
  const roleTitle =
    contactInfo?.targetRole?.trim() || linkedResume?.contactInfo?.targetRole?.trim() || name || "this role"
  const roleCompany =
    recipientCompany.trim() ||
    contactInfo?.targetCompany?.trim() ||
    linkedResume?.contactInfo?.targetCompany?.trim() ||
    "the company"

  const pushVersionSnapshot = useCallback(() => {
    if (!contentEn.trim() && !contentDe.trim()) return
    const snapshot: CoverLetterVersionSnapshot = {
      id: createCoverLetterVersionId(),
      label: `Saved ${new Date().toLocaleString()}`,
      contentEn,
      contentDe,
      createdAt: Date.now(),
      source: aiMetadata ? "ai_generated" : "user",
    }
    setVersionHistory((prev) => [...prev, snapshot].slice(-20))
  }, [contentEn, contentDe, aiMetadata])

  const buildCoverLetterUpdates = () => ({
    name,
    contentEn,
    contentDe,
    aiMetadata: aiMetadata ?? undefined,
    versionHistory,
    ...hiringManagerFields(hiringManager),
    ...coverLetterHeaderFields({
      recipientCompany,
      profileImage,
      companyLogo,
      applicantName,
      applicantAddress,
      applicantEmail,
      applicantPhone,
      letterDate,
    }),
  })

  const steps = [
    { number: 1, title: "Choose Language", icon: Globe },
    { number: 2, title: "Generate Cover Letter", icon: Sparkles },
    { number: 3, title: "Review & Edit", icon: FileText },
    { number: 4, title: "Check Details", icon: User },
  ]

  const applyResolvedContactDefaults = useCallback(() => {
    const resolved = resolveCoverLetterApplicantContact({
      coverLetter: {
        applicantName,
        applicantAddress,
        applicantEmail,
        applicantPhone,
        letterDate,
      },
      userProfile: loadUserProfile(),
      resumeContact: contactInfo ?? linkedResume?.contactInfo,
      language,
    })
    if (!sanitizeCoverLetterField(applicantName) && resolved.applicantName) {
      setApplicantName(resolved.applicantName)
    }
    if (!sanitizeCoverLetterField(applicantAddress) && resolved.applicantAddress) {
      setApplicantAddress(resolved.applicantAddress)
    }
    if (!sanitizeCoverLetterField(applicantEmail) && resolved.applicantEmail) {
      setApplicantEmail(resolved.applicantEmail)
    }
    if (!sanitizeCoverLetterField(applicantPhone) && resolved.applicantPhone) {
      setApplicantPhone(resolved.applicantPhone)
    }
    if (!sanitizeCoverLetterField(letterDate) && resolved.letterDate) {
      setLetterDate(resolved.letterDate)
    }
  }, [
    applicantName,
    applicantAddress,
    applicantEmail,
    applicantPhone,
    letterDate,
    contactInfo,
    linkedResume?.contactInfo,
    language,
  ])

  const handleGenerated = (text: string, metadata: CoverLetterAiMetadata) => {
    setCurrentContent(text)
    setAiMetadata(metadata)
    setReviewAccepted(false)
    applyResolvedContactDefaults()
    const next = 3
    setWizardStep(next)
    writeCoverLetterWizardSession(resumeId, next, { contentEn: language === "en" ? text : contentEn, contentDe: language === "de" ? text : contentDe, language })
  }

  const handleNext = () => {
    if (wizardStep === 3 && !reviewAccepted) return
    if (wizardStep < 4) {
      const next = wizardStep + 1
      setWizardStep(next)
      writeCoverLetterWizardSession(resumeId, next, { contentEn, contentDe, language })
    }
  }

  const openExistingStandaloneEditor = () => {
    isNewDraftRef.current = false
    clearCoverLetterWizardSession(resumeId)
    const source = resolveStoredCoverLetter()
    hydrateFromStoredLetter(source)
    setSelectedCoverLetterMode("edit")
    setShowEditor(true)
  }

  const startNewStandaloneDraft = () => {
    isNewDraftRef.current = true
    setContentEn("")
    setContentDe("")
    setLanguage((contactInfo?.language as "en" | "de") || "en")
    setSelectedCoverLetterMode("new")
    setWizardStep(1)
    setShowEditor(false)
    setAiMetadata(null)
    setReviewAccepted(false)
    writeCoverLetterWizardSession(resumeId, 1, { contentEn: "", contentDe: "", language })
  }

  const handleBackWizard = () => {
    if (wizardStep > 1) {
      const prev = wizardStep - 1
      setWizardStep(prev)
      writeCoverLetterWizardSession(resumeId, prev, { contentEn, contentDe, language })
      return
    }
    if (selectedCoverLetterMode === "new" && hasExistingStandaloneContent(coverLetter as CoverLetterStored)) {
      isNewDraftRef.current = false
      clearCoverLetterWizardSession(resumeId)
      setSelectedCoverLetterMode(null)
      return
    }
    clearCoverLetterWizardSession(resumeId)
    ;(onBackToOverview ?? onBack)()
  }

  const handleSeeCoverLetter = async () => {
    setIsSaving(true)
    await onUpdate(buildCoverLetterUpdates())
    setIsSaving(false)
    isNewDraftRef.current = false
    clearCoverLetterWizardSession(resumeId)
    setShowEditor(true)
  }

  const handleBoldText = () => {
    const textarea = document.getElementById("cover-letter-textarea") as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = currentContent.substring(start, end)

    if (selectedText) {
      const newContent = currentContent.substring(0, start) + `**${selectedText}**` + currentContent.substring(end)
      setCurrentContent(newContent)

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + 2, end + 2)
      }, 0)
    }
  }

  const renderFormattedContent = (text: string) => {
    if (!text.trim()) {
      return (
        <span style={{ color: "#6b7280" }}>
          Your cover letter content will appear here...
        </span>
      )
    }

    return (
      <FormattedLetterContent
        text={text}
        linkClassName="text-[#0369a1] underline underline-offset-2 break-words [overflow-wrap:anywhere]"
      />
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate(buildCoverLetterUpdates())
      lastHydratedFromPropRef.current = coverLetterFormSignature(
        resolveStoredCoverLetter(),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const displayDate =
    sanitizeCoverLetterField(letterDate) || formatCoverLetterDate(language)
  const displayApplicantName = sanitizeCoverLetterField(applicantName)
  const displayApplicantEmail = sanitizeCoverLetterField(applicantEmail)
  const displayApplicantPhone = sanitizeCoverLetterField(applicantPhone)
  const displayApplicantAddressLines = applicantAddress
    .split("\n")
    .map((line) => sanitizeCoverLetterField(line))
    .filter(Boolean)

  const handleCopyToClipboard = async () => {
    const formattedText = document.getElementById("cover-letter-preview")?.innerText
    if (formattedText) {
      await navigator.clipboard.writeText(formattedText)
      alert("Cover letter copied to clipboard!")
    }
  }

  const handleDownloadPDF = async () => {
    setIsExportingPdf(true)
    try {
      const linked = resumeVersions.find((v) => v.id === resumeId)
      const logoForExport =
        companyLogo?.trim() ||
        linked?.coverLetter?.companyLogo?.trim() ||
        linked?.companyLogo?.trim() ||
        null
      const photoForExport =
        profileImage?.trim() ||
        linked?.coverLetter?.profileImage?.trim() ||
        linked?.profileImage?.trim() ||
        null

      const exportData: CoverLetterExportData = {
        applicantName,
        applicantAddress,
        applicantEmail,
        applicantPhone,
        profileImage: photoForExport,
        companyLogo: logoForExport,
        recipientCompany,
        hiringManager,
        language,
        dateLabel: displayDate,
        bodyText: currentContent,
      }

      const exportRoot = await buildCoverLetterExportElement(exportData)
      const filename = `${name || "cover-letter"}.pdf`

      // Prefer Playwright text PDF (selectable/searchable); fall back to canvas export.
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
            link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
            return
          }
        }
        console.warn("[cover-letter] Text PDF unavailable, using canvas fallback", response.status)
      } catch (err) {
        console.warn("[cover-letter] Text PDF failed, using canvas fallback", err)
      }

      const maxBytes = coverLetterPdfMaxBytesForPreset(pdfExportPreset)
      const { withinLimit, sizeBytes } = await downloadDomAsCompressedPdf({
        element: exportRoot,
        filename,
        preset: pdfExportPreset,
        maxBytes,
        useExportRootDirectly: true,
      })

      if (!withinLimit) {
        alert(
          `PDF saved (${Math.round(sizeBytes / 1024)}KB) but is still above the ${Math.round(maxBytes / 1024)}KB limit. Try ATS Optimized export, shortening the letter, or removing large images.`,
        )
      }
    } catch (error) {
      console.error("Error generating PDF:", error)
      const detail = error instanceof Error ? error.message : "Unknown error"
      alert(
        detail.includes("oklch") || detail.includes("color")
          ? `Failed to generate PDF (${detail}). Please refresh and try again.`
          : `Failed to generate PDF. ${detail}`,
      )
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <>
      <AlertDialog open={showBackDialog} onOpenChange={handleBackDialogOpenChange}>
        <AlertDialogContent busy={isSaving}>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Cover Letter?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your cover letter. Would you like to save them before going back?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={handleDiscardAndBack}
            >
              No, Discard Changes
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleSaveAndBack()}>
              {isSaving ? "Saving…" : "Yes, Save Changes"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editLetterOpen} onOpenChange={setEditLetterOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit cover letter</DialogTitle>
            <DialogDescription>
              Edit the {language === "en" ? "English" : "German"} letter text. Changes appear in the
              preview as you type.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <div className="flex items-center gap-2">
              <Button type="button" onClick={handleBoldText} variant="outline" size="sm">
                <Bold className="mr-1 h-3 w-3" />
                Bold
              </Button>
              <span className="text-xs text-muted-foreground">
                Use **text** for bold
              </span>
            </div>
            <Textarea
              id="cover-letter-textarea"
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              onMouseUp={(e) => captureTextareaSelection("cover_letter", e.currentTarget)}
              onKeyUp={(e) => captureTextareaSelection("cover_letter", e.currentTarget)}
              placeholder="Write your cover letter here... Use **text** for bold."
              className="min-h-[280px] flex-1 font-mono text-xs"
            />
            <CoverLetterAiTransparencyNote metadata={aiMetadata} />
            {versionHistory.length > 0 ? (
              <div className="space-y-1 rounded-lg border bg-muted/30 p-2">
                <p className="text-[11px] font-medium text-muted-foreground">Version history</p>
                <ul className="space-y-1">
                  {versionHistory
                    .slice()
                    .reverse()
                    .map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="truncate">{v.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            setContentEn(v.contentEn)
                            setContentDe(v.contentDe)
                          }}
                        >
                          Restore
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditLetterOpen(false)}
            >
              Done
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-3.5 w-3.5" />
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="ui-formatter-shell flex min-h-0 flex-1 flex-col">
        <div className="ui-formatter-topbar">
          <FormatterOverviewBack onClick={requestExitToOverview} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">

      {selectedCoverLetterMode === null && (
        <div className="pb-8">
          <div className="container mx-auto px-4 py-8 max-w-lg">
            <h1 className="text-2xl font-bold mb-2">Cover Letter</h1>
            <p className="text-muted-foreground mb-8">You already have a saved cover letter.</p>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <Button
                    variant="outline"
                    className="h-auto min-h-[72px] w-full justify-start gap-3 whitespace-normal px-4 py-4 text-left"
                    onClick={openExistingStandaloneEditor}
                  >
                    <FileEdit className="h-6 w-6 shrink-0" />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-semibold">Edit existing cover letter</div>
                      <div className="text-sm font-normal leading-snug break-words text-muted-foreground">
                        Open the editor with your saved letter.
                      </div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Button
                    variant="outline"
                    className="h-auto min-h-[72px] w-full justify-start gap-3 whitespace-normal px-4 py-4 text-left"
                    onClick={startNewStandaloneDraft}
                  >
                    <Sparkles className="h-6 w-6 shrink-0" />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-semibold">Create new cover letter</div>
                      <div className="text-sm font-normal leading-snug break-words text-muted-foreground">
                        Start the wizard from step 1. Your saved letter stays until you replace it.
                      </div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {selectedCoverLetterMode === "new" && !showEditor && (
        <div className="pb-8">
          <div className="border-b bg-card">
            <div className="container mx-auto px-4 py-6 max-w-4xl">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Cover Letter Builder</h1>
                <p className="text-muted-foreground">
                  Follow the steps before reviewing and editing your cover letter
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {autosaveStatusLabel(standaloneAutosaveStatus)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = wizardStep === step.number
                  const isCompleted = wizardStep > step.number

                  return (
                    <div key={step.number} className="flex items-center flex-1">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : isCompleted
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div className="hidden sm:block">
                          <p className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                            Step {step.number}
                          </p>
                          <p className={`text-xs ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                            {step.title}
                          </p>
                        </div>
                      </div>

                      {index < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-4 ${wizardStep > step.number ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-8 max-w-4xl">
            {wizardStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Choose Language
                  </CardTitle>
                  <CardDescription>Select the language for your cover letter.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={language} onValueChange={(v) => setLanguage(v as "en" | "de")}>
                    <TabsList>
                      <TabsTrigger value="en">English</TabsTrigger>
                      <TabsTrigger value="de">Deutsch</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {wizardStep === 2 && (
              <CoverLetterGenerateStep
                language={language}
                jobTitle={roleTitle}
                company={roleCompany}
                jobDescription={localJobDescription}
                resumeContent={resumeContentForAi}
                applicantName={displayApplicantName || applicantName}
                applicantEmail={displayApplicantEmail || applicantEmail}
                applicantAddress={applicantAddress}
                applicantPhone={displayApplicantPhone || applicantPhone}
                contactPerson={hiringManager}
                resumeVersions={resumeVersions}
                selectedResumeVersionId={selectedResumeVersionId}
                onResumeVersionChange={setSelectedResumeVersionId}
                hasExistingContent={
                  Boolean(currentContent.trim()) || hasExistingStandaloneContent(coverLetter as CoverLetterStored)
                }
                folderId={coverLetter.folderId}
                documentName={name || roleTitle}
                onSaveVersionBeforeReplace={pushVersionSnapshot}
                onGenerated={handleGenerated}
              />
            )}

            {wizardStep === 3 && (
              <CoverLetterReviewStep
                content={currentContent}
                onContentChange={setCurrentContent}
                metadata={aiMetadata}
                onMetadataChange={setAiMetadata}
                language={language}
                jobTitle={roleTitle}
                company={roleCompany}
                jobDescription={localJobDescription}
                resumeContent={resumeContentForAi}
                applicantName={displayApplicantName || applicantName}
                applicantEmail={displayApplicantEmail || applicantEmail}
                applicantAddress={applicantAddress}
                applicantPhone={displayApplicantPhone || applicantPhone}
                contactPerson={hiringManager}
                hasExistingContent={
                  Boolean(currentContent.trim()) || hasExistingStandaloneContent(coverLetter as CoverLetterStored)
                }
                folderId={coverLetter.folderId}
                documentName={name || roleTitle}
                onCreateVersionBeforeRegenerate={pushVersionSnapshot}
                onAccepted={() => {
                  setReviewAccepted(true)
                  setWizardStep(4)
                  writeCoverLetterWizardSession(resumeId, 4, { contentEn, contentDe, language })
                }}
                onBackToGenerate={() => {
                  setReviewAccepted(false)
                  setWizardStep(2)
                  writeCoverLetterWizardSession(resumeId, 2, { contentEn, contentDe, language })
                }}
              />
            )}

            {wizardStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Check Information
                  </CardTitle>
                  <CardDescription>
                    Check your own information and the recipient before reviewing the cover letter.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-letter-name">Cover letter title (optional)</Label>
                    <Input
                      id="wizard-letter-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Software Engineer — Acme"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Your name</Label>
                      <Input
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Your email</Label>
                      <Input
                        value={applicantEmail}
                        onChange={(e) => setApplicantEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Your phone</Label>
                      <Input
                        value={applicantPhone}
                        onChange={(e) => setApplicantPhone(e.target.value)}
                        placeholder="+49 123 456789"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        value={letterDate}
                        onChange={(e) => setLetterDate(e.target.value)}
                        placeholder={formatCoverLetterDate(language)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wizard-hiring-manager">
                        Hiring manager <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="wizard-hiring-manager"
                        value={hiringManager}
                        onChange={(e) => setHiringManager(e.target.value)}
                        placeholder="e.g., Sarah Johnson"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Recipient company</Label>
                      <Input
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        placeholder="Company"
                      />
                    </div>
                  </div>

                  <CoverLetterImageField
                    id="wizard-company-logo"
                    label="Company logo (optional)"
                    value={companyLogo}
                    onChange={setCompanyLogo}
                    maxWidth={320}
                    previewShape="rectangle"
                  />

                  <CoverLetterImageField
                    id="wizard-profile-photo"
                    label="Profile photo (optional)"
                    value={profileImage}
                    onChange={setProfileImage}
                    maxWidth={400}
                    previewShape="circle"
                  />

                  <div className="space-y-2">
                    <Label>Your address</Label>
                    <Textarea
                      value={applicantAddress}
                      onChange={(e) => setApplicantAddress(e.target.value)}
                      placeholder={"Street\nCity\nCountry"}
                      className="min-h-[72px] text-sm resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    <p>
                      These details appear in the preview. The letter body can still be edited on the next screen.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between mt-8">
              {wizardStep > 1 ? (
                <Button variant="outline" onClick={handleBackWizard}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              ) : (
                <span />
              )}

              {wizardStep === 1 && (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {wizardStep === 3 && reviewAccepted && (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {wizardStep === 4 && (
                <Button onClick={handleSeeCoverLetter} disabled={isSaving}>
                  <FileText className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving…" : "See Cover Letter"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {showEditor && (
      <div className="pb-8">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Cover Letter Builder</h1>
            <p className="text-muted-foreground text-lg">Create a tailored cover letter for your application</p>
            <p className="text-xs text-muted-foreground mt-1">{autosaveStatusLabel(standaloneAutosaveStatus)}</p>
            {/* Language Toggle — affects AI generation and bilingual letter bodies */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="text-sm text-muted-foreground">Language:</span>
              <Tabs value={language} onValueChange={(v) => setLanguage(v as "en" | "de")}>
                <TabsList className="h-8">
                  <TabsTrigger value="en" className="text-sm px-3 h-7">English</TabsTrigger>
                  <TabsTrigger value="de" className="text-sm px-3 h-7">Deutsch</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Input Column - 1 column width with accordion */}
            <div className="lg:col-span-1 space-y-4">
              <Accordion type="multiple" defaultValue={["generate"]} className="space-y-4">
                <AccordionItem value="generate" className="border rounded-lg bg-primary/5 border-primary/20">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Generate cover letter</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <CoverLetterGenerateStep
                      embedded
                      language={language}
                      jobTitle={roleTitle}
                      company={roleCompany}
                      jobDescription={localJobDescription}
                      resumeContent={resumeContentForAi}
                      applicantName={displayApplicantName || applicantName}
                      applicantEmail={displayApplicantEmail || applicantEmail}
                      applicantAddress={applicantAddress}
                      applicantPhone={displayApplicantPhone || applicantPhone}
                      contactPerson={hiringManager}
                      resumeVersions={resumeVersions}
                      selectedResumeVersionId={selectedResumeVersionId}
                      onResumeVersionChange={setSelectedResumeVersionId}
                      hasExistingContent={Boolean(currentContent.trim())}
                      folderId={coverLetter.folderId}
                      documentName={name || roleTitle}
                      onSaveVersionBeforeReplace={pushVersionSnapshot}
                      onGenerated={(text, metadata) => {
                        setCurrentContent(text)
                        setAiMetadata(metadata)
                        applyResolvedContactDefaults()
                      }}
                    />
                    {aiMetadata ? <CoverLetterAiTransparencyNote metadata={aiMetadata} /> : null}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="details" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="font-semibold text-sm">Cover Letter Details</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="letter-name" className="text-xs">Name</Label>
                        <Input
                          id="letter-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Software Engineer"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="hiring-manager" className="text-xs">
                          Hiring manager <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input
                          id="hiring-manager"
                          value={hiringManager}
                          onChange={(e) => setHiringManager(e.target.value)}
                          placeholder="e.g., Sarah Johnson"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="your-info" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="font-semibold text-sm">Your Information</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="applicant-name" className="text-xs">Full Name</Label>
                        <Input
                          id="applicant-name"
                          value={applicantName}
                          onChange={(e) => setApplicantName(e.target.value)}
                          placeholder="Your full name"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="applicant-address" className="text-xs">Address (one line per row)</Label>
                        <Textarea
                          id="applicant-address"
                          value={applicantAddress}
                          onChange={(e) => setApplicantAddress(e.target.value)}
                          placeholder={"Street Name 123\n12345 City\nCountry"}
                          className="text-sm min-h-[72px] resize-none"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="applicant-email" className="text-xs">Email</Label>
                        <Input
                          id="applicant-email"
                          value={applicantEmail}
                          onChange={(e) => setApplicantEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="applicant-phone" className="text-xs">Phone</Label>
                        <Input
                          id="applicant-phone"
                          value={applicantPhone}
                          onChange={(e) => setApplicantPhone(e.target.value)}
                          placeholder="+49 123 456789"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="letter-date" className="text-xs">Date</Label>
                        <Input
                          id="letter-date"
                          value={letterDate}
                          onChange={(e) => setLetterDate(e.target.value)}
                          placeholder={formatCoverLetterDate(language)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="recipient" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="font-semibold text-sm">Recipient</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-4">
                    <div>
                      <Label htmlFor="recipient-company" className="text-xs">Company Name</Label>
                      <Input
                        id="recipient-company"
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        placeholder="Company name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <CoverLetterImageField
                      id="recipient-company-logo"
                      label="Company logo (optional)"
                      hint="Shown above the recipient name in the letter."
                      value={companyLogo}
                      onChange={setCompanyLogo}
                      maxWidth={320}
                      previewShape="rectangle"
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="profile-photo" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="font-semibold text-sm">Profile photo</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <CoverLetterImageField
                      id="cover-letter-profile-photo"
                      label="Your photo (optional)"
                      hint="Appears in the top corner of the letter, separate from your resume."
                      value={profileImage}
                      onChange={setProfileImage}
                      maxWidth={400}
                      previewShape="circle"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setEditLetterOpen(true)}
              >
                <FileEdit className="mr-2 h-4 w-4" />
                Edit cover letter
              </Button>
            </div>

            {/* Preview Column - 3 columns width */}
            <div className="lg:col-span-3 space-y-6">
              <PdfExportControls
                preset={pdfExportPreset}
                onPresetChange={setPdfExportPreset}
                estimatedBytes={estimatedPdfBytes}
              />

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle>Preview</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        onClick={() => setEditLetterOpen(true)}
                        variant="outline"
                        size="sm"
                      >
                        <FileEdit className="h-4 w-4 mr-2" />
                        Edit text
                      </Button>
                      <Button onClick={handleCopyToClipboard} variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        onClick={handleDownloadPDF}
                        variant="outline"
                        size="sm"
                        disabled={isExportingPdf}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isExportingPdf ? "Exporting…" : "PDF"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    id="cover-letter-preview"
                    className="bg-white text-black p-6 rounded-lg min-h-[400px] shadow-sm space-y-3"
                    style={{ fontFamily: "Georgia, serif", lineHeight: "1.4", fontSize: "14px" }}
                    onMouseUp={() => {
                      const el = document.getElementById("cover-letter-preview")
                      captureVisibleTextSelection("cover_letter", el)
                    }}
                  >
                {(displayApplicantName ||
                  displayApplicantAddressLines.length > 0 ||
                  displayApplicantEmail ||
                  displayApplicantPhone ||
                  profileImage) ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 border-b border-neutral-200/80 pb-3">
                    <div className="min-w-0 text-sm leading-snug">
                      {displayApplicantName ? (
                        <p className="font-semibold text-[15px]">{displayApplicantName}</p>
                      ) : null}
                      {displayApplicantAddressLines.map((line, i) => (
                        <p key={i} className="text-neutral-800">
                          {line}
                        </p>
                      ))}
                      {displayApplicantEmail ? (
                        <p className="text-neutral-800">{displayApplicantEmail}</p>
                      ) : null}
                    </div>
                    <div className="flex w-max max-w-[11rem] flex-col items-end gap-2 text-sm leading-snug">
                      {displayApplicantPhone ? (
                        <p className="whitespace-nowrap text-right text-neutral-800">
                          {displayApplicantPhone}
                        </p>
                      ) : null}
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt=""
                          width={72}
                          height={72}
                          className="cover-letter-profile-photo h-[72px] w-[72px] shrink-0 rounded-full border border-neutral-200 object-cover"
                        />
                      ) : null}
                    </div>
                  </div>
                ) : null}

                    {displayDate ? (
                      <div className="text-sm text-neutral-800">
                        <p>{displayDate}</p>
                      </div>
                    ) : null}

                    {/* Recipient */}
                    {(recipientCompany.trim() || hiringManager.trim() || companyLogo) ? (
                      <div className="space-y-1 text-sm leading-snug">
                        {companyLogo ? (
                          <div className="cover-letter-logo-frame inline-block rounded-md border border-neutral-200/80 bg-white p-2">
                            <img
                              src={companyLogo}
                              alt=""
                              className="max-h-14 max-w-[200px] object-contain"
                            />
                          </div>
                        ) : null}
                        {recipientCompany.trim() ? (
                          <p className="font-semibold text-[15px]">{recipientCompany.trim()}</p>
                        ) : null}
                        {hiringManager.trim() ? (
                          <p className="text-neutral-800">{hiringManager.trim()}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Salutation — only when body does not already start with one */}
                    {(() => {
                      const greeting = resolveCoverLetterSalutation({
                        hiringManager,
                        language,
                        bodyText: currentContent,
                      })
                      return greeting ? (
                        <div className="text-sm">
                          <p>{greeting}</p>
                        </div>
                      ) : null
                    })()}

                    {/* Cover Letter Content */}
                    <div className="text-sm leading-[1.45]">
                      {renderFormattedContent(currentContent)}
                    </div>

                    {/* Closing — keep with signature */}
                    <div className="text-sm break-inside-avoid">
                      <p>{language === "en" ? "Sincerely," : "Mit freundlichen Grüßen,"}</p>
                      {displayApplicantName ? (
                        <p className="mt-4">{displayApplicantName}</p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      )}
        </div>
      </div>
    </>
  )
}
