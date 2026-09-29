"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { Dashboard } from "@/components/dashboard"
import ResumeInput from "@/components/resume-input"
import { ResumePreview } from "@/components/resume-preview"
import { SavedVersions } from "@/components/saved-versions"
import { CoverLetterFormatter } from "@/components/cover-letter-formatter"
import { InterviewPrep } from "@/components/interview-prep"
import { CompanyInfo } from "@/components/company-info"
import { Contacts } from "@/components/contacts"
import { JobStrategy } from "@/components/job-strategy"
import { getSupabaseClient } from "@/lib/supabase/client"
import { shouldUseLocalFallback } from "@/lib/supabase/availability"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { User } from "@supabase/supabase-js"
import { normalizeContactInfo } from "@/lib/contact-info"
import { normalizeJobApplication } from "@/lib/application-outcome"
import type { JobApplication, ContactInfo } from "@/lib/types"
import { autosaveStatusLabel, useDebouncedAutosave } from "@/lib/use-debounced-autosave"

interface DashboardClientProps {
  user: User
  initialVersions: any[]
  initialJobApplications: any[]
}

export function DashboardClient({ user, initialVersions, initialJobApplications }: DashboardClientProps) {
  const [versions, setVersions] = useState<any[]>(initialVersions)
  const [jobApplications, setJobApplications] = useState<JobApplication[]>(
    initialJobApplications.map((app) => ({
      ...app,
      companyInfo: app.company_info || {},
      coverLetter: app.cover_letter || { content: "", lastModified: Date.now() },
      interviewPrep: app.interview_prep || {
        questions: [],
        personalDescription: "",
        interviewers: [],
        generalNotes: "",
        lastModified: Date.now(),
      },
      jobStrategy: app.job_strategy,
      appliedDate: new Date(app.applied_date).getTime(),
      lastModified: new Date(app.updated_at).getTime(),
      jobTitle: app.role,
      jobDescription:
        app.job_description?.content ||
        app.job_description?.description ||
        "",
      jobDescriptionSummary: app.job_description?.summary || "",
      jobDescriptionUrl: app.job_description?.url || "",
      resumeVersionId: app.job_description?.resumeVersionId || "",
      salaryExpectation: app.job_description?.salaryExpectation || "",
      employmentType: app.job_description?.employmentType || "full-time",
      why: app.job_description?.why || "",
      strategySummary: app.job_description?.strategySummary || "",
    })),
  )

  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentJob, setCurrentJob] = useState<JobApplication | null>(null)
  const [selectedJobForStrategy, setSelectedJobForStrategy] = useState<string>("")

  const [view, setView] = useState<
    "dashboard" | "formatter" | "coverLetter" | "interviewPrep" | "companyInfo" | "contacts" | "jobStrategy"
  >("dashboard")

  const [coverLetterMode, setCoverLetterMode] = useState<"wizard" | "editor">("wizard")

  const [resumeText, setResumeText] = useState("")
  const [profileImage, setProfileImage] = useState<string | null>("/images/profile-photo.png")
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [currentVersionName, setCurrentVersionName] = useState<string | null>(null)
  const [accentColor, setAccentColor] = useState<string>("oklch(65% .15 85)")
  const [accentColorHex, setAccentColorHex] = useState<string>("")
  const [jobAdvertSource, setJobAdvertSource] = useState<string>("")
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: user.email || "",
    linkedin: "",
    phone: "",
    address: "",
    citizenship: "",
    portfolio: "",
    portfolios: [],
    showPortfolio: true,
    professionalTitle: "",
    language: "de" as "en" | "de",
    targetCompany: "",
    targetRole: "",
  })

  const saveVersion = async (name: string) => {
    const supabase = getSupabaseClient()
    if (!supabase || shouldUseLocalFallback()) {
      toast({
        title: "Database unavailable",
        description: "Resume sync is disabled while Supabase is offline.",
        variant: "destructive",
      })
      return
    }

    const { data, error } = await supabase
      .from("resume_versions")
      .insert({
        user_id: user.id,
        name,
        resume_text: resumeText,
        contact_info: contactInfo,
        profile_image: profileImage,
        company_logo: companyLogo,
        accent_color: accentColorHex || accentColor,
      })
      .select()
      .single()

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save resume version",
        variant: "destructive",
      })
      return
    }

    const newVersion = {
      id: data.id,
      name: data.name,
      resumeText: data.resume_text,
      profileImage: data.profile_image,
      companyLogo: data.company_logo,
      contactInfo: data.contact_info,
      accentColor: data.accent_color,
      accentColorHex: data.accent_color,
      timestamp: new Date(data.created_at).getTime(),
    }

    setVersions([newVersion, ...versions])
    setCurrentVersionId(newVersion.id)
    setCurrentVersionName(name)
  }

  const loadVersion = (version: any) => {
    setResumeText(version.resumeText || version.resume_text)
    setProfileImage(version.profileImage || version.profile_image)
    setCompanyLogo(version.companyLogo || version.company_logo)
    setCurrentVersionId(version.id)
    setCurrentVersionName(version.name)
    setContactInfo(
      normalizeContactInfo(version.contactInfo || version.contact_info),
    )
    setAccentColor(version.accentColor || version.accent_color || "oklch(65% .15 85)")
    setAccentColorHex(version.accentColorHex || version.accent_color || "")
    setView("formatter")
  }

  const deleteVersion = async (id: string) => {
    const supabase = getSupabaseClient()
    if (!supabase || shouldUseLocalFallback()) return

    const { error } = await supabase.from("resume_versions").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete resume version",
        variant: "destructive",
      })
      return
    }

    setVersions(versions.filter((v) => v.id !== id))
    if (currentVersionId === id) {
      setCurrentVersionId(null)
      setCurrentVersionName(null)
    }
  }

  const dashboardResumePersistRef = useRef({
    currentVersionId: null as string | null,
    versions: [] as any[],
    resumeText: "",
    contactInfo,
    profileImage,
    companyLogo,
    accentColor,
    accentColorHex,
    currentVersionName: null as string | null,
  })

  dashboardResumePersistRef.current = {
    currentVersionId,
    versions,
    resumeText,
    contactInfo,
    profileImage,
    companyLogo,
    accentColor,
    accentColorHex,
    currentVersionName,
  }

  const persistDashboardResumeVersion = useCallback(async (opts?: { silent?: boolean }) => {
    const s = dashboardResumePersistRef.current
    if (!s.currentVersionId) return

    const supabase = getSupabaseClient()
    if (!supabase || shouldUseLocalFallback()) return

    const { error } = await supabase
      .from("resume_versions")
      .update({
        resume_text: s.resumeText,
        contact_info: s.contactInfo,
        profile_image: s.profileImage,
        company_logo: s.companyLogo,
        accent_color: s.accentColorHex || s.accentColor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", s.currentVersionId)
      .eq("user_id", user.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update resume version",
        variant: "destructive",
      })
      return
    }

    setVersions(
      s.versions.map((v: any) =>
        v.id === s.currentVersionId
          ? {
              ...v,
              resumeText: s.resumeText,
              contactInfo: s.contactInfo,
              profileImage: s.profileImage,
              companyLogo: s.companyLogo,
              accentColor: s.accentColor,
              accentColorHex: s.accentColorHex,
            }
          : v,
      ),
    )

    if (!opts?.silent) {
      toast({
        title: "Version Updated",
        description: `${s.currentVersionName ?? "Resume"} has been saved successfully.`,
        duration: 3000,
      })
    }
  }, [user.id])

  const updateCurrentVersion = async () => {
    await persistDashboardResumeVersion({ silent: false })
  }

  const createJobApplication = async (data: Omit<JobApplication, "id">) => {
    const supabase = getSupabaseClient()
    if (!supabase || shouldUseLocalFallback()) return

    const { data: newApp, error } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        role: data.jobTitle,
        company: data.company,
        status: data.status,
        job_description: {
          content: data.jobDescription,
          description: data.jobDescription,
          summary: data.jobDescriptionSummary,
          url: data.jobDescriptionUrl,
          resumeVersionId: data.resumeVersionId,
          salaryExpectation: data.salaryExpectation,
          employmentType: data.employmentType,
          why: data.why,
          strategySummary: data.strategySummary,
        },
        company_info: data.companyInfo,
        cover_letter: data.coverLetter,
        contacts: data.contacts,
        interview_prep: data.interviewPrep,
        job_strategy: data.jobStrategy,
        applied_date: new Date(data.appliedDate).toISOString(),
      })
      .select()
      .single()

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create job application",
        variant: "destructive",
      })
      return
    }

    const formattedApp = normalizeJobApplication({
      id: newApp.id,
      jobTitle: newApp.role,
      company: newApp.company,
      pipeline: Array.isArray(newApp.job_description?.pipeline)
        ? newApp.job_description.pipeline
        : data.pipeline,
      status: newApp.status,
      jobDescription:
        newApp.job_description?.content ||
        newApp.job_description?.description ||
        "",
      jobDescriptionSummary: newApp.job_description?.summary || "",
      jobDescriptionUrl: newApp.job_description?.url || "",
      resumeVersionId: newApp.job_description?.resumeVersionId || "",
      salaryExpectation: newApp.job_description?.salaryExpectation || "",
      employmentType: newApp.job_description?.employmentType || "full-time",
      why: newApp.job_description?.why || "",
      strategySummary: newApp.job_description?.strategySummary || "",
      companyInfo: newApp.company_info || data.companyInfo,
      coverLetter: newApp.cover_letter || data.coverLetter,
      contacts: newApp.contacts || data.contacts,
      interviewPrep: newApp.interview_prep || data.interviewPrep,
      jobStrategy: newApp.job_strategy,
      appliedDate: new Date(newApp.applied_date).getTime(),
      lastModified: new Date(newApp.updated_at).getTime(),
    })

    setJobApplications([formattedApp, ...jobApplications])
  }

  const updateJobApplication = async (id: string, updates: Partial<JobApplication>) => {
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.jobTitle) dbUpdates.role = updates.jobTitle
    if (updates.company) dbUpdates.company = updates.company
    if (updates.status) dbUpdates.status = updates.status
    if (updates.pipeline) {
      const currentApp = jobApplications.find((app) => app.id === id)
      dbUpdates.job_description = {
        ...(dbUpdates.job_description ?? {
          content: currentApp?.jobDescription ?? "",
          description: currentApp?.jobDescription ?? "",
          summary: currentApp?.jobDescriptionSummary ?? "",
          url: currentApp?.jobDescriptionUrl ?? "",
          resumeVersionId: currentApp?.resumeVersionId ?? "",
          salaryExpectation: currentApp?.salaryExpectation ?? "",
          employmentType: currentApp?.employmentType ?? "full-time",
          why: currentApp?.why ?? "",
          strategySummary: currentApp?.strategySummary ?? "",
        }),
        pipeline: updates.pipeline.map((record) => ({
          stage: record.stage,
          outcome: record.outcome,
          date: record.date ? new Date(record.date).toISOString() : null,
          notes: record.notes ?? null,
        })),
      }
      dbUpdates.status = normalizeJobApplication({
        ...(jobApplications.find((app) => app.id === id) as JobApplication),
        ...updates,
      }).status
    }
    if (updates.companyInfo) dbUpdates.company_info = updates.companyInfo
    if (updates.coverLetter) dbUpdates.cover_letter = updates.coverLetter
    if (updates.contacts) dbUpdates.contacts = updates.contacts
    if (updates.interviewPrep) dbUpdates.interview_prep = updates.interviewPrep
    if (updates.jobStrategy) dbUpdates.job_strategy = updates.jobStrategy
    if (updates.appliedDate) dbUpdates.applied_date = new Date(updates.appliedDate).toISOString()
    if (updates.uploadDetails !== undefined) dbUpdates.upload_details = updates.uploadDetails

    if (
      updates.jobDescription ||
      updates.jobDescriptionSummary ||
      updates.jobDescriptionUrl ||
      updates.resumeVersionId ||
      updates.salaryExpectation ||
      updates.employmentType ||
      updates.why ||
      updates.strategySummary
    ) {
      const currentApp = jobApplications.find((app) => app.id === id)
      dbUpdates.job_description = {
        content: updates.jobDescription || currentApp?.jobDescription || "",
        description: updates.jobDescription || currentApp?.jobDescription || "",
        summary: updates.jobDescriptionSummary || currentApp?.jobDescriptionSummary || "",
        url: updates.jobDescriptionUrl || currentApp?.jobDescriptionUrl || "",
        resumeVersionId: updates.resumeVersionId || currentApp?.resumeVersionId || "",
        salaryExpectation: updates.salaryExpectation || currentApp?.salaryExpectation || "",
        employmentType: updates.employmentType || currentApp?.employmentType || "full-time",
        why: updates.why || currentApp?.why || "",
        strategySummary: updates.strategySummary || currentApp?.strategySummary || "",
      }
    }

    const supabase = getSupabaseClient()
    if (!supabase || shouldUseLocalFallback()) return

    const { error } = await supabase.from("job_applications").update(dbUpdates).eq("id", id).eq("user_id", user.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update job application",
        variant: "destructive",
      })
      return
    }

    setJobApplications(
      jobApplications.map((app) =>
        app.id === id ? normalizeJobApplication({ ...app, ...updates }) : app,
      ),
    )
  }

  const deleteJobApplication = async (id: string) => {
    const supabase = getSupabaseClient()
    if (!supabase || shouldUseLocalFallback()) return

    const { error } = await supabase.from("job_applications").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete job application",
        variant: "destructive",
      })
      return
    }

    setJobApplications(jobApplications.filter((app) => app.id !== id))
  }

  const openCoverLetterWizard = (jobId: string) => {
    const job = jobApplications.find((app) => app.id === jobId)
    if (job) {
      setCurrentJob(job)
      setCoverLetterMode("wizard")
      setView("coverLetter")
    }
  }

  const openCoverLetterEditor = (jobId: string) => {
    const job = jobApplications.find((app) => app.id === jobId)
    if (job) {
      setCurrentJob(job)
      setCoverLetterMode("editor")
      setView("coverLetter")
    }
  }

  const openInterviewPrep = (jobId: string) => {
    const job = jobApplications.find((app) => app.id === jobId)
    if (job) {
      setCurrentJob(job)
      setView("interviewPrep")
    }
  }

  const openCompanyInfo = (jobId: string) => {
    const job = jobApplications.find((app) => app.id === jobId)
    if (job) {
      setCurrentJob(job)
      setView("companyInfo")
    }
  }

  const openContacts = (jobId: string) => {
    const job = jobApplications.find((app) => app.id === jobId)
    if (job) {
      setCurrentJob(job)
      setView("contacts")
    }
  }

  const openJobStrategy = (jobId: string) => {
    const job = jobApplications.find((app) => app.id === jobId)
    if (job) {
      setCurrentJob(job)
      setView("jobStrategy")
    }
  }

  const createNewResume = () => {
    setResumeText("")
    setProfileImage("/images/profile-photo.png")
    setCompanyLogo(null)
    setCurrentVersionId(null)
    setCurrentVersionName(null)
    setAccentColor("oklch(65% .15 85)")
    setAccentColorHex("")
    setContactInfo({
      name: "",
      email: user.email || "",
      linkedin: "",
      phone: "",
      address: "",
      citizenship: "",
      portfolio: "",
      portfolios: [],
      showPortfolio: true,
      professionalTitle: "",
      language: "de",
      targetCompany: "",
      targetRole: "",
    })
    setView("formatter")
  }

  const returnToDashboard = () => {
    setView("dashboard")
    setCurrentJob(null)
  }

  const handleResumeUpdate = (data: {
    contactInfo: ContactInfo
    resumeContent: string
    profilePhoto?: string
    companyLogo?: string | null
    accentColor?: string
    accentColorHex?: string
    selectedJobId?: string
  }) => {
    setResumeText(data.resumeContent)
    setContactInfo(data.contactInfo as any)
    setAccentColor(data.accentColor || accentColor)
    setAccentColorHex(data.accentColorHex || accentColorHex)
    if (data.profilePhoto) {
      setProfileImage(data.profilePhoto)
    }
    if (data.companyLogo !== undefined) {
      setCompanyLogo(data.companyLogo)
    }
    if (data.selectedJobId !== undefined) {
      setSelectedJobForStrategy(data.selectedJobId)
    }
  }

  const exportAllData = () => {
    const allData = {
      resumeVersions: versions,
      jobApplications: jobApplications,
      exportDate: new Date().toISOString(),
      version: "3.0",
    }

    const dataStr = JSON.stringify(allData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `resume-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Data Exported Successfully",
      description: `Downloaded backup with ${versions.length} resume versions and ${jobApplications.length} job applications.`,
      duration: 5000,
    })
  }

  const handleImportAll = () => {
    toast({
      title: "Import Not Available",
      description: "Data is now stored in the cloud and synced across all your devices automatically.",
      duration: 5000,
    })
  }

  const scrollToPreview = () => {
    const previewElement = document.getElementById("resume-preview-section")
    if (previewElement) {
      previewElement.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const hasUnsavedChanges =
    currentVersionId !== null &&
    (() => {
      const currentVersion = versions.find((v) => v.id === currentVersionId)
      if (!currentVersion) return false
      return (
        (currentVersion.resumeText || currentVersion.resume_text) !== resumeText ||
        (currentVersion.profileImage || currentVersion.profile_image) !== profileImage ||
        (currentVersion.companyLogo || currentVersion.company_logo) !== companyLogo ||
        JSON.stringify(currentVersion.contactInfo || currentVersion.contact_info) !== JSON.stringify(contactInfo) ||
        (currentVersion.accentColor || currentVersion.accent_color) !== accentColor ||
        (currentVersion.accentColorHex || currentVersion.accent_color || "") !== accentColorHex
      )
    })()

  const dashboardResumeAutosaveSnapshot = useMemo(
    () =>
      JSON.stringify({
        resumeText,
        contactInfo,
        profileImage,
        companyLogo,
        accentColor,
        accentColorHex,
      }),
    [resumeText, contactInfo, profileImage, companyLogo, accentColor, accentColorHex],
  )

  const dashboardResumeAutosaveStatus = useDebouncedAutosave({
    resetKey: currentVersionId ?? "no-version",
    snapshot: dashboardResumeAutosaveSnapshot,
    save: () => persistDashboardResumeVersion({ silent: true }),
    enabled: view === "formatter" && currentVersionId !== null,
    debounceMs: 1000,
  })

  if (view === "dashboard") {
    return (
      <Dashboard
        user={user}
        versions={versions}
        jobApplications={jobApplications}
        onCreateNew={createNewResume}
        onLoadVersion={loadVersion}
        onDeleteVersion={deleteVersion}
        onCreateJobApplication={createJobApplication}
        onOpenCoverLetterWizard={openCoverLetterWizard}
        onOpenCoverLetterEditor={openCoverLetterEditor}
        onOpenInterviewPrep={openInterviewPrep}
        onOpenCompanyInfo={openCompanyInfo}
        onOpenContacts={openContacts}
        onOpenJobStrategy={openJobStrategy}
        onDeleteJobApplication={deleteJobApplication}
        onUpdateJobStatus={updateJobApplication}
        onUpdateJob={updateJobApplication}
        onExportAll={exportAllData}
        onImportAll={handleImportAll}
      />
    )
  }

  if (view === "coverLetter" && currentJob) {
    return (
      <CoverLetterFormatter
        key={`${currentJob.id}-${coverLetterMode}`}
        job={currentJob}
        resumeVersions={versions}
        initialMode={coverLetterMode}
        onUpdate={(updates) => updateJobApplication(currentJob.id, updates)}
        onBack={returnToDashboard}
      />
    )
  }

  if (view === "interviewPrep" && currentJob) {
    return (
      <InterviewPrep
        job={currentJob}
        onUpdate={(updates) => updateJobApplication(currentJob.id, updates)}
        onBack={returnToDashboard}
      />
    )
  }

  if (view === "companyInfo" && currentJob) {
    return (
      <CompanyInfo
        jobApplication={currentJob}
        onUpdate={(updates) => updateJobApplication(currentJob.id, updates)}
        onClose={returnToDashboard}
      />
    )
  }

  if (view === "contacts" && currentJob) {
    return (
      <Contacts
        job={currentJob}
        onUpdate={(updates) => updateJobApplication(currentJob.id, updates)}
        onBack={returnToDashboard}
      />
    )
  }

  if (view === "jobStrategy" && currentJob) {
    return (
      <JobStrategy
        job={currentJob}
        onUpdate={(updates) => updateJobApplication(currentJob.id, updates)}
        onBack={returnToDashboard}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background no-print-container">
      <div className="container mx-auto px-4 py-8 lg:py-12 no-print">
        <div className="mb-8 text-center no-print">
          <div className="flex items-center justify-center gap-4 mb-2">
            <button
              onClick={returnToDashboard}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to dashboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Resume Formatter</h1>
          </div>
          {currentVersionId !== null && (
            <p className="text-center text-xs text-muted-foreground mt-1">{autosaveStatusLabel(dashboardResumeAutosaveStatus)}</p>
          )}
          <p className="text-muted-foreground text-lg">
            Paste your resume text and create an ATS-friendly, professional format
          </p>
          {currentJob && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {currentJob.company}{currentJob.jobTitle ? ` - ${currentJob.jobTitle}` : ""}
              </span>
            </div>
          )}
        </div>

        {currentVersionName && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground">Editing: {currentVersionName}</span>
              {hasUnsavedChanges && <span className="text-sm text-muted-foreground">(unsaved changes)</span>}
            </div>
          </div>
        )}

        <SavedVersions
          versions={versions}
          currentVersionId={currentVersionId}
          onSave={saveVersion}
          onLoad={loadVersion}
          onDelete={deleteVersion}
          onUpdate={updateCurrentVersion}
          hasUnsavedChanges={hasUnsavedChanges}
          onScrollToPreview={scrollToPreview}
        />

        <div className="flex flex-col gap-8">
          <div className="w-full">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold mb-2">Edit Resume</h2>
              <p className="text-sm text-muted-foreground">
                Edit your resume content below using markdown format (# for titles, ## for companies, ### for dates, -
                for bullets)
              </p>
            </div>
            <ResumeInput
              key={currentVersionId ?? "new-resume"}
              initialVersion={{
                resumeText,
                profileImage: profileImage,
                companyLogo: companyLogo,
                accentColor,
                accentColorHex,
                contactInfo,
              }}
              availableResumes={jobApplications}
              selectedJobId={selectedJobForStrategy}
              onJobSelect={setSelectedJobForStrategy}
              onSave={saveVersion}
              onResumeUpdate={handleResumeUpdate}
              onClose={() => setView("dashboard")}
              linkedJobDescriptionUrl={
                jobApplications.find((job) => job.id === selectedJobForStrategy)
                  ?.jobDescriptionUrl || null
              }
            />
          </div>

          <div id="resume-preview-section" className="w-full border-t-4 border-primary pt-8">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold mb-2">Resume Preview</h2>
              <p className="text-sm text-muted-foreground">
                Preview your formatted resume below. Use the download buttons to export as PDF or image.
              </p>
            </div>
            <ResumePreview
              version={{
                id: currentVersionId || "",
                name: currentVersionName || "Untitled",
                resumeText,
                profileImage,
                companyLogo,
                timestamp: Date.now(),
                contactInfo,
                accentColor,
                accentColorHex,
                jobAdvertSource,
              }}
              onExportBackup={exportAllData}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
