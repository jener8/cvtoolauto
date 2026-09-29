import type { SavedRoleMatch, RoleMatchResult } from "@/lib/role-matches/types"

const STORAGE_PREFIX = "saved-role-matches"

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

function normalizeSavedMatch(value: unknown): SavedRoleMatch | null {
  if (typeof value !== "object" || value === null) return null
  const row = value as Partial<SavedRoleMatch> & { title?: string }
  if (typeof row.id !== "string" || typeof row.title !== "string") return null
  if (!Array.isArray(row.matchingSkills)) return null
  const matchingSkills = row.matchingSkills.filter(
    (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
  )
  if (matchingSkills.length === 0) return null
  return {
    id: row.id,
    title: row.title.trim(),
    matchingSkills,
    fitLevel: row.fitLevel === "strong" ? "strong" : "growing",
    savedAt: typeof row.savedAt === "number" ? row.savedAt : Date.now(),
  }
}

/** Migrate legacy string[] bookmarks from saved-role-titles storage. */
function loadLegacyTitleBookmarks(folderId: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(`saved-role-titles:${folderId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string")
  } catch {
    return []
  }
}

export function loadSavedRoleMatches(folderId: string): SavedRoleMatch[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) {
      const legacy = loadLegacyTitleBookmarks(folderId)
      return legacy.map((title, index) => ({
        id: `legacy-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        title,
        matchingSkills: [],
        fitLevel: "growing" as const,
        savedAt: Date.now(),
      }))
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeSavedMatch)
      .filter((match): match is SavedRoleMatch => match !== null)
      .sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export function saveSavedRoleMatches(folderId: string, matches: SavedRoleMatch[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(matches))
}

export function isRoleMatchSaved(saved: SavedRoleMatch[], matchId: string): boolean {
  return saved.some((item) => item.id === matchId)
}

export function toggleSavedRoleMatch(
  saved: SavedRoleMatch[],
  match: RoleMatchResult,
): SavedRoleMatch[] {
  const exists = saved.some((item) => item.id === match.id)
  if (exists) {
    return saved.filter((item) => item.id !== match.id)
  }
  return [{ ...match, savedAt: Date.now() }, ...saved]
}

/** @deprecated Use loadSavedRoleMatches — kept for callers that only need title strings. */
export function loadSavedRoleTitles(folderId: string): string[] {
  return loadSavedRoleMatches(folderId).map((match) => match.title)
}

/** @deprecated Use saveSavedRoleMatches */
export function saveSavedRoleTitles(folderId: string, titles: string[]): void {
  const existing = loadSavedRoleMatches(folderId)
  const byTitle = new Map(existing.map((match) => [match.title.toLowerCase(), match]))
  const next: SavedRoleMatch[] = titles.map((title) => {
    const prior = byTitle.get(title.toLowerCase())
    if (prior) return prior
    return {
      id: `legacy-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      matchingSkills: [],
      fitLevel: "growing",
      savedAt: Date.now(),
    }
  })
  saveSavedRoleMatches(folderId, next)
}
