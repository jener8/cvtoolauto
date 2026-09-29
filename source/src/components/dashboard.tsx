"use client"

import React from "react"

import { useRef } from "react"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { captureTextareaSelection } from "@/lib/assistant-selection-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/components/ui/use-toast"
import {
  applyPortfolioSlotUpdate,
  MAX_PORTFOLIO_URLS,
  portfolioInputSlots,
  toFolderContactInfo,
} from "@/lib/contact-info"
import type { ResumeVersion, JobApplication, User, CoverLetter, FitScore, RedFlag, FolderContactInfo } from "@/lib/types"
import {
  type Language,
  getTranslation,
  getFitScoreTypeLabel,
  getOutcomeFilterLabel,
  getStageLabel,
} from "@/lib/translations"
import { cn } from "@/lib/utils"
import {
  PlusCircle,
  FileText,
  Trash2,
  FileEdit,
  MessageSquare,
  Building2,
  ExternalLink,
  Target,
  Sparkles,
  Download,
  Upload,
  ArrowLeft,
  Pencil,
  User as UserIcon,
  Settings,
  Star,
  AlertTriangle,
  Plus,
  X,
  Globe,
  Archive,
  RefreshCw,
  BarChart3,
  Search,
  ChevronDown,
  Loader2,
  ArrowDownWideNarrow,
} from "lucide-react"
import {
  createInitialJobApplicationPipeline,
  type ApplicationOutcomeFilter,
  type ApplicationStageFilter,
} from "@/lib/application-outcome"
import { formatDateInputValue, parseDateInputValue } from "@/lib/application-dates"
import { APPLICATION_STAGES, getCurrentOutcome, getCurrentStage } from "@/lib/application-pipeline"
import { ProfileMenu } from "@/components/profile-menu"
import { ApplicationDetailsDialog } from "@/components/application-details-dialog"
import { ApplicationListCard } from "@/components/application-list-card"
import { UploadDetailsDialog } from "@/components/upload-details-dialog"
import { loadStrategicProfile, patchStrategicProfile } from "@/lib/strategic-profile"
import { TrustComplianceSection } from "@/components/trust-compliance-section"
import { SectionEmptyState } from "@/components/application-intelligence/section-empty-state"
import { SECTION_ILLUSTRATION_SLOTS } from "@/components/illustrations/section-illustrations"
import { usePageTitle } from "@/hooks/use-page-title"
import { WorkspaceShell, type WorkspaceNavId } from "@/components/workspace-sidebar"
import { ApplicationsKanban } from "@/components/application-intelligence/applications-kanban"
import {
  pageTitleForSection,
  SECTION_EMPTY_STATES,
  SECTION_PAGE_H1,
} from "@/lib/workspace-shell-copy"
import {
  WorkspaceSyncStatus,
  isWorkspaceSyncActive,
  type WorkspaceSyncUiStatus,
} from "@/components/workspace-sync-status"
import {
  COMPANY_NOT_ADDED,
  JOB_TITLE_NOT_ADDED,
  filterJobApplications,
  sortJobApplicationsByDate,
  formatApplicationDate,
  formatFitScoreSummary,
  getCoverLetterDisplayName,
  resolveApplicationRole,
  type JobApplicationDateSort,
} from "@/lib/job-application-display"
import {
  countResumeLanguages,
  getResumeLanguage,
  getResumeLanguageFilterLabel,
  getResumeLanguageLabel,
  matchesResumeLanguageFilter,
  type ResumeLanguageFilter,
} from "@/lib/resume-language"
import {
  isAutoLinkedResumeName,
  proposedResumeNameAfterTitleChange,
  shouldPromptResumeRenameOnTitleChange,
} from "@/lib/application-resume-naming"
import { hasUsableApplicationCoverLetter } from "@/lib/application-cover-letter-navigation"
import { resolveResumeForJob } from "@/lib/resolve-application-resume"
import { hasUploadDetailsContent } from "@/lib/upload-details"
import { SUPPORTED_CV_FILE_ACCEPT } from "@/lib/extract-document-text"

interface DashboardProps {
  user?: User // Added user prop for UserMenu
  versions: ResumeVersion[]
  jobApplications: JobApplication[] // Changed from 'jobs'
  coverLetters?: CoverLetter[] // Added coverLetters prop
  onCreateNew: () => void
  /** Opens the resume formatter with the current or most recent CV — does not reset to onboarding. */
  onOpenResumeWorkspace?: () => void
  /** Opens the Make Application wizard (handled by the parent page). */
  onStartApplicationWizard?: () => void
  /** Opens the CV wizard for an existing application that has no CV yet. */
  onOpenApplicationWizardForJob?: (jobId: string) => void
  /** Attaches an uploaded CV file to an existing application. */
  onUploadCvForApplication?: (jobId: string, file: File) => void | Promise<void>
  /** Attaches an uploaded cover letter file to an existing application. */
  onUploadCoverLetterForApplication?: (jobId: string, file: File) => void | Promise<void>
  onApplicationFlowComplete?: (payload: import("@/lib/application-flow-complete").ApplicationFlowCompletePayload) => void | Promise<void>
  onCreateCoverLetter: () => void // Added onCreateCoverLetter prop
  onLoadVersion: (version: ResumeVersion) => void
  /** Opens the resume linked to a job application (by resumeVersionId). */
  onOpenApplicationResume?: (jobId: string) => void
  onDeleteVersion: (id: string) => void
  onRenameVersion?: (id: string, newName: string) => void // Added onRenameVersion prop
  onUpdateVersionRole?: (
    id: string,
    values: { jobTitle: string; company: string; location: string },
  ) => void
  onCreateJobApplication: (newApplication: Omit<JobApplication, "id">) => void
  onOpenApplicationCoverLetter: (jobId: string) => void
  onOpenYourStory?: (jobId: string) => void
  onOpenStoryWizard?: (jobId: string) => void
  onOpenCoverLetterWizard: (jobId: string) => void
  onOpenCoverLetterEditor: (jobId: string) => void
  onOpenInterviewPrep: (jobId: string) => void
  onOpenCompanyInfo: (jobId: string) => void
  onOpenContacts: (jobId: string) => void
  onOpenJobStrategy: (jobId: string) => void
  onDeleteJobApplication: (id: string) => void
  onUpdateJobStatus: (id: string, updates: Partial<JobApplication>) => void
  onUpdateJob: (id: string, updates: Partial<JobApplication>) => void
  onExportAll?: () => void // Added export all handler
  onImportAll?: () => void // Added import all handler
  onRefresh?: () => void // Refresh data from database
  onSaveProfile?: (name: string, email: string, password: string) => void
  onBack?: () => void // Added onBack prop to navigate back to folders
  userName?: string
  userEmail?: string
  profileImage?: string | null // Added profileImage prop from CV
  onDeleteCoverLetter: (id: string) => void // Added onDeleteCoverLetter prop
  folderName?: string // Name of the current folder/workspace
  folderProfileImage?: string | null // Profile image from the folder
  folderContactInfo?: FolderContactInfo | null // Contact info from the folder
  onUpdateFolder?: (updates: { name?: string; profileImage?: string | null; contactInfo?: Partial<FolderContactInfo> }) => void
  onOpenStatistics?: () => void
  onWorkspaceNavigate?: (id: WorkspaceNavId) => void
  folderId?: string | null
  onRestoreSnapshot?: (resumeId: string, snapshotId: string) => void
  onDataDeleted?: () => void
  workspaceSyncStatus?: WorkspaceSyncUiStatus
  workspaceSyncMessage?: string | null
  cvImportingJobId?: string | null
  /** Controlled applications date sort (synced to URL). */
  dateSort?: JobApplicationDateSort
  onDateSortChange?: (sort: JobApplicationDateSort) => void
  /** Controlled application details dialog id (synced to URL). */
  detailsApplicationId?: string | null
  onDetailsApplicationIdChange?: (jobId: string | null) => void
}

export function Dashboard({
  user, // Accept user prop
  versions,
  jobApplications, // Changed from 'jobs'
  coverLetters, // Accept coverLetters prop
  onCreateNew,
  onOpenResumeWorkspace,
  onStartApplicationWizard,
  onOpenApplicationWizardForJob,
  onUploadCvForApplication,
  onUploadCoverLetterForApplication,
  onApplicationFlowComplete,
  onCreateCoverLetter, // Accept onCreateCoverLetter prop
  onLoadVersion,
  onOpenApplicationResume,
  onDeleteVersion,
  onRenameVersion, // Accept onRenameVersion prop
  onUpdateVersionRole,
  onCreateJobApplication,
  onOpenApplicationCoverLetter,
  onOpenYourStory,
  onOpenStoryWizard,
  onOpenCoverLetterWizard,
  onOpenCoverLetterEditor,
  onOpenInterviewPrep,
  onOpenCompanyInfo,
  onOpenContacts,
  onOpenJobStrategy,
  onDeleteJobApplication,
  onUpdateJobStatus,
  onUpdateJob,
  onExportAll, // Added export all prop
  onImportAll, // Added import all prop
  onRefresh, // Refresh data from database
  onSaveProfile,
  onBack, // Accept onBack prop
  userName,
  userEmail,
  profileImage, // Accept profileImage prop
  onDeleteCoverLetter, // Accept onDeleteCoverLetter prop
  folderName, // Accept folder name
  folderProfileImage, // Accept folder profile image
  folderContactInfo, // Accept folder contact info
  onUpdateFolder, // Callback to update folder settings
  onOpenStatistics,
  onWorkspaceNavigate,
  folderId,
  onRestoreSnapshot,
  onDataDeleted,
  workspaceSyncStatus = "idle",
  workspaceSyncMessage = null,
  cvImportingJobId = null,
  dateSort: dateSortProp,
  onDateSortChange,
  detailsApplicationId: detailsApplicationIdProp,
  onDetailsApplicationIdChange,
}: DashboardProps) {
  const isWorkspaceSyncing = isWorkspaceSyncActive(workspaceSyncStatus)
  const language: Language = folderContactInfo?.language === "de" ? "de" : "en"
  const t = (key: keyof typeof import("@/lib/translations").translations.en) => getTranslation(language, key)
  const [applicationsView, setApplicationsView] = useState<"list" | "pipeline">("list")
  const [showNewJobDialog, setShowNewJobDialog] = useState(false)
  const [addCvJobId, setAddCvJobId] = useState<string | null>(null)
  const [addCoverLetterJobId, setAddCoverLetterJobId] = useState<string | null>(null)
  const [uploadDetailsJobId, setUploadDetailsJobId] = useState<string | null>(null)
  const addCvUploadRef = useRef<HTMLInputElement>(null)
  const addCoverLetterUploadRef = useRef<HTMLInputElement>(null)
  /** Preserves job id while the add-CV / cover-letter dialog closes for the native file picker. */
  const pendingCvUploadJobIdRef = useRef<string | null>(null)
  const pendingCoverLetterUploadJobIdRef = useRef<string | null>(null)
  const [viewJobDescriptionId, setViewJobDescriptionId] = useState<string | null>(null)
  const [isEditingJobDescription, setIsEditingJobDescription] = useState(false)
  const [editedJobDescription, setEditedJobDescription] = useState("")
  const [editedJobDescriptionUrl, setEditedJobDescriptionUrl] = useState("")
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [editedCompanyName, setEditedCompanyName] = useState("")
  const [editingJobTitleId, setEditingJobTitleId] = useState<string | null>(null)
  const [editedJobTitle, setEditedJobTitle] = useState("")
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null)
  const [editedSalary, setEditedSalary] = useState("")
  const [editedEmploymentType, setEditedEmploymentType] = useState<
    "full-time" | "part-time" | "contract" | "freelance"
  >("full-time")
  const [newJobData, setNewJobData] = useState({
    jobTitle: "",
    company: "",
    jobDescription: "",
    jobDescriptionSummary: "",
    jobDescriptionUrl: "",
    resumeVersionId: "",
    coverLetterId: "",
  })
  const [uploadedResumeFile, setUploadedResumeFile] = useState<File | null>(null)
  const [uploadedCoverLetterFile, setUploadedCoverLetterFile] = useState<File | null>(null)
  const [editUploadedResumeFile, setEditUploadedResumeFile] = useState<File | null>(null)
  const [editUploadedCoverLetterFile, setEditUploadedCoverLetterFile] = useState<File | null>(null)
  const [editedJobDescriptionSummary, setEditedJobDescriptionSummary] = useState("")
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null)
  const [editedSummary, setEditedSummary] = useState("")
  const [editingWhyId, setEditingWhyId] = useState<string | null>(null)
  const [editedWhy, setEditedWhy] = useState("")

  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [editedJobData, setEditedJobData] = useState({
    jobTitle: "",
    company: "",
    location: "",
    jobDescription: "",
    jobDescriptionUrl: "",
    resumeVersionId: "",
    coverLetterId: "",
    appliedDate: Date.now(),
  })

  const [editingResumeId, setEditingResumeId] = useState<string | null>(null)
  const [editedResumeName, setEditedResumeName] = useState("")
  
  // Folder settings edit dialog
  const [showFolderSettingsDialog, setShowFolderSettingsDialog] = useState(false)
  const [editFolderName, setEditFolderName] = useState(folderName || "")
  const [editFolderProfileImage, setEditFolderProfileImage] = useState<string | null>(folderProfileImage || null)
  const [editFolderContactInfo, setEditFolderContactInfo] = useState<FolderContactInfo>(
    () => toFolderContactInfo(folderContactInfo),
  )
  const [editNoticePeriod, setEditNoticePeriod] = useState("")
  const folderImageInputRef = useRef<HTMLInputElement>(null)
  const [applicationSearchQuery, setApplicationSearchQuery] = useState("")
  const [stageFilter, setStageFilter] = useState<ApplicationStageFilter>("all")
  const [outcomeFilter, setOutcomeFilter] = useState<ApplicationOutcomeFilter>("all")
  const [cvLanguageFilter, setCvLanguageFilter] = useState<ResumeLanguageFilter>("all")
  const [dateSortState, setDateSortState] = useState<JobApplicationDateSort>("newest")
  const dateSort = dateSortProp ?? dateSortState
  const setDateSort = (value: JobApplicationDateSort) => {
    if (onDateSortChange) onDateSortChange(value)
    else setDateSortState(value)
  }
  const [backupMenuOpen, setBackupMenuOpen] = useState(false)
  const [detailsJobIdState, setDetailsJobIdState] = useState<string | null>(null)
  const detailsJobId =
    detailsApplicationIdProp !== undefined ? detailsApplicationIdProp : detailsJobIdState
  const setDetailsJobId = (value: string | null) => {
    if (onDetailsApplicationIdChange) onDetailsApplicationIdChange(value)
    else setDetailsJobIdState(value)
  }
  const [resumeRenamePrompt, setResumeRenamePrompt] = useState<{
    resumeVersionId: string
    oldTitle: string
    newTitle: string
    currentResumeName: string
    proposedResumeName: string
    isAutoLinked: boolean
  } | null>(null)

  const duplicateApplicationIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const job of jobApplications) {
      const id = job.id?.trim() ?? ""
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    )
  }, [jobApplications])

  usePageTitle(pageTitleForSection("applications"))

  const cvLanguageCounts = useMemo(() => {
    const counts = countResumeLanguages([])
    for (const job of jobApplications) {
      const language = getResumeLanguage(resolveResumeForJob(job, versions))
      counts[language] += 1
    }
    return counts
  }, [jobApplications, versions])
  const filteredJobApplications = useMemo(
    () =>
      sortJobApplicationsByDate(
        filterJobApplications(jobApplications, {
          query: applicationSearchQuery,
          stageFilter,
          outcomeFilter,
          cvLanguageFilter,
          versions,
        }),
        dateSort,
      ),
    [
      jobApplications,
      applicationSearchQuery,
      stageFilter,
      outcomeFilter,
      cvLanguageFilter,
      versions,
      dateSort,
    ],
  )
  const applicationStatsSummary = useMemo(() => {
    let pending = 0
    let inProgress = 0
    let rejected = 0
    for (const job of jobApplications) {
      const outcome = getCurrentOutcome(job)
      const stage = getCurrentStage(job)
      if (outcome === "rejected") {
        rejected += 1
      } else if (outcome === "pending" && stage === "applied") {
        pending += 1
      } else {
        inProgress += 1
      }
    }
    return { total: jobApplications.length, pending, inProgress, rejected }
  }, [jobApplications])

  const handleSidebarNav = (id: WorkspaceNavId) => {
    if (onWorkspaceNavigate) {
      onWorkspaceNavigate(id)
    }
  }
  const hasActiveApplicationFilters =
    applicationSearchQuery.trim().length > 0 ||
    stageFilter !== "all" ||
    outcomeFilter !== "all" ||
    cvLanguageFilter !== "all"
  const hasNoApplicationResults =
    hasActiveApplicationFilters && filteredJobApplications.length === 0
  // Fit scores state
  const [editingFitScoreJobId, setEditingFitScoreJobId] = useState<string | null>(null)
  const [editingFitScoreType, setEditingFitScoreType] = useState<"culture" | "ambitions" | "skills" | "strategy" | null>(null)
  const [editedFitScore, setEditedFitScore] = useState<number>(3)
  const [editedFitSummary, setEditedFitSummary] = useState("")

  // Red flags state
  const [editingRedFlagsJobId, setEditingRedFlagsJobId] = useState<string | null>(null)
  const [editedRedFlags, setEditedRedFlags] = useState<RedFlag[]>([])
  const [newRedFlagQuestion, setNewRedFlagQuestion] = useState("")
  const [newRedFlagAnswer, setNewRedFlagAnswer] = useState("")
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null)
  const [editingFlagQuestion, setEditingFlagQuestion] = useState("")
  const [editingFlagAnswer, setEditingFlagAnswer] = useState("")

  // Folder settings handlers
  const handleOpenFolderSettings = () => {
    setEditFolderName(folderName || "")
    setEditFolderProfileImage(folderProfileImage || null)
    setEditFolderContactInfo(toFolderContactInfo(folderContactInfo))
    setEditNoticePeriod(loadStrategicProfile().noticePeriod ?? "")
    setShowFolderSettingsDialog(true)
  }

  const handleFolderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditFolderProfileImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveFolderSettings = () => {
    patchStrategicProfile({ noticePeriod: editNoticePeriod.trim() || undefined })
    if (onUpdateFolder) {
      onUpdateFolder({
        name: editFolderName,
        profileImage: editFolderProfileImage,
        contactInfo: editFolderContactInfo,
      })
    }
    setShowFolderSettingsDialog(false)
  }

  const handleStartEditJob = (job: JobApplication) => {
    const resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
    const role = resolveApplicationRole(job, resumeVersion)
    setEditingJobId(job.id)
    setEditedJobData({
      jobTitle: role.jobTitle,
      company: role.company,
      location: role.location,
      jobDescription: job.jobDescription || "",
      jobDescriptionUrl: job.jobDescriptionUrl || "",
      resumeVersionId: job.resumeVersionId || "",
      coverLetterId: job.coverLetterId || "",
      appliedDate: job.appliedDate > 0 ? job.appliedDate : Date.now(),
    })
  }

  const syncLinkedResumeContact = (
    resumeVersionId: string,
    values: { jobTitle: string; company: string; location: string },
  ) => {
    if (onUpdateVersionRole) {
      onUpdateVersionRole(resumeVersionId, values)
    }
  }

  const maybePromptLinkedResumeRename = (
    job: JobApplication,
    oldTitle: string,
    newTitle: string,
  ) => {
    if (!job.resumeVersionId || !onRenameVersion) return
    const version = versions.find((entry) => entry.id === job.resumeVersionId)
    const currentResumeName = version?.name?.trim() ?? ""
    if (
      !shouldPromptResumeRenameOnTitleChange(oldTitle, newTitle, currentResumeName)
    ) {
      return
    }
    setResumeRenamePrompt({
      resumeVersionId: job.resumeVersionId,
      oldTitle,
      newTitle,
      currentResumeName,
      proposedResumeName: proposedResumeNameAfterTitleChange(newTitle, currentResumeName),
      isAutoLinked: isAutoLinkedResumeName(currentResumeName, oldTitle),
    })
  }

  const handleUpdateApplicationRole = (
    id: string,
    values: { jobTitle: string; company: string; location: string },
  ) => {
    const job = jobApplications.find((entry) => entry.id === id)
    if (!job) return

    const resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
    const oldTitle = resolveApplicationRole(job, resumeVersion).jobTitle

    onUpdateJob(id, {
      jobTitle: values.jobTitle,
      company: values.company,
      location: values.location || undefined,
    })

    if (job.resumeVersionId) {
      syncLinkedResumeContact(job.resumeVersionId, values)
      maybePromptLinkedResumeRename(job, oldTitle, values.jobTitle)
    }
  }

  const handleSaveJob = (jobId: string) => {
    const job = jobApplications.find((entry) => entry.id === jobId)
    if (!job) return

    const resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
    const oldTitle = resolveApplicationRole(job, resumeVersion).jobTitle

    onUpdateJob(jobId, {
      ...editedJobData,
      location: editedJobData.location || undefined,
    })

    if (job.resumeVersionId) {
      syncLinkedResumeContact(job.resumeVersionId, {
        jobTitle: editedJobData.jobTitle,
        company: editedJobData.company,
        location: editedJobData.location,
      })
      maybePromptLinkedResumeRename(job, oldTitle, editedJobData.jobTitle)
    }

    setEditingJobId(null)
    setEditUploadedResumeFile(null)
    setEditUploadedCoverLetterFile(null)
  }

  const handleConfirmResumeRename = () => {
    if (!resumeRenamePrompt || !onRenameVersion) {
      setResumeRenamePrompt(null)
      return
    }
    onRenameVersion(resumeRenamePrompt.resumeVersionId, resumeRenamePrompt.proposedResumeName)
    toast({
      title: "Resume renamed",
      description: `Linked resume updated to "${resumeRenamePrompt.proposedResumeName}".`,
    })
    setResumeRenamePrompt(null)
  }

  const handleCancelEditJob = () => {
    setEditingJobId(null)
    setEditUploadedResumeFile(null)
    setEditUploadedCoverLetterFile(null)
  }

  // Fit Score handlers
  const handleStartEditFitScore = (jobId: string, type: "culture" | "ambitions" | "skills" | "strategy", job: JobApplication) => {
    setEditingFitScoreJobId(jobId)
    setEditingFitScoreType(type)
    const existingScore = job.fitScores?.[type]
    setEditedFitScore(existingScore?.score || 3)
    setEditedFitSummary(existingScore?.summary || "")
  }

  const handleSaveFitScore = (jobId: string) => {
    const job = jobApplications.find(j => j.id === jobId)
    if (!job || !editingFitScoreType) return
    
    const updatedFitScores = {
      ...job.fitScores,
      [editingFitScoreType]: {
        score: editedFitScore,
        summary: editedFitSummary,
      }
    }
    onUpdateJob(jobId, { fitScores: updatedFitScores })
    setEditingFitScoreJobId(null)
    setEditingFitScoreType(null)
  }

  const handleCancelEditFitScore = () => {
    setEditingFitScoreJobId(null)
    setEditingFitScoreType(null)
    setEditedFitScore(3)
    setEditedFitSummary("")
  }

  // Red Flags handlers
  const handleStartEditRedFlags = (jobId: string, job: JobApplication) => {
    setEditingRedFlagsJobId(jobId)
    setEditedRedFlags(job.redFlags || [])
    setNewRedFlagQuestion("")
    setNewRedFlagAnswer("")
  }

  const handleAddRedFlag = () => {
    if (!newRedFlagQuestion.trim()) return
    const newFlag: RedFlag = {
      id: crypto.randomUUID(),
      question: newRedFlagQuestion.trim(),
      answer: newRedFlagAnswer.trim() || undefined,
    }
    setEditedRedFlags([...editedRedFlags, newFlag])
    setNewRedFlagQuestion("")
    setNewRedFlagAnswer("")
  }

  const handleRemoveRedFlag = (flagId: string) => {
    setEditedRedFlags(editedRedFlags.filter(f => f.id !== flagId))
  }

  const handleStartEditFlag = (flag: RedFlag) => {
    setEditingFlagId(flag.id)
    setEditingFlagQuestion(flag.question)
    setEditingFlagAnswer(flag.answer || "")
  }

  const handleSaveEditFlag = () => {
    if (!editingFlagId || !editingFlagQuestion.trim()) return
    setEditedRedFlags(editedRedFlags.map(f => 
      f.id === editingFlagId 
        ? { ...f, question: editingFlagQuestion.trim(), answer: editingFlagAnswer.trim() || undefined }
        : f
    ))
    setEditingFlagId(null)
    setEditingFlagQuestion("")
    setEditingFlagAnswer("")
  }

  const handleCancelEditFlag = () => {
    setEditingFlagId(null)
    setEditingFlagQuestion("")
    setEditingFlagAnswer("")
  }

  const handleSaveRedFlags = (jobId: string) => {
    onUpdateJob(jobId, { redFlags: editedRedFlags })
    setEditingRedFlagsJobId(null)
  }

  const handleCancelEditRedFlags = () => {
    setEditingRedFlagsJobId(null)
    setEditedRedFlags([])
    setNewRedFlagQuestion("")
    setNewRedFlagAnswer("")
  }

  const getFitScoreColor = (score: number) => {
    if (score >= 4) return "text-green-600 bg-green-100"
    if (score >= 3) return "text-yellow-600 bg-yellow-100"
    return "text-red-600 bg-red-100"
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const extractDomain = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  }

  const handleCreateJob = () => {
    if (!newJobData.jobTitle || !newJobData.company) {
      alert("Please fill in all required fields (Job Title and Company)")
      return
    }

    const newApplication: Omit<JobApplication, "id"> = {
      jobTitle: newJobData.jobTitle,
      company: newJobData.company,
      jobDescription: newJobData.jobDescription,
      jobDescriptionSummary: newJobData.jobDescriptionSummary,
      jobDescriptionUrl: newJobData.jobDescriptionUrl,
      resumeVersionId: newJobData.resumeVersionId,
      coverLetterId: newJobData.coverLetterId || "",
      companyInfo: {
        website: "",
        researchNotes: "",
        linkedInContacts: [],
        lastModified: Date.now(),
      },
      contacts: [],
      coverLetter: {
        content: "",
        contentEn: "",
        contentDe: "",
        lastModified: Date.now(),
      },
      interviewPrep: {
        questions: [],
        personalDescription: "",
        interviewers: [],
        generalNotes: "",
        lastModified: Date.now(),
      },
      pipeline: createInitialJobApplicationPipeline(Date.now()),
      appliedDate: Date.now(),
      lastModified: Date.now(),
      salaryExpectation: "",
      employmentType: "full-time",
      why: "",
    }

    onCreateJobApplication(newApplication)
    setShowNewJobDialog(false)
    setNewJobData({
      jobTitle: "",
      company: "",
      jobDescription: "",
      jobDescriptionSummary: "",
      jobDescriptionUrl: "",
      resumeVersionId: "",
      coverLetterId: "",
    })
    setUploadedResumeFile(null)
    setUploadedCoverLetterFile(null)
  }

  const toDateInputValue = (timestamp?: number) => formatDateInputValue(timestamp)

  const fromDateInputValue = (value: string): number | undefined => parseDateInputValue(value)

  const handlePipelineDateUpdate = (
    jobId: string,
    field: "appliedDate" | "firstInterviewDate" | "rejectionDate" | "offerDate",
    value: string,
  ) => {
    const parsed = fromDateInputValue(value)
    if (parsed == null) return
    onUpdateJobStatus(jobId, { [field]: parsed })
  }

  const handleAdditionalInterviewDateUpdate = (
    job: JobApplication,
    index: number,
    value: string,
  ) => {
    const dates = [...(job.additionalInterviewDates ?? [])]
    const parsed = fromDateInputValue(value)
    if (parsed) {
      dates[index] = parsed
    } else {
      dates.splice(index, 1)
    }
    onUpdateJobStatus(job.id, { additionalInterviewDates: dates })
  }

  const handleAddAdditionalInterviewDate = (job: JobApplication) => {
    const dates = [...(job.additionalInterviewDates ?? []), Date.now()]
    onUpdateJobStatus(job.id, { additionalInterviewDates: dates })
  }

  const handleStartEditCompany = (jobId: string, companyName: string) => {
    setEditingCompanyId(jobId)
    setEditedCompanyName(companyName)
  }

  const handleSaveCompanyName = (jobId: string) => {
    onUpdateJobStatus(jobId, { company: editedCompanyName.trim() })
    setEditingCompanyId(null)
    setEditedCompanyName("")
  }

  const handleCancelEditCompany = () => {
    setEditingCompanyId(null)
    setEditedCompanyName("")
  }

  const handleStartEditJobTitle = (jobId: string, jobTitle: string) => {
    setEditingJobTitleId(jobId)
    setEditedJobTitle(jobTitle)
  }

  const handleSaveJobTitle = (jobId: string) => {
    onUpdateJobStatus(jobId, { jobTitle: editedJobTitle.trim() })
    setEditingJobTitleId(null)
    setEditedJobTitle("")
  }

  const handleCancelEditJobTitle = () => {
    setEditingJobTitleId(null)
    setEditedJobTitle("")
  }

  const handleStartEditSalary = (jobId: string, salary?: string, employmentType?: string) => {
    setEditingSalaryId(jobId)
    setEditedSalary(salary || "")
    setEditedEmploymentType((employmentType as any) || "full-time")
  }

  const handleSaveSalary = (jobId: string) => {
    onUpdateJob(jobId, {
      salaryExpectation: editedSalary.trim() || undefined,
      employmentType: editedEmploymentType,
    })
    setEditingSalaryId(null)
    setEditedSalary("")
  }

  const handleCancelEditSalary = () => {
    setEditingSalaryId(null)
    setEditedSalary("")
  }

  const handleStartEditWhy = (jobId: string, currentWhy: string) => {
    setEditingWhyId(jobId)
    setEditedWhy(currentWhy || "")
  }

  const handleSaveWhy = (jobId: string) => {
    onUpdateJob(jobId, {
      why: editedWhy.trim() || undefined,
    })
    setEditingWhyId(null)
    setEditedWhy("")
  }

  const handleCancelEditWhy = () => {
    setEditingWhyId(null)
    setEditedWhy("")
  }

  const handleGenerateWhyPrompt = (job: JobApplication) => {
    const resumeVersion = versions?.find((v) => v.id === job.resumeVersionId)
    const resumeName = resumeVersion?.name || "No resume selected"
    const resumeContent = resumeVersion?.resumeText || ""

    const strategyContext = job.jobStrategy
      ? `
Job Strategy:
- Intent: ${job.jobStrategy.intent}
- Strategic Fit: ${job.jobStrategy.strategicFit}
- Positioning: ${job.jobStrategy.positioning}
- Success Criteria: ${job.jobStrategy.successCriteria}
`
      : ""

    const prompt = `Based on the following information, create ONE powerful, motivating sentence that captures why I'm applying for this role. This sentence should be bold, clear, and inspiring.

Job Title: ${job.jobTitle}
Company: ${job.company}

Job Description:
${job.jobDescription}

${strategyContext}

Resume Version: ${resumeName}
${resumeContent ? `Resume Content:\n${resumeContent.substring(0, 1000)}...` : ""}

Create a single sentence that captures:
1. My core motivation for this role
2. The unique value I bring
3. The alignment between my goals and this opportunity

The sentence should be powerful, direct, and memorable.`

    navigator.clipboard.writeText(prompt)
    toast({
      title: "Prompt Copied!",
      description: "ChatGPT prompt for your 'Why' has been copied to clipboard.",
    })
  }

  const handleOpenJobDescription = (job: JobApplication) => {
    const linkedResume = resolveResumeForJob(job, versions)
    const fromJob = job.jobDescription?.trim() || ""
    const fromResume = linkedResume?.jobDescription?.trim() || ""
    // Prefer the longer copy in case an older local compact truncated one of them.
    const description =
      fromJob.length >= fromResume.length ? fromJob || fromResume : fromResume || fromJob
    setViewJobDescriptionId(job.id)
    setEditedJobDescription(description)
    setEditedJobDescriptionUrl(job.jobDescriptionUrl || "")
    setEditedJobDescriptionSummary(job.jobDescriptionSummary || "")
    setIsEditingJobDescription(false)
  }

  // Summary inline edit handlers
  const handleStartEditSummary = (jobId: string, currentSummary: string) => {
    setEditingSummaryId(jobId)
    setEditedSummary(currentSummary)
  }

  const handleSaveSummary = (jobId: string) => {
    onUpdateJob(jobId, { jobDescriptionSummary: editedSummary })
    setEditingSummaryId(null)
    setEditedSummary("")
  }

  const handleCancelEditSummary = () => {
    setEditingSummaryId(null)
    setEditedSummary("")
  }

  const handleSaveJobDescription = () => {
    if (viewJobDescriptionId) {
      onUpdateJob(viewJobDescriptionId, {
        jobDescription: editedJobDescription,
        jobDescriptionUrl: editedJobDescriptionUrl,
        jobDescriptionSummary: editedJobDescriptionSummary,
      })
      setIsEditingJobDescription(false)
    }
  }

  const handleStartRenameResume = (resumeId: string, currentName: string) => {
    setEditingResumeId(resumeId)
    setEditedResumeName(currentName)
  }

  const handleSaveResumeName = (resumeId: string) => {
    if (editedResumeName.trim() && onRenameVersion) {
      // Check if the name already exists
      const nameExists = versions.some((v) => v.id !== resumeId && v.name === editedResumeName.trim())
      if (nameExists) {
        toast({
          title: "Name Already Exists",
          description: "Please choose a different name.",
          variant: "destructive",
        })
        return
      }
      onRenameVersion(resumeId, editedResumeName.trim())
      toast({
        title: "Resume Renamed",
        description: `Resume renamed to "${editedResumeName.trim()}"`,
      })
    }
    setEditingResumeId(null)
    setEditedResumeName("")
  }

  const handleCancelRenameResume = () => {
    setEditingResumeId(null)
    setEditedResumeName("")
  }

  const viewingJob = jobApplications.find((j) => j.id === viewJobDescriptionId)
  const detailsJob = jobApplications.find((j) => j.id === detailsJobId) ?? null
  const uploadDetailsJob = jobApplications.find((j) => j.id === uploadDetailsJobId) ?? null
  const uploadDetailsResume = uploadDetailsJob
    ? versions.find((v) => v.id === uploadDetailsJob.resumeVersionId)
    : undefined

  const handleStartApplicationWizard = () => {
    if (onStartApplicationWizard) {
      onStartApplicationWizard()
      return
    }
    console.error("[dashboard] onStartApplicationWizard is not configured")
  }

  const headerAvatarSrc = folderProfileImage ?? profileImage ?? null

  return (
    <WorkspaceShell
      workspaceName={folderName}
      userName={userName}
      profileImage={headerAvatarSrc}
      activeNav="applications"
      onNavigate={handleSidebarNav}
      footerVariant="new-application"
      onNewApplication={handleStartApplicationWizard}
      showNewApplicationFab
    >
      <div className="p-6 space-y-6">
        {workspaceSyncStatus === "unavailable" ? (
          <WorkspaceSyncStatus status={workspaceSyncStatus} message={workspaceSyncMessage} />
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="ui-page-title">{SECTION_PAGE_H1.applications}</h1>
              {workspaceSyncStatus !== "idle" && workspaceSyncStatus !== "unavailable" ? (
                <WorkspaceSyncStatus
                  status={workspaceSyncStatus}
                  message={workspaceSyncMessage}
                />
              ) : null}
            </div>
            <p className="ui-page-subtitle">
              Track applications, interview stages, and outcomes — your employment pathway in one
              place.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onUpdateFolder && (
              <button
                type="button"
                className="relative flex-shrink-0 cursor-pointer group rounded-full"
                onClick={handleOpenFolderSettings}
                title="Edit workspace settings"
                aria-label="Edit workspace settings"
              >
                <div
                  className={cn(
                    "h-11 w-11 overflow-hidden rounded-full border-2 transition-colors group-hover:border-[var(--brand-teal)]",
                    headerAvatarSrc
                      ? "border-[var(--brand-teal)]/20"
                      : "border-dashed border-[var(--border-subtle)]",
                  )}
                >
                  {headerAvatarSrc ? (
                    <img
                      src={headerAvatarSrc}
                      alt="Profile"
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--page-bg)]">
                      <UserIcon className="h-5 w-5 text-[var(--text-secondary)]" />
                    </div>
                  )}
                </div>
              </button>
            )}
            <ProfileMenu
              userName={userName}
              userEmail={userEmail}
              profileImage={null}
              onSaveProfile={onSaveProfile}
            />
          </div>
        </div>

        <div className="ui-stat-grid" aria-label="Application statistics">
          <div className="ui-stat-card">
            <p className="ui-stat-card__label">Total</p>
            <p className="ui-stat-card__value">{applicationStatsSummary.total}</p>
          </div>
          <div className="ui-stat-card ui-stat-card--pending">
            <p className="ui-stat-card__label">Pending</p>
            <p className="ui-stat-card__value">{applicationStatsSummary.pending}</p>
          </div>
          <div className="ui-stat-card ui-stat-card--progress">
            <p className="ui-stat-card__label">In progress</p>
            <p className="ui-stat-card__value">{applicationStatsSummary.inProgress}</p>
          </div>
          <div className="ui-stat-card ui-stat-card--rejected">
            <p className="ui-stat-card__label">Rejected</p>
            <p className="ui-stat-card__value">{applicationStatsSummary.rejected}</p>
          </div>
        </div>

        <div
          className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1"
          role="tablist"
          aria-label="Applications view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={applicationsView === "list"}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              applicationsView === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setApplicationsView("list")}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={applicationsView === "pipeline"}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              applicationsView === "pipeline"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setApplicationsView("pipeline")}
          >
            Pipeline
          </button>
        </div>

        {applicationsView === "pipeline" ? (
          <ApplicationsKanban
            jobApplications={jobApplications}
            versions={versions}
            language={language}
            onOpenJob={(jobId) => setDetailsJobId(jobId)}
          />
        ) : null}

        {applicationsView === "list" ? (
        <>
        <div className="ui-toolbar-row">
          <label className="ui-search-input" htmlFor="application-search">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
            <input
              id="application-search"
              value={applicationSearchQuery}
              onChange={(e) => setApplicationSearchQuery(e.target.value)}
              placeholder="Search applications by company, job title, stage, or keywords…"
              aria-label="Search applications"
            />
          </label>
          <Select
            value={stageFilter}
            onValueChange={(value) => setStageFilter(value as ApplicationStageFilter)}
          >
            <SelectTrigger className="ui-filter-pill h-11 min-h-11 border-0 shadow-none bg-[var(--card-bg)]">
              <SelectValue placeholder="All stages" />
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {APPLICATION_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {getStageLabel(language, stage)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={outcomeFilter}
            onValueChange={(value) => setOutcomeFilter(value as ApplicationOutcomeFilter)}
          >
            <SelectTrigger className="ui-filter-pill h-11 min-h-11 border-0 shadow-none bg-[var(--card-bg)]">
              <SelectValue placeholder="All outcomes" />
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "all",
                  "active",
                  "interview",
                  "offer",
                  "rejected",
                  "declined",
                  "no_response",
                  "withdrawn",
                  "hired",
                ] as ApplicationOutcomeFilter[]
              ).map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {getOutcomeFilterLabel(language, filter)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onRefresh && (
            <button
              type="button"
              className="ui-btn-ghost"
              onClick={onRefresh}
              title="Refresh data from database"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t("refresh") || "Refresh"}
            </button>
          )}
          <Select
            value={cvLanguageFilter}
            onValueChange={(value) => setCvLanguageFilter(value as ResumeLanguageFilter)}
          >
            <SelectTrigger
              className="ui-filter-pill h-11 min-h-11 border-0 shadow-none bg-[var(--card-bg)]"
              aria-label="Filter by CV language"
            >
              <Globe className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
              <SelectValue placeholder={getResumeLanguageFilterLabel("all")} />
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getResumeLanguageFilterLabel("all")}</SelectItem>
              {cvLanguageCounts.en > 0 ? (
                <SelectItem value="en">
                  {getResumeLanguageLabel("en")} ({cvLanguageCounts.en})
                </SelectItem>
              ) : null}
              {cvLanguageCounts.de > 0 ? (
                <SelectItem value="de">
                  {getResumeLanguageLabel("de")} ({cvLanguageCounts.de})
                </SelectItem>
              ) : null}
              {cvLanguageCounts.unknown > 0 ? (
                <SelectItem value="unknown">
                  {getResumeLanguageLabel("unknown")} / no CV ({cvLanguageCounts.unknown})
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          <Select
            value={dateSort}
            onValueChange={(value) => setDateSort(value as JobApplicationDateSort)}
          >
            <SelectTrigger
              className="ui-filter-pill h-11 min-h-11 border-0 shadow-none bg-[var(--card-bg)]"
              aria-label="Sort applications by date"
            >
              <ArrowDownWideNarrow
                className="h-3.5 w-3.5 text-[var(--text-secondary)]"
                aria-hidden
              />
              <SelectValue placeholder="Sort by date" />
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest activity</SelectItem>
              <SelectItem value="oldest">Oldest activity</SelectItem>
            </SelectContent>
          </Select>
          {(onExportAll || onImportAll) && (
            <Popover open={backupMenuOpen} onOpenChange={setBackupMenuOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="ui-btn-ghost" aria-haspopup="menu">
                  <Archive className="h-4 w-4" aria-hidden />
                  Backup and restore
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="end">
                {onExportAll ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                    onClick={() => {
                      setBackupMenuOpen(false)
                      onExportAll()
                    }}
                  >
                    <Download className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                    Export backup
                  </button>
                ) : null}
                {onImportAll ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                    onClick={() => {
                      setBackupMenuOpen(false)
                      onImportAll()
                    }}
                  >
                    <Upload className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                    Import backup
                  </button>
                ) : null}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <TrustComplianceSection
          resume={null}
          allResumes={versions}
          folderId={folderId}
          onRestoreSnapshot={onRestoreSnapshot}
          onDataDeleted={onDataDeleted}
        />

        <section aria-label="Job applications">
          <p className="ui-list-section-label">
            Applications
            {hasActiveApplicationFilters
              ? ` (${filteredJobApplications.length} of ${jobApplications.length})`
              : jobApplications.length > 0
                ? ` (${jobApplications.length})`
                : ""}
            {jobApplications.length > 0
              ? dateSort === "newest"
                ? " · newest activity first"
                : " · oldest activity first"
              : ""}
          </p>

            {jobApplications.length === 0 ? (
              <SectionEmptyState
                heading={SECTION_EMPTY_STATES.applications.heading}
                body={SECTION_EMPTY_STATES.applications.body}
                cta={SECTION_EMPTY_STATES.applications.cta}
                slot={SECTION_ILLUSTRATION_SLOTS.applications}
                onCta={handleStartApplicationWizard}
              />
            ) : hasNoApplicationResults ? (
              <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
                <p className="text-base font-medium text-foreground">No applications match your filters.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try different keywords or filters, or clear everything to see all applications.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setApplicationSearchQuery("")
                    setStageFilter("all")
                    setOutcomeFilter("all")
                    setCvLanguageFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredJobApplications.map((job, index) => {
                  const resumeVersion = resolveResumeForJob(job, versions)
                  const role = resolveApplicationRole(job, resumeVersion)
                  const displayCompany = role.company.trim() || COMPANY_NOT_ADDED
                  const displayJobTitle = role.jobTitle.trim() || JOB_TITLE_NOT_ADDED
                  const cardKey = duplicateApplicationIds.has(job.id)
                    ? `${job.id}-${index}`
                    : job.id || `application-${index}`

                  return (
                    <ApplicationListCard
                      key={cardKey}
                      job={job}
                      isWorkspaceSyncing={isWorkspaceSyncing}
                      isCvImporting={cvImportingJobId === job.id}
                      resumeVersion={resumeVersion}
                      appliedDateLabel={formatApplicationDate(job.appliedDate)}
                      lastUpdatedLabel={formatApplicationDate(job.lastModified)}
                      resumeVersionName={resumeVersion?.name ?? null}
                      coverLetterName={getCoverLetterDisplayName(job, coverLetters, resumeVersion)}
                      hasCoverLetter={hasUsableApplicationCoverLetter(
                        job,
                        coverLetters,
                        resumeVersion,
                      )}
                      hasUploadDetails={hasUploadDetailsContent(job.uploadDetails)}
                      hasJobDescription={Boolean(
                        job.jobDescription?.trim() || resumeVersion?.jobDescription?.trim(),
                      )}
                      fitScoreSummary={formatFitScoreSummary(job)}
                      language={language}
                      onEdit={() => handleStartEditJob(job)}
                      onUpdateRole={handleUpdateApplicationRole}
                      onChangePipeline={(pipeline) => onUpdateJobStatus(job.id, { pipeline })}
                      onOpenCv={() => {
                        const hasUsableCv = Boolean(resumeVersion?.resumeText?.trim())
                        if (resumeVersion && hasUsableCv) {
                          if (onOpenApplicationResume) {
                            onOpenApplicationResume(job.id)
                          } else {
                            onLoadVersion(resumeVersion)
                          }
                          return
                        }
                        setAddCvJobId(job.id)
                      }}
                      onOpenCoverLetter={() => {
                        if (
                          hasUsableApplicationCoverLetter(job, coverLetters, resumeVersion)
                        ) {
                          onOpenApplicationCoverLetter(job.id)
                          return
                        }
                        setAddCoverLetterJobId(job.id)
                      }}
                      onOpenYourStory={
                        onOpenYourStory ? () => onOpenYourStory(job.id) : undefined
                      }
                      onOpenStoryWizard={
                        onOpenStoryWizard ? () => onOpenStoryWizard(job.id) : undefined
                      }
                      onOpenUploadDetails={() => setUploadDetailsJobId(job.id)}
                      onOpenJobDescription={() => handleOpenJobDescription(job)}
                      onOpen={() => setDetailsJobId(job.id)}
                      onDelete={() => {
                        if (confirm(`Delete application for ${displayJobTitle} at ${displayCompany}?`)) {
                          onDeleteJobApplication(job.id)
                        }
                      }}
                    />
                  )
                })}
              </div>
            )}
          </section>
        </>
        ) : null}
      </div>

      <ApplicationDetailsDialog
        open={detailsJobId !== null}
        onOpenChange={(open) => !open && setDetailsJobId(null)}
        job={detailsJob}
        versions={versions}
        coverLetters={coverLetters}
        language={language}
        onUpdateJob={onUpdateJobStatus}
        onUpdateRole={handleUpdateApplicationRole}
        onOpenCompanyInfo={onOpenCompanyInfo}
        onOpenJobStrategy={onOpenJobStrategy}
        onOpenContacts={onOpenContacts}
        onOpenInterviewPrep={onOpenInterviewPrep}
        onOpenCoverLetterWizard={onOpenCoverLetterWizard}
        onOpenCoverLetterEditor={onOpenCoverLetterEditor}
        onOpenUploadDetails={(jobId) => setUploadDetailsJobId(jobId)}
        onLoadVersion={onLoadVersion}
        onEditFitScore={handleStartEditFitScore}
      />

      <UploadDetailsDialog
        open={uploadDetailsJobId !== null}
        onOpenChange={(open) => {
          if (!open) setUploadDetailsJobId(null)
        }}
        job={uploadDetailsJob}
        resumeVersion={uploadDetailsResume}
        workspaceSyncStatus={workspaceSyncStatus}
        defaultOutputLanguage={folderContactInfo?.language === "de" ? "de" : "en"}
        onSave={async (jobId, uploadDetails) => {
          await onUpdateJob(jobId, { uploadDetails })
        }}
      />

      {/* Folder Settings Dialog */}
      <Dialog open={showFolderSettingsDialog} onOpenChange={setShowFolderSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription>
              Edit your workspace profile and contact information. These will be used as defaults for new resumes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Workspace Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name" className="text-sm font-semibold">Workspace Name</Label>
              <Input
                id="edit-folder-name"
                placeholder="e.g., Tech Jobs 2026"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
              />
            </div>

            {/* Profile Photo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed cursor-pointer hover:border-primary transition-colors overflow-hidden"
                  onClick={() => folderImageInputRef.current?.click()}
                >
                  {editFolderProfileImage ? (
                    <img src={editFolderProfileImage || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => folderImageInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                  {editFolderProfileImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditFolderProfileImage(null)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={folderImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFolderImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Contact Information</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-name" className="text-xs">Full Name</Label>
                  <Input
                    id="edit-contact-name"
                    placeholder="Your full name"
                    value={editFolderContactInfo.name}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-title" className="text-xs">Professional Title</Label>
                  <Input
                    id="edit-contact-title"
                    placeholder="e.g., Software Engineer"
                    value={editFolderContactInfo.professionalTitle}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, professionalTitle: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-email" className="text-xs">Email</Label>
                  <Input
                    id="edit-contact-email"
                    type="email"
                    placeholder="your@email.com"
                    value={editFolderContactInfo.email}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-phone" className="text-xs">Phone</Label>
                  <Input
                    id="edit-contact-phone"
                    placeholder="+1 234 567 890"
                    value={editFolderContactInfo.phone}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-address" className="text-xs">Location</Label>
                  <Input
                    id="edit-contact-address"
                    placeholder="City, Country"
                    value={editFolderContactInfo.address}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-citizenship" className="text-xs">Citizenship</Label>
                  <Input
                    id="edit-contact-citizenship"
                    placeholder="e.g., German"
                    value={editFolderContactInfo.citizenship}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, citizenship: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-linkedin" className="text-xs">LinkedIn Profile</Label>
                  <Input
                    id="edit-contact-linkedin"
                    placeholder="linkedin.com/in/yourprofile"
                    value={editFolderContactInfo.linkedin}
                    onChange={(e) => setEditFolderContactInfo({ ...editFolderContactInfo, linkedin: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs">
                    Portfolio / websites (up to {MAX_PORTFOLIO_URLS})
                  </Label>
                  {portfolioInputSlots(
                    editFolderContactInfo.portfolios,
                    editFolderContactInfo.portfolio,
                  ).map((url, index) => (
                    <Input
                      key={`edit-portfolio-${index}`}
                      id={
                        index === 0
                          ? "edit-contact-portfolio"
                          : `edit-contact-portfolio-${index + 1}`
                      }
                      placeholder={
                        index === 0 ? "yourportfolio.com" : `Website ${index + 1}`
                      }
                      value={url}
                      onChange={(e) =>
                        setEditFolderContactInfo(
                          applyPortfolioSlotUpdate(
                            editFolderContactInfo,
                            index,
                            e.target.value,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-contact-language" className="text-xs">Default Language</Label>
                <Select
                  value={editFolderContactInfo.language}
                  onValueChange={(value: "en" | "de") => setEditFolderContactInfo({ ...editFolderContactInfo, language: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="edit-notice-period" className="text-xs font-semibold">
                  Notice period
                </Label>
                <Input
                  id="edit-notice-period"
                  placeholder="e.g. 3 months, available from 1 September 2026"
                  value={editNoticePeriod}
                  onChange={(e) => setEditNoticePeriod(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Saved to your profile and used when drafting availability answers in Upload Details.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFolderSettings}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={addCvUploadRef}
        type="file"
        accept={SUPPORTED_CV_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          const jobId = pendingCvUploadJobIdRef.current ?? addCvJobId
          event.target.value = ""
          pendingCvUploadJobIdRef.current = null
          if (!file || !jobId) return
          void onUploadCvForApplication?.(jobId, file)?.finally(() => {
            setAddCvJobId(null)
          })
        }}
      />

      <Dialog
        open={addCvJobId !== null}
        onOpenChange={(open) => {
          if (!open) setAddCvJobId(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a CV to this application</DialogTitle>
            <DialogDescription>
              Create a new tailored CV with the wizard, or upload a CV file you already have (PDF,
              TXT, or Markdown).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Button
              type="button"
              className="h-11 justify-start"
              onClick={() => {
                const jobId = addCvJobId
                setAddCvJobId(null)
                if (jobId) onOpenApplicationWizardForJob?.(jobId)
              }}
            >
              <Sparkles className="mr-2 h-4 w-4 shrink-0" />
              Create tailored CV (wizard)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start"
              disabled={cvImportingJobId === addCvJobId}
              onClick={() => {
                if (addCvJobId) pendingCvUploadJobIdRef.current = addCvJobId
                addCvUploadRef.current?.click()
              }}
            >
              {cvImportingJobId === addCvJobId ? (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4 shrink-0" />
              )}
              {cvImportingJobId === addCvJobId ? "Importing CV…" : "Upload existing CV file"}
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                pendingCvUploadJobIdRef.current = null
                setAddCvJobId(null)
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={addCoverLetterUploadRef}
        type="file"
        accept={SUPPORTED_CV_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          const jobId = pendingCoverLetterUploadJobIdRef.current ?? addCoverLetterJobId
          event.target.value = ""
          pendingCoverLetterUploadJobIdRef.current = null
          if (!file || !jobId) return
          setAddCoverLetterJobId(null)
          void onUploadCoverLetterForApplication?.(jobId, file)
        }}
      />

      <Dialog
        open={addCoverLetterJobId !== null}
        onOpenChange={(open) => {
          if (!open) setAddCoverLetterJobId(null)
        }}
      >
        <DialogContent className="max-w-md">
          {(() => {
            const job =
              addCoverLetterJobId !== null
                ? jobApplications.find((entry) => entry.id === addCoverLetterJobId)
                : undefined
            const resumeVersion = job
              ? versions.find((version) => version.id === job.resumeVersionId)
              : undefined
            const needsCvFirst = !Boolean(resumeVersion?.resumeText?.trim())

            return (
              <>
                <DialogHeader>
                  <DialogTitle>Add a cover letter to this application</DialogTitle>
                  <DialogDescription>
                    {needsCvFirst
                      ? "Cover letters are linked to a resume. Add or upload a CV for this application first, then you can add a cover letter."
                      : "Create a tailored cover letter with the wizard, or upload a file you already have (PDF, TXT, or Markdown)."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  {needsCvFirst ? (
                    <Button
                      type="button"
                      className="h-11 justify-start"
                      onClick={() => {
                        const jobId = addCoverLetterJobId
                        setAddCoverLetterJobId(null)
                        if (jobId) setAddCvJobId(jobId)
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4 shrink-0" />
                      Add a CV first
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        className="h-11 justify-start"
                        onClick={() => {
                          const jobId = addCoverLetterJobId
                          setAddCoverLetterJobId(null)
                          if (jobId) onOpenCoverLetterWizard(jobId)
                        }}
                      >
                        <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                        Create tailored cover letter (wizard)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 justify-start"
                        onClick={() => {
                          if (addCoverLetterJobId) {
                            pendingCoverLetterUploadJobIdRef.current = addCoverLetterJobId
                          }
                          addCoverLetterUploadRef.current?.click()
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4 shrink-0" />
                        Upload existing cover letter file
                      </Button>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      pendingCoverLetterUploadJobIdRef.current = null
                      setAddCoverLetterJobId(null)
                    }}
                  >
                    Cancel
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showNewJobDialog} onOpenChange={setShowNewJobDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("createNewJobApplication")}</DialogTitle>
            <DialogDescription>{t("addJobApplicationToTrack")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobTitle">{t("jobTitle")} *</Label>
                <Input
                  id="jobTitle"
                  value={newJobData.jobTitle}
                  onChange={(e) => setNewJobData({ ...newJobData, jobTitle: e.target.value })}
                  placeholder={t("egSeniorSoftwareEngineer")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">{t("company")} *</Label>
                <Input
                  id="company"
                  value={newJobData.company}
                  onChange={(e) => setNewJobData({ ...newJobData, company: e.target.value })}
                  placeholder={t("egTechCorp")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uploadResume">{t("orUploadResume")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="uploadResume"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setUploadedResumeFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {uploadedResumeFile && (
                    <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {uploadedResumeFile.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coverLetter">{t("selectCoverLetter")}</Label>
                <Select
                  value={newJobData.coverLetterId || "none"}
                  onValueChange={(value) => setNewJobData({ ...newJobData, coverLetterId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectCoverLetterPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noCoverLetter")}</SelectItem>
                    {coverLetters?.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uploadCoverLetter">{t("orUploadCoverLetter")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="uploadCoverLetter"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setUploadedCoverLetterFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {uploadedCoverLetterFile && (
                    <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {uploadedCoverLetterFile.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobDescriptionSummary">{t("jobDescriptionSummary")}</Label>
                <Textarea
                  id="jobDescriptionSummary"
                  value={newJobData.jobDescriptionSummary}
                  onChange={(e) => setNewJobData({ ...newJobData, jobDescriptionSummary: e.target.value })}
                  placeholder={t("shortSummaryPlaceholder")}
                  rows={3}
                  className="resize-y"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobDescriptionUrl">{t("jobPostingUrl")}</Label>
                <Input
                  id="jobDescriptionUrl"
                  value={newJobData.jobDescriptionUrl}
                  onChange={(e) => setNewJobData({ ...newJobData, jobDescriptionUrl: e.target.value })}
                  placeholder={t("httpsPlaceholder")}
                  type="url"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobDescription">{t("fullJobDescription")}</Label>
                <Textarea
                  id="jobDescription"
                  value={newJobData.jobDescription}
                  onChange={(e) => setNewJobData({ ...newJobData, jobDescription: e.target.value })}
                  placeholder={t("pasteFullDescription")}
                  rows={12}
                  className="resize-y min-h-[200px]"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowNewJobDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreateJob}>{t("createApplication")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewJobDescriptionId} onOpenChange={() => setViewJobDescriptionId(null)}>
        <DialogContent className="flex max-h-[min(92vh,900px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 pr-12 text-left">
            <DialogTitle>
              {viewingJob?.jobTitle} at {viewingJob?.company}
            </DialogTitle>
            <DialogDescription>
              {isEditingJobDescription ? "Edit job description and URL" : "Full job description"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {isEditingJobDescription ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-job-description">Job Description</Label>
                  <Textarea
                    id="edit-job-description"
                    value={editedJobDescription}
                    onChange={(e) => setEditedJobDescription(e.target.value)}
                    onMouseUp={(e) =>
                      captureTextareaSelection("job_description", e.currentTarget)
                    }
                    onKeyUp={(e) =>
                      captureTextareaSelection("job_description", e.currentTarget)
                    }
                    placeholder="Enter the full job description here..."
                    rows={18}
                    className="resize-y min-h-[320px] [field-sizing:fixed] font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-job-summary">Job Description Summary (for card display)</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const prompt = `Create a concise 5-line summary of this job posting:\n\n${editedJobDescription}\n\nThe summary should capture the key role, main responsibilities, and essential requirements.`
                        navigator.clipboard.writeText(prompt)
                        alert("ChatGPT prompt copied to clipboard!")
                      }}
                    >
                      Create ChatGPT Prompt
                    </Button>
                  </div>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">View prompt</summary>
                    <pre className="mt-2 p-3 bg-background rounded-md border overflow-x-auto font-mono whitespace-pre-wrap">
                      <code>{`Create a concise 5-line summary of this job posting:

${editedJobDescription}

The summary should capture the key role, main responsibilities, and essential requirements.`}</code>
                    </pre>
                  </details>
                  <Textarea
                    id="edit-job-summary"
                    value={editedJobDescriptionSummary}
                    onChange={(e) => setEditedJobDescriptionSummary(e.target.value)}
                    placeholder="A concise 5-line summary that will appear on the job card..."
                    rows={5}
                    className="resize-y"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-job-url">Job Posting URL</Label>
                  <Input
                    id="edit-job-url"
                    type="url"
                    value={editedJobDescriptionUrl}
                    onChange={(e) => setEditedJobDescriptionUrl(e.target.value)}
                    placeholder="https://www.example.com/jobs/..."
                  />
                </div>
              </>
            ) : (
              <>
                {editedJobDescription.trim() ? (
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {editedJobDescription}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No job description saved for this application yet. Click Edit to paste the
                    posting you used when creating the CV.
                  </p>
                )}
                {viewingJob?.jobDescriptionUrl && (
                  <div className="pt-4 border-t">
                    <a
                      href={viewingJob.jobDescriptionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      View Original Job Posting →
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 justify-between gap-2 border-t px-6 py-4">
            {isEditingJobDescription ? (
              <>
                <Button variant="outline" onClick={() => setIsEditingJobDescription(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveJobDescription}>Save Changes</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditingJobDescription(true)}>
                  Edit
                </Button>
                <Button onClick={() => setViewJobDescriptionId(null)}>Close</Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingJobId !== null} onOpenChange={(open) => !open && handleCancelEditJob()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Application Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-job-title">Job Title *</Label>
              <Input
                id="edit-job-title"
                value={editedJobData.jobTitle}
                onChange={(e) => setEditedJobData({ ...editedJobData, jobTitle: e.target.value })}
                placeholder="e.g., Senior Product Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company *</Label>
              <Input
                id="edit-company"
                value={editedJobData.company}
                onChange={(e) => setEditedJobData({ ...editedJobData, company: e.target.value })}
                placeholder="e.g., Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location (optional)</Label>
              <Input
                id="edit-location"
                value={editedJobData.location}
                onChange={(e) => setEditedJobData({ ...editedJobData, location: e.target.value })}
                placeholder="e.g., Berlin, Germany"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-applied-date">Application Date</Label>
              <Input
                id="edit-applied-date"
                type="date"
                value={toDateInputValue(editedJobData.appliedDate)}
                onChange={(e) => {
                  const parsed = parseDateInputValue(e.target.value)
                  if (parsed != null) {
                    setEditedJobData({ ...editedJobData, appliedDate: parsed })
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-resume-version">Select Resume Version (Optional)</Label>
              <select
                id="edit-resume-version"
                value={editedJobData.resumeVersionId}
                onChange={(e) => setEditedJobData({ ...editedJobData, resumeVersionId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">No resume</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-upload-resume">Or Upload Resume (PDF)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-upload-resume"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setEditUploadedResumeFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {editUploadedResumeFile && (
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {editUploadedResumeFile.name}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cover-letter">Select Cover Letter (Optional)</Label>
              <select
                id="edit-cover-letter"
                value={editedJobData.coverLetterId}
                onChange={(e) => setEditedJobData({ ...editedJobData, coverLetterId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">No cover letter</option>
                {coverLetters?.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-upload-cover-letter">Or Upload Cover Letter (PDF)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-upload-cover-letter"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setEditUploadedCoverLetterFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {editUploadedCoverLetterFile && (
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {editUploadedCoverLetterFile.name}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-job-url">Job Posting URL (Optional)</Label>
              <Input
                id="edit-job-url"
                type="url"
                value={editedJobData.jobDescriptionUrl}
                onChange={(e) => setEditedJobData({ ...editedJobData, jobDescriptionUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-job-description">Job Description (Optional)</Label>
              <Textarea
                id="edit-job-description"
                value={editedJobData.jobDescription}
                onChange={(e) => setEditedJobData({ ...editedJobData, jobDescription: e.target.value })}
                onMouseUp={(e) =>
                  captureTextareaSelection("job_description", e.currentTarget)
                }
                onKeyUp={(e) =>
                  captureTextareaSelection("job_description", e.currentTarget)
                }
                rows={8}
                placeholder="Paste the full job description here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancelEditJob} variant="outline">
              Cancel
            </Button>
            <Button onClick={() => editingJobId && handleSaveJob(editingJobId)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fit Score Edit Dialog */}
      <Dialog open={editingFitScoreJobId !== null} onOpenChange={(open) => !open && handleCancelEditFitScore()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {t("editFitScore").replace("{type}", editingFitScoreType ? getFitScoreTypeLabel(language, editingFitScoreType) : "")}
            </DialogTitle>
            <DialogDescription>
              {t("rateHowWellFits").replace("{type}", editingFitScoreType ? getFitScoreTypeLabel(language, editingFitScoreType) : "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("score")} (1-5)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setEditedFitScore(score)}
                    className={`w-10 h-10 rounded-lg border-2 font-bold transition-colors ${
                      editedFitScore === score
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                1 = {t("poorFit")}, 5 = {t("excellentFit")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fit-summary">{t("summary")}</Label>
              <Textarea
                id="fit-summary"
                value={editedFitSummary}
                onChange={(e) => setEditedFitSummary(e.target.value)}
                placeholder={t("briefExplanation")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancelEditFitScore} variant="outline">
              {t("cancel")}
            </Button>
            <Button onClick={() => editingFitScoreJobId && handleSaveFitScore(editingFitScoreJobId)}>
              {t("saveScore")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Red Flags Edit Dialog */}
      <Dialog open={editingRedFlagsJobId !== null} onOpenChange={(open) => !open && handleCancelEditRedFlags()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t("redFlagsTitle")}
            </DialogTitle>
            <DialogDescription>{t("redFlagsDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Existing Red Flags */}
            {editedRedFlags.length > 0 && (
              <div className="space-y-3">
                {editedRedFlags.map((flag) => (
                  <div key={flag.id} className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    {editingFlagId === flag.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingFlagQuestion}
                          onChange={(e) => setEditingFlagQuestion(e.target.value)}
                          placeholder={t("questionOrConcern")}
                        />
                        <Textarea
                          value={editingFlagAnswer}
                          onChange={(e) => setEditingFlagAnswer(e.target.value)}
                          placeholder={t("answerOrNotes")}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEditFlag}>
                            {t("save")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEditFlag}>
                            {t("cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">{flag.question}</p>
                          {flag.answer && (
                            <p className="text-sm text-muted-foreground mt-1">{flag.answer}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEditFlag(flag)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveRedFlag(flag.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add New Red Flag */}
            <div className="p-3 border rounded-lg bg-muted/30">
              <p className="text-sm font-medium mb-2">{t("addNewRedFlag")}</p>
              <div className="space-y-2">
                <Input
                  value={newRedFlagQuestion}
                  onChange={(e) => setNewRedFlagQuestion(e.target.value)}
                  placeholder={t("questionOrConcern")}
                />
                <Textarea
                  value={newRedFlagAnswer}
                  onChange={(e) => setNewRedFlagAnswer(e.target.value)}
                  placeholder={t("answerOrNotes")}
                  rows={2}
                />
                <Button
                  onClick={handleAddRedFlag}
                  size="sm"
                  variant="outline"
                  disabled={!newRedFlagQuestion.trim()}
                  className="w-full bg-transparent"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("addRedFlag")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancelEditRedFlags} variant="outline">
              {t("cancel")}
            </Button>
            <Button onClick={() => editingRedFlagsJobId && handleSaveRedFlags(editingRedFlagsJobId)}>
              {t("saveRedFlags")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={resumeRenamePrompt !== null}
        onOpenChange={(open) => {
          if (!open) setResumeRenamePrompt(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update resume name too?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {resumeRenamePrompt && (
                  <>
                    <p>
                      Application title changed from{" "}
                      <span className="font-medium text-foreground">
                        {resumeRenamePrompt.oldTitle || "Untitled"}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium text-foreground">
                        {resumeRenamePrompt.newTitle}
                      </span>
                      .
                    </p>
                    {resumeRenamePrompt.currentResumeName ? (
                      <p>
                        Linked resume:{" "}
                        <span className="font-medium text-foreground">
                          {resumeRenamePrompt.currentResumeName}
                        </span>
                        {resumeRenamePrompt.isAutoLinked
                          ? " — matches the previous application title."
                          : " — this looks like a custom name."}
                      </p>
                    ) : null}
                    <p>
                      Rename to{" "}
                      <span className="font-medium text-foreground">
                        {resumeRenamePrompt.proposedResumeName}
                      </span>
                      ?
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current resume name</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmResumeRename}>
              Update resume name
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  )
}
