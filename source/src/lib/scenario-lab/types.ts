export type ScenarioLabStepIndex = 1 | 2 | 3

export type ScenarioLabDraft = {
  idealScenario: string
  blockers: string
  options: string
  strategy?: string
  strategyGeneratedAt?: number
  updatedAt: number
}

export type ScenarioStrategyAction = {
  action: string
  why: string
  firstStep: string
}

export type ScenarioStrategyReport = {
  summary: string
  strengthsToLeverage: string[]
  blockersReframed: string[]
  recommendedActions: ScenarioStrategyAction[]
  optionsRanked: string[]
  mindsetNote?: string
}

export const EMPTY_SCENARIO_STRATEGY: ScenarioStrategyReport = {
  summary: "",
  strengthsToLeverage: [],
  blockersReframed: [],
  recommendedActions: [],
  optionsRanked: [],
}
