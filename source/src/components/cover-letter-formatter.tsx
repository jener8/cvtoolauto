"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { captureTextareaSelection, captureVisibleTextSelection } from "@/lib/assistant-selection-context"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Check, FileEdit, FileText, Globe, Sparkles, User } from "lucide-react"
import {
  formatCoverLetterDate,
  resolveCoverLetterApplicantContact,
  sanitizeCoverLetterField,
} from "@/lib/cover-letter-contact"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { loadUserProfile } from "@/lib/user-profile"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { autosaveStatusLabel, useDebouncedAutosave } from "@/lib/use-debounced-autosave"
import { FormattedLetterContent } from "@/components/formatted-letter-content"
import {
  CoverLetterAiTransparencyNote,
  CoverLetterGenerateStep,
  CoverLetterReviewStep,
} from "@/components/cover-letter-ai-panel"
import { FormatterOverviewBack } from "@/components/formatter-overview-back"
import { subscribeAssistantCoverLetterApplied } from "@/lib/assistant-cover-letter-apply"
import {
  createCoverLetterVersionId,
  type CoverLetterAiMetadata,
  type CoverLetterVersionSnapshot,
} from "@/lib/cover-letter-ai"

interface CoverLetterFormatterProps {
  job: JobApplication
  resumeVersions: ResumeVersion[]
  folderId?: string | null
  onUpdate: (updates: Partial<JobApplication>) => void | Promise<void>
  onBack: () => void
  onBackToOverview?: () => void
  onRegisterExit?: (handler: () => void) => void
  /** Parent sets explicitly: wizard = step 1, editor = full editor. */
  initialMode: "wizard" | "editor"
  /** When user backs out of the wizard while saved content exists and no onReturnToEntryChoice, onBack is used. */
  onReturnToEntryChoice?: () => void
}

/** Job cover letters may use legacy `{ content }` or bilingual `{ contentEn, contentDe }` from storage. */
function getCoverLetterBodies(job: JobApplication): { en: string; de: string } {
  const cl = job.coverLetter as
    | {
        content?: string
        contentEn?: string
        contentDe?: string
      }
    | undefined
  if (!cl) return { en: "", de: "" }

  const en = typeof cl.contentEn === "string" ? cl.contentEn : ""
  const de = typeof cl.contentDe === "string" ? cl.contentDe : ""
  const legacy = typeof cl.content === "string" ? cl.content : ""

  if (!en.trim() && !de.trim() && legacy.trim()) {
    return { en: legacy, de: "" }
  }
  return { en, de }
}

/** True if any stored body field has non-empty text (legacy `content` or bilingual). */
export function hasStoredCoverLetterText(job: JobApplication): boolean {
  const cl = job.coverLetter as { content?: string; contentEn?: string; contentDe?: string } | undefined
  if (!cl) return false
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  return t(cl.content).length > 0 || t(cl.contentEn).length > 0 || t(cl.contentDe).length > 0
}

export function CoverLetterFormatter({
  job,
  resumeVersions,
  folderId,
  onUpdate,
  onBack,
  onBackToOverview,
  onRegisterExit,
  initialMode,
  onReturnToEntryChoice,
}: CoverLetterFormatterProps) {
  const [showEditor, setShowEditor] = useState(() => initialMode === "editor")
  const [wizardStep, setWizardStep] = useState(1)

  const [language, setLanguage] = useState<"en" | "de">("en")
  const [contentEn, setContentEn] = useState(() => getCoverLetterBodies(job).en)
  const [contentDe, setContentDe] = useState(() => getCoverLetterBodies(job).de)
  const [selectedResumeVersionId, setSelectedResumeVersionId] = useState(job.resumeVersionId || "")
  const [localJobDescription, setLocalJobDescription] = useState(job.jobDescription || "")

  const linkedResumeForInit = resumeVersions.find((v) => v.id === (job.resumeVersionId || ""))
  const initialContact = resolveCoverLetterApplicantContact({
    coverLetter: job.coverLetter,
    userProfile: loadUserProfile(),
    resumeContact: linkedResumeForInit?.contactInfo,
    language: "en",
  })
  const [senderName, setSenderName] = useState(initialContact.applicantName)
  const [senderEmail, setSenderEmail] = useState(initialContact.applicantEmail)
  const [senderAddress, setSenderAddress] = useState(initialContact.applicantAddress)
  const [senderPhone, setSenderPhone] = useState(initialContact.applicantPhone)
  const [letterDate, setLetterDate] = useState(initialContact.letterDate)
  const [recipientName, setRecipientName] = useState(job.contactPersonName || "")
  const [recipientCompany, setRecipientCompany] = useState(job.company || "")
  const [aiMetadata, setAiMetadata] = useState<CoverLetterAiMetadata | null>(
    () => job.coverLetter?.aiMetadata ?? null,
  )
  const [versionHistory, setVersionHistory] = useState<CoverLetterVersionSnapshot[]>(
    () => job.coverLetter?.versionHistory ?? [],
  )
  const [reviewAccepted, setReviewAccepted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editLetterOpen, setEditLetterOpen] = useState(false)

  const handleBackToOverview = onBackToOverview ?? onBack

  useEffect(() => {
    onRegisterExit?.(handleBackToOverview)
    return () => onRegisterExit?.(() => {})
  }, [handleBackToOverview, onRegisterExit])

  const openedJobScopeRef = useRef<string | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  const jobScopeKey = `${job.id}:${initialMode}`

  useEffect(() => {
    return subscribeAssistantCoverLetterApplied((detail) => {
      setContentEn(detail.contentEn)
      setContentDe(detail.contentDe)
      if (detail.aiMetadata) setAiMetadata(detail.aiMetadata)
    })
  }, [])

  useEffect(() => {
    if (openedJobScopeRef.current === jobScopeKey) return
    openedJobScopeRef.current = jobScopeKey

    const bodies = getCoverLetterBodies(job)
    const hasStored = hasStoredCoverLetterText(job)
    if (initialMode === "editor" || hasStored) {
      setContentEn(bodies.en)
      setContentDe(bodies.de)
      setShowEditor(initialMode === "editor")
    } else {
      setContentEn("")
      setContentDe("")
      setLanguage("en")
      setShowEditor(false)
    }
    setWizardStep(1)
    setLocalJobDescription(job.jobDescription || "")
    setSelectedResumeVersionId(job.resumeVersionId || "")
    setRecipientCompany(job.company || "")
    setRecipientName(job.contactPersonName || "")
    const linked = resumeVersions.find((v) => v.id === (job.resumeVersionId || selectedResumeVersionId))
    const resolved = resolveCoverLetterApplicantContact({
      coverLetter: job.coverLetter,
      userProfile: loadUserProfile(),
      resumeContact: linked?.contactInfo,
      language,
    })
    setSenderName(resolved.applicantName)
    setSenderEmail(resolved.applicantEmail)
    setSenderAddress(resolved.applicantAddress)
    setSenderPhone(resolved.applicantPhone)
    setLetterDate(resolved.letterDate)
    setAiMetadata(job.coverLetter?.aiMetadata ?? null)
    setVersionHistory(job.coverLetter?.versionHistory ?? [])
    setReviewAccepted(false)
  }, [jobScopeKey, job.company, job.jobDescription, job.resumeVersionId, job.contactPersonName])

  const persistRef = useRef({
    jobDescription: "",
    resumeVersionId: "",
    contentEn: "",
    contentDe: "",
    language: "en" as "en" | "de",
    recipientCompany: "",
    recipientName: "",
    senderName: "",
    senderEmail: "",
    senderAddress: "",
    senderPhone: "",
    letterDate: "",
  })
  persistRef.current = {
    jobDescription: localJobDescription,
    resumeVersionId: selectedResumeVersionId,
    contentEn,
    contentDe,
    language,
    recipientCompany,
    recipientName,
    senderName,
    senderEmail,
    senderAddress,
    senderPhone,
    letterDate,
  }

  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

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

  const buildPersistPayload = useCallback(
    (): Partial<JobApplication> => ({
      jobDescription: localJobDescription,
      resumeVersionId: selectedResumeVersionId,
      company: recipientCompany.trim() || job.company,
      contactPersonName: recipientName.trim(),
      coverLetter: {
        contentEn,
        contentDe,
        content: language === "en" ? contentEn : contentDe,
        applicantName: senderName,
        applicantAddress: senderAddress,
        applicantEmail: senderEmail,
        applicantPhone: senderPhone,
        letterDate,
        lastModified: Date.now(),
        aiMetadata: aiMetadata ?? undefined,
        versionHistory,
      },
    }),
    [
      localJobDescription,
      selectedResumeVersionId,
      recipientCompany,
      job.company,
      recipientName,
      contentEn,
      contentDe,
      language,
      senderName,
      senderAddress,
      senderEmail,
      senderPhone,
      letterDate,
      aiMetadata,
      versionHistory,
    ],
  )

  const persistCoverLetter = useCallback(async () => {
    await Promise.resolve(onUpdateRef.current(buildPersistPayload()))
  }, [buildPersistPayload])

  const coverLetterAutosaveSnapshot = useMemo(
    () =>
      JSON.stringify({
        contentEn,
        contentDe,
        language,
        jobDescription: localJobDescription,
        resumeVersionId: selectedResumeVersionId,
        recipientCompany,
        recipientName,
        senderName,
        senderEmail,
        senderAddress,
        senderPhone,
        letterDate,
      }),
    [
      contentEn,
      contentDe,
      language,
      localJobDescription,
      selectedResumeVersionId,
      recipientCompany,
      recipientName,
      senderName,
      senderEmail,
      senderAddress,
      senderPhone,
      letterDate,
    ],
  )

  const coverLetterAutosaveResetKey = `${job.id}:${initialMode}`

  const coverLetterAutosaveStatus = useDebouncedAutosave({
    resetKey: coverLetterAutosaveResetKey,
    snapshot: coverLetterAutosaveSnapshot,
    save: async () => {
      const s = persistRef.current
      await Promise.resolve(
        onUpdateRef.current({
          jobDescription: s.jobDescription,
          resumeVersionId: s.resumeVersionId,
          company: s.recipientCompany.trim() || job.company,
          contactPersonName: s.recipientName.trim(),
          coverLetter: {
            contentEn: s.contentEn,
            contentDe: s.contentDe,
            content: s.language === "en" ? s.contentEn : s.contentDe,
            applicantName: s.senderName,
            applicantAddress: s.senderAddress,
            applicantEmail: s.senderEmail,
            applicantPhone: s.senderPhone,
            letterDate: s.letterDate,
            lastModified: Date.now(),
            aiMetadata: aiMetadata ?? undefined,
            versionHistory,
          },
        }),
      )
    },
    debounceMs: 1000,
  })

  const currentContent = language === "en" ? contentEn : contentDe
  const setCurrentContent = language === "en" ? setContentEn : setContentDe

  const selectedVersion = resumeVersions.find((v) => v.id === selectedResumeVersionId)
  const resumeContent = selectedVersion?.resumeText || ""

  const steps = [
    { number: 1, title: "Choose Language", icon: Globe },
    { number: 2, title: "Generate Cover Letter", icon: Sparkles },
    { number: 3, title: "Review & Edit", icon: FileText },
    { number: 4, title: "Check Details", icon: User },
  ]

  const applyResolvedContactDefaults = () => {
    const resolved = resolveCoverLetterApplicantContact({
      coverLetter: {
        applicantName: senderName,
        applicantAddress: senderAddress,
        applicantEmail: senderEmail,
        applicantPhone: senderPhone,
        letterDate,
      },
      userProfile: loadUserProfile(),
      resumeContact: selectedVersion?.contactInfo,
      language,
    })
    if (!sanitizeCoverLetterField(senderName) && resolved.applicantName) {
      setSenderName(resolved.applicantName)
    }
    if (!sanitizeCoverLetterField(senderAddress) && resolved.applicantAddress) {
      setSenderAddress(resolved.applicantAddress)
    }
    if (!sanitizeCoverLetterField(senderEmail) && resolved.applicantEmail) {
      setSenderEmail(resolved.applicantEmail)
    }
    if (!sanitizeCoverLetterField(senderPhone) && resolved.applicantPhone) {
      setSenderPhone(resolved.applicantPhone)
    }
    if (!sanitizeCoverLetterField(letterDate) && resolved.letterDate) {
      setLetterDate(resolved.letterDate)
    }
  }

  const handleGenerated = (text: string, metadata: CoverLetterAiMetadata) => {
    setCurrentContent(text)
    setAiMetadata(metadata)
    setReviewAccepted(false)
    applyResolvedContactDefaults()
    setWizardStep(3)
  }

  const handleNext = () => {
    if (wizardStep === 3 && !reviewAccepted) return
    if (wizardStep < 4) {
      setWizardStep(wizardStep + 1)
    }
  }

  const handleBackWizard = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1)
    } else if (initialMode === "wizard" && hasStoredCoverLetterText(job)) {
      if (onReturnToEntryChoice) onReturnToEntryChoice()
      else handleBackToOverview()
    } else {
      handleBackToOverview()
    }
  }

  const handleSeeCoverLetter = async () => {
    await persistCoverLetter()
    setShowEditor(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await persistCoverLetter()
    } catch (err) {
      console.error("[cover-letter] Save failed:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const renderFormattedContent = (text: string) => {
    if (!text.trim()) return null
    return <FormattedLetterContent text={text} />
  }

  if (showEditor) {
    return (
      <div className="ui-formatter-shell flex min-h-0 flex-1 flex-col">
        <div className="ui-formatter-topbar">
          <FormatterOverviewBack onClick={handleBackToOverview} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6 grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Settings</CardTitle>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {autosaveStatusLabel(coverLetterAutosaveStatus)}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs value={language} onValueChange={(v) => setLanguage(v as "en" | "de")}>
              <TabsList>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={selectedResumeVersionId} onValueChange={setSelectedResumeVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select resume version" />
              </SelectTrigger>
              <SelectContent>
                {resumeVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              value={localJobDescription}
              onChange={(e) => setLocalJobDescription(e.target.value)}
              onMouseUp={(e) =>
                captureTextareaSelection("job_description", e.currentTarget)
              }
              onKeyUp={(e) =>
                captureTextareaSelection("job_description", e.currentTarget)
              }
              placeholder="Job description"
            />

            <CoverLetterAiTransparencyNote metadata={aiMetadata} />

            <Button type="button" variant="secondary" className="w-full" onClick={() => setEditLetterOpen(true)}>
              <FileEdit className="mr-2 h-4 w-4" />
              Edit cover letter
            </Button>

            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Cover Letter"}
            </Button>

            {versionHistory.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Version history</p>
                <ul className="space-y-1 text-xs">
                  {versionHistory
                    .slice()
                    .reverse()
                    .map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2">
                        <span>{v.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Preview</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditLetterOpen(true)}>
                <FileEdit className="mr-2 h-4 w-4" />
                Edit text
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div
              ref={previewContainerRef}
              className="space-y-4 text-sm"
              onMouseUp={() =>
                captureVisibleTextSelection("cover_letter", previewContainerRef.current)
              }
            >
              {renderFormattedContent(currentContent)}
            </div>
          </CardContent>
        </Card>
        </div>

        <Dialog open={editLetterOpen} onOpenChange={setEditLetterOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit cover letter</DialogTitle>
              <DialogDescription>
                Edit the {language === "en" ? "English" : "German"} letter text. Changes appear in the
                preview as you type.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              onMouseUp={(e) => captureTextareaSelection("cover_letter", e.currentTarget)}
              onKeyUp={(e) => captureTextareaSelection("cover_letter", e.currentTarget)}
              placeholder="Cover letter"
              className="min-h-[320px] font-mono text-sm"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditLetterOpen(false)}>
                Done
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (initialMode === "wizard" && !showEditor) {
    return (
      <div className="ui-formatter-shell flex min-h-0 flex-1 flex-col">
        <div className="ui-formatter-topbar">
          <FormatterOverviewBack onClick={handleBackToOverview} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-8">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Create Cover Letter</h1>
              <p className="text-muted-foreground">
                Follow the steps before reviewing and editing your cover letter
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {autosaveStatusLabel(coverLetterAutosaveStatus)}
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
              jobTitle={job.jobTitle}
              company={job.company}
              jobDescription={localJobDescription}
              resumeContent={resumeContent}
              applicantName={sanitizeCoverLetterField(senderName) || senderName}
              applicantEmail={sanitizeCoverLetterField(senderEmail) || senderEmail}
              applicantAddress={senderAddress}
              applicantPhone={sanitizeCoverLetterField(senderPhone) || senderPhone}
              contactPerson={recipientName}
              resumeVersions={resumeVersions}
              selectedResumeVersionId={selectedResumeVersionId}
              onResumeVersionChange={setSelectedResumeVersionId}
              hasExistingContent={Boolean(currentContent.trim()) || hasStoredCoverLetterText(job)}
              folderId={folderId ?? job.folderId}
              documentName={`${job.jobTitle} — ${job.company}`}
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
              jobTitle={job.jobTitle}
              company={job.company}
              jobDescription={localJobDescription}
              resumeContent={resumeContent}
              applicantName={sanitizeCoverLetterField(senderName) || senderName}
              applicantEmail={sanitizeCoverLetterField(senderEmail) || senderEmail}
              applicantAddress={senderAddress}
              applicantPhone={sanitizeCoverLetterField(senderPhone) || senderPhone}
              contactPerson={recipientName}
              hasExistingContent={Boolean(currentContent.trim()) || hasStoredCoverLetterText(job)}
              folderId={folderId ?? job.folderId}
              documentName={`${job.jobTitle} — ${job.company}`}
              onCreateVersionBeforeRegenerate={pushVersionSnapshot}
              onAccepted={() => {
                setReviewAccepted(true)
                setWizardStep(4)
              }}
              onBackToGenerate={() => {
                setReviewAccepted(false)
                setWizardStep(2)
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
                  Check your own information and the recipient information before reviewing the cover letter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your name</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Your email</Label>
                    <Input
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Your phone</Label>
                    <Input
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="+49 123 456789"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Your address</Label>
                    <Textarea
                      value={senderAddress}
                      onChange={(e) => setSenderAddress(e.target.value)}
                      placeholder={"Street\nCity\nCountry"}
                      className="min-h-[72px] text-sm resize-none"
                      rows={3}
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
                    <Label>Recipient name</Label>
                    <Input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Hiring manager / contact person"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Recipient company</Label>
                    <Input
                      value={recipientCompany}
                      onChange={(e) => setRecipientCompany(e.target.value)}
                      placeholder="Company"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  <p>
                    These details are for checking before review. The cover letter text itself can still be edited on the next page.
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
              <Button onClick={() => void handleSeeCoverLetter()}>
                <FileText className="h-4 w-4 mr-2" />
                See Cover Letter
              </Button>
            )}
          </div>
        </div>
        </div>
      </div>
    )
  }

  return null
}