import type { CareerProfilePrefs } from "@/lib/career-profile/types"
import type { SavedRoleMatch } from "@/lib/role-matches/types"
import type { StrategicProfile } from "@/lib/strategic-profile"

export type LiveDiscoverySearchQuery = {
  keywords: string[]
  location: string
  remote: boolean
  /** Short note for the UI — what informed this search. */
  sourcesUsed: string[]
}

function splitTerms(value: string | undefined, max = 8): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[,;\n|/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 80)
    .slice(0, max)
}

function uniqueKeywords(values: string[], max = 12): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const key = raw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(raw)
    if (out.length >= max) break
  }
  return out
}

/**
 * Derive agent search settings from Career Profile + Role Strategy (+ My story).
 * No invented job titles — only user-provided / saved strategy terms.
 */
export function buildLiveDiscoverySearchQuery(input: {
  careerPrefs?: CareerProfilePrefs | null
  strategicProfile?: StrategicProfile | null
  savedRoleMatches?: SavedRoleMatch[] | null
}): LiveDiscoverySearchQuery {
  const prefs = input.careerPrefs
  const story = input.strategicProfile
  const usePrefs = prefs?.useForRecommendations?.preferences !== false
  const useStory = prefs?.useForRecommendations?.story !== false
  const useStrategy = prefs?.useForRecommendations?.roleStrategy !== false

  const keywords: string[] = []
  const sourcesUsed: string[] = []

  if (usePrefs && prefs) {
    const fromRoles = splitTerms(prefs.rolesOfInterest)
    const fromIndustries = splitTerms(prefs.industriesOfInterest, 4)
    const fromProblems = splitTerms(prefs.problemsToSolve, 4)
    if (fromRoles.length || fromIndustries.length || fromProblems.length) {
      keywords.push(...fromRoles, ...fromIndustries, ...fromProblems)
      sourcesUsed.push("Career Profile")
    }
  }

  if (useStrategy && input.savedRoleMatches?.length) {
    const titles = input.savedRoleMatches.map((m) => m.title.trim()).filter(Boolean)
    if (titles.length) {
      keywords.push(...titles.slice(0, 8))
      sourcesUsed.push("Role Strategy")
    }
  }

  if (useStory && story?.careerDirection?.trim()) {
    keywords.push(...splitTerms(story.careerDirection, 4))
    if (!sourcesUsed.includes("My story")) sourcesUsed.push("My story")
  }

  const location =
    (usePrefs && prefs?.preferredLocations?.trim().split(/[,;\n]/)[0]?.trim()) || "Berlin"

  const remote =
    usePrefs &&
    (prefs?.remotePreference === "remote" || prefs?.remotePreference === "hybrid")

  return {
    keywords: uniqueKeywords(keywords, 12),
    location: location || "Berlin",
    remote: Boolean(remote),
    sourcesUsed: sourcesUsed.length > 0 ? sourcesUsed : ["Defaults"],
  }
}
