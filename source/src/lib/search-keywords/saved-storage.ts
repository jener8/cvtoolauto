import type { KeywordCluster, SavedKeywordCluster } from "@/lib/search-keywords/types"

const STORAGE_PREFIX = "saved-search-keywords"

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

function normalizeSavedKeyword(value: unknown): SavedKeywordCluster | null {
  if (typeof value !== "object" || value === null) return null
  const row = value as Partial<SavedKeywordCluster>
  if (typeof row.id !== "string") return null
  if (typeof row.keywordDe !== "string" || typeof row.keywordEn !== "string") return null
  if (typeof row.provenance !== "string") return null
  if (!Array.isArray(row.exampleRoleTitles)) return null
  if (typeof row.searchString !== "string") return null
  if (!Array.isArray(row.sources)) return null

  return {
    id: row.id,
    keywordDe: row.keywordDe,
    keywordEn: row.keywordEn,
    provenance: row.provenance,
    fitLevel: row.fitLevel === "strong" ? "strong" : "growing",
    exampleRoleTitles: row.exampleRoleTitles.filter(
      (t): t is string => typeof t === "string" && t.trim().length > 0,
    ),
    searchString: row.searchString,
    sources: row.sources as SavedKeywordCluster["sources"],
    savedAt: typeof row.savedAt === "number" ? row.savedAt : Date.now(),
  }
}

export function loadSavedKeywords(folderId: string): SavedKeywordCluster[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeSavedKeyword)
      .filter((item): item is SavedKeywordCluster => item !== null)
      .sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export function saveSavedKeywords(folderId: string, keywords: SavedKeywordCluster[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(keywords))
}

export function isKeywordSaved(saved: SavedKeywordCluster[], keywordId: string): boolean {
  return saved.some((item) => item.id === keywordId)
}

export function toggleSavedKeyword(
  saved: SavedKeywordCluster[],
  keyword: KeywordCluster,
): SavedKeywordCluster[] {
  const exists = saved.some((item) => item.id === keyword.id)
  if (exists) return saved.filter((item) => item.id !== keyword.id)
  return [{ ...keyword, savedAt: Date.now() }, ...saved]
}

