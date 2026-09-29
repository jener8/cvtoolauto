export type CareerStoryInputMode = "type" | "voice"

const STORAGE_KEY = "career-story-input-mode"

export function loadCareerStoryInputMode(): CareerStoryInputMode {
  if (typeof window === "undefined") return "voice"
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === "type") return "type"
    return "voice"
  } catch {
    return "voice"
  }
}

export function saveCareerStoryInputMode(mode: CareerStoryInputMode): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, mode)
}
