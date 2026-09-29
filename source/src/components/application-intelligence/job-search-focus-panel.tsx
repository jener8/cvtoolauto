"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { discoverJobSearchCompanies } from "@/app/actions/discover-job-search-companies"
import { generateJobSearchTitles } from "@/app/actions/generate-job-search-titles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  buildFallbackJobTitles,
  computeJobSearchFocus,
  isCompanyTargetDone,
  primaryResumeText,
  type CompanySearchTarget,
} from "@/lib/job-search-focus"
import { jobSearchCompaniesFingerprint } from "@/lib/job-search-companies-fingerprint"
import {
  loadJobSearchCompaniesCache,
  saveJobSearchCompaniesCache,
} from "@/lib/job-search-companies-storage"
import { jobSearchTitlesFingerprint } from "@/lib/job-search-titles-fingerprint"
import {
  loadJobSearchTitlesCache,
  saveJobSearchTitlesCache,
} from "@/lib/job-search-titles-storage"
import {
  loadJobSearchFocusChecklist,
  saveJobSearchFocusChecklist,
} from "@/lib/job-search-focus-storage"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { Briefcase, Loader2, Target } from "lucide-react"

type JobSearchFocusPanelProps = {
  folderId: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
  onNavigateOpportunities?: () => void
}

export function JobSearchFocusPanel({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
  onNavigateOpportunities,
}: JobSearchFocusPanelProps) {
  const focus = useMemo(
    () =>
      computeJobSearchFocus({
        folderId,
        jobs: jobApplications,
        versions,
        strategicProfile,
      }),
    [folderId, jobApplications, versions, strategicProfile],
  )

  const titlesFingerprint = useMemo(
    () =>
      jobSearchTitlesFingerprint({
        folderId,
        strategicProfile,
        versions,
        jobs: jobApplications,
      }),
    [folderId, strategicProfile, versions, jobApplications],
  )

  const fallbackTitles = useMemo(
    () =>
      buildFallbackJobTitles({
        folderId,
        jobs: jobApplications,
        versions,
        strategicProfile,
      }),
    [folderId, jobApplications, versions, strategicProfile],
  )

  const [jobTitles, setJobTitles] = useState<string[]>(fallbackTitles)
  const [titlesLoading, setTitlesLoading] = useState(true)
  const [titlesSource, setTitlesSource] = useState<"ai" | "fallback">("fallback")

  const [companyTargets, setCompanyTargets] = useState<CompanySearchTarget[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companiesSource, setCompaniesSource] = useState<"ai" | "fallback">("fallback")
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  const companiesFingerprint = useMemo(
    () =>
      jobSearchCompaniesFingerprint({
        folderId,
        strategicProfile,
        versions,
        jobs: jobApplications,
        jobTitles,
      }),
    [folderId, strategicProfile, versions, jobApplications, jobTitles],
  )

  useEffect(() => {
    setChecklist(loadJobSearchFocusChecklist(folderId))
  }, [folderId])

  useEffect(() => {
    let cancelled = false

    const cached = loadJobSearchTitlesCache(folderId)
    if (cached && cached.fingerprint === titlesFingerprint && cached.jobTitles.length > 0) {
      setJobTitles(cached.jobTitles)
      setTitlesSource(cached.source)
      setTitlesLoading(false)
      return
    }

    setTitlesLoading(true)
    setJobTitles(fallbackTitles)
    setTitlesSource("fallback")

    void (async () => {
      const result = await generateJobSearchTitles({
        strategicProfile,
        resumeText: primaryResumeText(versions),
        jobs: jobApplications,
      })

      if (cancelled) return

      if (result.success && result.jobTitles?.length) {
        setJobTitles(result.jobTitles)
        setTitlesSource("ai")
        saveJobSearchTitlesCache(folderId, {
          fingerprint: titlesFingerprint,
          jobTitles: result.jobTitles,
          generatedAt: Date.now(),
          source: "ai",
        })
      } else {
        setJobTitles(fallbackTitles)
        setTitlesSource("fallback")
        if (fallbackTitles.length > 0) {
          saveJobSearchTitlesCache(folderId, {
            fingerprint: titlesFingerprint,
            jobTitles: fallbackTitles,
            generatedAt: Date.now(),
            source: "fallback",
          })
        }
      }

      setTitlesLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [titlesFingerprint, folderId, strategicProfile, versions, jobApplications, fallbackTitles])

  useEffect(() => {
    if (titlesLoading || jobTitles.length === 0) {
      if (!titlesLoading && jobTitles.length === 0) {
        setCompanyTargets([])
        setCompaniesLoading(false)
      }
      return
    }

    let cancelled = false

    const cached = loadJobSearchCompaniesCache(folderId)
    if (
      cached &&
      cached.fingerprint === companiesFingerprint &&
      cached.companies.length > 0
    ) {
      setCompanyTargets(cached.companies)
      setCompaniesSource(cached.source)
      setCompaniesLoading(false)
      return
    }

    setCompaniesLoading(true)

    void (async () => {
      const result = await discoverJobSearchCompanies({
        strategicProfile,
        resumeText: primaryResumeText(versions),
        jobs: jobApplications,
        jobTitles,
      })

      if (cancelled) return

      if (result.success && result.companies?.length) {
        setCompanyTargets(result.companies)
        setCompaniesSource(result.source ?? "ai")
        saveJobSearchCompaniesCache(folderId, {
          fingerprint: companiesFingerprint,
          companies: result.companies,
          generatedAt: Date.now(),
          source: result.source ?? "ai",
        })
      } else {
        setCompanyTargets([])
      }

      setCompaniesLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [
    companiesFingerprint,
    folderId,
    strategicProfile,
    versions,
    jobApplications,
    jobTitles,
    titlesLoading,
  ])

  const toggleTarget = useCallback(
    (target: CompanySearchTarget, checked: boolean) => {
      setChecklist((prev) => {
        const next = { ...prev, [target.id]: checked }
        saveJobSearchFocusChecklist(folderId, next)
        return next
      })
    },
    [folderId],
  )

  const pendingCount = companyTargets.filter((t) => !isCompanyTargetDone(t, checklist)).length

  return (
    <div className="grid gap-6 lg:col-span-12 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Briefcase className="h-4 w-4 text-[var(--icon-applications)]" aria-hidden />
            Job titles to search for
          </CardTitle>
          <CardDescription>
            {titlesSource === "ai"
              ? "Suggested from your CV, career story, and application history — paste these into job boards."
              : "Based on your applications so far — we will refine these when AI analysis is available."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {titlesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Analysing which roles fit you best…
            </div>
          ) : jobTitles.length > 0 ? (
            <ul className="space-y-2" aria-label="Recommended job titles">
              {jobTitles.map((title) => (
                <li key={title}>
                  <span className="block rounded-lg border border-[color:var(--ds-brand-border-soft)] bg-[var(--ds-brand-surface-soft)] px-3 py-2.5 text-sm font-medium leading-snug text-[var(--color-forest)]">
                    {title}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete your career story and CV, then analyse a role — we will suggest titles to
              search for.
            </p>
          )}
          {onNavigateOpportunities ? (
            <button
              type="button"
              className="mt-4 text-sm font-medium text-[var(--color-primary-light)] hover:underline"
              onClick={onNavigateOpportunities}
            >
              Analyse a new role →
            </button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Target className="h-4 w-4 text-[var(--icon-progress)]" aria-hidden />
            Employers to explore
          </CardTitle>
          <CardDescription>
            {companiesLoading
              ? "Searching Berlin and Europe for employers that match your target roles…"
              : companiesSource === "ai"
                ? pendingCount > 0
                  ? `${pendingCount} ideas to research — tick each when you have looked them up or applied.`
                  : "You have worked through this list. Refresh your job titles to get new suggestions."
                : pendingCount > 0
                  ? `${pendingCount} starter ideas in Berlin & Europe — tick when explored.`
                  : "You have worked through this list."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companiesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Researching employers in Berlin and Europe…
            </div>
          ) : companyTargets.length > 0 ? (
            <ul className="space-y-2.5" aria-label="Employers to explore checklist">
              {companyTargets.map((target) => {
                const done = isCompanyTargetDone(target, checklist)
                return (
                  <li key={target.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
                        done
                          ? "border-[color:var(--ds-brand-border-soft)] bg-[var(--ds-brand-surface-soft)]"
                          : "border-[color:var(--color-border-accent)] bg-[var(--color-card)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <Checkbox
                        checked={done}
                        onCheckedChange={(value) => toggleTarget(target, value === true)}
                        className="mt-0.5"
                        aria-label={`Mark ${target.company} as explored`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-semibold leading-snug ${
                            done ? "text-muted-foreground line-through" : "text-[var(--color-forest)]"
                          }`}
                        >
                          {target.company}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">
                          {target.area}
                          {target.roleHint ? ` · ${target.roleHint}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add job titles on the left first — we will search for matching employers in Berlin and
              Europe.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
