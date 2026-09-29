import {
  EMPTY_SCENARIO_STRATEGY,
  type ScenarioStrategyReport,
  type ScenarioStrategyAction,
} from "@/lib/scenario-lab/types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean)
}

function parseActions(value: unknown): ScenarioStrategyAction[] {
  if (!Array.isArray(value)) return []
  const out: ScenarioStrategyAction[] = []
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const action = asString((row as ScenarioStrategyAction).action)
    const why = asString((row as ScenarioStrategyAction).why)
    const firstStep = asString((row as ScenarioStrategyAction).firstStep)
    if (!action) continue
    out.push({ action, why, firstStep })
  }
  return out
}

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed

  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) return null

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

export function parseScenarioStrategyResponse(raw: string): {
  report: ScenarioStrategyReport
  usedFallback: boolean
} {
  const parsed = extractJsonObject(raw)
  if (!parsed || typeof parsed !== "object") {
    return {
      report: {
        ...EMPTY_SCENARIO_STRATEGY,
        summary: raw.trim(),
      },
      usedFallback: true,
    }
  }

  const row = parsed as Partial<ScenarioStrategyReport>
  const report: ScenarioStrategyReport = {
    summary: asString(row.summary) || raw.trim().slice(0, 600),
    strengthsToLeverage: asStringArray(row.strengthsToLeverage),
    blockersReframed: asStringArray(row.blockersReframed),
    recommendedActions: parseActions(row.recommendedActions),
    optionsRanked: asStringArray(row.optionsRanked),
    mindsetNote: asString(row.mindsetNote) || undefined,
  }

  const hasStructure =
    report.recommendedActions.length > 0 ||
    report.strengthsToLeverage.length > 0 ||
    report.optionsRanked.length > 0

  if (!hasStructure) {
    return {
      report: { ...EMPTY_SCENARIO_STRATEGY, summary: raw.trim() },
      usedFallback: true,
    }
  }

  return { report, usedFallback: false }
}
