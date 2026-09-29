"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MobileApplicationsList } from "@/components/mobile/mobile-applications-list"
import { MobileCoverLetters } from "@/components/mobile/mobile-cover-letters"
import { MobileKeywords } from "@/components/mobile/mobile-keywords"
import { MobileResumes } from "@/components/mobile/mobile-resumes"
import { getCvUser, setCvUser, fetchCvUserFromSession } from "@/lib/cv-auth"
import { normalizeJobApplication } from "@/lib/application-outcome"
import { sortJobApplicationsByDate } from "@/lib/job-application-display"
import { loadAllResumesForAccount, normalizeResumeVersion } from "@/lib/resume-persistence"
import { loadJobApplications } from "@/lib/storage"
import { ensureSupabaseAuthSession } from "@/lib/supabase/app-auth"
import { isSupabaseAuthBlocked } from "@/lib/supabase/client-auth-cache"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Briefcase, FileText, KeyRound, Mail } from "lucide-react"

type MobileTab = "applications" | "resume" | "coverLetter" | "keywords"

const TABS: {
  id: MobileTab
  label: string
  icon: typeof Briefcase
}[] = [
  { id: "applications", label: "Apps", icon: Briefcase },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "coverLetter", label: "Letter", icon: Mail },
  { id: "keywords", label: "Keywords", icon: KeyRound },
]

type MobileAppProps = {
  /** Opens the shared application creation wizard (ApplicationFlow). */
  onCreateApplication?: () => void
  /** Bump after wizard save so phone lists reload from storage. */
  listRevision?: number
}

/**
 * Secondary phone UI for `/app`. Desktop formatter is unchanged —
 * narrow viewports render this shell instead of LargeScreenRequired.
 */
export function MobileApp({
  onCreateApplication,
  listRevision = 0,
}: MobileAppProps) {
  const router = useRouter()
  const [tab, setTab] = useState<MobileTab>("applications")
  const [authReady, setAuthReady] = useState(false)
  const [loadingApps, setLoadingApps] = useState(true)
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [appsError, setAppsError] = useState<string | null>(null)
  const [resumesError, setResumesError] = useState<string | null>(null)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [resumes, setResumes] = useState<ResumeVersion[]>([])
  const [openResumeId, setOpenResumeId] = useState<string | null>(null)
  const [openLetterResumeId, setOpenLetterResumeId] = useState<string | null>(null)

  const loadApps = useCallback(async () => {
    setLoadingApps(true)
    setAppsError(null)
    try {
      const raw = await loadJobApplications()
      const normalized = sortJobApplicationsByDate(
        raw.map((job) => normalizeJobApplication(job)),
      )
      setApplications(normalized)
    } catch (err) {
      console.error("[mobile] Failed to load applications:", err)
      setAppsError("Couldn’t load applications. Check your connection and try again.")
    } finally {
      setLoadingApps(false)
    }
  }, [])

  const loadResumes = useCallback(async () => {
    setLoadingResumes(true)
    setResumesError(null)
    try {
      const raw = await loadAllResumesForAccount()
      const normalized = raw
        .map((resume) => normalizeResumeVersion(resume))
        .sort((a, b) => (b.updatedAt ?? b.timestamp ?? 0) - (a.updatedAt ?? a.timestamp ?? 0))
      setResumes(normalized)
    } catch (err) {
      console.error("[mobile] Failed to load resumes:", err)
      setResumesError("Couldn’t load resumes. Check your connection and try again.")
    } finally {
      setLoadingResumes(false)
    }
  }, [])

  const jumpToResume = useCallback((resumeId: string) => {
    setOpenResumeId(resumeId)
    setTab("resume")
  }, [])

  const jumpToCoverLetter = useCallback((resumeId: string) => {
    setOpenLetterResumeId(resumeId)
    setTab("coverLetter")
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        let user = getCvUser()
        if (!user) {
          user = await fetchCvUserFromSession()
          if (user) setCvUser(user)
        }
        if (!user) {
          router.replace("/login")
          return
        }

        try {
          if (!isSupabaseAuthBlocked()) {
            await ensureSupabaseAuthSession()
          }
        } catch (err) {
          console.warn("[mobile] Supabase session bootstrap failed:", err)
        }

        if (cancelled) return
        setAuthReady(true)
        await Promise.all([loadApps(), loadResumes()])
      } catch (err) {
        console.error("[mobile] Auth bootstrap failed:", err)
        if (!cancelled) {
          setAppsError("Something went wrong signing you in.")
          setAuthReady(true)
          setLoadingApps(false)
          setLoadingResumes(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadApps, loadResumes, router])

  useEffect(() => {
    if (!authReady || listRevision <= 0) return
    void Promise.all([loadApps(), loadResumes()])
  }, [authReady, listRevision, loadApps, loadResumes])

  if (!authReady) {
    return (
      <main className="flex h-dvh items-center justify-center bg-white">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" aria-hidden />
        <span className="sr-only">Loading</span>
      </main>
    )
  }

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-white text-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "applications" ? (
          <MobileApplicationsList
            applications={applications}
            resumes={resumes}
            loading={loadingApps}
            error={appsError}
            onRefresh={() => void loadApps()}
            onApplicationsChange={setApplications}
            onOpenResume={jumpToResume}
            onOpenCoverLetter={jumpToCoverLetter}
            onCreateApplication={onCreateApplication}
          />
        ) : null}
        {tab === "resume" ? (
          <MobileResumes
            resumes={resumes}
            loading={loadingResumes}
            error={resumesError}
            onRefresh={() => void loadResumes()}
            onResumesChange={setResumes}
            openResumeId={openResumeId}
            onOpenResumeConsumed={() => setOpenResumeId(null)}
          />
        ) : null}
        {tab === "coverLetter" ? (
          <MobileCoverLetters
            resumes={resumes}
            loading={loadingResumes}
            error={resumesError}
            onRefresh={() => void loadResumes()}
            onResumesChange={setResumes}
            openResumeId={openLetterResumeId}
            onOpenResumeConsumed={() => setOpenLetterResumeId(null)}
          />
        ) : null}
        {tab === "keywords" ? <MobileKeywords applications={applications} /> : null}
      </div>

      <nav
        className="shrink-0 border-t border-zinc-200 bg-white pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1"
        aria-label="Mobile navigation"
      >
        <ul className="grid grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                    active ? "text-teal-800" : "text-zinc-500",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", active ? "text-teal-700" : "text-zinc-400")}
                    strokeWidth={active ? 2 : 1.75}
                    aria-hidden
                  />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </main>
  )
}
