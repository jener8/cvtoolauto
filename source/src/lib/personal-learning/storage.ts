import {
  DEFAULT_LEARNING_SETTINGS,
  emptyLearningMemory,
  normalizeLearningMemory,
  type LearnedInsight,
  type PersonalLearningMemory,
  type PersonalLearningSettings,
} from "@/lib/personal-learning/types"

const MEMORY_PREFIX = "personal-learning-memory:"
const SETTINGS_PREFIX = "personal-learning-settings:"

function memoryKey(folderId: string): string {
  return `${MEMORY_PREFIX}${folderId}`
}

function settingsKey(folderId: string): string {
  return `${SETTINGS_PREFIX}${folderId}`
}

export function loadLearningSettings(folderId: string): PersonalLearningSettings {
  if (typeof window === "undefined" || !folderId) {
    return { ...DEFAULT_LEARNING_SETTINGS, excludedApplicationIds: [] }
  }
  try {
    const raw = localStorage.getItem(settingsKey(folderId))
    if (!raw) return { ...DEFAULT_LEARNING_SETTINGS, updatedAt: Date.now() }
    const parsed = JSON.parse(raw) as Partial<PersonalLearningSettings>
    return {
      enabled: parsed.enabled !== false,
      excludedApplicationIds: Array.isArray(parsed.excludedApplicationIds)
        ? parsed.excludedApplicationIds
        : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return { ...DEFAULT_LEARNING_SETTINGS }
  }
}

export function saveLearningSettings(
  folderId: string,
  settings: PersonalLearningSettings,
): void {
  if (typeof window === "undefined" || !folderId) return
  localStorage.setItem(
    settingsKey(folderId),
    JSON.stringify({ ...settings, updatedAt: Date.now() }),
  )
}

export function loadLearningMemory(folderId: string): PersonalLearningMemory {
  if (typeof window === "undefined" || !folderId) {
    return emptyLearningMemory(folderId || "unknown")
  }
  try {
    const raw = localStorage.getItem(memoryKey(folderId))
    if (!raw) return emptyLearningMemory(folderId)
    const parsed = JSON.parse(raw) as PersonalLearningMemory
    if (parsed.folderId !== folderId) return emptyLearningMemory(folderId)
    return normalizeLearningMemory(parsed)
  } catch {
    return emptyLearningMemory(folderId)
  }
}

export function saveLearningMemory(memory: PersonalLearningMemory): void {
  if (typeof window === "undefined" || !memory.folderId) return
  localStorage.setItem(
    memoryKey(memory.folderId),
    JSON.stringify({ ...memory, updatedAt: Date.now() }),
  )
}

export function clearLearningMemory(folderId: string): void {
  if (typeof window === "undefined" || !folderId) return
  localStorage.removeItem(memoryKey(folderId))
}

export function deleteAllPersonalLearningData(folderId: string): void {
  clearLearningMemory(folderId)
  if (typeof window === "undefined" || !folderId) return
  localStorage.removeItem(settingsKey(folderId))
  const prefix = `unified-assistant-chat:${folderId}:`
  const toRemove: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(prefix)) toRemove.push(key)
  }
  toRemove.forEach((k) => sessionStorage.removeItem(k))
}

export function setApplicationExcludedFromLearning(
  folderId: string,
  applicationId: string,
  excluded: boolean,
): PersonalLearningSettings {
  const settings = loadLearningSettings(folderId)
  const set = new Set(settings.excludedApplicationIds)
  if (excluded) set.add(applicationId)
  else set.delete(applicationId)
  const next = { ...settings, excludedApplicationIds: [...set], updatedAt: Date.now() }
  saveLearningSettings(folderId, next)
  return next
}

export function updateInsightInMemory(
  folderId: string,
  insightId: string,
  patch: Partial<LearnedInsight>,
): PersonalLearningMemory {
  const memory = loadLearningMemory(folderId)
  memory.insights = memory.insights.map((i) => {
    if (i.id !== insightId) return i
    const next = { ...i, ...patch, updatedAt: Date.now() }
    if (patch.userCorrection !== undefined && patch.userCorrection) {
      next.source = "user_correction"
    }
    return next
  })
  saveLearningMemory(memory)
  return memory
}
