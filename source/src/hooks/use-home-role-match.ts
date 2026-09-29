"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { generateRoleMatches } from "@/app/actions/generate-role-matches"
import { buildFallbackJobTitles, primaryResumeText } from "@/lib/job-search-focus"
import {
  buildKeywordChipsFromMatches,
  orphanedSavedMatches,
  sanitizeRoleMatches,
  toRoleMatchCards,
} from "@/lib/role-matches/present"
import {
  isRoleMatchSaved,
  loadSavedRoleMatches,
  saveSavedRoleMatches,
  toggleSavedRoleMatch,
} from "@/lib/role-matches/saved-storage"
import { loadRoleMatchesCache, saveRoleMatchesCache } from "@/lib/role-matches/storage"
import type { RoleMatchCardModel, RoleMatchResult, SavedRoleMatch } from "@/lib/role-matches/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication, ResumeVersion } from "@/lib/types"

export type UseHomeRoleMatchInput = {
  folderId: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
}

function buildFallbackRoleMatches(input: {
  folderId: string
  jobs: JobApplication[]
  versions: ResumeVersion[]
  strategicProfile: StrategicProfile | null
}): RoleMatchResult[] {
  const titles = buildFallbackJobTitles(input)
  const profileSkills = [
    input.strategicProfile?.professionalStrengths,
    input.strategicProfile?.careerDirection,
    input.strategicProfile?.strategicEmphasis,
  ]
    .filter(Boolean)
    .flatMap((field) => field!.split(/[,;|\n]+/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && part.length <= 60)

  return titles.slice(0, 8).map((title, index) => ({
    id: `fallback-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
    title,
    matchingSkills: profileSkills.slice(index * 2, index * 2 + 3),
    fitLevel: (index < 2 ? "strong" : "growing") as RoleMatchResult["fitLevel"],
  }))
}

export function useHomeRoleMatch({
  folderId,
  jobApplications,
  versions,
  strategicProfile,
}: UseHomeRoleMatchInput) {
  const [exploreQuery, setExploreQuery] = useState("")
  const [matches, setMatches] = useState<RoleMatchResult[]>([])
  const [titlesLoading, setTitlesLoading] = useState(false)
  const [titlesSource, setTitlesSource] = useState<"ai" | "fallback">("fallback")
  const [hasLoadedCache, setHasLoadedCache] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [savedMatches, setSavedMatches] = useState<SavedRoleMatch[]>([])

  useEffect(() => {
    setSavedMatches(loadSavedRoleMatches(folderId))
    const cached = loadRoleMatchesCache(folderId)
    if (cached?.matches.length) {
      setMatches(sanitizeRoleMatches(cached.matches))
      setTitlesSource(cached.source)
      if (cached.searchQuery) setExploreQuery(cached.searchQuery)
    }
    setHasLoadedCache(true)
  }, [folderId])

  const teaserCards = useMemo(() => toRoleMatchCards(matches.slice(0, 2)), [matches])

  const runGeneration = useCallback(
    async (searchQuery: string) => {
      setTitlesLoading(true)
      setSearchError(null)

      const result = await generateRoleMatches({
        strategicProfile,
        resumeText: primaryResumeText(versions),
        jobs: jobApplications,
        searchQuery: searchQuery.trim() || undefined,
      })

      if (result.success && result.matches?.length) {
        const matches = sanitizeRoleMatches(result.matches)
        setMatches(matches)
        setTitlesSource("ai")
        saveRoleMatchesCache(folderId, {
          matches,
          searchQuery: searchQuery.trim() || undefined,
          generatedAt: Date.now(),
          source: "ai",
        })
        setTitlesLoading(false)
        return
      }

      const fallback = sanitizeRoleMatches(
        buildFallbackRoleMatches({
          folderId,
          jobs: jobApplications,
          versions,
          strategicProfile,
        }),
      )

      if (fallback.length === 0) {
        setSearchError(result.error ?? "Add your CV or career story first, then try again.")
        setMatches([])
        setTitlesLoading(false)
        return
      }

      setMatches(fallback)
      setTitlesSource("fallback")
      saveRoleMatchesCache(folderId, {
        matches: fallback,
        searchQuery: searchQuery.trim() || undefined,
        generatedAt: Date.now(),
        source: "fallback",
      })
      if (result.error) setSearchError(result.error)
      setTitlesLoading(false)
    },
    [folderId, strategicProfile, versions, jobApplications],
  )

  const handleFindMatches = useCallback(
    async (overrideQuery?: string) => {
      const query = overrideQuery ?? exploreQuery
      if (overrideQuery !== undefined) setExploreQuery(overrideQuery)
      await runGeneration(query)
    },
    [exploreQuery, runGeneration],
  )

  const handleRefreshMatches = useCallback(async () => {
    await runGeneration(exploreQuery)
  }, [exploreQuery, runGeneration])

  const cards = useMemo(() => toRoleMatchCards(matches), [matches])

  const savedOnlyCards = useMemo(() => {
    const orphaned = orphanedSavedMatches(matches, savedMatches)
    return toRoleMatchCards(orphaned)
  }, [matches, savedMatches])

  const keywordChips = useMemo(() => buildKeywordChipsFromMatches(matches), [matches])

  const toggleSaved = useCallback(
    (match: RoleMatchResult) => {
      setSavedMatches((prev) => {
        const next = toggleSavedRoleMatch(prev, match)
        saveSavedRoleMatches(folderId, next)
        return next
      })
    },
    [folderId],
  )

  const isSaved = useCallback(
    (matchId: string) => isRoleMatchSaved(savedMatches, matchId),
    [savedMatches],
  )

  return {
    exploreQuery,
    setExploreQuery,
    titlesLoading,
    titlesSource,
    hasLoadedCache,
    searchError,
    cards,
    savedOnlyCards,
    keywordChips,
    teaserCards,
    handleFindMatches,
    handleRefreshMatches,
    hasMatches: matches.length > 0,
    toggleSaved,
    isSaved,
  }
}

export type { RoleMatchCardModel }
