"use client"

import React from "react"
import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { SavedVersions } from "@/components/saved-versions"
import ResumeInput from "@/components/resume-input"
import { ResumePreview } from "@/components/resume-preview"
import {
  UnifiedAiAssistant,
  type CoverLetterApplyPayload,
} from "@/components/unified-ai-assistant"
import { InterviewPrep } from "@/components/interview-prep"
import { CompanyInfo } from "@/components/company-info"
import { Contacts } from "@/components/contacts"
import { JobStrategy } from "@/components/job-strategy"
import { FoldersView } from "@/components/folders-view"
import { StandaloneCoverLetter } from "@/components/standalone-cover-letter"
import { YourStoryView } from "@/components/your-story-view"
import { ApplicationStoryWizard } from "@/components/application-story-wizard/application-story-wizard"
import { CoverLetterFormatter } from "@/components/cover-letter-formatter"
import { MobileApp } from "@/components/mobile/mobile-app"
import { getCvUser, setCvUser, type CvUser, fetchCvUserFromSession } from "@/lib/cv-auth"
import {
  consumePendingWorkspaceSlug,
  findFolderForUser,
  getWorkspaceSlugForUser,
  peekPendingWorkspaceSlug,
} from "@/lib/cv-workspace-routing"
import {
  buildFolderApplicationCounts,
  findBestFolderForUser,
  hasAnyLocalWorkspaceData,
  scoreFolderLocalContent,
} from "@/lib/workspace-folder-resolution"
import { useToolViewportAllowed } from "@/hooks/use-tool-viewport"
import { CareerProgressPage } from "@/components/application-intelligence/career-progress-page"
import { Dashboard } from "@/components/dashboard" // Changed from default import to named import
import { ApplicationFlow } from "@/components/application-flow/application-flow"
import { ResumeEmptyState } from "@/components/resume-empty-state"
import { WorkspaceShell, type WorkspaceNavId } from "@/components/workspace-sidebar"
import { CareerDashboard } from "@/components/application-intelligence/career-dashboard"
import { IntegrationSectionPage } from "@/components/career-integration/integration-section-page"
import { ProgrammePage } from "@/components/career-integration/programme-page"
import {
  INTEGRATION_SECTIONS,
  type CareerActionCard,
  type IntegrationSectionId,
} from "@/lib/career-integration-platform"
import { OpportunitiesSection } from "@/components/application-intelligence/opportunities-section"
import { CareerBrainSection } from "@/components/application-intelligence/career-brain-section"
import { RoleMatchesPage } from "@/components/application-intelligence/role-matches-page"
import { AiCoachPage } from "@/components/application-intelligence/ai-coach-page"
import { ScenarioLabPage } from "@/components/scenario-lab/scenario-lab-page"
import { SettingsHub } from "@/components/application-intelligence/settings-hub"
import { computeWorkspaceJourneyProgress } from "@/lib/workspace-journey-progress"
import { computeCareerJourneyGuide } from "@/lib/career-journey-guide"
import {
  viewFromWorkspaceNav,
  workspaceNavFromView,
} from "@/lib/workspace-navigation"
import {
  buildAppWorkspaceHref,
  isRestorableAppView,
  readAppWorkspaceUrlFromWindow,
  type AppWorkspaceSort,
} from "@/lib/app-workspace-url"
import type { JobApplicationDateSort } from "@/lib/job-application-display"
import { FormatterOverviewBack } from "@/components/formatter-overview-back"
import { GettingStartedGuide } from "@/components/getting-started-guide"
import { ProfileMenu } from "@/components/profile-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  ResumeVersion,
  JobApplication,
  ContactInfo,
  Folder,
  CoverLetter,
  FolderContactInfo,
  ResumeEmbeddedCoverLetter,
} from "@/lib/types"
import {
  mergeApplicationCoverLetterOntoResume,
  resolveApplicationCoverLetterMode,
} from "@/lib/application-cover-letter-navigation"
import {
  buildYourStoryJobUpdate,
  mergeYourStoryOntoJob,
} from "@/lib/your-story-persistence"
import { hasUsableYourStory } from "@/lib/your-story"
import {
  createEmptyResumeCoverLetter,
  hasResumeCoverLetterContent,
  hasResumeCoverLetterRecord,
  mergeLegacyCoverLettersIntoResumes,
  resolveCoverLetterOpenMode,
  resolveResumeEmbeddedCoverLetter,
} from "@/lib/resume-cover-letter"
import {
  defaultResumeContactInfo,
  getWorkspaceContactDefaults,
  hasResumeContactContent,
  normalizeContactInfo,
  normalizePortfolioUrls,
  withJobAdvertFromApplication,
} from "@/lib/contact-info"
import {
  loadResumeVersions,
  loadResumesForWorkspace,
  saveResumeVersions,
  saveResume,
  saveResumeDraft,
  deleteResume,
  createNewResumeId,
  ensureResumeId,
  defaultResumeTitle,
  normalizeResumeVersion,
  loadJobApplications,
  loadWorkspaceJobApplications,
  assignApplicationsToWorkspaceFolder,
  getLastJobApplicationsLoadMeta,
  saveJobApplications,
  deleteJobApplicationById,
  cacheJobApplicationsLocally,
  cacheResumeVersionsFromCloud,
  applyJobApplicationUpdates,
  foldersStorage,
  coverLettersStorage,
  loadCoverLetters,
  loadCoverLettersForWorkspace,
  saveCoverLetters,
  saveFolders,
  retryResumeRemoteSync,
} from "@/lib/storage"
import { readFoldersCache, writeFoldersCache } from "@/lib/folders-cache"
import { ArrowLeft } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import { UnsavedChangesLeaveDialog } from "@/components/unsaved-changes-leave-dialog"
import { getSupabaseClient } from "@/lib/supabase/client"
import { ensureSupabaseAuthSession } from "@/lib/supabase/app-auth"
import { isSupabaseAuthBlocked } from "@/lib/supabase/client-auth-cache"
import { shouldUseLocalFallback, refreshSupabaseReachability } from "@/lib/supabase/availability"
import {
  SUPABASE_CONNECTION_FAILED_BANNER,
} from "@/lib/supabase/connection-messages"
import {
  pickStableJobApplications,
  shouldSkipApplicationsUiUpdate,
} from "@/lib/workspace-applications-stable"
import { toast } from "@/components/ui/use-toast"
import { autosaveStatusLabel, useDebouncedAutosave } from "@/lib/use-debounced-autosave"
import { ResumeCloudSyncStatus } from "@/components/resume-cloud-sync-status"
import {
  deriveResumeCloudSyncFromSaveResult,
  resumeCloudSyncLabel,
  type ResumeCloudSyncStatus as ResumeCloudSyncUiStatus,
} from "@/lib/resume-sync-status"
import type { SaveResumeResult } from "@/lib/resume-persistence"
import { loadUserProfile, patchUserProfile } from "@/lib/user-profile"
import {
  loadStrategicProfile,
  type StrategicProfile,
} from "@/lib/strategic-profile"
import {
  loadQualificationProfile,
  QUALIFICATION_PROFILE_UPDATED_EVENT,
} from "@/lib/qualification-profile/storage"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { PhraseLibraryHost } from "@/components/phrase-library/phrase-library-host"
import { PhraseLibraryProvider } from "@/components/phrase-library/phrase-library-context"
import {
  parseCombinedApplicationLabel,
} from "@/lib/application-role-label"
import { nextApplicationResumeName } from "@/lib/application-resume-naming"
import { resolveResumeForJob } from "@/lib/resolve-application-resume"
import { inferCoverLetterIdsFromPatterns } from "@/lib/data-integrity/cover-letter-links"
import { repairApplicationResumeLinks } from "@/lib/repair-application-resume-links"
import { extractCvFileWithDiagnostics } from "@/lib/extract-document-text"
import { prepareImportedCvText, existingCvShouldBlockSilentOverwrite } from "@/lib/prepare-imported-cv"
import { validateAndRepairImportedCv } from "@/lib/import-cv-structure"
import {
  ImportCvPreviewDialog,
  type ImportCvPreviewPayload,
} from "@/components/import-cv-preview-dialog"
import { uniqueAiEditVersionName } from "@/lib/cv-edit-version-name"
import type { AiResumeEditPayload, AiResumeEditResult } from "@/lib/cv-edit-types"
import { migrateDuplicateResumes } from "@/lib/resume-duplicate-migration"
import {
  appendAuditEntry,
  providerDisplayName,
} from "@/lib/ai-transparency"
import {
  applyResumeContentUpdate,
  restoreResumeFromSnapshot,
} from "@/lib/resume-version-history"
import { appendFolderAiActivity } from "@/lib/ai-activity-log"
import { dispatchAssistantCoverLetterApplied } from "@/lib/assistant-cover-letter-apply"
import { createCoverLetterVersionId } from "@/lib/cover-letter-ai"
import {
  haveJobApplicationsChanged,
  reconcileWorkspaceApplications,
} from "@/lib/application-reconcile"
import { finalizeWorkspaceApplications } from "@/lib/job-application-enrich"
import {
  WORKSPACE_DB_TIMEOUT_MS,
  WORKSPACE_LOAD_STAGES,
  hasWorkspaceLocalContent,
  loadWithTimeoutAndRetry,
  loadWorkspaceFromLocalCache,
} from "@/lib/workspace-local-cache"
import { WorkspaceLoadingSkeleton } from "@/components/workspace-loading-skeleton"
import type { WorkspaceSyncUiStatus } from "@/components/workspace-sync-status"
import {
  deriveApplicationName,
  emptyJobApplicationFields,
  type ApplicationFlowCompletePayload,
} from "@/lib/application-flow-complete"
import { tombstoneApplicationDeletion, getDeletedApplicationIdsForFolder } from "@/lib/application-delete-tombstones"
import { prepareJobApplicationsForWorkspace } from "@/lib/job-applications-normalize"
import {
  hasRecoverableApplicationFlowDraft,
  loadApplicationFlowSessionId,
  startFreshApplicationFlowDraft,
  startApplicationFlowForJob,
  getOrCreateWizardApplicationIds,
} from "@/lib/application-flow-storage"
import {
  findMatchingApplication,
  mergeAllDuplicateApplications,
} from "@/lib/job-applications-dedupe"

type AppView =
  | "folders"
  | "careerHome"
  | "opportunities"
  | "careerBrain"
  | "roleMatches"
  | "scenarioLab"
  | "aiCoach"
  | "settings"
  | "recognitionPathways"
  | "workplaceGerman"
  | "mentoringSupport"
  | "bureaucracyNavigator"
  | "aiJobSearchGuide"
  | "programme"
  | "dashboard"
  | "statistics"
  | "resume"
  | "yourStory"
  | "coverLetter"
  | "jobCoverLetter"
  | "interviewPrep"
  | "companyInfo"
  | "contacts"
  | "jobStrategy"

const INTEGRATION_SECTION_VIEWS: IntegrationSectionId[] = [
  "recognitionPathways",
  "workplaceGerman",
  "mentoringSupport",
  "bureaucracyNavigator",
  "aiJobSearchGuide",
]

function isIntegrationSectionView(view: AppView): view is IntegrationSectionId {
  return INTEGRATION_SECTION_VIEWS.includes(view as IntegrationSectionId)
}

/** Views where the floating AI Assistant has meaningful editing context. */
const AI_ASSISTANT_VIEWS: AppView[] = [
  "resume",
  "yourStory",
  "coverLetter",
  "jobCoverLetter",
  "statistics",
  "aiCoach",
  "companyInfo",
  "contacts",
  "jobStrategy",
  "interviewPrep",
]

function shouldShowAiAssistant(view: AppView, hasCurrentResume: boolean): boolean {
  if (!AI_ASSISTANT_VIEWS.includes(view)) return false
  if (view === "yourStory") return true
  if (view === "resume") return hasCurrentResume
  return true
}

function getAiCoachFabCopy(view: AppView): { label: string; tooltip: string } {
  switch (view) {
    case "resume":
      return { label: "AI CV Coach", tooltip: "Get help improving your CV" }
    case "yourStory":
      return {
        label: "AI Career Story Coach",
        tooltip: "Refine My Career Story and align your CV",
      }
    case "coverLetter":
    case "jobCoverLetter":
      return {
        label: "AI Cover Letter Coach",
        tooltip: "Get help tailoring your cover letter",
      }
    case "statistics":
    case "aiCoach":
      return { label: "AI Career Coach", tooltip: "Get career strategy and insights" }
    case "companyInfo":
    case "contacts":
    case "jobStrategy":
    case "interviewPrep":
      return { label: "AI Application Coach", tooltip: "Get help with this application" }
    default:
      return { label: "Ask AI Coach", tooltip: "Get AI coaching for your job search" }
  }
}

type AppHistoryState = {
  app: true
  view: AppView
  folderId: string | null
  applicationId?: string | null
  resumeId?: string | null
  sort?: AppWorkspaceSort | null
}

type PendingNavigation = {
  view: AppView
  folderId?: string | null
  clearWorkspace?: boolean
  applicationId?: string | null
  resumeId?: string | null
  sort?: AppWorkspaceSort | null
}

function isAppHistoryState(state: unknown): state is AppHistoryState {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as AppHistoryState).app === true &&
    typeof (state as AppHistoryState).view === "string"
  )
}

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { ready: viewportReady, allowed: viewportAllowed } = useToolViewportAllowed()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersLoadError, setFoldersLoadError] = useState<string | null>(null)
  const [unlockedFolderIds, setUnlockedFolderIds] = useState<string[]>([])
  const [view, setView] = useState<AppView>("folders")
  const [applicationsSort, setApplicationsSort] = useState<JobApplicationDateSort>(() => {
    if (typeof window === "undefined") return "newest"
    return readAppWorkspaceUrlFromWindow().sort ?? "newest"
  })
  const [detailsApplicationId, setDetailsApplicationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const parsed = readAppWorkspaceUrlFromWindow()
    return parsed.view === "dashboard" ? parsed.applicationId : null
  })
  const pendingUrlRestoreRef = useRef<ReturnType<typeof readAppWorkspaceUrlFromWindow> | null>(
    null,
  )
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null)
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null)
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false)
  const [showStartAgainDialog, setShowStartAgainDialog] = useState(false)
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([])
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([])
  const [coverLetterResumeId, setCoverLetterResumeId] = useState<string | null>(null)
  const [standaloneCoverLetterMode, setStandaloneCoverLetterMode] = useState<"wizard" | "editor">("wizard")
  const [coverLetterReturnView, setCoverLetterReturnView] = useState<"resume" | "dashboard">("resume")
  const [yourStoryReturnView, setYourStoryReturnView] = useState<"resume" | "dashboard">("dashboard")
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [pendingCvImport, setPendingCvImport] = useState<ImportCvPreviewPayload | null>(null)
  const [isSavingCvImport, setIsSavingCvImport] = useState(false)
  const [cvImportingJobId, setCvImportingJobId] = useState<string | null>(null)
  const coverLetterExitHandlerRef = useRef<(() => void) | null>(null)
  const coverLetterNavTargetRef = useRef<"dashboard" | "resume" | "statistics" | "careerHome">("resume")
  const [jobCoverLetterMode, setJobCoverLetterMode] = useState<"wizard" | "editor">("wizard")
  const [selectedTab, setSelectedTab] = useState<string>("")
  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [resumeText, setResumeText] = useState("")
  const [aiRefineHistory, setAiRefineHistory] = useState<
    { resumeText: string; versionId: string | null }[]
  >([])
  const [strategicProfile, setStrategicProfile] = useState<StrategicProfile>(() =>
    typeof window !== "undefined" ? loadStrategicProfile() : {},
  )
  const [qualificationProfile, setQualificationProfile] = useState<QualificationProfile>(() =>
    typeof window !== "undefined" ? loadQualificationProfile() : {},
  )

  useEffect(() => {
    const syncQualificationProfile = () => {
      setQualificationProfile(loadQualificationProfile())
    }
    window.addEventListener(QUALIFICATION_PROFILE_UPDATED_EVENT, syncQualificationProfile)
    return () => {
      window.removeEventListener(QUALIFICATION_PROFILE_UPDATED_EVENT, syncQualificationProfile)
    }
  }, [])
  const [profileImage, setProfileImage] = useState<string | null>("/images/profile-photo.png")
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false)
  const [backConfirmSaving, setBackConfirmSaving] = useState(false)
  const [backConfirmSaveError, setBackConfirmSaveError] = useState<string | null>(null)
  const [accentColor, setAccentColor] = useState<string>("oklch(74% 0.10 81)")
  const [accentColorHex, setAccentColorHex] = useState<string | null>(null)
  const [targetBoxBgColor, setTargetBoxBgColor] = useState<string>("#f8f9fa")
  const [targetBoxBorderColor, setTargetBoxBorderColor] = useState<string>("")
  const [profilePhotoBorder, setProfilePhotoBorder] = useState<boolean>(true)
  const previewRef = useRef<HTMLDivElement>(null)
  const pendingJobDescriptionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const draftResumeIdRef = useRef<string | null>(null)
  const activeResumeIdRef = useRef<string | null>(null)
  const selectedJobIdRef = useRef<string | null>(null)
  const pendingNavigationRef = useRef<PendingNavigation | null>(null)
  const skipNextHistoryPushRef = useRef(false)
  const appHistoryReadyRef = useRef(false)
  const previousHistoryViewRef = useRef<AppView | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  hasUnsavedChangesRef.current = hasUnsavedChanges

  const defaultContactInfo = defaultResumeContactInfo()
  const [contactInfo, setContactInfo] = useState<ContactInfo>(defaultContactInfo)

  const folderContactFallback = useMemo(() => {
    const folder = folders.find((f) => f.id === currentFolderId)
    return folder?.contactInfo ?? null
  }, [folders, currentFolderId])

  const previewContactInfo = useMemo(
    () => normalizeContactInfo(contactInfo, folderContactFallback),
    [contactInfo, folderContactFallback],
  )

  const jobs = [] // Declare the jobs variable

  const [pendingApplicationName, setPendingApplicationName] = useState("")
  const [jobDescriptionDraft, setJobDescriptionDraft] = useState("")
  const [showApplicationWizard, setShowApplicationWizard] = useState(false)
  const [showStoryWizard, setShowStoryWizard] = useState(false)
  const [applicationWizardSessionKey, setApplicationWizardSessionKey] = useState("")
  const [applicationWizardRestoreDraft, setApplicationWizardRestoreDraft] = useState(false)
  const [applicationDraftPromptOpen, setApplicationDraftPromptOpen] = useState(false)
  const [mobileListRevision, setMobileListRevision] = useState(0)
  const resumeEmptyImportRef = useRef<HTMLInputElement>(null)
  const importAllInputRef = useRef<HTMLInputElement>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState({
    active: false,
    stage: WORKSPACE_LOAD_STAGES[0].label,
    progress: 0,
  })
  const [workspaceSync, setWorkspaceSync] = useState<{
    status: WorkspaceSyncUiStatus
    message: string | null
  }>({ status: "idle", message: null })
  const [resumeCloudSync, setResumeCloudSync] = useState<{
    status: ResumeCloudSyncUiStatus
    remoteError: string | null
  }>({ status: "idle", remoteError: null })
  const [isRetryingResumeSync, setIsRetryingResumeSync] = useState(false)
  const [formatterDocumentActions, setFormatterDocumentActions] =
    useState<React.ReactNode>(null)
  const formatterDocumentActionsRef = useRef<React.ReactNode>(null)
  const handleRegisterFormatterDocumentActions = useCallback(
    (actions: React.ReactNode) => {
      if (Object.is(formatterDocumentActionsRef.current, actions)) return
      formatterDocumentActionsRef.current = actions
      setFormatterDocumentActions(actions)
    },
    [],
  )

  useEffect(() => {
    setResumeCloudSync({ status: "idle", remoteError: null })
  }, [currentFolderId])

  useEffect(() => {
    let cancelled = false

    async function bootstrapAuth() {
      try {
        let user = getCvUser()

        if (!user) {
          user = await fetchCvUserFromSession()
          if (user) {
            setCvUser(user)
          }
        }

        if (!user) {
          router.replace("/login")
          return
        }

        if (cancelled) return

        setIsAuthenticated(true)
        setUserName(user.username)
        setIsResolvingWorkspace(true)

        try {
          if (!isSupabaseAuthBlocked()) {
            await ensureSupabaseAuthSession()
          }
        } catch (error) {
          console.warn("[auth] Supabase session bootstrap failed:", error)
        }

        const profile = loadUserProfile()
        if (profile?.name) setUserName(profile.name)
        if (profile?.email) setUserEmail(profile.email)

        const unlockedFoldersRaw = sessionStorage.getItem("unlocked_folder_ids")
        if (unlockedFoldersRaw) {
          try {
            const parsed = JSON.parse(unlockedFoldersRaw)
            if (Array.isArray(parsed)) {
              setUnlockedFolderIds(parsed.filter((id): id is string => typeof id === "string"))
            }
          } catch {
            sessionStorage.removeItem("unlocked_folder_ids")
          }
        }
      } catch (error) {
        console.error("[auth] Bootstrap failed:", error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void bootstrapAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => {
      console.warn("[auth] Bootstrap timed out after 12s — showing sign-in or workspace")
      setIsLoading(false)
    }, 12_000)
    return () => clearTimeout(timer)
  }, [isLoading])

  // Ref to track last refresh time for debouncing
  const lastRefreshRef = React.useRef<number>(0)
  const isOperationInProgressRef = React.useRef<boolean>(false)
  const foldersAutoRetriedRef = React.useRef(false)
  const defaultWorkspaceBootstrapRef = React.useRef(false)
  const folderRecoveryAttemptedRef = React.useRef(false)
  const [isResolvingWorkspace, setIsResolvingWorkspace] = useState(false)
  const [workspaceBootstrapFailed, setWorkspaceBootstrapFailed] = useState(false)
  const foldersLoadInFlightRef = React.useRef<Promise<void> | null>(null)
  const workspaceSyncInFlightRef = React.useRef(false)
  const workspaceSyncHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const stableJobApplicationsRef = React.useRef<JobApplication[]>([])
  const lastFocusSyncAtRef = React.useRef(0)
  const syncWorkspaceRef = React.useRef<
    (options?: { force?: boolean; persistChanges?: boolean }) => Promise<void>
  >(async () => {})
  const workspaceBootstrapKeyRef = React.useRef<string | null>(null)
  const userWorkspaceOpenedRef = React.useRef(false)
  const applicationFlowCompleteInFlightRef = React.useRef<string | null>(null)

  const clearWorkspaceSyncHideTimer = useCallback(() => {
    if (workspaceSyncHideTimerRef.current) {
      clearTimeout(workspaceSyncHideTimerRef.current)
      workspaceSyncHideTimerRef.current = null
    }
  }, [])

  const setWorkspaceSyncUi = useCallback(
    (
      next: { status: WorkspaceSyncUiStatus; message?: string | null },
      options?: { autoHideSyncedMs?: number },
    ) => {
      clearWorkspaceSyncHideTimer()
      setWorkspaceSync({
        status: next.status,
        message: next.message ?? null,
      })
      if (next.status === "synced") {
        workspaceSyncHideTimerRef.current = setTimeout(() => {
          setWorkspaceSync({ status: "idle", message: null })
          workspaceSyncHideTimerRef.current = null
        }, options?.autoHideSyncedMs ?? 2500)
      }
    },
    [clearWorkspaceSyncHideTimer],
  )
  const scaleCvRef = useRef<(() => void) | null>(null)
  const scheduleScaleCv = useCallback(() => {
    setTimeout(() => scaleCvRef.current?.(), 220)
  }, [])

  const loadFoldersFromDatabase = (): Promise<void> => {
    if (foldersLoadInFlightRef.current) {
      return foldersLoadInFlightRef.current
    }

    const cached = readFoldersCache()
    if (cached.length > 0) {
      setFolders(cached)
    }

    setFoldersLoading(cached.length === 0)
    setFoldersLoadError(null)

    foldersLoadInFlightRef.current = (async () => {
      try {
        const loadedFolders = await foldersStorage.list()
        setFolders(loadedFolders)
        writeFoldersCache(loadedFolders)
        setFoldersLoadError(null)
        foldersAutoRetriedRef.current = false
        lastRefreshRef.current = Date.now()
      } catch (e) {
        console.error("[v0] Failed to load folders:", e)
        if (cached.length === 0) {
          setFoldersLoadError(
            shouldUseLocalFallback()
              ? "Working offline — create a workspace to get started. Data stays in this browser."
              : "Could not load workspaces. Supabase may be down — try again or use local mode.",
          )
        } else {
          setFoldersLoadError("Showing saved workspaces — could not refresh from the server.")
        }
      } finally {
        setFoldersLoading(false)
        foldersLoadInFlightRef.current = null
      }
    })()

    return foldersLoadInFlightRef.current
  }

  const applyLoadedWorkspaceVersions = useCallback(
    (loaded: ResumeVersion[]) => {
      const normalized = loaded.map(normalizeResumeVersion)
      const activeId = activeResumeIdRef.current
      let resolvedVersions = normalized
      setVersions((prev) => {
        let next = normalized
        if (activeId && !next.some((v) => v.id === activeId)) {
          const kept = prev.find((v) => v.id === activeId)
          if (kept) next = [kept, ...next]
        }
        resolvedVersions = next
        return next
      })
      if (activeId) {
        const idx = resolvedVersions.findIndex((v) => v.id === activeId)
        setCurrentVersionIndex((prevIndex) => (idx >= 0 ? idx : prevIndex))
        setCurrentResumeId(activeId)
      }
    },
    [],
  )

  const hydrateWorkspaceFromLocalCache = useCallback(
    (folderId: string) => {
      const snapshot = loadWorkspaceFromLocalCache(folderId)
      applyLoadedWorkspaceVersions(snapshot.versions)
      setJobApplications(snapshot.applications)
      stableJobApplicationsRef.current = snapshot.applications
      setCoverLetters(snapshot.coverLetters)
      if (hasWorkspaceLocalContent(snapshot)) {
        setWorkspaceLoading((prev) => ({ ...prev, active: false }))
      }
      return snapshot
    },
    [applyLoadedWorkspaceVersions],
  )

  const reportWorkspaceLoadStage = useCallback((stageIndex: number) => {
    const stage = WORKSPACE_LOAD_STAGES[stageIndex]
    if (!stage) return
    setWorkspaceLoading((prev) => ({
      ...prev,
      stage: stage.label,
      progress: stage.progress,
    }))
  }, [])

  const dedupeAndRemoveStaleApplications = useCallback(
    async (
      apps: JobApplication[],
      resumeVersions: ResumeVersion[],
      folderId: string,
      source: "sync" | "persist",
    ): Promise<JobApplication[]> => {
      const { applications: deduped, removedApplications } = mergeAllDuplicateApplications(
        apps,
        resumeVersions,
        folderId,
      )
      if (removedApplications.length === 0) return apps

      // Never delete cloud rows during background sync — only when the user edits the list.
      if (source === "sync") {
        return deduped
      }

      for (const job of removedApplications) {
        const deleteResult = await deleteJobApplicationById(job.id, {
          folderId,
          resumeVersionId: job.resumeVersionId,
          company: job.company,
          jobTitle: job.jobTitle,
        })
        if (deleteResult.success) {
          tombstoneApplicationDeletion(folderId, job, resumeVersions)
        }
      }

      console.info("[applications] Auto-merged duplicate applications", {
        source,
        folder_id: folderId,
        removed_count: removedApplications.length,
        removed_ids: removedApplications.map((job) => job.id),
      })

      return deduped
    },
    [],
  )

  const syncWorkspaceFromDatabase = useCallback(
    async (options: { force?: boolean; persistChanges?: boolean } = {}) => {
      const { force = false, persistChanges = false } = options
      const now = Date.now()
      if (
        !force &&
        (now - lastRefreshRef.current < 2000 ||
          isOperationInProgressRef.current ||
          workspaceSyncInFlightRef.current)
      ) {
        return
      }

      const folderId = currentFolderId
      if (!folderId) {
        await loadFoldersFromDatabase()
        setWorkspaceLoading((prev) => ({ ...prev, active: false }))
        return
      }

      await refreshSupabaseReachability()

      workspaceSyncInFlightRef.current = true
      const localSnapshot = loadWorkspaceFromLocalCache(folderId)
      const hasLocal = hasWorkspaceLocalContent(localSnapshot)

      if (hasLocal) {
        applyLoadedWorkspaceVersions(localSnapshot.versions)
        if (stableJobApplicationsRef.current.length === 0) {
          setJobApplications(localSnapshot.applications)
          stableJobApplicationsRef.current = localSnapshot.applications
        }
        setCoverLetters(localSnapshot.coverLetters)
        setWorkspaceLoading((prev) => ({ ...prev, active: false }))
      } else {
        setWorkspaceLoading({
          active: true,
          stage: WORKSPACE_LOAD_STAGES[0].label,
          progress: WORKSPACE_LOAD_STAGES[0].progress,
        })
      }

      const localOnly = shouldUseLocalFallback()

      if (localOnly) {
        if (hasLocal) {
          setWorkspaceSyncUi({
            status: "loaded_local",
            message: "Loaded from this device",
          })
        }
      } else if (hasLocal) {
        setWorkspaceSyncUi({ status: "loaded_local" })
      } else {
        setWorkspaceSyncUi({ status: "loading" })
      }

      let anyTimedOut = false
      let applicationsLoadTimedOut = false
      let applicationsFromSync: JobApplication[] | null = null

      try {
        if (!localOnly && !hasLocal) {
          setWorkspaceSyncUi({ status: "syncing" })
        }

        reportWorkspaceLoadStage(0)
        const cvUser = getCvUser()
        const workspaceSlug = cvUser ? getWorkspaceSlugForUser(cvUser) : null
        const applicationsResult = await loadWithTimeoutAndRetry(
          () => loadWorkspaceJobApplications(folderId, folders, workspaceSlug),
          localSnapshot.applications,
          WORKSPACE_DB_TIMEOUT_MS,
        )
        anyTimedOut = anyTimedOut || applicationsResult.timedOut
        applicationsLoadTimedOut = applicationsResult.timedOut

        const deletedApplicationIds = getDeletedApplicationIdsForFolder(folderId)
        const loadedApplicationsPreMerge = applicationsResult.value.filter(
          (app) => !deletedApplicationIds.has(app.id),
        )

        reportWorkspaceLoadStage(1)
        const versionsResult = await loadWithTimeoutAndRetry(
          () => loadResumesForWorkspace(folderId, loadedApplicationsPreMerge),
          localSnapshot.versions,
          WORKSPACE_DB_TIMEOUT_MS,
        )
        anyTimedOut = anyTimedOut || versionsResult.timedOut

        reportWorkspaceLoadStage(2)
        const normalizedVersions = versionsResult.value.map(normalizeResumeVersion)
        const lettersResult = await loadWithTimeoutAndRetry(
          () =>
            loadCoverLettersForWorkspace(
              folderId,
              loadedApplicationsPreMerge,
              normalizedVersions,
            ),
          localSnapshot.coverLetters,
          WORKSPACE_DB_TIMEOUT_MS,
        )
        anyTimedOut = anyTimedOut || lettersResult.timedOut

        let merged = mergeLegacyCoverLettersIntoResumes(normalizedVersions, lettersResult.value)

        const loadedApplications = inferCoverLetterIdsFromPatterns(
          loadedApplicationsPreMerge,
          lettersResult.value,
          merged,
        )

        const { applications: reconciledApplications, newApplicationCount } =
          reconcileWorkspaceApplications(merged, loadedApplications, folderId)

        const enrichedApplications = finalizeWorkspaceApplications(
          reconciledApplications,
          merged,
        )

        const migration = migrateDuplicateResumes(merged, enrichedApplications)
        const finalApplications = migration.changed
          ? migration.applications
          : enrichedApplications
        const applicationsDirty = haveJobApplicationsChanged(
          loadedApplications,
          finalApplications,
        )
        const canAutoPersistApplications =
          persistChanges &&
          viewRef.current === "dashboard" &&
          applicationsDirty

        reportWorkspaceLoadStage(3)

        if (migration.changed) {
          merged = migration.versions
          if (persistChanges) {
            try {
              const bulkResult = await saveResumeVersions(merged, folderId)
              if (!bulkResult.remoteSynced) {
                console.warn(
                  "[resume] Duplicate migration saved locally only:",
                  bulkResult.remoteError,
                )
                toast({
                  title: "⚠ Resumes saved locally only",
                  description:
                    bulkResult.remoteError ?? "Cloud sync did not complete during cleanup.",
                })
              }
              if (
                canAutoPersistApplications &&
                haveJobApplicationsChanged(applicationsResult.value, migration.applications)
              ) {
                await saveJobApplications(migration.applications, folderId)
              }
            } catch (e) {
              console.warn("[resume] Duplicate migration save failed:", e)
            }
            if (migration.message) {
              toast({ title: "Resume data cleaned up", description: migration.message })
            }
          }
        }

        applyLoadedWorkspaceVersions(merged)

        const preparedApplications = prepareJobApplicationsForWorkspace(finalApplications)
        const dedupedApplications = await dedupeAndRemoveStaleApplications(
          preparedApplications,
          merged,
          folderId,
          "sync",
        )
        const linkRepair = repairApplicationResumeLinks(dedupedApplications, merged, folderId)
        let syncedVersions = merged
        let syncedApplications = assignApplicationsToWorkspaceFolder(
          linkRepair.changed ? linkRepair.applications : dedupedApplications,
          folderId,
        )
        if (linkRepair.changed) {
          syncedVersions = linkRepair.versions
          applyLoadedWorkspaceVersions(syncedVersions)
        }
        if (!localOnly && !versionsResult.timedOut) {
          cacheResumeVersionsFromCloud(syncedVersions)
        }
        const idsNormalized = haveJobApplicationsChanged(finalApplications, syncedApplications)

        if (applicationsDirty || idsNormalized || linkRepair.changed) {
          cacheJobApplicationsLocally(syncedApplications, folderId)
        }

        if (canAutoPersistApplications && newApplicationCount > 0) {
          await saveJobApplications(syncedApplications, folderId)
          toast({
            title: `${newApplicationCount} application${newApplicationCount === 1 ? "" : "s"} restored`,
            description:
              "Role-specific CVs are now tracked as job applications with status and interview history.",
          })
        } else if (
          persistChanges &&
          (idsNormalized ||
            linkRepair.changed ||
            haveJobApplicationsChanged(preparedApplications, syncedApplications))
        ) {
          await saveJobApplications(syncedApplications, folderId)
        }

        if (linkRepair.changed && persistChanges) {
          const repairedResumeIds = new Set(
            syncedVersions
              .filter((version) => {
                const before = merged.find((entry) => entry.id === version.id)
                return before?.applicationId !== version.applicationId
              })
              .map((version) => version.id),
          )
          if (repairedResumeIds.size > 0) {
            try {
              const bulkResult = await saveResumeVersions(
                syncedVersions.filter((version) => repairedResumeIds.has(version.id)),
                folderId,
              )
              if (!bulkResult.remoteSynced) {
                console.warn(
                  "[resume] Repaired application links saved locally only:",
                  bulkResult.remoteError,
                )
              }
            } catch (error) {
              console.warn("[resume] Failed to persist repaired application links:", error)
            }
          }
        }

        const appsMeta = getLastJobApplicationsLoadMeta()
        const remoteFailed = appsMeta.authFailure || appsMeta.offline
        const stableApplications = pickStableJobApplications(syncedApplications, {
          previous: stableJobApplicationsRef.current,
          localFallback: localSnapshot.applications,
          remoteFailed,
          folderId,
        })

        if (
          linkRepair.changed ||
          !shouldSkipApplicationsUiUpdate(stableJobApplicationsRef.current, stableApplications)
        ) {
          setJobApplications(stableApplications)
          stableJobApplicationsRef.current = stableApplications
        }
        applicationsFromSync = stableApplications
        setCoverLetters(lettersResult.value)
        lastRefreshRef.current = Date.now()

        if (localOnly) {
          setWorkspaceSyncUi({ status: "idle" })
        } else if (anyTimedOut) {
          setWorkspaceSyncUi({
            status: "unavailable",
            message: `${SUPABASE_CONNECTION_FAILED_BANNER} Cloud sync was slow — showing your saved copy.`,
          })
        } else if (appsMeta.authFailure || (appsMeta.cloudCount === 0 && appsMeta.totalCount > 0)) {
          const detail =
            appsMeta.hint && !appsMeta.hint.includes(SUPABASE_CONNECTION_FAILED_BANNER)
              ? ` ${appsMeta.hint}`
              : ""
          setWorkspaceSyncUi({
            status: "unavailable",
            message: `${SUPABASE_CONNECTION_FAILED_BANNER}${detail}`,
          })
        } else {
          setWorkspaceSyncUi({ status: "synced" })
        }
      } catch (e) {
        console.error("[v0] Failed to refresh workspace data:", e)
        const hydrated = hydrateWorkspaceFromLocalCache(folderId)
        if (hasWorkspaceLocalContent(hydrated)) {
          setWorkspaceSyncUi({
            status: "unavailable",
            message: SUPABASE_CONNECTION_FAILED_BANNER,
          })
        } else {
          setWorkspaceSyncUi({
            status: "unavailable",
            message: `${SUPABASE_CONNECTION_FAILED_BANNER} Could not load your workspace. Check your connection and try again.`,
          })
        }
      } finally {
        workspaceSyncInFlightRef.current = false
        setWorkspaceLoading((prev) => ({ ...prev, active: false, progress: 100 }))

        if (
          applicationsLoadTimedOut &&
          !shouldUseLocalFallback() &&
          folderId &&
          !localOnly &&
          !getLastJobApplicationsLoadMeta().authFailure &&
          !isSupabaseAuthBlocked()
        ) {
          void (async () => {
            try {
              const retryUser = getCvUser()
              const remoteApps = assignApplicationsToWorkspaceFolder(
                await loadWorkspaceJobApplications(
                  folderId,
                  folders,
                  retryUser ? getWorkspaceSlugForUser(retryUser) : null,
                ),
                folderId,
              )
              if (remoteApps.length === 0) return
              const deletedIds = getDeletedApplicationIdsForFolder(folderId)
              const filtered = remoteApps.filter((app) => !deletedIds.has(app.id))
              if (
                filtered.length > (applicationsFromSync?.length ?? 0) &&
                !shouldSkipApplicationsUiUpdate(
                  stableJobApplicationsRef.current,
                  filtered,
                )
              ) {
                setJobApplications(filtered)
                stableJobApplicationsRef.current = filtered
                cacheJobApplicationsLocally(filtered, folderId)
                setWorkspaceSyncUi({ status: "synced" })
                if (process.env.NODE_ENV === "development") {
                  console.info(
                    `[workspace] Background sync recovered ${filtered.length} application(s) from cloud`,
                  )
                }
              }
            } catch (error) {
              if (process.env.NODE_ENV === "development") {
                console.warn("[workspace] Background application sync retry failed:", error)
              }
            }
          })()
        }
      }
    },
    [
      currentFolderId,
      applyLoadedWorkspaceVersions,
      hydrateWorkspaceFromLocalCache,
      reportWorkspaceLoadStage,
      setWorkspaceSyncUi,
      dedupeAndRemoveStaleApplications,
      folders,
    ],
  )

  syncWorkspaceRef.current = syncWorkspaceFromDatabase

  const refreshDataFromDatabase = useCallback(
    (force = false) => syncWorkspaceFromDatabase({ force, persistChanges: force }),
    [syncWorkspaceFromDatabase],
  )

  useEffect(() => {
    if (!isAuthenticated) return

    const bootstrapKey = `${currentFolderId ?? "no-folder"}`
    const shouldBootstrap = workspaceBootstrapKeyRef.current !== bootstrapKey
    workspaceBootstrapKeyRef.current = bootstrapKey

    const runBackgroundSync = (options?: { force?: boolean; persistChanges?: boolean }) => {
      if (isSupabaseAuthBlocked() && !options?.force) return
      void syncWorkspaceRef.current(options)
    }

    if (currentFolderId) {
      if (shouldBootstrap) {
        const snapshot = hydrateWorkspaceFromLocalCache(currentFolderId)
        if (hasWorkspaceLocalContent(snapshot)) {
          const { applications: dedupedApplications } = mergeAllDuplicateApplications(
            snapshot.applications,
            snapshot.versions,
            currentFolderId,
          )
          setJobApplications(dedupedApplications)
          stableJobApplicationsRef.current = dedupedApplications
          setWorkspaceSyncUi(
            shouldUseLocalFallback()
              ? { status: "loaded_local", message: "Loaded from this device" }
              : { status: "loaded_local" },
          )
        }
        runBackgroundSync({ force: true, persistChanges: false })
      }
    } else {
      void loadFoldersFromDatabase()
    }

    const maybeSyncOnFocus = () => {
      const now = Date.now()
      if (now - lastFocusSyncAtRef.current < 30_000) return
      if (isOperationInProgressRef.current || workspaceSyncInFlightRef.current) return
      if (isSupabaseAuthBlocked()) return
      lastFocusSyncAtRef.current = now
      runBackgroundSync({ persistChanges: false })
    }

    const handleFocus = () => {
      setTimeout(maybeSyncOnFocus, 500)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setTimeout(maybeSyncOnFocus, 500)
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [currentFolderId, isAuthenticated, hydrateWorkspaceFromLocalCache, setWorkspaceSyncUi])

  useEffect(() => {
    if (!workspaceLoading.active) return
    const timer = setTimeout(() => {
      console.warn("[workspace] Loading timed out — showing cached workspace data")
      if (currentFolderId) {
        hydrateWorkspaceFromLocalCache(currentFolderId)
      }
      setWorkspaceLoading((prev) => ({ ...prev, active: false }))
      setWorkspaceSyncUi({
        status: "unavailable",
        message: "Sync is taking longer than expected. Showing data saved on this device.",
      })
    }, 15_000)
    return () => clearTimeout(timer)
  }, [
    workspaceLoading.active,
    currentFolderId,
    hydrateWorkspaceFromLocalCache,
    setWorkspaceSyncUi,
  ])

  useEffect(() => () => clearWorkspaceSyncHideTimer(), [clearWorkspaceSyncHideTimer])

  // Re-hydrate header fields when versions refresh from storage (e.g. focus/reload).
  useEffect(() => {
    if (view !== "resume") return
    const version = currentResumeId
      ? versions.find((v) => v.id === currentResumeId)
      : currentVersionIndex !== null
        ? versions[currentVersionIndex]
        : undefined
    if (!version) return
    const fromStorage = normalizeContactInfo(version.contactInfo, folderContactFallback)
    setContactInfo((prev) => {
      const prevNorm = normalizeContactInfo(prev, folderContactFallback)
      if (!hasResumeContactContent(prevNorm) && hasResumeContactContent(fromStorage)) {
        return fromStorage
      }
      const prevPortfolios = normalizePortfolioUrls(
        prevNorm.portfolios,
        prevNorm.portfolio,
      )
      const storedPortfolios = normalizePortfolioUrls(
        fromStorage.portfolios,
        fromStorage.portfolio,
      )
      if (
        storedPortfolios.length > 0 &&
        (storedPortfolios.length > prevPortfolios.length ||
          JSON.stringify(prevPortfolios) !== JSON.stringify(storedPortfolios))
      ) {
        return fromStorage
      }
      if (
        !prevNorm.name.trim() &&
        fromStorage.name.trim() &&
        JSON.stringify(prevNorm) !== JSON.stringify(fromStorage)
      ) {
        return fromStorage
      }
      return prevNorm
    })
  }, [versions, currentVersionIndex, currentResumeId, view, folderContactFallback])

  // New draft resume: fill contact when folder list hydrates or versions load.
  useEffect(() => {
    if (view !== "resume" || currentVersionIndex !== null || !currentFolderId) return
    const folder = folders.find((f) => f.id === currentFolderId)
    const defaults = getWorkspaceContactDefaults(folder?.contactInfo, versions)
    setContactInfo((prev) => {
      const prevNorm = normalizeContactInfo(prev, folder?.contactInfo)
      if (hasResumeContactContent(prevNorm)) return prevNorm
      return defaults
    })
  }, [view, currentVersionIndex, currentFolderId, folders, versions])

  // One automatic retry when the initial workspace list fails (common on cold start)
  useEffect(() => {
    if (!isAuthenticated || currentFolderId || !foldersLoadError || foldersAutoRetriedRef.current) return
    foldersAutoRetriedRef.current = true
    const timer = setTimeout(() => {
      void refreshDataFromDatabase(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [foldersLoadError, isAuthenticated, currentFolderId])

  const handleSaveProfile = (name: string, email: string, password: string) => {
    const existing = loadUserProfile() ?? { name: "", email: "" }
    patchUserProfile({
      ...existing,
      name,
      email,
      ...(password ? { password } : existing.password ? { password: existing.password } : {}),
    })
    setUserName(name)
    setUserEmail(email)
  }

  const exportAllData = () => {
    const profile = loadUserProfile() ?? undefined

    const exportData = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      resumeVersions: versions,
      jobApplications: jobApplications,
      coverLetters: coverLetters,
      profile: profile,
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `job-search-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const applyImportedBackupData = async (importData: unknown) => {
    if (!importData || typeof importData !== "object") {
      throw new Error("Invalid file format")
    }

    const data = importData as Record<string, unknown>
    let importedVersions = 0
    let importedJobs = 0
    let importedLetters = 0

    if (data.version === "2.0") {
      if (Array.isArray(data.resumeVersions)) {
        setVersions(data.resumeVersions as ResumeVersion[])
        await saveResumeVersions(data.resumeVersions as ResumeVersion[], currentFolderId || undefined)
        importedVersions = data.resumeVersions.length
      }
      if (Array.isArray(data.jobApplications)) {
        setJobApplications(data.jobApplications as JobApplication[])
        await saveJobApplications(data.jobApplications as JobApplication[])
        importedJobs = data.jobApplications.length
      }
      if (Array.isArray(data.coverLetters)) {
        setCoverLetters(data.coverLetters as CoverLetter[])
        await saveCoverLetters(data.coverLetters as CoverLetter[])
        importedLetters = data.coverLetters.length
      }
      if (data.profile && typeof data.profile === "object") {
        localStorage.setItem("profile", JSON.stringify(data.profile))
        const profile = data.profile as { name?: string; email?: string }
        setUserName(profile.name || "")
        setUserEmail(profile.email || "")
      }
    } else if (Array.isArray(data.versions) || Array.isArray(data.jobApplications)) {
      if (Array.isArray(data.versions)) {
        setVersions(data.versions as ResumeVersion[])
        await saveResumeVersions(data.versions as ResumeVersion[], currentFolderId || undefined)
        importedVersions = data.versions.length
      }
      if (Array.isArray(data.jobApplications)) {
        setJobApplications(data.jobApplications as JobApplication[])
        await saveJobApplications(data.jobApplications as JobApplication[])
        importedJobs = data.jobApplications.length
      }
    } else if (Array.isArray(importData)) {
      setVersions(importData as ResumeVersion[])
      await saveResumeVersions(importData as ResumeVersion[], currentFolderId || undefined)
      importedVersions = importData.length
    } else {
      throw new Error("Invalid file format")
    }

    toast({
      title: "Import complete",
      description: `Imported ${importedVersions} resume version(s), ${importedJobs} job application(s), and ${importedLetters} cover letter(s).`,
    })
  }

  const importAllData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string)
        await applyImportedBackupData(importData)
      } catch (error) {
        console.error("[v0] Import error:", error)
        toast({
          title: "Import failed",
          description: "Could not read that file. Check the format and try again.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  // Handle creating a new resume - check for pending content from wizard
  // Also apply folder defaults (contact info and profile image) if available
  const handleCreateNew = () => {
    const pendingContent = sessionStorage.getItem("pendingResumeContent")
    const pendingName = sessionStorage.getItem("pendingApplicationName")
    
    setAiRefineHistory([])
    if (pendingContent) {
      setResumeText(pendingContent)
      sessionStorage.removeItem("pendingResumeContent")
    } else {
      setResumeText("")
    }
    
    // Set the pending application name in state for the Save Version dialog default
    if (pendingName) {
      setPendingApplicationName(pendingName)
      sessionStorage.removeItem("pendingApplicationName")
    } else {
      setPendingApplicationName("")
    }
    
    // Apply folder defaults for contact info and profile image if available
    const currentFolder = folders.find((f) => f.id === currentFolderId)
    
    if (currentFolder) {
      // Apply folder's default profile image
      if (currentFolder.profileImage) {
        setProfileImage(currentFolder.profileImage)
      } else {
        setProfileImage(null)
      }
      
      applyWorkspaceContactDefaults(currentFolder, { force: true })
    } else {
      setProfileImage(null)
      setContactInfo(getWorkspaceContactDefaults(null, versions))
    }
    
    draftResumeIdRef.current = createNewResumeId()
    setJobDescriptionDraft(
      typeof window !== "undefined" ? sessionStorage.getItem("pendingJobDescription") || "" : "",
    )
    setCurrentVersionIndex(null)
    setCurrentResumeId(null)
    activeResumeIdRef.current = null
    setHasUnsavedChanges(false)
    setView("resume")
  }

  const handleImportResume = () => {
    resumeEmptyImportRef.current?.click()
  }

  const handleOpenExistingResume = () => {
    if (versions.length > 0) {
      const sorted = [...versions].sort(
        (a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0),
      )
      loadVersion(sorted[0]!)
      return
    }
    handleImportResume()
  }

  const handleImportResumeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string)

        if (imported.version === "2.0") {
          void importAllData(event)
          return
        }

        if (imported.versions || imported.jobApplications) {
          let importedCount = 0
          if (imported.versions && Array.isArray(imported.versions)) {
            importedCount += imported.versions.length
          }
          if (imported.jobApplications && Array.isArray(imported.jobApplications)) {
            importedCount += imported.jobApplications.length
          }

          if (importedCount > 0) {
            if (imported.versions && Array.isArray(imported.versions)) {
              setVersions(imported.versions)
              void saveResumeVersions(imported.versions, currentFolderId || undefined)
              if (imported.versions.length > 0) {
                loadVersion(imported.versions[0])
              }
            }
            if (imported.jobApplications && Array.isArray(imported.jobApplications)) {
              setJobApplications(imported.jobApplications)
              void saveJobApplications(imported.jobApplications)
            }
            const versionCount = imported.versions?.length || 0
            const jobCount = imported.jobApplications?.length || 0
            alert(
              `Successfully imported ${versionCount} resume version(s) and ${jobCount} job application(s)`,
            )
          } else {
            alert("No data found in file")
          }
        } else if (Array.isArray(imported) && imported.length > 0) {
          setVersions(imported)
          void saveResumeVersions(imported, currentFolderId || undefined)
          loadVersion(imported[0])
          alert(`Successfully imported ${imported.length} version(s)`)
        } else {
          alert("Invalid file format")
        }
      } catch (error) {
        alert("Failed to import data. Please check the file format.")
        console.error("[v0] Import error:", error)
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const openFreshApplicationWizard = useCallback(() => {
    const sessionId = startFreshApplicationFlowDraft()
    setApplicationWizardSessionKey(sessionId)
    setApplicationWizardRestoreDraft(false)
    setApplicationDraftPromptOpen(false)
    setShowApplicationWizard(true)
  }, [])

  const openResumeApplicationWizard = useCallback(() => {
    const sessionId = loadApplicationFlowSessionId() ?? startFreshApplicationFlowDraft()
    setApplicationWizardSessionKey(sessionId)
    setApplicationWizardRestoreDraft(true)
    setApplicationDraftPromptOpen(false)
    setShowApplicationWizard(true)
  }, [])

  const openApplicationWizardForJob = useCallback(
    (jobId: string) => {
      const job = jobApplications.find((application) => application.id === jobId)
      if (!job) return
      if (!currentFolderId) {
        toast({
          title: "Workspace not ready",
          description: "Select a workspace before adding a CV.",
          variant: "destructive",
        })
        return
      }
      const sessionId = startApplicationFlowForJob(job)
      setApplicationWizardSessionKey(sessionId)
      setApplicationWizardRestoreDraft(false)
      setApplicationDraftPromptOpen(false)
      setShowApplicationWizard(true)
    },
    [jobApplications, currentFolderId],
  )

  const handleCreateApplication = () => {
    if (!currentFolderId) {
      toast({
        title: "Workspace not ready",
        description: "Select a workspace before creating an application.",
        variant: "destructive",
      })
      return
    }
    if (hasRecoverableApplicationFlowDraft()) {
      setApplicationDraftPromptOpen(true)
      return
    }
    openFreshApplicationWizard()
  }

  const handleUndoResumeEdit = useCallback(
    (previousVersionId: string | null, previousResumeText: string) => {
      if (previousVersionId) {
        const previous = versions.find((v) => v.id === previousVersionId)
        if (previous) {
          loadVersion(previous)
          setAiRefineHistory((stack) => stack.slice(0, -1))
          toast({
            title: "Reverted to previous version",
            description: previous.name,
          })
          return
        }
      }
      setResumeText(previousResumeText)
      setHasUnsavedChanges(true)
      setAiRefineHistory((stack) => stack.slice(0, -1))
      toast({ title: "Reverted CV changes" })
    },
    [versions],
  )

  const handleAiRefineRestore = useCallback(() => {
    setAiRefineHistory((stack) => {
      if (stack.length === 0) return stack
      const previous = stack[stack.length - 1]!
      if (previous.versionId) {
        const version = versions.find((v) => v.id === previous.versionId)
        if (version) loadVersion(version)
      } else {
        setResumeText(previous.resumeText)
        setHasUnsavedChanges(true)
      }
      return stack.slice(0, -1)
    })
  }, [versions])

  const resumeOutputLanguage = useMemo((): "en" | "de" => {
    if (typeof window === "undefined") return "en"
    const lang = sessionStorage.getItem("cvLanguage")
    return lang === "de" ? "de" : "en"
  }, [view, resumeText])

  const loadVersion = (version: ResumeVersion, linkedJobDescriptionUrl?: string) => {
    console.log("[application] Opening Resume Formatter", {
      resumeId: version.id,
      name: version.name,
    })
    setAiRefineHistory([])
    draftResumeIdRef.current = null
    setCoverLetterResumeId(null)
    const normalized = normalizeResumeVersion(version)
    setCurrentResumeId(normalized.id)
    activeResumeIdRef.current = normalized.id
    const index = versions.findIndex((v) => v.id === normalized.id)
    setCurrentVersionIndex(index >= 0 ? index : null)
    setResumeText(normalized.resumeText)
    const linkedJob =
      linkedJobDescriptionUrl !== undefined
        ? null
        : jobApplications.find(
            (job) =>
              job.resumeVersionId === normalized.id ||
              (normalized.applicationId && job.id === normalized.applicationId),
          )
    const jobUrl = linkedJobDescriptionUrl ?? linkedJob?.jobDescriptionUrl
    setContactInfo(
      withJobAdvertFromApplication(
        normalizeContactInfo(normalized.contactInfo, folderContactFallback),
        jobUrl,
      ),
    )
    setProfileImage(normalized.profileImage)
    setCompanyLogo(normalized.companyLogo)
    setAccentColor(normalized.accentColor ?? "oklch(74% 0.10 81)")
    setAccentColorHex(normalized.accentColorHex ?? null)
    setTargetBoxBgColor(normalized.targetBoxBgColor || "#f8f9fa")
    setTargetBoxBorderColor(normalized.targetBoxBorderColor || "")
    setProfilePhotoBorder(normalized.profilePhotoBorder !== false)
    setJobDescriptionDraft(normalized.jobDescription || "")
    setView("resume")
  }

  const openApplicationResume = useCallback(
    (jobId: string) => {
      const job = jobApplications.find((application) => application.id === jobId)
      if (!job) return
      const version = resolveResumeForJob(job, versions)
      if (!version) return
      setSelectedJobId(jobId)
      loadVersion(version, job.jobDescriptionUrl)
    },
    [jobApplications, versions],
  )

  const openResumeWorkspace = useCallback(() => {
    if (resumeText.trim() || draftResumeIdRef.current) {
      setView("resume")
      return
    }

    if (currentResumeId) {
      const byId = versions.find((v) => v.id === currentResumeId)
      if (byId) {
        setView("resume")
        return
      }
    }

    if (currentVersionIndex !== null && versions[currentVersionIndex]) {
      setView("resume")
      return
    }

    const pinnedId = activeResumeIdRef.current
    if (pinnedId) {
      const found = versions.find((v) => v.id === pinnedId)
      if (found) {
        loadVersion(found)
        return
      }
    }

    if (versions.length > 0) {
      const sorted = [...versions].sort(
        (a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0),
      )
      loadVersion(sorted[0]!)
      return
    }

    setView("resume")
  }, [currentResumeId, currentVersionIndex, resumeText, versions])

  useEffect(() => {
    if (view !== "resume") return
    if (resumeText.trim() || draftResumeIdRef.current) return
    if (currentResumeId && versions.some((v) => v.id === currentResumeId)) return
    if (currentVersionIndex !== null && versions[currentVersionIndex]) return
    if (versions.length === 0) return

    const sorted = [...versions].sort(
      (a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0),
    )
    loadVersion(sorted[0]!)
  }, [view, currentResumeId, currentVersionIndex, versions, resumeText])

  const currentVersion = useMemo(() => {
    if (currentResumeId) {
      const byId = versions.find((v) => v.id === currentResumeId)
      if (byId) return byId
    }
    if (currentVersionIndex !== null) {
      const indexed = versions[currentVersionIndex]
      if (indexed) return indexed
    }
    const pinnedId = activeResumeIdRef.current
    if (pinnedId) {
      return versions.find((v) => v.id === pinnedId) ?? null
    }
    return null
  }, [versions, currentVersionIndex, currentResumeId])

  // Keep index + editor content aligned when the versions list is reordered or reloaded.
  useEffect(() => {
    if (!currentResumeId) return
    const version = versions.find((v) => v.id === currentResumeId)
    if (!version) return
    const idx = versions.findIndex((v) => v.id === currentResumeId)
    const atIndex =
      currentVersionIndex !== null ? versions[currentVersionIndex] : undefined
    if (atIndex?.id === currentResumeId) {
      if (idx >= 0 && currentVersionIndex !== idx) {
        setCurrentVersionIndex(idx)
      }
      return
    }
    setCurrentVersionIndex(idx >= 0 ? idx : null)
    if (view === "resume" && !hasUnsavedChangesRef.current) {
      setResumeText(version.resumeText)
      const linkedJob = jobApplications.find(
        (job) =>
          job.resumeVersionId === version.id ||
          (version.applicationId && job.id === version.applicationId) ||
          job.id === selectedJobIdRef.current,
      )
      setContactInfo(
        withJobAdvertFromApplication(
          normalizeContactInfo(version.contactInfo, folderContactFallback),
          linkedJob?.jobDescriptionUrl,
        ),
      )
      setProfileImage(version.profileImage)
      setCompanyLogo(version.companyLogo)
      setAccentColor(version.accentColor ?? "oklch(74% 0.10 81)")
      setAccentColorHex(version.accentColorHex ?? null)
      setTargetBoxBgColor(version.targetBoxBgColor || "#f8f9fa")
      setTargetBoxBorderColor(version.targetBoxBorderColor || "")
      setProfilePhotoBorder(version.profilePhotoBorder !== false)
      setJobDescriptionDraft(version.jobDescription || "")
    }
  }, [versions, currentResumeId, currentVersionIndex, view, folderContactFallback, jobApplications])

  useEffect(() => {
    if (currentResumeId) {
      const idx = versions.findIndex((v) => v.id === currentResumeId)
      if (idx >= 0) {
        if (currentVersionIndex !== idx) setCurrentVersionIndex(idx)
        return
      }
      setCurrentResumeId(null)
    }

    if (currentVersionIndex === null) return
    if (versions[currentVersionIndex]) return

    const pinnedId = activeResumeIdRef.current
    const byId = pinnedId ? versions.findIndex((v) => v.id === pinnedId) : -1
    if (byId >= 0) {
      setCurrentVersionIndex(byId)
      setCurrentResumeId(pinnedId)
      return
    }
    if (versions.length > 0) {
      const sorted = [...versions].sort(
        (a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0),
      )
      const idx = versions.findIndex((v) => v.id === sorted[0]!.id)
      setCurrentVersionIndex(idx >= 0 ? idx : 0)
      setCurrentResumeId(sorted[0]!.id)
      return
    }
    setCurrentVersionIndex(null)
    setCurrentResumeId(null)
  }, [versions, currentVersionIndex, currentResumeId])
  const activeJobDescription = useMemo(
    () =>
      currentVersion?.jobDescription ??
      jobDescriptionDraft ??
      (typeof window !== "undefined"
        ? sessionStorage.getItem("pendingJobDescription") || ""
        : ""),
    [currentVersion?.jobDescription, jobDescriptionDraft],
  )
  const activeResumeId = currentVersion?.id ?? draftResumeIdRef.current
  activeResumeIdRef.current = activeResumeId
  selectedJobIdRef.current = selectedJobId

  // Keep Resume Tools "Job advert source" filled from the linked application URL.
  useEffect(() => {
    if (!selectedJobId) return
    const job = jobApplications.find((application) => application.id === selectedJobId)
    const url = job?.jobDescriptionUrl?.trim()
    if (!url) return
    setContactInfo((prev) => withJobAdvertFromApplication(prev, url))
  }, [selectedJobId, jobApplications])

  const resumePersistRef = useRef({
    currentVersionIndex: null as number | null,
    currentResumeId: null as string | null,
    versions: [] as ResumeVersion[],
    resumeText,
    contactInfo,
    profileImage,
    companyLogo,
    accentColor,
    accentColorHex: accentColorHex ?? "",
    targetBoxBgColor,
    targetBoxBorderColor,
    profilePhotoBorder,
    jobDescription: "",
    pendingApplicationName: "",
    folderId: null as string | null,
  })
  resumePersistRef.current = {
    currentVersionIndex,
    currentResumeId: currentResumeId ?? draftResumeIdRef.current,
    versions,
    resumeText,
    contactInfo,
    profileImage,
    companyLogo,
    accentColor,
    accentColorHex: accentColorHex ?? "",
    targetBoxBgColor,
    targetBoxBorderColor,
    profilePhotoBorder,
    jobDescription: currentVersion?.jobDescription ?? jobDescriptionDraft,
    pendingApplicationName,
    folderId: currentFolderId,
  }

  const buildResumeSnapshot = (s: typeof resumePersistRef.current): ResumeVersion => {
    const now = Date.now()
    const pendingJd =
      s.jobDescription ||
      (typeof window !== "undefined" ? sessionStorage.getItem("pendingJobDescription") || "" : "")

    if (s.currentResumeId) {
      const existing = s.versions.find((v) => v.id === s.currentResumeId)
      if (existing) {
        return normalizeResumeVersion({
          ...existing,
          coverLetter: existing.coverLetter ?? null,
          resumeText: s.resumeText,
          contactInfo: normalizeContactInfo(s.contactInfo),
          profileImage: s.profileImage,
          companyLogo: s.companyLogo,
          accentColor: s.accentColor,
          accentColorHex: s.accentColorHex,
          targetBoxBgColor: s.targetBoxBgColor,
          targetBoxBorderColor: s.targetBoxBorderColor,
          profilePhotoBorder: s.profilePhotoBorder,
          jobDescription: pendingJd,
          updatedAt: now,
        })
      }
    }

    if (s.currentVersionIndex !== null && s.versions[s.currentVersionIndex]) {
      const existing = s.versions[s.currentVersionIndex]
      return normalizeResumeVersion({
        ...existing,
        coverLetter: existing.coverLetter ?? null,
        resumeText: s.resumeText,
        contactInfo: normalizeContactInfo(s.contactInfo),
        profileImage: s.profileImage,
        companyLogo: s.companyLogo,
        accentColor: s.accentColor,
        accentColorHex: s.accentColorHex,
        targetBoxBgColor: s.targetBoxBgColor,
        targetBoxBorderColor: s.targetBoxBorderColor,
        profilePhotoBorder: s.profilePhotoBorder,
        jobDescription: pendingJd,
        updatedAt: now,
      })
    }

    const id = ensureResumeId(draftResumeIdRef.current)
    draftResumeIdRef.current = id
    const draftName =
      s.pendingApplicationName.trim() ||
      defaultResumeTitle(s.contactInfo, s.pendingApplicationName)
    return normalizeResumeVersion({
      id,
      name: draftName,
      coverLetter: null,
      resumeText: s.resumeText,
      profileImage: s.profileImage,
      companyLogo: s.companyLogo,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      contactInfo: normalizeContactInfo(s.contactInfo),
      accentColor: s.accentColor,
      accentColorHex: s.accentColorHex,
      targetBoxBgColor: s.targetBoxBgColor,
      targetBoxBorderColor: s.targetBoxBorderColor,
      profilePhotoBorder: s.profilePhotoBorder,
      jobDescription: pendingJd,
      folderId: s.folderId || undefined,
    })
  }

  const reportResumeSaveResult = useCallback(
    (saveResult: SaveResumeResult, options?: { quiet?: boolean }) => {
      setResumeCloudSync({
        status: deriveResumeCloudSyncFromSaveResult(saveResult),
        remoteError: saveResult.remoteError ?? null,
      })
      if (saveResult.localWarning) {
        toast({
          title: "Limited browser storage",
          description: saveResult.localWarning,
        })
      }
      if (!saveResult.remoteSynced && saveResult.localSaved && !options?.quiet) {
        toast({
          title: "⚠ Saved locally only",
          description:
            saveResult.remoteError ??
            "This resume is on this device only until Supabase sync succeeds.",
        })
      }
    },
    [],
  )

  const handleRetryResumeCloudSync = useCallback(async () => {
    const resume =
      currentVersion ??
      (currentVersionIndex !== null ? versions[currentVersionIndex] : null) ??
      versions.find((v) => v.id === activeResumeIdRef.current)
    if (!resume) {
      toast({
        title: "No resume to sync",
        description: "Open a saved resume first, then retry cloud sync.",
        variant: "destructive",
      })
      return
    }

    setIsRetryingResumeSync(true)
    setResumeCloudSync({ status: "syncing", remoteError: null })
    try {
      const snapshot = normalizeResumeVersion(buildResumeSnapshot(resumePersistRef.current))
      const toSync = snapshot.id === resume.id ? snapshot : resume
      const result = await retryResumeRemoteSync(toSync)
      setResumeCloudSync({
        status: result.remoteSynced ? "synced" : "local_only",
        remoteError: result.remoteError ?? null,
      })
      if (result.remoteSynced) {
        toast({
          title: "Saved to Supabase",
          description: "This resume is now stored in the cloud.",
        })
      } else {
        toast({
          title: "Cloud sync failed",
          description: result.remoteError ?? "Supabase is still unreachable.",
          variant: "destructive",
        })
      }
    } finally {
      setIsRetryingResumeSync(false)
    }
  }, [currentVersion, currentVersionIndex, versions])

  const commitResumeSnapshot = useCallback(
    async (snapshot: ResumeVersion, options?: { mode?: "draft" | "snapshot"; quiet?: boolean }) => {
    const normalized = normalizeResumeVersion(snapshot)
    const mode = options?.mode ?? "snapshot"
    console.log("[resume] Persisting:", {
      id: normalized.id,
      name: normalized.name,
      folderId: normalized.folderId,
      mode,
      resumeTextLength: normalized.resumeText?.length ?? 0,
    })

    setResumeCloudSync({ status: "syncing", remoteError: null })

    const saveResult =
      mode === "draft" ? await saveResumeDraft(normalized) : await saveResume(normalized)
    if (!saveResult.localSaved && !saveResult.remoteSynced) {
      setResumeCloudSync({ status: "idle", remoteError: saveResult.remoteError ?? null })
      throw new Error(
        saveResult.localWarning ??
          "Storage is full. Please export your data, then clear saved versions.",
      )
    }
    if (!saveResult.remoteSynced && saveResult.remoteError) {
      console.warn("[resume] Saved locally; cloud sync failed:", saveResult.remoteError)
    }
    reportResumeSaveResult(saveResult, { quiet: options?.quiet })

    let nextIndex = -1
    setVersions((prev) => {
      const exists = prev.some((v) => v.id === normalized.id)
      const next = exists
        ? prev.map((v) => (v.id === normalized.id ? normalized : v))
        : [normalized, ...prev.filter((v) => v.id !== normalized.id)]
      nextIndex = next.findIndex((v) => v.id === normalized.id)
      return next
    })
    activeResumeIdRef.current = normalized.id
    setCurrentResumeId(normalized.id)
    if (mode === "snapshot") {
      draftResumeIdRef.current = null
    }
    setCurrentVersionIndex(nextIndex >= 0 ? nextIndex : null)
    setHasUnsavedChanges(false)
    if (normalized.jobDescription) {
      sessionStorage.removeItem("pendingJobDescription")
    }
    return normalized
  },
  [reportResumeSaveResult],
  )

  const waitForResumeOperation = useCallback(async (maxMs = 5000) => {
    const step = 100
    let waited = 0
    while (isOperationInProgressRef.current && waited < maxMs) {
      await new Promise((resolve) => setTimeout(resolve, step))
      waited += step
    }
  }, [])

  const persistResumeVersion = useCallback(
    async (options?: { quiet?: boolean }): Promise<boolean> => {
      if (viewRef.current !== "resume") {
        return true
      }

      if (!hasUnsavedChangesRef.current) {
        return true
      }

      const s = resumePersistRef.current
      const hasEditableContent =
        Boolean(s.resumeText?.trim()) ||
        s.currentVersionIndex !== null ||
        Boolean(draftResumeIdRef.current)
      if (!hasEditableContent) {
        return true
      }

      await waitForResumeOperation()
      if (viewRef.current !== "resume") {
        return true
      }

      if (isOperationInProgressRef.current) {
        console.warn("[resume] Save skipped — another save is still in progress")
        return false
      }

      isOperationInProgressRef.current = true
      setIsUpdatingVersion(true)
      try {
        const s = resumePersistRef.current
        const snapshot = buildResumeSnapshot(s)
        await commitResumeSnapshot(snapshot, { mode: "draft", quiet: options?.quiet })
        return true
      } catch (error) {
        if (options?.quiet) {
          console.warn("[resume] Autosave persist failed:", error)
        } else {
          console.error("[resume] Persist failed:", error)
        }
        if (!options?.quiet) {
          toast({
            title: "Save failed",
            description: error instanceof Error ? error.message : "Could not save resume.",
            variant: "destructive",
          })
        }
        return false
      } finally {
        setIsUpdatingVersion(false)
        isOperationInProgressRef.current = false
        lastRefreshRef.current = Date.now()
      }
    },
    [commitResumeSnapshot, waitForResumeOperation],
  )

  const saveNewVersion = useCallback(async (data: {
    name: string
    resumeText: string
    profileImage: string | null
    companyLogo: string | null
    contactInfo: ContactInfo
    accentColor: string
    accentColorHex: string
    targetBoxBgColor?: string
    targetBoxBorderColor?: string
    profilePhotoBorder?: boolean
  }): Promise<boolean> => {
    isOperationInProgressRef.current = true
    setIsUpdatingVersion(true)
    try {
      console.log("[resume] Manual save:", {
        name: data.name,
        folderId: currentFolderId,
        resumeTextLength: data.resumeText?.length ?? 0,
      })

      const sanitizedContactInfo = normalizeContactInfo(data.contactInfo)
      const pendingJobDescription =
        sessionStorage.getItem("pendingJobDescription") || ""

      resumePersistRef.current = {
        ...resumePersistRef.current,
        resumeText: data.resumeText,
        contactInfo: sanitizedContactInfo,
        profileImage: data.profileImage,
        companyLogo: data.companyLogo,
        accentColor: data.accentColor,
        accentColorHex: data.accentColorHex ?? "",
        targetBoxBgColor: data.targetBoxBgColor ?? resumePersistRef.current.targetBoxBgColor,
        targetBoxBorderColor:
          data.targetBoxBorderColor ?? resumePersistRef.current.targetBoxBorderColor,
        profilePhotoBorder:
          data.profilePhotoBorder ?? resumePersistRef.current.profilePhotoBorder,
        jobDescription: pendingJobDescription,
      }

      const s = resumePersistRef.current
      const snapshot = buildResumeSnapshot(s)
      const now = Date.now()
      const isEditingExisting = s.currentVersionIndex !== null && s.versions[s.currentVersionIndex]
      const existingResume = isEditingExisting
        ? s.versions[s.currentVersionIndex!]!
        : null
      const versionId = existingResume
        ? existingResume.id
        : ensureResumeId(draftResumeIdRef.current)
      const isReusableTemplate =
        typeof window !== "undefined" &&
        sessionStorage.getItem("pendingIsReusableTemplate") === "true"

      const contentUpdates = {
        resumeText: data.resumeText,
        contactInfo: sanitizedContactInfo,
        profileImage: data.profileImage,
        companyLogo: data.companyLogo,
        accentColor: data.accentColor,
        accentColorHex: data.accentColorHex,
        targetBoxBgColor: data.targetBoxBgColor ?? s.targetBoxBgColor,
        targetBoxBorderColor: data.targetBoxBorderColor ?? s.targetBoxBorderColor,
        profilePhotoBorder: data.profilePhotoBorder ?? s.profilePhotoBorder,
        jobDescription: isReusableTemplate
          ? undefined
          : pendingJobDescription || snapshot.jobDescription,
      }

      const named = existingResume
        ? applyResumeContentUpdate(existingResume, contentUpdates, {
            label: data.name.trim() || existingResume.name,
            source: "manual",
          })
        : normalizeResumeVersion({
            ...snapshot,
            ...contentUpdates,
            id: versionId,
            name: data.name.trim() || snapshot.name,
            folderId: currentFolderId || snapshot.folderId,
            createdAt: snapshot.createdAt ?? now,
            updatedAt: now,
            isReusableTemplate: isReusableTemplate || undefined,
            versionHistory: [],
          })

      if (isReusableTemplate && typeof window !== "undefined") {
        sessionStorage.removeItem("pendingIsReusableTemplate")
      }

      const saved = await commitResumeSnapshot(named, { mode: "snapshot" })
      await refreshDataFromDatabase(true)

      setResumeText(data.resumeText)
      setContactInfo(sanitizedContactInfo)
      setProfileImage(data.profileImage)
      setCompanyLogo(data.companyLogo)
      setAccentColor(data.accentColor)
      setAccentColorHex(data.accentColorHex)
      setTargetBoxBgColor(data.targetBoxBgColor || "#f8f9fa")
      setTargetBoxBorderColor(data.targetBoxBorderColor || "")
      setProfilePhotoBorder(data.profilePhotoBorder !== false)

      setPendingApplicationName(saved.name)

      toast({
        title: existingResume ? "Version snapshot saved" : "Resume saved",
        description: existingResume
          ? `Snapshot added to "${saved.name}" — same resume record, new history entry.`
          : `"${saved.name}" is in your workspace.`,
      })
      return true
    } catch (error) {
      console.error("[resume] Manual save failed:", error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save resume.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsUpdatingVersion(false)
      isOperationInProgressRef.current = false
      lastRefreshRef.current = Date.now()
    }
  }, [commitResumeSnapshot, currentFolderId, refreshDataFromDatabase])

  const handleAiResumeEdit = useCallback(
    async (payload: AiResumeEditPayload): Promise<AiResumeEditResult> => {
      const s = resumePersistRef.current
      const resumeId =
        payload.previousVersionId ??
        (s.currentVersionIndex !== null ? s.versions[s.currentVersionIndex]?.id ?? null : null)
      const previousResumeText = payload.previousResumeText || s.resumeText

      const existing =
        (resumeId ? s.versions.find((v) => v.id === resumeId) : null) ??
        (s.currentVersionIndex !== null ? s.versions[s.currentVersionIndex] : null)

      if (!existing) {
        return {
          success: false,
          error: "No resume record to update. Save your CV first.",
        }
      }

      const snapshotLabel = uniqueAiEditVersionName(payload.versionName, s.versions)

      try {
        await waitForResumeOperation()
        isOperationInProgressRef.current = true
        setIsUpdatingVersion(true)

        const approvedAt = Date.now()
        const aiMetadata = {
          instruction: payload.instruction,
          changes: payload.changes,
          model: payload.model,
          provider: payload.provider,
          providerLabel: payload.providerLabel ?? providerDisplayName(payload.provider),
          feature: payload.feature ?? "CV edit",
          approvalStatus: payload.approvalStatus ?? "approved",
          approvedAt,
          explainability: payload.explainability,
          assistantMessageId: payload.assistantMessageId,
          suggestedResumeText: payload.newResumeText,
          acceptedResumeText: payload.newResumeText,
        } as const

        const withAudit = appendAuditEntry(existing, {
          createdAt: approvedAt,
          action: payload.summary || snapshotLabel,
          model: payload.model ?? "Unknown",
          provider: payload.provider ?? "unknown",
          providerLabel: aiMetadata.providerLabel,
          approvalStatus: payload.approvalStatus ?? "approved",
          approvedAt,
          instruction: payload.instruction,
          changes: payload.changes,
          explainability: payload.explainability,
          feature: payload.feature ?? "CV edit",
          assistantMessageId: payload.assistantMessageId,
        })

        const updated = applyResumeContentUpdate(
          withAudit,
          { resumeText: payload.newResumeText },
          { label: snapshotLabel, source: "ai_edit", aiMetadata },
        )

        const lastSnapshot = updated.versionHistory?.[updated.versionHistory.length - 1]
        const withSnapshotLink =
          lastSnapshot && updated.aiAuditLog?.length
            ? {
                ...updated,
                aiAuditLog: updated.aiAuditLog.map((entry, index, arr) =>
                  index === arr.length - 1 ? { ...entry, snapshotId: lastSnapshot.id } : entry,
                ),
              }
            : updated

        const saved = await commitResumeSnapshot(withSnapshotLink, { mode: "snapshot" })
        await refreshDataFromDatabase(true)

        setResumeText(payload.newResumeText)
        setHasUnsavedChanges(false)

        setAiRefineHistory((stack) => [
          ...stack,
          { resumeText: previousResumeText, versionId: existing.id },
        ])

        return {
          success: true,
          previousVersionId: existing.id,
          newVersionId: saved.id,
          newVersionName: snapshotLabel,
        }
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not save the CV edit.",
        }
      } finally {
        setIsUpdatingVersion(false)
        isOperationInProgressRef.current = false
      }
    },
    [commitResumeSnapshot, waitForResumeOperation, refreshDataFromDatabase],
  )

  const handleLogAiActivity = useCallback(
    (event: Parameters<typeof appendFolderAiActivity>[1]) => {
      if (!currentFolderId) return
      appendFolderAiActivity(currentFolderId, event)
    },
    [currentFolderId],
  )

  const handleRestoreSnapshot = useCallback(
    async (resumeId: string, snapshotId: string) => {
      const resume = versions.find((v) => v.id === resumeId)
      if (!resume) return
      const restored = restoreResumeFromSnapshot(resume, snapshotId)
      if (!restored) return
      try {
        await commitResumeSnapshot(restored, { mode: "snapshot" })
        setResumeText(restored.resumeText)
        setContactInfo(normalizeContactInfo(restored.contactInfo, folderContactFallback))
        setHasUnsavedChanges(false)
        toast({
          title: "Version restored",
          description: "Content restored from history. A snapshot of the previous state was saved.",
        })
      } catch (error) {
        toast({
          title: "Restore failed",
          description: error instanceof Error ? error.message : "Could not restore version.",
          variant: "destructive",
        })
      }
    },
    [versions, commitResumeSnapshot, folderContactFallback],
  )

  const handleSaveResumeByName = useCallback(
    async (name: string): Promise<boolean> => {
      const s = resumePersistRef.current
      return saveNewVersion({
        name,
        resumeText: s.resumeText,
        profileImage: s.profileImage,
        companyLogo: s.companyLogo,
        contactInfo: s.contactInfo,
        accentColor: s.accentColor,
        accentColorHex: s.accentColorHex || "",
        targetBoxBgColor: s.targetBoxBgColor,
        targetBoxBorderColor: s.targetBoxBorderColor,
        profilePhotoBorder: s.profilePhotoBorder,
      })
    },
    [saveNewVersion],
  )

  /** Save draft only (autosave / leave with save) — never writes manual version list. */
  const saveDraftOnly = useCallback(async (): Promise<boolean> => {
    await waitForResumeOperation()
    if (isOperationInProgressRef.current) {
      console.warn("[resume] Draft save skipped — another save is in progress")
      return false
    }
    isOperationInProgressRef.current = true
    setIsUpdatingVersion(true)
    try {
      const snapshot = buildResumeSnapshot(resumePersistRef.current)
      await commitResumeSnapshot(snapshot, { mode: "draft", quiet: false })
      await refreshDataFromDatabase(true)
      return true
    } catch (error) {
      console.error("[resume] Draft save failed:", error)
      return false
    } finally {
      setIsUpdatingVersion(false)
      isOperationInProgressRef.current = false
      lastRefreshRef.current = Date.now()
    }
  }, [commitResumeSnapshot, waitForResumeOperation, refreshDataFromDatabase])

  const updateCurrentVersion = useCallback(async () => {
    await waitForResumeOperation()
    if (isOperationInProgressRef.current) return
    isOperationInProgressRef.current = true
    setIsUpdatingVersion(true)
    try {
      const snapshot = buildResumeSnapshot(resumePersistRef.current)
      await commitResumeSnapshot(snapshot, { mode: "snapshot" })
    } catch (error) {
      console.error("[resume] Update version failed:", error)
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Could not update saved version.",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingVersion(false)
      isOperationInProgressRef.current = false
      lastRefreshRef.current = Date.now()
    }
  }, [commitResumeSnapshot, waitForResumeOperation])

  const resumeHasPendingLeaveChanges = useCallback(() => {
    const isNewResume = currentVersionIndex === null
    return (
      hasUnsavedChanges || (Boolean(resumeText.trim()) && isNewResume)
    )
  }, [hasUnsavedChanges, currentVersionIndex, resumeText])

  const resolveNavigationContext = useCallback(
    (nav: PendingNavigation) => {
      const folderId = nav.folderId !== undefined ? nav.folderId : currentFolderId
      const applicationId =
        nav.applicationId !== undefined ? nav.applicationId : selectedJobIdRef.current
      const resumeId =
        nav.resumeId !== undefined
          ? nav.resumeId
          : nav.view === "resume"
            ? activeResumeIdRef.current ?? currentResumeId
            : null
      const sort =
        nav.sort !== undefined
          ? nav.sort
          : nav.view === "dashboard"
            ? applicationsSort
            : null
      return { folderId, applicationId, resumeId, sort }
    },
    [currentFolderId, currentResumeId, applicationsSort],
  )

  const writeAppHistoryState = useCallback(
    (nav: PendingNavigation, mode: "push" | "replace") => {
      if (typeof window === "undefined") return
      const ctx = resolveNavigationContext(nav)
      const state: AppHistoryState = {
        app: true,
        view: nav.view,
        folderId: ctx.folderId,
        applicationId: ctx.applicationId,
        resumeId: ctx.resumeId,
        sort: ctx.sort,
      }
      const href = buildAppWorkspaceHref({
        view: nav.view,
        folderId: ctx.folderId,
        applicationId: ctx.applicationId,
        resumeId: ctx.resumeId,
        sort: ctx.sort,
        pathname: window.location.pathname.startsWith("/app")
          ? window.location.pathname
          : "/app",
      })
      if (mode === "replace") {
        window.history.replaceState(state, "", href)
      } else {
        window.history.pushState(state, "", href)
      }
    },
    [resolveNavigationContext],
  )

  const applyNavigation = useCallback((nav: PendingNavigation) => {
    if (nav.clearWorkspace) {
      setCurrentFolderId(null)
      setVersions([])
      setJobApplications([])
      setCoverLetters([])
    }
    const nextView =
      (nav.view as AppView | "documents") === "documents" ? "careerHome" : nav.view
    setView(nextView)
    if (nav.applicationId !== undefined) {
      setSelectedJobId(nav.applicationId)
      selectedJobIdRef.current = nav.applicationId
      if (nextView === "dashboard") {
        setDetailsApplicationId(nav.applicationId)
      }
    } else if (nextView === "careerHome" || nextView === "folders") {
      setDetailsApplicationId(null)
    }
    if (nav.sort && nextView === "dashboard") {
      setApplicationsSort(nav.sort)
    }
    if (nav.view !== "resume") {
      setHasUnsavedChanges(false)
    }
  }, [])

  const dismissLeaveDialog = useCallback(() => {
    pendingNavigationRef.current = null
    setShowBackConfirmDialog(false)
    setBackConfirmSaveError(null)
  }, [])

  const refreshDashboardAfterNavigation = useCallback(
    async (nav: PendingNavigation) => {
      const folderId = nav.folderId ?? currentFolderId
      if (nav.view !== "dashboard" || !folderId) return
      await waitForResumeOperation()
      await persistResumeVersion({ quiet: true })

      const jobId = selectedJobIdRef.current?.trim()
      const resumeId = activeResumeIdRef.current?.trim()
      if (jobId && resumeId) {
        const snapshot = buildResumeSnapshot(resumePersistRef.current)
        if (snapshot.resumeText?.trim()) {
          const job = jobApplications.find((application) => application.id === jobId)
          const resume = versions.find((version) => version.id === resumeId)
          const needsJobLink = Boolean(job && job.resumeVersionId?.trim() !== resumeId)
          const needsResumeTag =
            resume?.applicationId !== jobId || snapshot.applicationId !== jobId

          if (needsJobLink || needsResumeTag) {
            try {
              await commitResumeSnapshot(
                normalizeResumeVersion({
                  ...(resume ?? snapshot),
                  ...snapshot,
                  id: resumeId,
                  applicationId: jobId,
                }),
                { mode: "snapshot", quiet: true },
              )
              if (needsJobLink && job) {
                const now = Date.now()
                const nextJobs = jobApplications.map((application) =>
                  application.id === jobId
                    ? { ...application, resumeVersionId: resumeId, lastModified: now }
                    : application,
                )
                setJobApplications(nextJobs)
                cacheJobApplicationsLocally(nextJobs, folderId)
                await saveJobApplications(nextJobs, folderId)
              }
            } catch (error) {
              console.warn("[application] Could not persist CV link before dashboard refresh:", error)
            }
          }
        }
      }

      await refreshDataFromDatabase(true)
    },
    [
      currentFolderId,
      waitForResumeOperation,
      persistResumeVersion,
      jobApplications,
      versions,
      commitResumeSnapshot,
      refreshDataFromDatabase,
    ],
  )

  const completePendingNavigation = useCallback(async () => {
    const nav =
      pendingNavigationRef.current ?? {
        view: "dashboard" as const,
        folderId: currentFolderId,
      }
    pendingNavigationRef.current = null
    setShowBackConfirmDialog(false)
    setBackConfirmSaveError(null)
    skipNextHistoryPushRef.current = true
    applyNavigation(nav)
    writeAppHistoryState(nav, "replace")
    await refreshDashboardAfterNavigation(nav)
  }, [
    applyNavigation,
    currentFolderId,
    writeAppHistoryState,
    refreshDashboardAfterNavigation,
  ])

  const requestNavigation = useCallback(
    (nav: PendingNavigation) => {
      const finishNavigation = async () => {
        skipNextHistoryPushRef.current = true
        applyNavigation(nav)
        writeAppHistoryState(nav, "push")
        await refreshDashboardAfterNavigation(nav)
      }

      if (view !== "resume") {
        void finishNavigation()
        return
      }
      if (resumeHasPendingLeaveChanges()) {
        pendingNavigationRef.current = nav
        setBackConfirmSaveError(null)
        setShowBackConfirmDialog(true)
        return
      }
      void finishNavigation()
    },
    [
      view,
      resumeHasPendingLeaveChanges,
      applyNavigation,
      writeAppHistoryState,
      refreshDashboardAfterNavigation,
    ],
  )

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined" || appHistoryReadyRef.current) {
      return
    }
    writeAppHistoryState(
      {
        view,
        folderId: currentFolderId,
        applicationId: selectedJobId,
        resumeId: currentResumeId,
        sort: applicationsSort,
      },
      "replace",
    )
    appHistoryReadyRef.current = true
    skipNextHistoryPushRef.current = true
  }, [
    isAuthenticated,
    view,
    currentFolderId,
    selectedJobId,
    currentResumeId,
    applicationsSort,
    writeAppHistoryState,
  ])

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined" || !appHistoryReadyRef.current) {
      return
    }
    if (skipNextHistoryPushRef.current) {
      skipNextHistoryPushRef.current = false
      return
    }
    const mode =
      previousHistoryViewRef.current !== null && previousHistoryViewRef.current !== view
        ? "push"
        : "replace"
    previousHistoryViewRef.current = view
    writeAppHistoryState(
      {
        view,
        folderId: currentFolderId,
        applicationId: selectedJobId,
        resumeId: currentResumeId,
        sort: applicationsSort,
      },
      mode,
    )
  }, [
    view,
    currentFolderId,
    selectedJobId,
    currentResumeId,
    applicationsSort,
    isAuthenticated,
    writeAppHistoryState,
  ])

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return

    const onPopState = (event: PopStateEvent) => {
      const state = isAppHistoryState(event.state) ? event.state : null
      const fromUrl = readAppWorkspaceUrlFromWindow()
      const restoredView = state?.view ?? (isRestorableAppView(fromUrl.view) ? fromUrl.view : null)
      if (!restoredView) return

      const target: PendingNavigation = {
        view: restoredView,
        folderId: state?.folderId ?? fromUrl.folderId ?? currentFolderId,
        applicationId: state?.applicationId ?? fromUrl.applicationId,
        resumeId: state?.resumeId ?? fromUrl.resumeId,
        sort: state?.sort ?? fromUrl.sort,
        clearWorkspace: restoredView === "folders" && !(state?.folderId ?? fromUrl.folderId),
      }

      if (view === "resume" && resumeHasPendingLeaveChanges()) {
        skipNextHistoryPushRef.current = true
        writeAppHistoryState(
          {
            view: "resume",
            folderId: currentFolderId,
            applicationId: selectedJobId,
            resumeId: currentResumeId,
            sort: applicationsSort,
          },
          "push",
        )
        pendingNavigationRef.current = target
        setBackConfirmSaveError(null)
        setShowBackConfirmDialog(true)
        return
      }

      skipNextHistoryPushRef.current = true
      applyNavigation(target)
      if (target.view === "resume" && target.resumeId) {
        pendingUrlRestoreRef.current = {
          view: "resume",
          folderId: target.folderId ?? null,
          applicationId: target.applicationId ?? null,
          resumeId: target.resumeId,
          sort: target.sort ?? null,
        }
      }
      void refreshDashboardAfterNavigation(target)
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [
    view,
    currentFolderId,
    currentResumeId,
    selectedJobId,
    applicationsSort,
    isAuthenticated,
    resumeHasPendingLeaveChanges,
    applyNavigation,
    writeAppHistoryState,
    refreshDashboardAfterNavigation,
  ])

  useEffect(() => {
    if (typeof window === "undefined" || view !== "resume") return
    if (!resumeHasPendingLeaveChanges()) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [view, resumeHasPendingLeaveChanges])

  const deleteVersion = async (id: string) => {
    console.log("[v0] Deleting resume version:", id)

    const newVersions = versions.filter((v) => v.id !== id)
    setVersions(newVersions)
    await deleteResume(id, currentFolderId || undefined)

    if (currentVersion?.id === id) {
      draftResumeIdRef.current = null
      setCurrentVersionIndex(null)
      setCurrentResumeId(null)
      activeResumeIdRef.current = null
    } else if (currentVersionIndex !== null && currentVersionIndex >= newVersions.length) {
      setCurrentVersionIndex(newVersions.length > 0 ? newVersions.length - 1 : null)
    }

    toast({
      title: "Success",
      description: "Resume deleted successfully.",
    })
  }

  const renameVersion = async (id: string, newName: string) => {
    console.log("[v0] Renaming resume version:", id, "to", newName)

    // Update local state first for immediate UI feedback
    const updatedVersions = versions.map((v) => (v.id === id ? { ...v, name: newName } : v))
    setVersions(updatedVersions)

    try {
      const saveResult = await saveResume(
        normalizeResumeVersion({ ...updatedVersions.find((v) => v.id === id)!, name: newName }),
      )
      reportResumeSaveResult(saveResult)
      console.log("[v0] Successfully renamed resume")
    } catch (e) {
      console.error("[v0] Error renaming resume:", e)
      setVersions(versions)
    }
  }

  const updateVersionRole = async (
    id: string,
    values: { jobTitle: string; company: string; location: string },
  ) => {
    const existing = versions.find((v) => v.id === id)
    if (!existing) return

    const updated = normalizeResumeVersion({
      ...existing,
      contactInfo: {
        ...existing.contactInfo,
        targetCompany: values.company,
        targetRole: values.jobTitle,
        address: values.location || existing.contactInfo.address,
      },
    })

    setVersions((prev) => prev.map((v) => (v.id === id ? updated : v)))

    try {
      const saveResult = await saveResume(updated)
      reportResumeSaveResult(saveResult)
    } catch (e) {
      console.error("[v0] Error updating draft application role:", e)
      setVersions(versions)
    }
  }

  const scrollToPreview = () => {
    if (previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const resumeAutosaveSnapshot = useMemo(() => {
    const jd = currentVersion?.jobDescription ?? jobDescriptionDraft
    try {
      return JSON.stringify({
        name: currentVersion?.name ?? defaultResumeTitle(contactInfo, pendingApplicationName),
        resumeText,
        contactInfo,
        profileImage,
        companyLogo,
        accentColor,
        accentColorHex: accentColorHex ?? "",
        targetBoxBgColor,
        targetBoxBorderColor,
        profilePhotoBorder,
        jobDescription: jd,
      })
    } catch (e) {
      console.error("[resume] Autosave snapshot serialization failed:", e)
      return ""
    }
  }, [
    currentVersion?.name,
    currentVersion?.jobDescription,
    jobDescriptionDraft,
    pendingApplicationName,
    resumeText,
    contactInfo,
    profileImage,
    companyLogo,
    accentColor,
    accentColorHex,
    targetBoxBgColor,
    targetBoxBorderColor,
    profilePhotoBorder,
  ])

  const isResumeEditorOpen = view === "resume"
  const shouldAutosave =
    isResumeEditorOpen &&
    !showBackConfirmDialog &&
    !backConfirmSaving &&
    !isUpdatingVersion &&
    hasUnsavedChanges &&
    Boolean(resumeText.trim() || currentVersionIndex !== null || draftResumeIdRef.current)

  const resumeAutosaveResetKey = isResumeEditorOpen
    ? `${currentFolderId ?? "nofolder"}:${activeResumeId ?? "draft"}`
    : `autosave-off-${currentFolderId ?? "nofolder"}`

  const resumeAutosaveStatus = useDebouncedAutosave({
    resetKey: resumeAutosaveResetKey,
    snapshot: resumeAutosaveSnapshot,
    save: persistResumeVersion,
    enabled: shouldAutosave,
    canSave: shouldAutosave,
    debounceMs: 1000,
  })

  const resumeSyncToolbarLabel = useMemo(() => {
    if (isUpdatingVersion || resumeAutosaveStatus === "saving") {
      return "⟳ Syncing"
    }
    if (resumeCloudSync.status !== "idle") {
      const prefix =
        resumeCloudSync.status === "synced"
          ? "✓ "
          : resumeCloudSync.status === "local_only"
            ? "⚠ "
            : ""
      return `${prefix}${resumeCloudSyncLabel(resumeCloudSync.status)}`
    }
    return autosaveStatusLabel(resumeAutosaveStatus)
  }, [isUpdatingVersion, resumeAutosaveStatus, resumeCloudSync.status])

  const profileImageFromCV = versions.length > 0 ? versions[versions.length - 1]?.profileImage : null

  const normalizePasswordValue = (value: string) => value.trim().toLowerCase()

  const extractLastName = (fullName: string): string => {
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : ""
  }

  const looksLikeFullName = (value: string) => value.trim().split(/\s+/).filter(Boolean).length >= 2

  const resolveFolderPassword = async (folderId: string): Promise<string | null> => {
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return null

    if (looksLikeFullName(folder.name)) {
      return extractLastName(folder.name)
    }

    if (looksLikeFullName(folder.contactInfo?.name || "")) {
      return extractLastName(folder.contactInfo.name)
    }

    const supabase = getSupabaseClient()
    if (supabase && !shouldUseLocalFallback()) {
      const { data, error } = await supabase
        .from("resume_versions")
        .select("contact_info, created_at")
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false })
        .limit(20)

      if (!error && data?.length) {
      for (const row of data) {
        const contactName = row?.contact_info?.name
        if (typeof contactName === "string" && looksLikeFullName(contactName)) {
          return extractLastName(contactName)
        }
      }
      }
    }

    const localVersions = versions.filter((v) => v.folderId === folderId)
    for (const v of localVersions) {
      const contactName = v.contactInfo?.name
      if (typeof contactName === "string" && looksLikeFullName(contactName)) {
        return extractLastName(contactName)
      }
    }

    const fallbackName = folder.contactInfo?.name || folder.name
    const fallbackLastName = extractLastName(fallbackName)
    return fallbackLastName || null
  }

  const handleUnlockFolder = async (folderId: string, passwordInput: string): Promise<boolean> => {
    const expectedPassword = await resolveFolderPassword(folderId)
    if (!expectedPassword) {
      toast({
        title: "Unable to unlock",
        description: "Could not derive a password for this workspace yet.",
        variant: "destructive",
      })
      return false
    }

    const isValid = normalizePasswordValue(passwordInput) === normalizePasswordValue(expectedPassword)
    if (!isValid) return false

    const nextUnlockedFolderIds = unlockedFolderIds.includes(folderId)
      ? unlockedFolderIds
      : [...unlockedFolderIds, folderId]
    setUnlockedFolderIds(nextUnlockedFolderIds)
    sessionStorage.setItem("unlocked_folder_ids", JSON.stringify(nextUnlockedFolderIds))
    return true
  }

  const handleLockFolder = (folderId: string) => {
    const nextUnlockedFolderIds = unlockedFolderIds.filter((id) => id !== folderId)
    setUnlockedFolderIds(nextUnlockedFolderIds)
    sessionStorage.setItem("unlocked_folder_ids", JSON.stringify(nextUnlockedFolderIds))
  }

  const applyWorkspaceContactDefaults = (
    folder?: Folder | null,
    opts?: { force?: boolean },
  ) => {
    const defaults = getWorkspaceContactDefaults(folder?.contactInfo, versions)
    if (folder?.profileImage) {
      setProfileImage(folder.profileImage)
    }
    setContactInfo((prev) => {
      if (!opts?.force && hasResumeContactContent(normalizeContactInfo(prev))) {
        return prev
      }
      return defaults
    })
  }

  const applyFolderDefaults = (folder: Folder) => {
    applyWorkspaceContactDefaults(folder)
  }

  const handleSelectFolder = (folderId: string) => {
    setIsResolvingWorkspace(false)
    setWorkspaceBootstrapFailed(false)

    const snapshot = loadWorkspaceFromLocalCache(folderId)
    if (hasWorkspaceLocalContent(snapshot)) {
      applyLoadedWorkspaceVersions(snapshot.versions)
      setJobApplications(snapshot.applications)
      setCoverLetters(snapshot.coverLetters)
      setWorkspaceLoading((prev) => ({ ...prev, active: false }))
      setWorkspaceSyncUi(
        shouldUseLocalFallback()
          ? { status: "loaded_local", message: "Loaded from this device" }
          : { status: "loaded_local" },
      )
    } else {
      setWorkspaceLoading({
        active: true,
        stage: WORKSPACE_LOAD_STAGES[0].label,
        progress: WORKSPACE_LOAD_STAGES[0].progress,
      })
    }

    setCurrentFolderId(folderId)

    const selectedFolder = folders.find((f) => f.id === folderId)
    if (selectedFolder) {
      applyFolderDefaults(selectedFolder)
    }

    void foldersStorage.getById(folderId).then((fullFolder) => {
      if (!fullFolder) return
      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, ...fullFolder } : f,
        )
        writeFoldersCache(next)
        return next
      })
      if (fullFolder.profileImage) {
        setProfileImage(fullFolder.profileImage)
      }
      applyWorkspaceContactDefaults(fullFolder)
    })

    // Restore section from URL so refresh keeps Applications / CVs / etc.
    const fromUrl = readAppWorkspaceUrlFromWindow()
    pendingUrlRestoreRef.current = fromUrl
    if (fromUrl.sort) {
      setApplicationsSort(fromUrl.sort)
    }
    if (fromUrl.applicationId) {
      setSelectedJobId(fromUrl.applicationId)
      selectedJobIdRef.current = fromUrl.applicationId
      if (!fromUrl.view || fromUrl.view === "dashboard") {
        setDetailsApplicationId(fromUrl.applicationId)
      }
    }
    if (isRestorableAppView(fromUrl.view)) {
      setView(fromUrl.view)
    } else {
      setView("careerHome")
    }
  }

  useEffect(() => {
    if (!isAuthenticated || isLoading) return

    const user = getCvUser()
    if (!user) return

    const pendingSlug = peekPendingWorkspaceSlug()
    const shouldOpen =
      Boolean(pendingSlug) ||
      view === "folders" ||
      (!currentFolderId && view !== "resume" && view !== "coverLetter" && view !== "jobCoverLetter")

    if (!shouldOpen) {
      setIsResolvingWorkspace(false)
      return
    }

    if (foldersLoading && folders.length === 0) {
      setIsResolvingWorkspace(true)
      return
    }

    const slug = pendingSlug ?? getWorkspaceSlugForUser(user)

    void (async () => {
      let remoteCounts: Map<string, number> | undefined
      if (!shouldUseLocalFallback()) {
        try {
          await loadJobApplications()
          const meta = getLastJobApplicationsLoadMeta()
          if (meta.cloudCount > 0) {
            const allApps = await loadJobApplications()
            remoteCounts = buildFolderApplicationCounts(allApps)
          } else {
            remoteCounts = new Map()
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[workspace] Could not load cloud application counts:", error)
          }
        }
      }

      const urlFolderId = readAppWorkspaceUrlFromWindow().folderId
      const folderFromUrl =
        urlFolderId ? folders.find((item) => item.id === urlFolderId) : undefined
      const folder =
        folderFromUrl ?? findBestFolderForUser(folders, user, pendingSlug, remoteCounts)

    if (!folder && folders.length === 0) {
      if (foldersLoadError) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[workspace] Workspace list failed to load:", foldersLoadError)
        }
        setWorkspaceBootstrapFailed(true)
        setIsResolvingWorkspace(false)
        setWorkspaceLoading((prev) => ({ ...prev, active: false }))
        return
      }

      if (hasAnyLocalWorkspaceData(folders)) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[workspace] Folders list empty but local workspace data exists — waiting for folder list refresh",
          )
        }
        setWorkspaceBootstrapFailed(true)
        setIsResolvingWorkspace(false)
        return
      }

      if (defaultWorkspaceBootstrapRef.current) return
      defaultWorkspaceBootstrapRef.current = true

      void (async () => {
        const displayName = slug.charAt(0).toUpperCase() + slug.slice(1)
        if (process.env.NODE_ENV === "development") {
          console.info(`[workspace] Creating default workspace "${displayName}"`)
        }

        const defaultFolderContactInfo: FolderContactInfo = {
          name: user.username,
          email: "",
          phone: "",
          address: "",
          linkedin: "",
          citizenship: "",
          portfolio: "",
          portfolios: [],
          professionalTitle: "",
          language: "en",
        }
        const newFolder: Folder = {
          id: crypto.randomUUID(),
          name: displayName,
          profileImage: null,
          contactInfo: defaultFolderContactInfo,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        const updatedFolders = [newFolder]
        setFolders(updatedFolders)
        writeFoldersCache(updatedFolders)
        try {
          await saveFolders(updatedFolders)
        } catch (error) {
          console.error("[workspace] Failed to persist default workspace:", error)
        }
        if (pendingSlug) consumePendingWorkspaceSlug()
        userWorkspaceOpenedRef.current = true
        setIsResolvingWorkspace(false)
        setWorkspaceBootstrapFailed(false)
        handleSelectFolder(newFolder.id)
      })()
      return
    }

    if (!folder) {
      setWorkspaceBootstrapFailed(true)
      setIsResolvingWorkspace(false)
      setWorkspaceLoading((prev) => ({ ...prev, active: false }))
      return
    }

    if (process.env.NODE_ENV === "development") {
        const remoteCount = remoteCounts?.get(folder.id) ?? 0
        console.info(
          `[workspace] Opening "${folder.name}" (${remoteCount} apps in cloud, ${scoreFolderLocalContent(folder.id)} cached items)`,
        )
      }

    if (currentFolderId === folder.id && view !== "folders") {
      userWorkspaceOpenedRef.current = true
      setIsResolvingWorkspace(false)
      setWorkspaceBootstrapFailed(false)
      if (pendingSlug) consumePendingWorkspaceSlug()
      return
    }

    if (userWorkspaceOpenedRef.current && currentFolderId === folder.id && view !== "folders") {
      setIsResolvingWorkspace(false)
      return
    }

    userWorkspaceOpenedRef.current = true
    setIsResolvingWorkspace(false)
    setWorkspaceBootstrapFailed(false)
    if (pendingSlug) consumePendingWorkspaceSlug()
    handleSelectFolder(folder.id)
    })()
    // handleSelectFolder is stable enough for this effect; defined above in the same component.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when folders/slug become available
  }, [
    isAuthenticated,
    isLoading,
    folders,
    foldersLoading,
    foldersLoadError,
    view,
    currentFolderId,
  ])

  useEffect(() => {
    if (!isResolvingWorkspace || workspaceBootstrapFailed) return
    const timer = setTimeout(() => {
      console.warn("[workspace] Bootstrap timed out after 12s — showing workspace picker")
      setWorkspaceBootstrapFailed(true)
      setIsResolvingWorkspace(false)
      setWorkspaceLoading((prev) => ({ ...prev, active: false }))
    }, 12_000)
    return () => clearTimeout(timer)
  }, [isResolvingWorkspace, workspaceBootstrapFailed])

  // After workspace data loads, restore CV / application deep links from the URL.
  useEffect(() => {
    const pending = pendingUrlRestoreRef.current
    if (!pending || !currentFolderId) return
    if (workspaceLoading.active) return

    const wantsResume = pending.view === "resume" && pending.resumeId
    const wantsApplication =
      pending.applicationId &&
      (pending.view === "dashboard" ||
        pending.view === "resume" ||
        pending.view === "yourStory" ||
        pending.view === "jobCoverLetter" ||
        pending.view === "interviewPrep" ||
        pending.view === "companyInfo" ||
        pending.view === "contacts" ||
        pending.view === "jobStrategy")

    if (wantsApplication && pending.applicationId) {
      const job = jobApplications.find((item) => item.id === pending.applicationId)
      if (job) {
        setSelectedJobId(job.id)
        selectedJobIdRef.current = job.id
        if (pending.view === "dashboard" || !pending.view) {
          setDetailsApplicationId(job.id)
        }
      }
    }

    if (wantsResume && pending.resumeId) {
      if (versions.length === 0) return
      const version = versions.find((item) => item.id === pending.resumeId)
      if (version) {
        const job =
          (pending.applicationId &&
            jobApplications.find((item) => item.id === pending.applicationId)) ||
          jobApplications.find(
            (item) =>
              item.resumeVersionId === version.id || item.id === version.applicationId,
          )
        if (job) {
          setSelectedJobId(job.id)
          selectedJobIdRef.current = job.id
        }
        loadVersion(version, job?.jobDescriptionUrl)
        pendingUrlRestoreRef.current = null
        return
      }
      // Resume id not found yet — keep pending until versions refresh, then clear.
      if (!workspaceLoading.active && versions.length > 0) {
        pendingUrlRestoreRef.current = null
      }
      return
    }

    if (pending.view === "dashboard" || !wantsResume) {
      pendingUrlRestoreRef.current = null
    }
  }, [
    currentFolderId,
    workspaceLoading.active,
    versions,
    jobApplications,
  ])

  // Recover when localhost opened a workspace with fewer cloud apps than production.
  useEffect(() => {
    if (!isAuthenticated || isLoading || !currentFolderId || folders.length === 0) return
    if (folderRecoveryAttemptedRef.current || workspaceLoading.active) return
    if (shouldUseLocalFallback()) return

    const user = getCvUser()
    if (!user) return

    const recoverToFolder = (folderId: string, reason: string) => {
      const folder = folders.find((f) => f.id === folderId)
      if (!folder || folder.id === currentFolderId) return false
      folderRecoveryAttemptedRef.current = true
      console.warn(`[workspace] ${reason} — switching to "${folder.name}"`)
      handleSelectFolder(folder.id)
      return true
    }

    void (async () => {
      try {
        const allApplications = await loadJobApplications()
        if (allApplications.length === 0) return

        const counts = buildFolderApplicationCounts(allApplications)
        const bestFolder = findBestFolderForUser(folders, user, null, counts)
        if (!bestFolder) return

        const tombstonedIds = getDeletedApplicationIdsForFolder(currentFolderId)
        const visibleCloudCount = allApplications.filter(
          (app) => app.folderId === currentFolderId && !tombstonedIds.has(app.id),
        ).length
        const bestTombstonedIds = getDeletedApplicationIdsForFolder(bestFolder.id)
        const bestVisibleCloudCount = allApplications.filter(
          (app) => app.folderId === bestFolder.id && !bestTombstonedIds.has(app.id),
        ).length

        if (bestFolder.id !== currentFolderId && bestVisibleCloudCount > visibleCloudCount) {
          recoverToFolder(
            bestFolder.id,
            `This workspace has ${visibleCloudCount} visible cloud apps; "${bestFolder.name}" has ${bestVisibleCloudCount}`,
          )
          return
        }

        if (
          tombstonedIds.size > 0 &&
          visibleCloudCount < (counts.get(currentFolderId) ?? 0) &&
          process.env.NODE_ENV === "development"
        ) {
          console.warn(
            `[workspace] ${tombstonedIds.size} applications hidden by local delete tombstones for this folder — clear cv_deleted_application_tombstones to restore`,
          )
        }

        // Only refresh when visible cloud count exceeds what we display — not
        // total apps including tombstoned rows (that caused pointless refresh loops).
        if (jobApplications.length > 0 && visibleCloudCount > jobApplications.length + 1) {
          folderRecoveryAttemptedRef.current = true
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[workspace] Showing ${jobApplications.length} apps but ${visibleCloudCount} visible in cloud for this folder — refreshing once`,
            )
          }
          void syncWorkspaceFromDatabase({ force: true, persistChanges: false })
          return
        }

        folderRecoveryAttemptedRef.current = true
        if (jobApplications.length > 0) return

        const currentSnapshot = loadWorkspaceFromLocalCache(currentFolderId)
        const currentHasData =
          hasWorkspaceLocalContent(currentSnapshot) ||
          jobApplications.length > 0 ||
          versions.length > 0
        if (currentHasData) return

        if (bestVisibleCloudCount > 0) {
          recoverToFolder(bestFolder.id, "Current workspace is empty in cloud")
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[workspace] Folder recovery scan failed:", error)
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recover once per session
  }, [
    isAuthenticated,
    isLoading,
    currentFolderId,
    folders,
    jobApplications.length,
    versions.length,
    workspaceLoading.active,
  ])

  const handleCreateFolder = async (
    name: string,
    profileImage: string | null,
    contactInfo: Partial<FolderContactInfo>
  ) => {
    console.log("[v0] Creating folder:", name, "with profile image:", !!profileImage)
    const defaultFolderContactInfo: FolderContactInfo = {
      name: "",
      email: "",
      phone: "",
      address: "",
      linkedin: "",
      citizenship: "",
      portfolio: "",
      portfolios: [],
      professionalTitle: "",
      language: "en",
    }
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      profileImage,
      contactInfo: { ...defaultFolderContactInfo, ...contactInfo },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updatedFolders = [...folders, newFolder]
    setFolders(updatedFolders)
    writeFoldersCache(updatedFolders)
    await saveFolders(updatedFolders)
  }

  const handleDeleteFolder = async (folderId: string) => {
    console.log("[v0] Deleting folder and all its contents:", folderId)

    if (!shouldUseLocalFallback()) {
      const supabase = getSupabaseClient()
      if (supabase) {
        const { error: folderError } = await supabase.from("folders").delete().eq("id", folderId)
        if (folderError) {
          console.error("[v0] Error deleting folder from database:", folderError)
          toast({
            title: "Cloud delete failed",
            description: "Removing workspace locally. Cloud data may remain until Supabase recovers.",
            variant: "destructive",
          })
        } else {
          await supabase.from("resume_versions").delete().eq("folder_id", folderId)
          await supabase.from("job_applications").delete().eq("folder_id", folderId)
          await supabase.from("cover_letters").delete().eq("folder_id", folderId)
        }
      }
    }

    const updatedFolders = folders.filter((f) => f.id !== folderId)
    setFolders(updatedFolders)
    writeFoldersCache(updatedFolders)

    console.log("[v0] Successfully deleted folder and all contents")
  }

  const handleRenameFolder = async (folderId: string, newName: string) => {
    console.log("[v0] Renaming folder:", folderId, "to", newName)
    const updatedFolders = folders.map((f) => (f.id === folderId ? { ...f, name: newName, updatedAt: Date.now() } : f))
    setFolders(updatedFolders)
    writeFoldersCache(updatedFolders)
    await saveFolders(updatedFolders)
  }

  const handleUpdateFolder = async (updates: { name?: string; profileImage?: string | null; contactInfo?: Partial<FolderContactInfo> }) => {
    if (!currentFolderId) return
    console.log("[v0] Updating folder:", currentFolderId, updates)
    
    const updatedFolders = folders.map((f) => {
      if (f.id !== currentFolderId) return f
      return {
        ...f,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.profileImage !== undefined && { profileImage: updates.profileImage }),
        ...(updates.contactInfo && { contactInfo: { ...f.contactInfo, ...updates.contactInfo } }),
        updatedAt: Date.now(),
      }
    })
    
    setFolders(updatedFolders)
    writeFoldersCache(updatedFolders)
    await saveFolders(updatedFolders)
  }

  const handleBackToDashboard = () => {
    requestNavigation({ view: "dashboard", folderId: currentFolderId })
  }

  const handleBackToCareerHome = () => {
    requestNavigation({ view: "careerHome", folderId: currentFolderId })
  }

  const handleOpenStatistics = () => {
    requestNavigation({ view: "statistics", folderId: currentFolderId })
  }

  const handleWorkspaceNavigate = useCallback(
    (id: WorkspaceNavId) => {
      const nextView = viewFromWorkspaceNav(id)
      requestNavigation({ view: nextView, folderId: currentFolderId })
    },
    [currentFolderId, requestNavigation],
  )

  const handleJourneyNavigate = useCallback(
    (id: WorkspaceNavId, directAction?: "openResume") => {
      if (directAction === "openResume") {
        openResumeWorkspace()
        return
      }
      handleWorkspaceNavigate(id)
    },
    [handleWorkspaceNavigate, openResumeWorkspace],
  )

  const workspaceFolderName = folders.find((f) => f.id === currentFolderId)?.name
  const workspaceFolderProfileImage = folders.find((f) => f.id === currentFolderId)?.profileImage

  const sidebarProfileImage =
    workspaceFolderProfileImage ?? profileImage ?? profileImageFromCV ?? null

  const journeyProgress = useMemo(
    () =>
      computeWorkspaceJourneyProgress({
        strategicProfile,
        qualificationProfile,
        versions,
        coverLetters,
        jobApplications,
      }),
    [strategicProfile, qualificationProfile, versions, coverLetters, jobApplications],
  )

  const careerJourneyGuide = useMemo(
    () =>
      computeCareerJourneyGuide({
        strategicProfile,
        qualificationProfile,
        versions,
        jobApplications,
      }),
    [strategicProfile, qualificationProfile, versions, jobApplications],
  )

  const workspaceShellProps = {
    workspaceName: workspaceFolderName,
    userName,
    profileImage: sidebarProfileImage,
    onNavigate: handleWorkspaceNavigate,
    footerVariant: "new-application" as const,
    onNewApplication: handleCreateApplication,
    showNewApplicationFab: true,
    journeyProgress,
    careerJourneyGuide,
  }

  const completeCoverLetterExit = useCallback(() => {
    const target = coverLetterNavTargetRef.current

    if (view === "jobCoverLetter") {
      setSelectedJobId(null)
      if (target === "dashboard") {
        setView("dashboard")
      } else if (target === "statistics") {
        handleOpenStatistics()
      } else if (target === "careerHome") {
        setView("careerHome")
      } else {
        setView("resume")
      }
      return
    }

    setCoverLetterResumeId(null)
    const returnView = coverLetterReturnView
    setCoverLetterReturnView("resume")

    if (target === "dashboard") {
      setView("dashboard")
      setSelectedJobId(null)
      return
    }
    if (target === "statistics") {
      handleOpenStatistics()
      return
    }
    if (target === "careerHome") {
      setView("careerHome")
      setSelectedJobId(null)
      return
    }
    if (target === "resume") {
      setView("resume")
      return
    }

    setView(returnView === "dashboard" ? "dashboard" : "resume")
    if (returnView === "dashboard") {
      setSelectedJobId(null)
    }
  }, [view, coverLetterReturnView, handleOpenStatistics])

  const handleCoverLetterShellNav = useCallback(
    (id: WorkspaceNavId) => {
      coverLetterNavTargetRef.current =
        id === "applications"
          ? "dashboard"
          : id === "careerHome"
            ? "careerHome"
            : "dashboard"
      if (coverLetterExitHandlerRef.current) {
        coverLetterExitHandlerRef.current()
      } else {
        completeCoverLetterExit()
      }
    },
    [completeCoverLetterExit],
  )

  const handleCoverLetterBackToOverview = useCallback(() => {
    coverLetterNavTargetRef.current = "dashboard"
    completeCoverLetterExit()
  }, [completeCoverLetterExit])

  const handleBackConfirmSaveAndLeave = async () => {
    if (backConfirmSaving) return
    setBackConfirmSaving(true)
    setBackConfirmSaveError(null)
    try {
      const ok = await saveDraftOnly()
      if (!ok) {
        setBackConfirmSaveError(
          "Could not save draft. Export your data, then clear saved versions in Profile Settings.",
        )
        return
      }
      await completePendingNavigation()
    } catch (err) {
      console.error("[resume] Save before navigation failed:", err)
      setBackConfirmSaveError(
        err instanceof Error ? err.message : "Save failed. Please try again.",
      )
    } finally {
      setBackConfirmSaving(false)
    }
  }

  const handleBackConfirmLeaveWithoutSaving = () => {
    if (backConfirmSaving) return
    void completePendingNavigation()
  }

  const handleBackToFolders = () => {
    requestNavigation({ view: "folders", folderId: null, clearWorkspace: true })
  }

  const resolveResumeIdForCoverLetter = (): string | null => {
    if (currentVersion?.id) return currentVersion.id
    if (draftResumeIdRef.current) return draftResumeIdRef.current
    return null
  }

  // Close cover letter view only if the linked resume was removed — do not compare to currentVersion.
  useEffect(() => {
    if (view !== "coverLetter" || !coverLetterResumeId) return
    if (!versions.some((v) => v.id === coverLetterResumeId)) {
      setCoverLetterResumeId(null)
      setView("dashboard")
    }
  }, [view, coverLetterResumeId, versions])

  const upsertResumeInVersions = async (resume: ResumeVersion): Promise<ResumeVersion> => {
    isOperationInProgressRef.current = true
    try {
      return await commitResumeSnapshot(resume)
    } finally {
      isOperationInProgressRef.current = false
      lastRefreshRef.current = Date.now()
    }
  }

  const openCoverLetterForResume = async (
    mode: "wizard" | "editor",
    explicitResumeId?: string | null,
    returnView: "resume" | "dashboard" = "resume",
  ) => {
    let resumeId = explicitResumeId ?? resolveResumeIdForCoverLetter()

    if (!resumeId) {
      toast({
        title: "Save resume first",
        description: "Save your resume before opening a cover letter.",
        variant: "destructive",
      })
      return
    }

    let resume = versions.find((v) => v.id === resumeId)

    if (!resume) {
      await persistResumeVersion({ quiet: true })
      const s = resumePersistRef.current
      resumeId =
        s.currentVersionIndex !== null ? s.versions[s.currentVersionIndex]?.id ?? resumeId : resumeId
      resume = resumeId ? s.versions.find((v) => v.id === resumeId) : undefined
    }

    if (!resume && resumeId) {
      const snapshot = normalizeResumeVersion(buildResumeSnapshot(resumePersistRef.current))
      if (snapshot.id === resumeId) {
        resume = snapshot
      }
    }

    if (!resume) {
      toast({
        title: "Could not open cover letter",
        description: "Save your resume, then try again.",
        variant: "destructive",
      })
      return
    }

    let openMode = mode
    if (!resume.coverLetter) {
      if (openMode === "editor") {
        openMode = "wizard"
      }
      const withLetter = normalizeResumeVersion({
        ...resume,
        coverLetter: createEmptyResumeCoverLetter(resume.name),
      })
      resume = await upsertResumeInVersions(withLetter)
    }

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("coverLetterResumeVersionId")
      sessionStorage.removeItem("coverLetterResumeText")
    }

    setCoverLetterReturnView(returnView)
    setCoverLetterResumeId(resume.id)
    setStandaloneCoverLetterMode(openMode === "editor" ? "editor" : "wizard")
    setView("coverLetter")
  }

  const openCoverLetterForApplication = async (
    jobId: string,
    forcedMode?: "wizard" | "editor",
  ) => {
    console.log("[application] Opening Cover Letter Builder", { jobId, forcedMode })

    const job = jobApplications.find((application) => application.id === jobId)
    if (!job) {
      console.warn("[application] Cover letter open failed — job not found", jobId)
      return
    }

    if (!job.resumeVersionId?.trim()) {
      toast({
        title: "No resume linked",
        description: "Link a resume to this application before opening the cover letter.",
        variant: "destructive",
      })
      return
    }

    let resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
    if (!resumeVersion) {
      toast({
        title: "Resume not found",
        description: "The resume linked to this application could not be loaded.",
        variant: "destructive",
      })
      return
    }

    const mergedResume = mergeApplicationCoverLetterOntoResume(
      job,
      resumeVersion,
      coverLetters,
    )
    if (
      JSON.stringify(mergedResume.coverLetter) !== JSON.stringify(resumeVersion.coverLetter)
    ) {
      resumeVersion = await upsertResumeInVersions(mergedResume)
    } else {
      resumeVersion = mergedResume
    }

    const mode =
      forcedMode ?? resolveApplicationCoverLetterMode(job, resumeVersion, coverLetters)

    setSelectedJobId(jobId)
    await openCoverLetterForResume(mode, job.resumeVersionId, "dashboard")
  }

  const openYourStoryForApplication = useCallback(
    (jobId: string, returnView: "resume" | "dashboard" = "dashboard") => {
      const job = jobApplications.find((application) => application.id === jobId)
      if (!job) return

      if (!job.resumeVersionId?.trim()) {
        toast({
          title: "No resume linked",
          description: "Create or link a resume before opening Your Story.",
          variant: "destructive",
        })
        return
      }

      const resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
      if (!resumeVersion?.resumeText?.trim()) {
        toast({
          title: "Resume has no content",
          description: "Generate or add CV content first, then open Your Story.",
          variant: "destructive",
        })
        return
      }

      setSelectedJobId(jobId)
      setYourStoryReturnView(returnView)
      if (returnView === "resume") {
        loadVersion(resumeVersion)
      }
      setView("yourStory")
    },
    [jobApplications, versions, loadVersion],
  )

  const openStoryWizardForApplication = useCallback(
    (jobId: string, returnView: "resume" | "dashboard" = "dashboard") => {
      const job = jobApplications.find((application) => application.id === jobId)
      if (!job) return

      const linkedResume = resolveResumeForJob(job, versions)
      if (!linkedResume?.resumeText?.trim()) {
        toast({
          title: "Tailored resume required",
          description: "Create or link a tailored CV before running the Application Story Wizard.",
          variant: "destructive",
        })
        return
      }

      setSelectedJobId(jobId)
      setYourStoryReturnView(returnView)
      if (returnView === "resume") {
        loadVersion(linkedResume)
      }
      setShowStoryWizard(true)
    },
    [jobApplications, versions, loadVersion],
  )

  const handleCareerAction = useCallback(
    (card: CareerActionCard) => {
      switch (card.target) {
        case "resume":
          openResumeWorkspace()
          return
        case "applications":
          handleWorkspaceNavigate("applications")
          return
        case "interviewPrep":
          handleWorkspaceNavigate("applications")
          toast({
            title: "Open an application",
            description:
              "Select a job from your list, then open Interview Prep from the application card.",
          })
          return
        case "careerStory": {
          const jobWithCv = jobApplications.find((job) => {
            const resume = resolveResumeForJob(job, versions)
            return Boolean(resume?.resumeText?.trim())
          })
          if (jobWithCv) {
            openYourStoryForApplication(jobWithCv.id, "dashboard")
            return
          }
          toast({
            title: "Link a CV first",
            description:
              "Create an application with a tailored CV, then build your career story from there.",
          })
          handleWorkspaceNavigate("applications")
          return
        }
        default:
          if (card.target in INTEGRATION_SECTIONS) {
            setView(card.target)
          }
      }
    },
    [handleWorkspaceNavigate, jobApplications, versions, openYourStoryForApplication, openResumeWorkspace],
  )

  const handleYourStoryBack = useCallback(() => {
    setView(yourStoryReturnView)
  }, [yourStoryReturnView])

  const handleOpenYourStoryFromResume = () => {
    if (selectedJobId) {
      openYourStoryForApplication(selectedJobId, "resume")
      return
    }
    const resumeId = resolveResumeIdForCoverLetter()
    const linkedJob =
      jobApplications.find((job) => job.resumeVersionId === resumeId) ??
      (currentVersion?.applicationId
        ? jobApplications.find((job) => job.id === currentVersion.applicationId)
        : undefined)
    if (linkedJob) {
      openYourStoryForApplication(linkedJob.id, "resume")
      return
    }
    toast({
      title: "No application linked",
      description: "Open an application from Job search to use My Career Story.",
    })
  }

  const handleCreateCoverLetter = () => {
    toast({
      title: "Open a resume first",
      description: "Cover letters belong to a specific resume. Open or create a resume, then use Cover Letter there.",
    })
  }

  const handleOpenCoverLetterFromResume = () => {
    const resumeId = resolveResumeIdForCoverLetter()
    const resume = resumeId ? versions.find((v) => v.id === resumeId) : undefined
    void openCoverLetterForResume(resolveCoverLetterOpenMode(resume?.coverLetter), resumeId, "resume")
  }

  const updateResumeCoverLetter = async (resumeId: string, updates: Partial<ResumeEmbeddedCoverLetter>) => {
    isOperationInProgressRef.current = true
    try {
      let resumeToSave: ResumeVersion | undefined
      setVersions((prev) =>
        prev.map((v) => {
          if (v.id !== resumeId) return v
          const baseLetter = v.coverLetter ?? createEmptyResumeCoverLetter(v.name)
          const next = {
            ...v,
            coverLetter: {
              ...baseLetter,
              ...updates,
              updatedAt: Date.now(),
            },
          }
          resumeToSave = next
          return next
        }),
      )
      if (resumeToSave) {
        const saveResult = await saveResume(resumeToSave)
        reportResumeSaveResult(saveResult, { quiet: true })
      }
    } catch (error) {
      console.error("[resume] Cover letter save failed:", error)
      throw error
    } finally {
      isOperationInProgressRef.current = false
      lastRefreshRef.current = Date.now()
    }
  }

  const handleAiCoverLetterApply = useCallback(
    async (payload: CoverLetterApplyPayload): Promise<boolean> => {
      try {
        const now = Date.now()
        const aiMetadata = {
          model: payload.model ?? "Unknown",
          provider: payload.provider ?? "unknown",
          providerLabel: payload.providerLabel ?? providerDisplayName(payload.provider),
          generatedAt: now,
          status: "accepted" as const,
          acceptedAt: now,
        }

        const readBodies = (
          cl:
            | {
                content?: string
                contentEn?: string
                contentDe?: string
                versionHistory?: import("@/lib/cover-letter-ai").CoverLetterVersionSnapshot[]
              }
            | null
            | undefined,
        ) => {
          const legacy = typeof cl?.content === "string" ? cl.content : ""
          const en = cl?.contentEn ?? (legacy && !cl?.contentDe ? legacy : "")
          const de = cl?.contentDe ?? ""
          return { en, de, versionHistory: [...(cl?.versionHistory ?? [])] }
        }

        let bodies = {
          en: "",
          de: "",
          versionHistory: [] as import("@/lib/cover-letter-ai").CoverLetterVersionSnapshot[],
        }

        if (view === "coverLetter" && coverLetterResumeId) {
          const resume = versions.find((v) => v.id === coverLetterResumeId)
          bodies = readBodies(resume?.coverLetter)
        } else if (view === "jobCoverLetter" && selectedJobId) {
          const job = jobApplications.find((j) => j.id === selectedJobId)
          bodies = readBodies(job?.coverLetter)
        } else {
          return false
        }

        if (bodies.en.trim() || bodies.de.trim()) {
          const rollbackLabel = payload.summary?.trim()
            ? `Before AI edit: ${payload.summary}`
            : `Before AI edit ${new Date().toLocaleString()}`
          bodies.versionHistory.push({
            id: createCoverLetterVersionId(),
            label: rollbackLabel,
            contentEn: bodies.en,
            contentDe: bodies.de,
            createdAt: now,
            source: "user",
          })
        }

        const contentEn = payload.language === "en" ? payload.newLetterText : bodies.en
        const contentDe = payload.language === "de" ? payload.newLetterText : bodies.de

        const coverLetterUpdate = {
          contentEn,
          contentDe,
          content: payload.language === "en" ? contentEn : contentDe,
          lastModified: now,
          aiMetadata,
          versionHistory: bodies.versionHistory.slice(-20),
        }

        if (view === "coverLetter" && coverLetterResumeId) {
          await updateResumeCoverLetter(coverLetterResumeId, coverLetterUpdate)
        } else if (view === "jobCoverLetter" && selectedJobId) {
          const nextJobs = jobApplications.map((job) =>
            job.id === selectedJobId
              ? {
                  ...job,
                  coverLetter: {
                    ...job.coverLetter,
                    content: coverLetterUpdate.content,
                    contentEn: coverLetterUpdate.contentEn,
                    contentDe: coverLetterUpdate.contentDe,
                    lastModified: now,
                    aiMetadata: coverLetterUpdate.aiMetadata,
                    versionHistory: coverLetterUpdate.versionHistory,
                  },
                }
              : job,
          )
          setJobApplications(nextJobs)
          await saveJobApplications(nextJobs, currentFolderId ?? undefined)
        } else {
          return false
        }

        dispatchAssistantCoverLetterApplied({
          contentEn,
          contentDe,
          language: payload.language,
          insertAsVersion: payload.insertAsVersion,
          aiMetadata,
        })

        handleLogAiActivity({
          createdAt: now,
          approvedAt: now,
          action: payload.summary?.trim() ? `AI: ${payload.summary}` : "Updated Cover Letter",
          model: payload.model ?? "Unknown",
          provider: payload.provider ?? "unknown",
          providerLabel: aiMetadata.providerLabel,
          approvalStatus: "approved",
          explainability: payload.explainability,
          feature: "cover_letter_edit",
          assistantMessageId: payload.assistantMessageId,
        })

        return true
      } catch (error) {
        console.error("[cover-letter] AI apply failed:", error)
        return false
      }
    },
    [
      view,
      coverLetterResumeId,
      selectedJobId,
      versions,
      jobApplications,
      currentFolderId,
      handleLogAiActivity,
    ],
  )

  const handleDeleteCoverLetter = async (letterId: string) => {
    const newCoverLetters = coverLetters.filter((l) => l.id !== letterId)
    setCoverLetters(newCoverLetters)
    await saveCoverLetters(newCoverLetters)
  }

  const persistJobApplications = async (nextJobs: JobApplication[]) => {
    if (!currentFolderId) return
    isOperationInProgressRef.current = true
    try {
      const deduped = await dedupeAndRemoveStaleApplications(
        nextJobs,
        versions,
        currentFolderId,
        "persist",
      )
      if (!haveJobApplicationsChanged(jobApplications, deduped)) return
      setJobApplications(deduped)
      cacheJobApplicationsLocally(deduped, currentFolderId)
      await saveJobApplications(deduped, currentFolderId)
      lastRefreshRef.current = Date.now()
    } finally {
      isOperationInProgressRef.current = false
    }
  }

  const uploadCvForApplication = useCallback(
    async (jobId: string, file: File) => {
      const job = jobApplications.find((application) => application.id === jobId)
      if (!job || !currentFolderId) return

      setCvImportingJobId(jobId)

      try {
        const currentFolder = folders.find((folder) => folder.id === currentFolderId)
        const workspaceContact = getWorkspaceContactDefaults(currentFolder?.contactInfo, versions)
        const applicationContext = {
          targetRole: job.jobTitle || "",
          targetCompany: job.company || "",
          professionalTitle: workspaceContact.professionalTitle || "",
        }

        const extraction = await extractCvFileWithDiagnostics(file)
        if (!extraction.ok) {
          toast({
            title: "Could not read CV file",
            description: extraction.error,
            variant: "destructive",
          })
          return
        }

        const formattingToast = toast({
          title: "Formatting CV…",
          description: "Converting your file into the resume builder format.",
        })

        const prepared = await prepareImportedCvText(extraction.text, {
          outputLanguage: resumeOutputLanguage,
          applicationContext,
        })
        formattingToast.dismiss()

        if (!prepared.ok) {
          toast({
            title: "Could not format CV",
            description: prepared.error,
            variant: "destructive",
          })
          return
        }

        const existingResume = job.resumeVersionId
          ? versions.find((version) => version.id === job.resumeVersionId)
          : undefined

        setPendingCvImport({
          jobId,
          fileName: extraction.fileName,
          formattedText: prepared.text,
          confidence: prepared.confidence,
          needsReview: prepared.needsReview,
          warnings: prepared.warnings,
          issues: prepared.issues,
          score: prepared.score,
          replacesExistingGoodCv: existingCvShouldBlockSilentOverwrite(existingResume?.resumeText),
          existingResumeName: existingResume?.name,
          applicationContext,
        })
      } finally {
        setCvImportingJobId(null)
      }
    },
    [jobApplications, currentFolderId, versions, resumeOutputLanguage, folders],
  )

  const confirmCvImport = useCallback(
    async (reviewedText: string) => {
      if (!pendingCvImport || !currentFolderId) return

      const job = jobApplications.find((application) => application.id === pendingCvImport.jobId)
      if (!job) return

      const validation = validateAndRepairImportedCv(reviewedText, {
        applicationContext: pendingCvImport.applicationContext,
      })
      const resumeText = validation.text

      const currentFolder = folders.find((folder) => folder.id === currentFolderId)
      const workspaceContact = getWorkspaceContactDefaults(currentFolder?.contactInfo, versions)
      const now = Date.now()
      const linkedResume = job.resumeVersionId
        ? versions.find((version) => version.id === job.resumeVersionId)
        : undefined
      const resumeId =
        linkedResume?.applicationId === job.id
          ? linkedResume.id
          : createNewResumeId()
      const resumeName = nextApplicationResumeName(
        job.jobTitle || job.company || "Application",
        versions,
      )

      const snapshot = normalizeResumeVersion({
        id: resumeId,
        name: resumeName,
        applicationId: job.id,
        versionHistory: [],
        resumeText,
        jobDescription: job.jobDescription,
        contactInfo: {
          ...workspaceContact,
          targetCompany: job.company || "",
          targetRole: job.jobTitle || "",
        },
        isReusableTemplate: false,
        profileImage: currentFolder?.profileImage ?? profileImage,
        companyLogo: null,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        accentColor,
        accentColorHex: accentColorHex ?? "",
        targetBoxBgColor,
        targetBoxBorderColor,
        profilePhotoBorder,
        folderId: currentFolderId,
        coverLetter: null,
      })

      setIsSavingCvImport(true)
      isOperationInProgressRef.current = true
      try {
        const saved = await commitResumeSnapshot(snapshot, { mode: "snapshot" })
        const nextJobs = jobApplications.map((application) =>
          application.id === job.id
            ? { ...application, resumeVersionId: saved.id, lastModified: now }
            : application,
        )
        await persistJobApplications(nextJobs)
        setSelectedJobId(job.id)
        loadVersion(saved)
        setPendingCvImport(null)
        toast({
          title: "CV attached",
          description: validation.needsReview
            ? `Saved ${pendingCvImport.fileName}. Review the CV preview — import confidence was low.`
            : `Saved ${pendingCvImport.fileName} for ${job.company || job.jobTitle}.`,
        })
      } catch (error) {
        toast({
          title: "Could not save CV",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsSavingCvImport(false)
        isOperationInProgressRef.current = false
      }
    },
    [
      pendingCvImport,
      currentFolderId,
      jobApplications,
      folders,
      versions,
      profileImage,
      accentColor,
      accentColorHex,
      targetBoxBgColor,
      targetBoxBorderColor,
      profilePhotoBorder,
      commitResumeSnapshot,
      loadVersion,
    ],
  )

  const uploadCoverLetterForApplication = useCallback(
    async (jobId: string, file: File) => {
      const job = jobApplications.find((application) => application.id === jobId)
      if (!job || !currentFolderId) return

      if (!job.resumeVersionId?.trim()) {
        toast({
          title: "Add a CV first",
          description: "Link a resume to this application before adding a cover letter.",
          variant: "destructive",
        })
        return
      }

      const resumeVersion = versions.find((version) => version.id === job.resumeVersionId)
      if (!resumeVersion?.resumeText?.trim()) {
        toast({
          title: "Add a CV first",
          description: "Cover letters need a saved resume for this application.",
          variant: "destructive",
        })
        return
      }

      const extraction = await extractCvFileWithDiagnostics(file)
      if (!extraction.ok) {
        toast({
          title: "Could not read cover letter file",
          description: extraction.error,
          variant: "destructive",
        })
        return
      }

      const merged = mergeApplicationCoverLetterOntoResume(job, resumeVersion, coverLetters)
      const baseLetter = merged.coverLetter ?? createEmptyResumeCoverLetter(merged.name)
      const letterText = extraction.text.trim()
      const withLetter = normalizeResumeVersion({
        ...merged,
        coverLetter: {
          ...baseLetter,
          contentEn: letterText,
          contentDe: letterText,
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      })

      isOperationInProgressRef.current = true
      try {
        const saved = await upsertResumeInVersions(withLetter)
        setSelectedJobId(jobId)
        loadVersion(saved)
        toast({
          title: "Cover letter attached",
          description: `Uploaded ${extraction.fileName} for ${job.company || job.jobTitle}.`,
        })
      } catch (error) {
        toast({
          title: "Could not save cover letter",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        })
      } finally {
        isOperationInProgressRef.current = false
      }
    },
    [jobApplications, currentFolderId, versions, coverLetters, upsertResumeInVersions, loadVersion],
  )

  const handleApplicationFlowComplete = async (
    payload: ApplicationFlowCompletePayload,
  ): Promise<boolean> => {
    if (!currentFolderId) {
      toast({
        title: "Select a workspace first",
        description: "Open a folder before creating an application.",
        variant: "destructive",
      })
      return false
    }

    const wizardSessionId = payload.wizardSessionId
    if (applicationFlowCompleteInFlightRef.current === wizardSessionId) {
      console.warn("[application-flow] Ignoring duplicate completion for session", wizardSessionId)
      return false
    }
    applicationFlowCompleteInFlightRef.current = wizardSessionId

    const currentFolder = folders.find((f) => f.id === currentFolderId)
    const workspaceContact = getWorkspaceContactDefaults(currentFolder?.contactInfo, versions)
    const now = Date.now()
    const wizardIds = getOrCreateWizardApplicationIds(wizardSessionId)

    const applicationTitle = deriveApplicationName({
      applicationName: payload.applicationName,
      company: payload.company,
      jobDescription: payload.jobDescription,
    })
    const parsed = parseCombinedApplicationLabel(applicationTitle)
    const company = payload.company.trim() || parsed?.company || ""
    const jobTitle = applicationTitle

    const deletedApplicationIds = getDeletedApplicationIdsForFolder(currentFolderId)
    const duplicateMatch = findMatchingApplication(jobApplications, {
      folderId: currentFolderId,
      company,
      jobTitle,
      appliedDate: now,
      excludeApplicationIds: deletedApplicationIds,
    })

    let applicationId = wizardIds.applicationId
    let resumeId = wizardIds.resumeVersionId
    let saveMode: "create" | "update" = "create"

    const existingByWizardId = jobApplications.find((job) => job.id === applicationId)
    const existingByDuplicate = duplicateMatch

    if (existingByDuplicate && existingByDuplicate.id !== applicationId) {
      applicationId = existingByDuplicate.id
      if (existingByDuplicate.resumeVersionId) {
        resumeId = existingByDuplicate.resumeVersionId
      }
      saveMode = "update"
    } else if (existingByWizardId) {
      saveMode = "update"
      if (existingByWizardId.resumeVersionId) {
        resumeId = existingByWizardId.resumeVersionId
      }
    }

    console.info("[application-flow] Persist application", {
      wizard_session_id: wizardSessionId,
      application_id: applicationId,
      resume_version_id: resumeId,
      mode: saveMode,
      step: "complete",
      company,
      jobTitle,
    })

    const resumeName = nextApplicationResumeName(applicationTitle, versions)

    const snapshot = normalizeResumeVersion({
      id: resumeId,
      name: resumeName,
      applicationId,
      versionHistory: [],
      resumeText: payload.resumeContent,
      jobDescription: payload.jobDescription,
      contactInfo: {
        ...workspaceContact,
        targetCompany: company,
        targetRole: jobTitle,
        jobAdvertSource:
          payload.jobDescriptionUrl.trim() || workspaceContact.jobAdvertSource || "",
      },
      isReusableTemplate: false,
      profileImage: currentFolder?.profileImage ?? profileImage,
      companyLogo: null,
      timestamp: now,
      createdAt: existingByWizardId?.lastModified ?? now,
      updatedAt: now,
      accentColor,
      accentColorHex: accentColorHex ?? "",
      targetBoxBgColor,
      targetBoxBorderColor,
      profilePhotoBorder,
      folderId: currentFolderId,
      coverLetter: null,
    })

    try {
      const saved = await commitResumeSnapshot(snapshot, { mode: "snapshot" })
      console.info("[application-flow] Resume saved", {
        wizard_session_id: wizardSessionId,
        application_id: applicationId,
        resume_version_id: saved.id,
        step: "resume_snapshot",
      })

      const jobFields = emptyJobApplicationFields({
        jobTitle,
        company,
        jobDescription: payload.jobDescription,
        jobDescriptionUrl: payload.jobDescriptionUrl,
        resumeVersionId: saved.id,
      })

      const baseJob: JobApplication = {
        ...jobFields,
        id: applicationId,
        folderId: currentFolderId,
        appliedDate: existingByDuplicate?.appliedDate ?? existingByWizardId?.appliedDate ?? now,
        lastModified: now,
      }

      const nextJobs =
        saveMode === "update"
          ? jobApplications.map((job) =>
              job.id === applicationId
                ? {
                    ...job,
                    ...baseJob,
                    pipeline: job.pipeline?.length ? job.pipeline : baseJob.pipeline,
                    companyInfo: job.companyInfo ?? baseJob.companyInfo,
                    contacts: job.contacts ?? baseJob.contacts,
                    coverLetter: job.coverLetter ?? baseJob.coverLetter,
                    yourStory: job.yourStory ?? baseJob.yourStory,
                    interviewPrep: job.interviewPrep ?? baseJob.interviewPrep,
                  }
                : job,
            )
          : [baseJob, ...jobApplications.filter((job) => job.id !== applicationId)]

      await persistJobApplications(nextJobs)
      console.info("[application-flow] Application saved", {
        wizard_session_id: wizardSessionId,
        application_id: applicationId,
        mode: saveMode,
        step: "job_application",
      })

      const savedJob = nextJobs.find((job) => job.id === applicationId)
      if (savedJob && payload.resumeContent.trim()) {
        void (async () => {
          try {
            const storyResult = await buildYourStoryJobUpdate({
              job: savedJob,
              resumeContent: payload.resumeContent,
              resumeVersionId: saved.id,
              outputLanguage: payload.outputLanguage,
              strategicProfile: loadStrategicProfile(),
            })
            if (!storyResult.ok) {
              toast({
                title: "Your Story not generated",
                description: storyResult.error,
                variant: "destructive",
              })
              return
            }
            const withStory = nextJobs.map((job) =>
              job.id === applicationId
                ? mergeYourStoryOntoJob(job, storyResult.updates)
                : job,
            )
            await persistJobApplications(withStory)
            toast({
              title: "Your Story ready",
              description: "Your positioning narrative is saved with this application.",
            })
          } catch (storyError) {
            console.warn("[your-story] Post-wizard generation failed:", storyError)
          }
        })()
      }

      setSelectedJobId(applicationId)
      loadVersion(saved)
      setShowApplicationWizard(false)
      setApplicationWizardSessionKey("")
      setMobileListRevision((n) => n + 1)
      applicationFlowCompleteInFlightRef.current = null

      if (typeof window !== "undefined") {
        sessionStorage.setItem("cvLanguage", payload.outputLanguage)
        sessionStorage.removeItem("pendingJobDescription")
        sessionStorage.removeItem("pendingResumeContent")
        sessionStorage.removeItem("pendingApplicationName")
      }

      toast({
        title: saveMode === "update" ? "Application updated" : "Application created",
        description: `${company || jobTitle} is ready in your workspace.`,
      })
      return true
    } catch (error) {
      applicationFlowCompleteInFlightRef.current = null
      console.error("[application-flow] Save failed:", error)
      toast({
        title: "Could not save application",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingResumeContent", payload.resumeContent)
        sessionStorage.setItem("pendingApplicationName", payload.applicationName)
        sessionStorage.setItem("pendingJobDescription", payload.jobDescription)
      }
      return false
    }
  }

  const handleCreateJobApplication = async (newApplication: Partial<JobApplication>) => {
    if (!currentFolderId) return
    const newJob: JobApplication = {
      ...newApplication,
      id: crypto.randomUUID(),
      folderId: currentFolderId || undefined,
    }
    await persistJobApplications([newJob, ...jobApplications])
  }

  const handleUpdateJobStatus = async (id: string, updates: Partial<JobApplication>) => {
    const newJobs = jobApplications.map((j) =>
      j.id === id ? applyJobApplicationUpdates(j, updates) : j,
    )
    await persistJobApplications(newJobs)
  }

  const handleUpdateJob = async (id: string, updates: Partial<JobApplication>) => {
    const newJobs = jobApplications.map((j) =>
      j.id === id ? applyJobApplicationUpdates(j, updates) : j,
    )
    await persistJobApplications(newJobs)
  }

  const handleDeleteJobApplication = async (id: string) => {
    const job = jobApplications.find((j) => j.id === id)
    if (!job) return

    isOperationInProgressRef.current = true
    try {
      const deleteResult = await deleteJobApplicationById(id, {
        folderId: currentFolderId ?? undefined,
        resumeVersionId: job.resumeVersionId,
        company: job.company,
        jobTitle: job.jobTitle,
      })

      if (!deleteResult.success) {
        toast({
          title: "Could not delete application",
          description:
            deleteResult.error ??
            "The application is still in the database. Check your connection and try again.",
          variant: "destructive",
        })
        return
      }

      if (currentFolderId) {
        tombstoneApplicationDeletion(currentFolderId, job, versions)
      }

      const newJobs = jobApplications.filter((j) => j.id !== id)
      setJobApplications(newJobs)
      await saveJobApplications(newJobs, currentFolderId ?? undefined)
      if (currentFolderId) {
        cacheJobApplicationsLocally(newJobs, currentFolderId)
      }

      const duplicateNote =
        deleteResult.duplicateMatches.length > 1
          ? ` (${deleteResult.duplicateMatches.length - 1} similar record${
              deleteResult.duplicateMatches.length - 1 === 1 ? "" : "s"
            } may still exist in the database)`
          : ""

      toast({
        title: "Application deleted",
        description: `${job.jobTitle || "Application"} at ${job.company || "Unknown Company"} was removed permanently.${duplicateNote}`,
      })
    } finally {
      setTimeout(() => {
        isOperationInProgressRef.current = false
      }, 1000)
    }
  }

  const handleResumeUpdate = useCallback(
    (data: {
      contactInfo: ContactInfo
      resumeContent: string
      profilePhoto?: string | null
      companyLogo?: string | null
      accentColor: string
      accentColorHex: string
      targetBoxBgColor: string
      targetBoxBorderColor: string
      profilePhotoBorder: boolean
    }) => {
      const nextContact = normalizeContactInfo(data.contactInfo, folderContactFallback)
      const s = resumePersistRef.current
      const unchanged =
        s.resumeText === data.resumeContent &&
        s.accentColor === data.accentColor &&
        s.accentColorHex === data.accentColorHex &&
        s.targetBoxBgColor === data.targetBoxBgColor &&
        s.targetBoxBorderColor === data.targetBoxBorderColor &&
        s.profilePhotoBorder === data.profilePhotoBorder &&
        s.profileImage === (data.profilePhoto ?? s.profileImage) &&
        s.companyLogo === (data.companyLogo ?? null) &&
        JSON.stringify(s.contactInfo) === JSON.stringify(nextContact)

      setContactInfo(nextContact)
      setResumeText(data.resumeContent)
      if (data.profilePhoto !== undefined) setProfileImage(data.profilePhoto ?? null)
      setCompanyLogo(data.companyLogo ?? null)
      setAccentColor(data.accentColor)
      setAccentColorHex(data.accentColorHex)
      setTargetBoxBgColor(data.targetBoxBgColor)
      setTargetBoxBorderColor(data.targetBoxBorderColor)
      setProfilePhotoBorder(data.profilePhotoBorder)
      if (!unchanged) setHasUnsavedChanges(true)
    },
    [folderContactFallback],
  )

  const handleResumeJobDescriptionChange = useCallback(
    (newJobDescription: string) => {
      if (currentVersionIndex === null) {
        setJobDescriptionDraft(newJobDescription)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pendingJobDescription", newJobDescription)
        }
        return
      }
      setVersions((prev) => {
        const i = currentVersionIndex
        if (i === null || i < 0 || i >= prev.length) return prev
        return prev.map((v, idx) => (idx === i ? { ...v, jobDescription: newJobDescription } : v))
      })
    },
    [currentVersionIndex],
  )

  const handleStartAgainUpdate = useCallback(
    (newResumeContent: string, newJobDescription: string) => {
      handleResumeUpdate({
        contactInfo,
        resumeContent: newResumeContent,
        profilePhoto: profileImage,
        companyLogo,
        accentColor,
        accentColorHex,
        targetBoxBgColor,
        targetBoxBorderColor,
        profilePhotoBorder,
      })
      handleResumeJobDescriptionChange(newJobDescription)
      setShowStartAgainDialog(false)
    },
    [
      contactInfo,
      profileImage,
      companyLogo,
      accentColor,
      accentColorHex,
      targetBoxBgColor,
      targetBoxBorderColor,
      profilePhotoBorder,
      handleResumeUpdate,
      handleResumeJobDescriptionChange,
    ],
  )

  const handleOpenCompanyInfo = (jobId: string) => {
    setSelectedJobId(jobId)
    setView("companyInfo")
  }

  const handleOpenContacts = (jobId: string) => {
    setSelectedJobId(jobId)
    setView("contacts")
  }

  const handleOpenJobStrategy = (jobId: string) => {
    setSelectedJobId(jobId)
    setView("jobStrategy")
  }

  const handleOpenInterviewPrep = (jobId: string) => {
    setSelectedJobId(jobId)
    setView("interviewPrep")
  }

  const handleOpenJobApplication = async (newApplication: Partial<JobApplication>) => {
    if (!currentFolderId) return
    const newJob: JobApplication = {
      ...newApplication,
      id: crypto.randomUUID(),
      folderId: currentFolderId || undefined,
    }
    await persistJobApplications([newJob, ...jobApplications])
    setSelectedJobId(newJob.id)
    setView("dashboard")
  }

  // Phone / narrow tablet: secondary companion UI (applications list first).
  // Desktop shell below is unchanged when viewportAllowed.
  // Application creation wizard is shared — open it above the phone shell.
  if (!viewportReady) {
    return (
      <WorkspaceLoadingSkeleton
        userName={userName}
        stage={WORKSPACE_LOAD_STAGES[0].label}
        progress={8}
      />
    )
  }

  if (!viewportAllowed) {
    const mobileDraftPrompt = (
      <AlertDialog open={applicationDraftPromptOpen} onOpenChange={setApplicationDraftPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfinished application draft</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unfinished application draft. Resume it or start fresh?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={openFreshApplicationWizard}>Start fresh</AlertDialogCancel>
            <AlertDialogAction onClick={openResumeApplicationWizard}>Resume draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    if (showApplicationWizard && applicationWizardSessionKey) {
      if (!currentFolderId) {
        return (
          <>
            {mobileDraftPrompt}
            <div className="flex min-h-dvh items-center justify-center bg-white px-4">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 px-6 py-8 text-center shadow-sm">
                <h1 className="text-lg font-semibold text-zinc-900">Workspace not ready</h1>
                <p className="text-sm text-zinc-600">
                  We could not load your workspace. Wait a moment and try again, or go back.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void syncWorkspaceFromDatabase({ force: true, persistChanges: true })
                    }}
                  >
                    Retry
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowApplicationWizard(false)
                      setApplicationWizardSessionKey("")
                    }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            </div>
          </>
        )
      }

      return (
        <>
          {mobileDraftPrompt}
          <div className="h-dvh max-h-dvh overflow-hidden bg-background">
            <ApplicationFlow
              key={applicationWizardSessionKey}
              flowSessionKey={applicationWizardSessionKey}
              restoreDraft={applicationWizardRestoreDraft}
              versions={versions}
              jobApplications={jobApplications}
              onComplete={async (payload) => handleApplicationFlowComplete(payload)}
              onCancel={() => {
                setShowApplicationWizard(false)
                setApplicationWizardSessionKey("")
              }}
            />
          </div>
        </>
      )
    }

    return (
      <>
        {mobileDraftPrompt}
        <MobileApp
          onCreateApplication={handleCreateApplication}
          listRevision={mobileListRevision}
        />
      </>
    )
  }

  if (isLoading) {
    return (
      <WorkspaceLoadingSkeleton
        userName={userName}
        stage={WORKSPACE_LOAD_STAGES[0].label}
        progress={8}
      />
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const selectedJob = selectedJobId ? jobApplications.find((j) => j.id === selectedJobId) : null
  const coverLetterResume = coverLetterResumeId
    ? versions.find((v) => v.id === coverLetterResumeId)
    : null
  const embeddedCoverLetter = coverLetterResume?.coverLetter ?? null

  const unsavedLeaveDialog = (
    <UnsavedChangesLeaveDialog
      open={showBackConfirmDialog}
      onOpenChange={setShowBackConfirmDialog}
      isSaving={backConfirmSaving}
      saveError={backConfirmSaveError}
      onStay={dismissLeaveDialog}
      onDiscardAndLeave={handleBackConfirmLeaveWithoutSaving}
      onSaveAndLeave={handleBackConfirmSaveAndLeave}
    />
  )

  const assistantResumeText = (() => {
    if (view === "yourStory" && selectedJob) {
      return resolveResumeForJob(selectedJob, versions)?.resumeText?.trim() ?? ""
    }
    return (
      resumeText ||
      currentVersion?.resumeText ||
      versions[versions.length - 1]?.resumeText ||
      ""
    )
  })()

  const assistantCoverLetterLanguage: "en" | "de" =
    view === "coverLetter" && coverLetterResume?.contactInfo?.language === "de"
      ? "de"
      : "en"

  const assistantCoverLetterText = (() => {
    if (view === "jobCoverLetter" && selectedJob?.coverLetter) {
      const cl = selectedJob.coverLetter
      const legacy = cl.content ?? ""
      const en = cl.contentEn ?? legacy
      const de = cl.contentDe ?? ""
      return (assistantCoverLetterLanguage === "de" ? de || legacy : en || legacy).trim()
    }
    if (view === "coverLetter" && embeddedCoverLetter) {
      const en = embeddedCoverLetter.contentEn ?? ""
      const de = embeddedCoverLetter.contentDe ?? ""
      const fallback = en || de
      return (assistantCoverLetterLanguage === "de" ? de || fallback : en || fallback).trim()
    }
    return ""
  })()

  const assistantSessionId =
    view === "yourStory" && selectedJobId
      ? `your-story-${selectedJobId}`
      : view === "coverLetter" && coverLetterResumeId
      ? `cover-letter-${coverLetterResumeId}`
      : view === "jobCoverLetter" && selectedJobId
        ? `cover-letter-job-${selectedJobId}`
        : activeResumeId ?? "draft"

  const showUnifiedAssistant =
    Boolean(currentFolderId) &&
    !showApplicationWizard &&
    shouldShowAiAssistant(view, Boolean(currentVersion))

  const aiCoachFabCopy = getAiCoachFabCopy(view)

  const unifiedAssistant = showUnifiedAssistant ? (
      <UnifiedAiAssistant
        folderId={currentFolderId!}
        resumeSessionId={assistantSessionId}
        resumeText={assistantResumeText}
        coverLetterText={assistantCoverLetterText}
        coverLetterLanguage={assistantCoverLetterLanguage}
        jobDescription={activeJobDescription}
        outputLanguage={resumeOutputLanguage}
        strategicProfile={strategicProfile}
        onStrategicProfileChange={setStrategicProfile}
        onResumeEdit={handleAiResumeEdit}
        onCoverLetterApply={handleAiCoverLetterApply}
        onUndoResumeEdit={handleUndoResumeEdit}
        canRestoreResume={aiRefineHistory.length > 0}
        onRestoreResume={handleAiRefineRestore}
        onLogAiActivity={handleLogAiActivity}
        currentVersionName={currentVersion?.name}
        currentVersionId={currentVersion?.id ?? null}
        versions={versions}
        jobApplications={jobApplications}
        selectedJobTitle={selectedJob?.jobTitle}
        selectedCompany={selectedJob?.company}
        requireResume={view === "resume"}
        requireCoverLetter={view === "coverLetter" || view === "jobCoverLetter"}
        accentColorHex={accentColorHex ?? currentVersion?.accentColorHex ?? currentVersion?.accentColor}
        fabLabel={aiCoachFabCopy.label}
        fabTooltip={aiCoachFabCopy.tooltip}
      />
    ) : null

  const applicationDraftPromptDialog = (
    <AlertDialog open={applicationDraftPromptOpen} onOpenChange={setApplicationDraftPromptOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unfinished application draft</AlertDialogTitle>
          <AlertDialogDescription>
            You have an unfinished application draft. Resume it or start fresh?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={openFreshApplicationWizard}>Start fresh</AlertDialogCancel>
          <AlertDialogAction onClick={openResumeApplicationWizard}>Resume draft</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const wrapApp = (content: React.ReactNode) => (
    <>
      {unsavedLeaveDialog}
      {applicationDraftPromptDialog}
      <PhraseLibraryProvider
        strategicProfile={strategicProfile}
        qualificationProfile={qualificationProfile}
      >
        {content}
        <PhraseLibraryHost />
      </PhraseLibraryProvider>
      {unifiedAssistant}
    </>
  )

  if (showApplicationWizard && applicationWizardSessionKey) {
    if (!currentFolderId) {
      return wrapApp(
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-lg border bg-card px-6 py-8 text-center space-y-4 shadow-sm">
            <h1 className="text-lg font-semibold text-foreground">Workspace not ready</h1>
            <p className="text-sm text-muted-foreground">
              We could not load your workspace. Wait a moment and try again, or return to the
              dashboard.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                onClick={() => {
                  void syncWorkspaceFromDatabase({ force: true, persistChanges: true })
                }}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApplicationWizard(false)}
              >
                Back to dashboard
              </Button>
            </div>
          </div>
        </div>,
      )
    }

    return wrapApp(
      <ApplicationFlow
        key={applicationWizardSessionKey}
        flowSessionKey={applicationWizardSessionKey}
        restoreDraft={applicationWizardRestoreDraft}
        versions={versions}
        jobApplications={jobApplications}
        onComplete={async (payload) => handleApplicationFlowComplete(payload)}
        onCancel={() => {
          setShowApplicationWizard(false)
          setApplicationWizardSessionKey("")
        }}
      />,
    )
  }

  if (showStoryWizard && selectedJob) {
    const storyWizardResume = resolveResumeForJob(selectedJob, versions)

    return wrapApp(
      <ApplicationStoryWizard
        key={`story-wizard-${selectedJob.id}`}
        job={selectedJob}
        resumeVersion={storyWizardResume}
        outputLanguage={resumeOutputLanguage}
        strategicProfile={strategicProfile}
        onComplete={async (yourStory) => {
          await handleUpdateJob(selectedJob.id, { yourStory })
        }}
        onCancel={() => {
          setShowStoryWizard(false)
          setView("yourStory")
        }}
      />,
    )
  }

  if (view === "yourStory") {
    if (!selectedJob) {
      if (typeof window !== "undefined") {
        queueMicrotask(() => setView("dashboard"))
      }
      return wrapApp(
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading Your Story…
        </div>,
      )
    }

    const yourStoryResume = resolveResumeForJob(selectedJob, versions)

    return wrapApp(
      <WorkspaceShell
        workspaceName={folders.find((f) => f.id === currentFolderId)?.name}
        userName={userName}
        profileImage={sidebarProfileImage}
        activeNav="applications"
        onNavigate={handleWorkspaceNavigate}
        footerVariant="new-application"
        onNewApplication={handleCreateApplication}
        showNewApplicationFab={!showUnifiedAssistant}
        journeyProgress={journeyProgress}
      >
        <YourStoryView
          key={selectedJob.id}
          job={selectedJob}
          resumeVersion={yourStoryResume}
          outputLanguage={resumeOutputLanguage}
          strategicProfile={strategicProfile}
          onUpdate={(updates) => handleUpdateJob(selectedJob.id, updates)}
          onBack={handleYourStoryBack}
          onOpenStoryWizard={() => openStoryWizardForApplication(selectedJob.id, yourStoryReturnView)}
          onApplyCvSuggestions={(suggestionsMarkdown) => {
            if (typeof window !== "undefined") {
              sessionStorage.setItem("pendingCvStorySuggestions", suggestionsMarkdown)
            }
            if (yourStoryResume) {
              loadVersion(yourStoryResume)
            }
            setView("resume")
            toast({
              title: "CV suggestions ready",
              description: "Open AI CV Coach and ask it to apply the suggested edits.",
            })
          }}
        />
      </WorkspaceShell>,
    )
  }

  if (view === "coverLetter") {
    if (!coverLetterResumeId || !coverLetterResume) {
      if (typeof window !== "undefined") {
        queueMicrotask(() => {
          setCoverLetterResumeId(null)
          setView(currentVersion ? "resume" : "dashboard")
        })
      }
      return wrapApp(
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading cover letter…
        </div>,
      )
    }

    const letterForView = resolveResumeEmbeddedCoverLetter(
      coverLetterResume,
      coverLetters,
    )

    return wrapApp(
      <WorkspaceShell
        workspaceName={folders.find((f) => f.id === currentFolderId)?.name}
        userName={userName}
        profileImage={sidebarProfileImage}
        activeNav="applications"
        onNavigate={handleCoverLetterShellNav}
        footerVariant="new-application"
        onNewApplication={handleCreateApplication}
        showNewApplicationFab={!showUnifiedAssistant}
        journeyProgress={journeyProgress}
      >
        <StandaloneCoverLetter
          key={coverLetterResumeId}
          resumeId={coverLetterResumeId}
          coverLetter={letterForView}
          resumeVersions={versions}
          onUpdate={(updates) => updateResumeCoverLetter(coverLetterResumeId, updates)}
          initialMode={standaloneCoverLetterMode}
          onBack={handleCoverLetterBackToOverview}
          onBackToOverview={handleCoverLetterBackToOverview}
          onRegisterExit={(handler) => {
            coverLetterExitHandlerRef.current = handler
          }}
          contactInfo={coverLetterResume.contactInfo}
          jobDescription={coverLetterResume.jobDescription}
          resumeText={coverLetterResume.resumeText}
        />
      </WorkspaceShell>,
    )
  }

  // Cover letter linked to a job application (from Resume Builder)
  if (view === "jobCoverLetter" && selectedJob) {
    return wrapApp(
      <WorkspaceShell
        workspaceName={folders.find((f) => f.id === currentFolderId)?.name}
        userName={userName}
        profileImage={sidebarProfileImage}
        activeNav="applications"
        onNavigate={handleCoverLetterShellNav}
        footerVariant="new-application"
        onNewApplication={handleCreateApplication}
        showNewApplicationFab={!showUnifiedAssistant}
        journeyProgress={journeyProgress}
      >
        <CoverLetterFormatter
          key={`${selectedJob.id}-${jobCoverLetterMode}`}
          job={selectedJob}
          resumeVersions={versions}
          folderId={currentFolderId}
          initialMode={jobCoverLetterMode}
          onUpdate={(updates) => handleUpdateJob(selectedJob.id, updates)}
          onBack={handleCoverLetterBackToOverview}
          onBackToOverview={handleCoverLetterBackToOverview}
          onRegisterExit={(handler) => {
            coverLetterExitHandlerRef.current = handler
          }}
        />
      </WorkspaceShell>,
    )
  }

  if (view === "interviewPrep" && selectedJob) {
    return wrapApp(
      <InterviewPrep
        job={selectedJob}
        onUpdate={(updates) => {
          const newJobs = jobApplications.map((j) => (j.id === selectedJobId ? { ...j, ...updates } : j))
          setJobApplications(newJobs)
          saveJobApplications(newJobs)
        }}
        onBack={() => setView("dashboard")}
      />,
    )
  }

  if (view === "companyInfo" && selectedJob) {
    return wrapApp(
      <CompanyInfo
        jobApplication={selectedJob}
        onUpdate={(updates) => {
          const newJobs = jobApplications.map((j) => (j.id === selectedJobId ? { ...j, ...updates } : j))
          setJobApplications(newJobs)
          saveJobApplications(newJobs)
        }}
        onClose={() => setView("dashboard")}
      />,
    )
  }

  if (view === "contacts" && selectedJob) {
    return wrapApp(
      <Contacts
        job={selectedJob}
        onUpdate={(updates) => {
          const newJobs = jobApplications.map((j) => (j.id === selectedJobId ? { ...j, ...updates } : j))
          setJobApplications(newJobs)
          saveJobApplications(newJobs)
        }}
        onBack={() => setView("dashboard")}
      />,
    )
  }

  if (view === "jobStrategy" && selectedJob) {
    return wrapApp(
      <JobStrategy
        job={selectedJob}
        onUpdate={(updates) => {
          const newJobs = jobApplications.map((j) => (j.id === selectedJobId ? { ...j, ...updates } : j))
          setJobApplications(newJobs)
          saveJobApplications(newJobs)
        }}
        onBack={() => setView("dashboard")}
      />,
    )
  }

  if (view === "folders") {
    const loggedInUser = getCvUser()
    const targetFolder = loggedInUser ? findFolderForUser(folders, loggedInUser) : undefined
    const showBootstrapSkeleton =
      Boolean(loggedInUser) && isResolvingWorkspace && !workspaceBootstrapFailed

    if (showBootstrapSkeleton) {
      return wrapApp(
        <WorkspaceLoadingSkeleton
          folderName={targetFolder?.name ?? loggedInUser?.username}
          userName={userName}
          stage={
            foldersLoading && folders.length === 0
              ? "Loading workspaces…"
              : "Opening workspace…"
          }
          progress={foldersLoading && folders.length === 0 ? 12 : 55}
        />,
      )
    }

    return wrapApp(
      <FoldersView
        folders={folders}
        isLoading={foldersLoading}
        loadError={
          workspaceBootstrapFailed && !foldersLoadError
            ? "Could not open your workspace automatically. Select one below or create a new workspace."
            : foldersLoadError
        }
        onRetryLoad={() => {
          setWorkspaceBootstrapFailed(false)
          setIsResolvingWorkspace(true)
          defaultWorkspaceBootstrapRef.current = false
          void refreshDataFromDatabase(true)
        }}
        onSelectFolder={handleSelectFolder}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onRenameFolder={handleRenameFolder}
        unlockedFolderIds={unlockedFolderIds}
        onUnlockFolder={handleUnlockFolder}
        onLockFolder={handleLockFolder}
      />,
    )
  }

  if (
    (view === "careerHome" ||
      view === "opportunities" ||
      view === "careerBrain" ||
      view === "roleMatches" ||
      view === "scenarioLab" ||
      view === "aiCoach" ||
      view === "settings" ||
      view === "programme" ||
      isIntegrationSectionView(view)) &&
    currentFolderId
  ) {
    const currentFolder = folders.find((f) => f.id === currentFolderId)

    if (workspaceLoading.active) {
      return wrapApp(
        <WorkspaceLoadingSkeleton
          folderName={currentFolder?.name}
          userName={userName}
          stage={workspaceLoading.stage}
          progress={workspaceLoading.progress}
        />,
      )
    }

    const activeNav = workspaceNavFromView(view)

    return wrapApp(
      <WorkspaceShell {...workspaceShellProps} activeNav={activeNav}>
        {view === "careerHome" ? (
          <CareerDashboard
            folderId={currentFolderId}
            folderName={currentFolder?.name}
            jobApplications={jobApplications}
            versions={versions}
            strategicProfile={strategicProfile}
            qualificationProfile={qualificationProfile}
            userName={userName}
            onNavigateOpportunities={() => setView("opportunities")}
            onNavigateApplications={() => handleWorkspaceNavigate("applications")}
            onNavigateAiCoach={() => handleWorkspaceNavigate("aiCoach")}
            onStartApplication={handleCreateApplication}
            journeyProgress={journeyProgress}
            careerJourneyGuide={careerJourneyGuide}
            onJourneyNavigate={handleJourneyNavigate}
            onOpenApplication={(jobId) => {
              setSelectedJobId(jobId)
              handleWorkspaceNavigate("applications")
            }}
            onCareerAction={handleCareerAction}
            onOpenProgramme={() => setView("programme")}
          />
        ) : null}
        {isIntegrationSectionView(view) ? (
          <IntegrationSectionPage
            config={INTEGRATION_SECTIONS[view]}
            onBack={() => setView("careerHome")}
            qualificationProfile={qualificationProfile}
            onQualificationProfileChange={setQualificationProfile}
            onNavigateCareerBrain={() => handleWorkspaceNavigate("careerBrain")}
            folderId={currentFolderId ?? "local"}
            onNavigateAiCoach={() => handleWorkspaceNavigate("aiCoach")}
            strategicProfile={strategicProfile}
          />
        ) : null}
        {view === "programme" ? (
          <ProgrammePage onBack={() => setView("settings")} />
        ) : null}
        {view === "opportunities" ? (
          <OpportunitiesSection
            jobApplications={jobApplications}
            versions={versions}
            onStartApplication={handleCreateApplication}
            onTrackApplication={() => handleWorkspaceNavigate("applications")}
          />
        ) : null}
        {view === "careerBrain" ? (
          <CareerBrainSection
            folderId={currentFolderId}
            versions={versions}
            jobApplications={jobApplications}
            userName={userName}
            userEmail={userEmail}
          />
        ) : null}
        {view === "roleMatches" ? (
          <RoleMatchesPage
            folderId={currentFolderId}
            jobApplications={jobApplications}
            versions={versions}
            strategicProfile={strategicProfile}
            qualificationProfile={qualificationProfile}
            onNavigateCareerBrain={() => handleWorkspaceNavigate("careerBrain")}
          />
        ) : null}
        {view === "scenarioLab" ? (
          <ScenarioLabPage
            folderId={currentFolderId}
            strategicProfile={strategicProfile}
            qualificationProfile={qualificationProfile}
            outputLanguage={resumeOutputLanguage}
          />
        ) : null}
        {view === "aiCoach" ? (
          <AiCoachPage
            folderId={currentFolderId}
            versions={versions}
            jobApplications={jobApplications}
            strategicProfile={strategicProfile}
            outputLanguage={resumeOutputLanguage}
            userName={userName}
          />
        ) : null}
        {view === "settings" ? (
          <SettingsHub
            userName={userName}
            userEmail={userEmail}
            folderName={currentFolder?.name}
            folderProfileImage={currentFolder?.profileImage ?? sidebarProfileImage}
            folderContactInfo={currentFolder?.contactInfo}
            onUpdateFolder={handleUpdateFolder}
            onSaveProfile={handleSaveProfile}
            onBackToFolders={handleBackToFolders}
            onDataDeleted={() => void refreshDataFromDatabase(true)}
            onOpenProgramme={() => setView("programme")}
            folderId={currentFolderId}
          />
        ) : null}
      </WorkspaceShell>,
    )
  }

  if (view === "dashboard") {
    const currentFolder = folders.find((f) => f.id === currentFolderId)

    if (workspaceLoading.active) {
      return wrapApp(
        <WorkspaceLoadingSkeleton
          folderName={currentFolder?.name}
          userName={userName}
          stage={workspaceLoading.stage}
          progress={workspaceLoading.progress}
        />,
      )
    }

    return wrapApp(
      <>
        <Dashboard
        jobApplications={jobApplications} // Fixed prop name from 'jobs' to 'jobApplications'
        versions={versions}
        coverLetters={coverLetters}
        workspaceSyncStatus={workspaceSync.status}
        workspaceSyncMessage={workspaceSync.message}
        onOpenCompanyInfo={handleOpenCompanyInfo}
        onOpenContacts={handleOpenContacts}
        onOpenJobStrategy={handleOpenJobStrategy}
        onOpenApplicationCoverLetter={(jobId) => {
          void openCoverLetterForApplication(jobId)
        }}
        onOpenYourStory={(jobId) => openYourStoryForApplication(jobId, "dashboard")}
        onOpenStoryWizard={(jobId) => openStoryWizardForApplication(jobId, "dashboard")}
        onOpenCoverLetterWizard={(jobId) => {
          void openCoverLetterForApplication(jobId, "wizard")
        }}
        onOpenCoverLetterEditor={(jobId) => {
          void openCoverLetterForApplication(jobId, "editor")
        }}
        onOpenInterviewPrep={handleOpenInterviewPrep}
        onCreateJobApplication={handleOpenJobApplication}
        onStartApplicationWizard={handleCreateApplication}
        onOpenApplicationWizardForJob={openApplicationWizardForJob}
        onUploadCvForApplication={uploadCvForApplication}
        cvImportingJobId={cvImportingJobId}
        onUploadCoverLetterForApplication={uploadCoverLetterForApplication}
        onApplicationFlowComplete={handleApplicationFlowComplete}
        onCreateNew={handleCreateNew}
        onOpenResumeWorkspace={openResumeWorkspace}
        onCreateCoverLetter={handleCreateCoverLetter}
        onUpdateJobStatus={handleUpdateJobStatus}
        onUpdateJob={handleUpdateJob}
        onLoadVersion={loadVersion}
        onOpenApplicationResume={openApplicationResume}
        onDeleteVersion={deleteVersion}
        onRenameVersion={renameVersion}
        onUpdateVersionRole={updateVersionRole}
        onDeleteCoverLetter={handleDeleteCoverLetter}
        onDeleteJobApplication={handleDeleteJobApplication}
        onRefresh={() => syncWorkspaceFromDatabase({ force: true, persistChanges: true })}
        onExportAll={exportAllData}
        onImportAll={() => importAllInputRef.current?.click()}
        onBack={handleBackToFolders}
        folderName={folders.find((f) => f.id === currentFolderId)?.name}
        folderProfileImage={folders.find((f) => f.id === currentFolderId)?.profileImage}
        folderContactInfo={folders.find((f) => f.id === currentFolderId)?.contactInfo}
        onUpdateFolder={handleUpdateFolder}
        onSaveProfile={handleSaveProfile}
        userName={userName}
        userEmail={userEmail}
        profileImage={profileImage}
        onOpenStatistics={handleOpenStatistics}
        onWorkspaceNavigate={handleWorkspaceNavigate}
        dateSort={applicationsSort}
        onDateSortChange={setApplicationsSort}
        detailsApplicationId={detailsApplicationId}
        onDetailsApplicationIdChange={(jobId) => {
          setDetailsApplicationId(jobId)
          setSelectedJobId(jobId)
          selectedJobIdRef.current = jobId
        }}
        folderId={currentFolderId}
        onRestoreSnapshot={(resumeId, snapshotId) =>
          void handleRestoreSnapshot(resumeId, snapshotId)
        }
        onDataDeleted={() => void refreshDataFromDatabase(true)}
        />
        <input
          ref={importAllInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => void importAllData(event)}
        />
        <ImportCvPreviewDialog
          open={pendingCvImport !== null}
          payload={pendingCvImport}
          isSaving={isSavingCvImport}
          onOpenChange={(open) => {
            if (!open && !isSavingCvImport) setPendingCvImport(null)
          }}
          onConfirm={confirmCvImport}
        />
      </>,
    )
  }

  if (view === "statistics" && currentFolderId) {
    const statisticsFolder = folders.find((f) => f.id === currentFolderId)

    const handleStatisticsSidebarNav = (id: WorkspaceNavId) => {
      handleWorkspaceNavigate(id)
    }

    return wrapApp(
      <WorkspaceShell
        workspaceName={statisticsFolder?.name}
        userName={userName}
        profileImage={sidebarProfileImage}
        activeNav="progress"
        onNavigate={handleStatisticsSidebarNav}
        footerVariant="new-application"
        onNewApplication={handleCreateApplication}
        showNewApplicationFab={!showUnifiedAssistant}
        journeyProgress={journeyProgress}
      >
        <CareerProgressPage
          folderId={currentFolderId}
          folderName={statisticsFolder?.name}
          jobApplications={jobApplications}
          versions={versions}
          outputLanguage={resumeOutputLanguage}
          userName={userName}
          userEmail={userEmail}
          onSaveProfile={handleSaveProfile}
          onNavigateAiCoach={() => handleWorkspaceNavigate("aiCoach")}
          onOpenResume={openResumeWorkspace}
          onNavigateApplications={() => handleWorkspaceNavigate("applications")}
        />
      </WorkspaceShell>,
    )
  }

  const resumeDisplayTitle =
    currentVersion?.name ??
    defaultResumeTitle(contactInfo, pendingApplicationName)

  const handleResumeSidebarNav = (id: WorkspaceNavId) => {
    handleWorkspaceNavigate(id)
  }

  const showResumeEmptyState =
    versions.length === 0 &&
    currentVersionIndex === null &&
    !resumeText.trim() &&
    !draftResumeIdRef.current

  const linkedApplicationForFormatter =
    selectedJob ??
    (currentVersion?.applicationId
      ? jobApplications.find((job) => job.id === currentVersion.applicationId)
      : currentVersion?.id
        ? jobApplications.find((job) => job.resumeVersionId === currentVersion.id)
        : undefined)

  return wrapApp(
    <WorkspaceShell
      workspaceName={folders.find((f) => f.id === currentFolderId)?.name}
      userName={userName}
      profileImage={sidebarProfileImage}
      activeNav="applications"
      onNavigate={handleResumeSidebarNav}
      footerVariant="new-application"
      onNewApplication={handleCreateApplication}
      showNewApplicationFab={!showUnifiedAssistant}
      onLayoutChange={scheduleScaleCv}
      journeyProgress={journeyProgress}
    >
      {showResumeEmptyState ? (
        <>
          <input
            ref={resumeEmptyImportRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportResumeFile}
          />
          <ResumeEmptyState
            onStart={handleCreateApplication}
            onOpenExisting={handleOpenExistingResume}
            onCreateApplication={handleCreateApplication}
          />
        </>
      ) : (
      <div className="ui-formatter-shell ui-formatter-shell--v2">
        <ResumePreview
              panel="formatter"
              previewSectionRef={previewRef}
              onRegisterScale={(fn) => {
                scaleCvRef.current = fn
              }}
              onRegisterDocumentActions={handleRegisterFormatterDocumentActions}
              formatterBreadcrumb={
                <p className="formatter-breadcrumb">
                  <span className="formatter-breadcrumb__muted">Documents / </span>
                  {selectedJob
                    ? `${selectedJob.company}${selectedJob.jobTitle ? ` — ${selectedJob.jobTitle}` : ""}`
                    : resumeDisplayTitle}
                </p>
              }
              formatterTopbarRight={
                <>
                  <ResumeCloudSyncStatus
                    status={
                      isUpdatingVersion || resumeAutosaveStatus === "saving" || isRetryingResumeSync
                        ? "syncing"
                        : resumeCloudSync.status
                    }
                    remoteError={resumeCloudSync.remoteError}
                    unsaved={
                      hasUnsavedChanges &&
                      !(isUpdatingVersion || resumeAutosaveStatus === "saving")
                    }
                    onRetrySync={
                      resumeCloudSync.status === "local_only" ? handleRetryResumeCloudSync : undefined
                    }
                    isRetryingSync={isRetryingResumeSync}
                  />
                  <ProfileMenu
                    userName={userName}
                    userEmail={userEmail}
                    profileImage={null}
                    onSaveProfile={handleSaveProfile}
                  />
                </>
              }
              versionActionsSlot={
                <SavedVersions
                  variant="drawer"
                  versions={versions}
                  currentVersionId={currentVersion?.id || null}
                  currentResumeName={resumeDisplayTitle}
                  onSave={handleSaveResumeByName}
                  onLoad={loadVersion}
                  onRestoreSnapshot={handleRestoreSnapshot}
                  onDelete={deleteVersion}
                  onRename={renameVersion}
                  onUpdate={updateCurrentVersion}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onScrollToPreview={scrollToPreview}
                  isUpdating={isUpdatingVersion}
                  onStartAgain={() => setShowStartAgainDialog(true)}
                  defaultVersionName={
                    selectedJob?.jobTitle?.trim() ||
                    pendingApplicationName.trim() ||
                    currentVersion?.name ||
                    ""
                  }
                />
              }
              leftSlot={
                <ResumeInput
                  key={currentVersion?.id || "new-resume"}
                  initialVersion={(() => {
                    const currentFolder = folders.find((f) => f.id === currentFolderId)
                    const folderProfileImage = currentFolder?.profileImage || null
                    const folderContactInfo = currentFolder?.contactInfo

                    if (currentVersion) {
                      return {
                        resumeText: resumeText || currentVersion.resumeText,
                        profileImage: profileImage ?? currentVersion.profileImage,
                        companyLogo: companyLogo ?? currentVersion.companyLogo,
                        accentColor: accentColor || currentVersion.accentColor,
                        accentColorHex: accentColorHex || currentVersion.accentColorHex,
                        targetBoxBgColor,
                        targetBoxBorderColor,
                        profilePhotoBorder,
                        contactInfo: previewContactInfo,
                      }
                    }

                    return {
                      resumeText: resumeText || "",
                      profileImage: folderProfileImage ?? profileImage,
                      companyLogo: null,
                      accentColor: accentColor || "oklch(65% .15 85)",
                      accentColorHex: accentColorHex || "#b89968",
                      targetBoxBgColor,
                      targetBoxBorderColor,
                      profilePhotoBorder,
                      contactInfo: getWorkspaceContactDefaults(
                        folderContactInfo,
                        versions,
                      ),
                    }
                  })()}
                  onSave={saveNewVersion}
                  onResumeUpdate={handleResumeUpdate}
                  jobDescription={
                    currentVersion?.jobDescription ||
                    (typeof window !== "undefined"
                      ? sessionStorage.getItem("pendingJobDescription") || ""
                      : "")
                  }
                  onJobDescriptionChange={handleResumeJobDescriptionChange}
                  linkedJobDescriptionUrl={
                    selectedJob?.jobDescriptionUrl ||
                    jobApplications.find(
                      (job) =>
                        job.resumeVersionId === currentVersion?.id ||
                        (currentVersion?.applicationId &&
                          job.id === currentVersion.applicationId),
                    )?.jobDescriptionUrl ||
                    null
                  }
                  resumeDisplayName={
                    selectedJob?.company ||
                    currentVersion?.name ||
                    resumeDisplayTitle
                  }
                  targetRoleDisplay={
                    selectedJob?.jobTitle ||
                    previewContactInfo.targetRole ||
                    previewContactInfo.professionalTitle
                  }
                />
              }
              version={{
                id: currentVersion?.id || "temp",
                name:
                  currentVersion?.name ||
                  pendingApplicationName.trim() ||
                  defaultResumeTitle(contactInfo, pendingApplicationName) ||
                  "New Resume",
                resumeText: resumeText,
                contactInfo: previewContactInfo,
                profileImage: profileImage,
                companyLogo: companyLogo,
                accentColor: accentColor,
                accentColorHex: accentColorHex,
                targetBoxBgColor: targetBoxBgColor,
                targetBoxBorderColor: targetBoxBorderColor,
                profilePhotoBorder: profilePhotoBorder,
                timestamp: currentVersion?.timestamp || Date.now(),
                versionHistory: currentVersion?.versionHistory,
                aiAuditLog: currentVersion?.aiAuditLog,
                aiProvenance: currentVersion?.aiProvenance,
              }}
              onOpenCoverLetter={handleOpenCoverLetterFromResume}
              hasSavedCoverLetter={hasResumeCoverLetterRecord(currentVersion?.coverLetter)}
              onOpenYourStory={
                linkedApplicationForFormatter ? handleOpenYourStoryFromResume : undefined
              }
              hasYourStory={hasUsableYourStory(linkedApplicationForFormatter?.yourStory)}
              trustAllResumes={versions}
              trustFolderId={currentFolderId}
              onTrustRestoreSnapshot={(resumeId, snapshotId) =>
                void handleRestoreSnapshot(resumeId, snapshotId)
              }
              onTrustDataDeleted={() => void refreshDataFromDatabase(true)}
            />
      </div>
      )}
      <Dialog open={showStartAgainDialog} onOpenChange={setShowStartAgainDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Re-generate Resume Content</DialogTitle>
            <DialogDescription>
              Update your resume content while keeping all formatting and contact info
            </DialogDescription>
          </DialogHeader>
          <GettingStartedGuide
            defaultExpanded
            updateMode
            initialJobDescription={
              currentVersion?.jobDescription ||
              (typeof window !== "undefined"
                ? sessionStorage.getItem("pendingJobDescription") || ""
                : "")
            }
            onUpdateResumeContent={handleStartAgainUpdate}
            onCancel={() => setShowStartAgainDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </WorkspaceShell>,
  )
}
