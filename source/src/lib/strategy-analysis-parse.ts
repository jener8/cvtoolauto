import {
  EMPTY_STRATEGY_ANALYSIS,
  type StrategyAnalysisReport,
  type StrategyConfidence,
  type StrategyInsightItem,
} from "@/lib/strategy-analysis-types"

const INSIGHT_ARRAY_KEYS = [
  "whatWorked",
  "bestRoles",
  "bestResumes",
  "successfulKeywords",
  "whatDidNotWork",
  "underperformingRoles",
  "recommendedRoles",
  "strategyChanges",
] as const

function normalizeConfidence(value: unknown): StrategyConfidence | undefined {
  if (value === "high" || value === "medium" || value === "low") return value
  return undefined
}

function normalizeInsightItem(raw: unknown): StrategyInsightItem | null {
  if (typeof raw === "string" && raw.trim()) {
    return { title: raw.trim(), detail: "" }
  }
  if (!raw || typeof raw !== "object") return null

  const item = raw as Record<string, unknown>
  const title =
    (typeof item.title === "string" && item.title.trim()) ||
    (typeof item.label === "string" && item.label.trim()) ||
    (typeof item.name === "string" && item.name.trim()) ||
    ""

  const detail =
    (typeof item.detail === "string" && item.detail.trim()) ||
    (typeof item.description === "string" && item.description.trim()) ||
    (typeof item.text === "string" && item.text.trim()) ||
    ""

  if (!title && !detail) return null

  return {
    title: title || detail.slice(0, 80),
    detail: detail || title,
    evidence: typeof item.evidence === "string" ? item.evidence.trim() : undefined,
    confidence: normalizeConfidence(item.confidence),
  }
}

function normalizeInsightArray(raw: unknown): StrategyInsightItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeInsightItem).filter((item): item is StrategyInsightItem => item !== null)
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed.startsWith("{") ? trimmed : null
}

export function parseStrategyAnalysisReport(
  raw: string,
): { report: StrategyAnalysisReport; usedFallback: boolean } {
  const candidate = extractJsonCandidate(raw)
  if (!candidate) {
    return {
      report: {
        ...EMPTY_STRATEGY_ANALYSIS,
        summary: raw.trim(),
        whatWorked: raw.trim()
          ? [{ title: "Analysis", detail: raw.trim() }]
          : [],
      },
      usedFallback: true,
    }
  }

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>
    const report: StrategyAnalysisReport = { ...EMPTY_STRATEGY_ANALYSIS }

    for (const key of INSIGHT_ARRAY_KEYS) {
      report[key] = normalizeInsightArray(parsed[key])
    }

    if (typeof parsed.summary === "string" && parsed.summary.trim()) {
      report.summary = parsed.summary.trim()
    }

    const hasContent = INSIGHT_ARRAY_KEYS.some((key) => report[key].length > 0)
    if (!hasContent && !report.summary) {
      return {
        report: {
          ...EMPTY_STRATEGY_ANALYSIS,
          summary: raw.trim(),
          whatWorked: [{ title: "Analysis", detail: raw.trim() }],
        },
        usedFallback: true,
      }
    }

    return { report, usedFallback: false }
  } catch {
    return {
      report: {
        ...EMPTY_STRATEGY_ANALYSIS,
        summary: raw.trim(),
        whatWorked: raw.trim()
          ? [{ title: "Analysis", detail: raw.trim() }]
          : [],
      },
      usedFallback: true,
    }
  }
}
