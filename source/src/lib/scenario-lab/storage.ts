import type { ScenarioLabDraft } from "@/lib/scenario-lab/types"

const KEY_PREFIX = "scenario-lab:"

export function scenarioLabStorageKey(folderId: string): string {
  return `${KEY_PREFIX}${folderId}`
}

export function emptyScenarioLabDraft(): ScenarioLabDraft {
  return {
    idealScenario: "",
    blockers: "",
    options: "",
    updatedAt: Date.now(),
  }
}

export function loadScenarioLabDraft(folderId: string): ScenarioLabDraft {
  if (typeof window === "undefined") return emptyScenarioLabDraft()
  try {
    const raw = localStorage.getItem(scenarioLabStorageKey(folderId))
    if (!raw) return emptyScenarioLabDraft()
    const parsed = JSON.parse(raw) as Partial<ScenarioLabDraft>
    return {
      idealScenario: typeof parsed.idealScenario === "string" ? parsed.idealScenario : "",
      blockers: typeof parsed.blockers === "string" ? parsed.blockers : "",
      options: typeof parsed.options === "string" ? parsed.options : "",
      strategy: typeof parsed.strategy === "string" ? parsed.strategy : undefined,
      strategyGeneratedAt:
        typeof parsed.strategyGeneratedAt === "number" ? parsed.strategyGeneratedAt : undefined,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return emptyScenarioLabDraft()
  }
}

export function saveScenarioLabDraft(folderId: string, draft: ScenarioLabDraft): ScenarioLabDraft {
  const normalized: ScenarioLabDraft = { ...draft, updatedAt: Date.now() }
  if (typeof window !== "undefined") {
    localStorage.setItem(scenarioLabStorageKey(folderId), JSON.stringify(normalized))
  }
  return normalized
}

export function isScenarioLabReadyForAnalysis(draft: ScenarioLabDraft): boolean {
  return (
    draft.idealScenario.trim().length >= 12 &&
    draft.blockers.trim().length >= 8 &&
    draft.options.trim().length >= 8
  )
}
