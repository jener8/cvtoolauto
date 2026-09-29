"use client"

import { useEffect, useMemo, useState } from "react"
import { generateJobSearchTitles } from "@/app/actions/generate-job-search-titles"
import { buildFallbackJobTitles } from "@/lib/job-search-focus"
import { jobSearchTitlesFingerprint } from "@/lib/job-search-titles-fingerprint"
import {
  loadJobSearchTitlesCache,
  saveJobSearchTitlesCache,
} from "@/lib/job-search-titles-storage"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { primaryResumeText } from "@/lib/job-search-focus"

export type JobSearchTitlesState = {
  jobTitles: string[]
  titlesLoading: boolean
  titlesSource: "ai" | "fallback"
}

export function useJobSearchTitles(input: {
  folderId: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
}): JobSearchTitlesState {
  const { folderId, jobApplications, versions, strategicProfile } = input

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

  return { jobTitles, titlesLoading, titlesSource }
}
