import type { Folder } from "./types"

export const FOLDERS_CACHE_KEY = "cv_folders_list_v1"

export function readFoldersCache(): Folder[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(FOLDERS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (f): f is Folder =>
        f &&
        typeof f === "object" &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        typeof f.createdAt === "number",
    )
  } catch {
    localStorage.removeItem(FOLDERS_CACHE_KEY)
    return []
  }
}

export function writeFoldersCache(folders: Folder[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(FOLDERS_CACHE_KEY, JSON.stringify(folders))
  } catch {
    // Quota exceeded — cache is optional
  }
}
