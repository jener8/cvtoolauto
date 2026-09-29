"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"

const LOG_TAG = "generate-task-how-to"

export type GenerateTaskHowToInput = {
  taskLabel: string
}

export type GenerateTaskHowToResult = {
  success: boolean
  steps?: string[]
  error?: string
  errorCode?: AiErrorCode
}

function parseSteps(text: string): string[] | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() ?? text.trim()
  try {
    const parsed = JSON.parse(candidate) as { steps?: string[] }
    if (!Array.isArray(parsed.steps)) return null
    const steps = parsed.steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    return steps.length > 0 ? steps.slice(0, 4) : null
  } catch {
    const lines = text
      .split(/\n+/)
      .map((line) => line.replace(/^\s*\d+[\).\]]\s*/, "").trim())
      .filter(Boolean)
    return lines.length > 0 ? lines.slice(0, 4) : null
  }
}

/** Live guidance for user-added checklist tasks (not pre-written defaults). */
export async function generateTaskHowToGuidance(
  input: GenerateTaskHowToInput,
): Promise<GenerateTaskHowToResult> {
  const label = input.taskLabel.trim()
  if (!label) {
    return { success: false, error: "Task label is required.", errorCode: "validation_error" }
  }

  const missing = getMissingAiKeyError()
  if (missing) {
    return { success: false, error: missing.message, errorCode: missing.code }
  }

  const prompt = `You help someone navigating employment and life admin in Germany.

They added this personal checklist task: "${label}"

Write 2–4 short, practical steps to help them get started. Focus on Germany/EU context where relevant (authorities, documents, advisors) but do NOT invent specific legal outcomes.

Return ONLY valid JSON:
{
  "steps": ["step 1", "step 2", "step 3"]
}`

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 600,
    temperature: 0.4,
    timeoutMs: 45_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (!result.ok) {
    return { success: false, error: result.error.message, errorCode: result.error.code }
  }

  const steps = parseSteps(result.text)
  if (!steps) {
    return {
      success: false,
      error: "Could not read guidance steps. Try again.",
      errorCode: "empty_response",
    }
  }

  return { success: true, steps }
}
