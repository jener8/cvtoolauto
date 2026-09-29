const FAVOURITES_KEY = "phrase-library-favourites"

export function loadPhraseFavourites(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === "string")
  } catch {
    return []
  }
}

export function savePhraseFavourites(ids: string[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify(ids))
}

export function togglePhraseFavourite(id: string): string[] {
  const current = loadPhraseFavourites()
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  savePhraseFavourites(next)
  return next
}
