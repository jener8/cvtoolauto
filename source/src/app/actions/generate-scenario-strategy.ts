"use server"

import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import type { AiErrorCode } from "@/lib/ai/errors"
import { buildScenarioStrategyPrompt } from "@/lib/scenario-lab/prompt"
import { parseScenarioStrategyResponse } from "@/lib/scenario-lab/parse-response"
import { isScenarioLabReadyForAnalysis } from "@/lib/scenario-lab/storage"
import type { ScenarioLabDraft, ScenarioStrategyReport } from "@/lib/scenario-lab/types"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import type { StrategicProfile } from "@/lib/strategic-profile"

const LOG_TAG = "generate-scenario-strategy"

export type GenerateScenarioStrategyInput = {
  draft: ScenarioLabDraft
  strategicProfile?: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  outputLanguage?: "en" | "de"
}

export type GenerateScenarioStrategyResult = {
  success: boolean
  report?: ScenarioStrategyReport
  rawText?: string
  usedFallback?: boolean
  error?: string
  errorCode?: AiErrorCode
}

export async function generateScenarioStrategy(
  input: GenerateScenarioStrategyInput,
): Promise<GenerateScenarioStrategyResult> {
  if (!isScenarioLabReadyForAnalysis(input.draft)) {
    return {
      success: false,
      error: "Complete all three steps before running the analysis.",
      errorCode: "validation_error",
    }
  }

  const missingAi = getMissingAiKeyError()
  if (missingAi) {
    return {
      success: false,
      error: missingAi.message,
      errorCode: missingAi.code,
    }
  }

  const prompt = buildScenarioStrategyPrompt(input)

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 3500,
    temperature: 0.45,
    timeoutMs: 60_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (!result.ok) {
    return {
      success: false,
      error: result.error.message,
      errorCode: result.error.code,
    }
  }

  const raw = result.text.trim()
  if (!raw) {
    return {
      success: false,
      error: "The AI returned an empty strategy. Please try again.",
      errorCode: "empty_response",
    }
  }

  const { report, usedFallback } = parseScenarioStrategyResponse(raw)

  return {
    success: true,
    report,
    rawText: raw,
    usedFallback,
  }
}
