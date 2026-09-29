import type { RoleMatchesCache } from "@/lib/role-matches/types"

const STORAGE_PREFIX = "role-matches-cache"

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

export function loadRoleMatchesCache(folderId: string): RoleMatchesCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RoleMatchesCache>
    if (!Array.isArray(parsed.matches)) return null
    const matches = parsed.matches.filter(
      (item): item is RoleMatchesCache["matches"][number] =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { title?: unknown }).title === "string" &&
        Array.isArray((item as { matchingSkills?: unknown }).matchingSkills),
    )
    if (matches.length === 0) return null
    return {
      matches,
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : undefined,
      generatedAt: typeof parsed.generatedAt === "number" ? parsed.generatedAt : 0,
      source: parsed.source === "ai" ? "ai" : "fallback",
    }
  } catch {
    return null
  }
}

export function saveRoleMatchesCache(folderId: string, cache: RoleMatchesCache): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(cache))
}

export function clearRoleMatchesCache(folderId: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(storageKey(folderId))
}
