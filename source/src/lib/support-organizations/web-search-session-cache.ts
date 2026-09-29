import type { SupportDirectoryFilters } from "@/lib/support-organizations/filter"
import type { UnverifiedSupportResult } from "@/lib/support-organizations/types"

const STORAGE_KEY = "support-web-search-session:v1"

export type WebSearchCacheInput = {
  query: string
  userCity: string | null
  filters: SupportDirectoryFilters
}

export function buildWebSearchCacheKey(input: WebSearchCacheInput): string {
  return JSON.stringify({
    q: input.query.trim().toLowerCase(),
    city: input.userCity?.trim().toLowerCase() ?? "",
    categories: [...input.filters.categories].sort(),
    location: input.filters.location?.trim().toLowerCase() ?? "",
    free: input.filters.costFreeOnly,
  })
}

function readStore(): Record<string, UnverifiedSupportResult[]> {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, UnverifiedSupportResult[]>)
      : {}
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, UnverifiedSupportResult[]>): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/** Returns cached rows, or null when this query has not been searched yet this session. */
export function readWebSearchSessionCache(
  key: string,
): UnverifiedSupportResult[] | null {
  const store = readStore()
  if (!Object.prototype.hasOwnProperty.call(store, key)) return null
  return Array.isArray(store[key]) ? store[key]! : []
}

export function writeWebSearchSessionCache(
  key: string,
  results: UnverifiedSupportResult[],
): void {
  const store = readStore()
  store[key] = results
  writeStore(store)
}
