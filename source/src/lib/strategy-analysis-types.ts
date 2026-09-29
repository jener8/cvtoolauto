export type StrategyConfidence = "high" | "medium" | "low"

export type StrategyInsightItem = {
  title: string
  detail: string
  evidence?: string
  confidence?: StrategyConfidence
}

export type StrategyAnalysisReport = {
  whatWorked: StrategyInsightItem[]
  bestRoles: StrategyInsightItem[]
  bestResumes: StrategyInsightItem[]
  successfulKeywords: StrategyInsightItem[]
  whatDidNotWork: StrategyInsightItem[]
  underperformingRoles: StrategyInsightItem[]
  recommendedRoles: StrategyInsightItem[]
  strategyChanges: StrategyInsightItem[]
  /** Optional one-line executive summary */
  summary?: string
}

export const EMPTY_STRATEGY_ANALYSIS: StrategyAnalysisReport = {
  whatWorked: [],
  bestRoles: [],
  bestResumes: [],
  successfulKeywords: [],
  whatDidNotWork: [],
  underperformingRoles: [],
  recommendedRoles: [],
  strategyChanges: [],
}
