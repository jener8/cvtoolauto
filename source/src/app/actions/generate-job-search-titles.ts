"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { buildJobSearchTitlesPrompt } from "@/lib/job-search-titles-prompt"
import { parseJobSearchTitlesResponse } from "@/lib/job-search-titles-parse"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication } from "@/lib/types"

const LOG_TAG = "generate-job-search-titles"
const CV_EXCERPT_MAX = 6000

export type GenerateJobSearchTitlesInput = {
  strategicProfile: StrategicProfile | null
  resumeText: string
  jobs: JobApplication[]
  outputLanguage?: "en" | "de"
}

export type GenerateJobSearchTitlesResult = {
  success: boolean
  jobTitles?: string[]
  error?: string
  errorCode?: AiErrorCode
}

export async function generateJobSearchTitles(
  input: GenerateJobSearchTitlesInput,
): Promise<GenerateJobSearchTitlesResult> {
  const missing = getMissingAiKeyError()
  if (missing) {
    return { success: false, error: missing.message, errorCode: missing.code }
  }

  const resumeExcerpt = input.resumeText.trim().slice(0, CV_EXCERPT_MAX)
  if (!resumeExcerpt && !input.strategicProfile?.careerDirection?.trim()) {
    return {
      success: false,
      error: "Add your CV or career story before we can suggest job titles.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildJobSearchTitlesPrompt({
    strategicProfile: input.strategicProfile,
    resumeExcerpt,
    jobs: input.jobs,
    outputLanguage: input.outputLanguage,
  })

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 1200,
    temperature: 0.35,
    timeoutMs: 45_000,
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

  const jobTitles = parseJobSearchTitlesResponse(result.text)
  if (!jobTitles) {
    return {
      success: false,
      error: "Could not read job title suggestions. Try again.",
      errorCode: "empty_response",
    }
  }

  return { success: true, jobTitles }
}
