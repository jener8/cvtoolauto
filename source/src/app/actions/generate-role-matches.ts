"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { buildRoleMatchesPrompt } from "@/lib/role-matches/prompt"
import { parseRoleMatchesResponse } from "@/lib/role-matches/parse"
import type { RoleMatchResult } from "@/lib/role-matches/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication } from "@/lib/types"

const LOG_TAG = "generate-role-matches"
const CV_EXCERPT_MAX = 6000

export type GenerateRoleMatchesInput = {
  strategicProfile: StrategicProfile | null
  resumeText: string
  jobs: JobApplication[]
  searchQuery?: string
  outputLanguage?: "en" | "de"
}

export type GenerateRoleMatchesResult = {
  success: boolean
  matches?: RoleMatchResult[]
  error?: string
  errorCode?: AiErrorCode
}

export async function generateRoleMatches(
  input: GenerateRoleMatchesInput,
): Promise<GenerateRoleMatchesResult> {
  const missing = getMissingAiKeyError()
  if (missing) {
    return { success: false, error: missing.message, errorCode: missing.code }
  }

  const resumeExcerpt = input.resumeText.trim().slice(0, CV_EXCERPT_MAX)
  if (!resumeExcerpt && !input.strategicProfile?.careerDirection?.trim()) {
    return {
      success: false,
      error: "Add your CV or career story before we can suggest role matches.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildRoleMatchesPrompt({
    strategicProfile: input.strategicProfile,
    resumeExcerpt,
    jobs: input.jobs,
    searchQuery: input.searchQuery,
    outputLanguage: input.outputLanguage,
  })

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 2200,
    temperature: 0.4,
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

  const matches = parseRoleMatchesResponse(result.text)
  if (!matches) {
    return {
      success: false,
      error: "Could not read role match suggestions. Try again.",
      errorCode: "empty_response",
    }
  }

  return { success: true, matches }
}
