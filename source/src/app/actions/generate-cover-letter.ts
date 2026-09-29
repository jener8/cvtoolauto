"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { providerDisplayName } from "@/lib/ai-transparency"
import {
  buildCoverLetterPrompt,
  cleanCoverLetterAiOutput,
  type BuildCoverLetterPromptInput,
} from "@/lib/cover-letter-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"

const LOG_TAG = "generate-cover-letter"

export type GenerateCoverLetterInput = BuildCoverLetterPromptInput & {
  strategicProfile?: StrategicProfile | null
}

export type GenerateCoverLetterResult = {
  success: boolean
  coverLetterText?: string
  model?: string
  provider?: string
  providerLabel?: string
  generatedAt?: number
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
}

export async function generateCoverLetter(
  input: GenerateCoverLetterInput,
): Promise<GenerateCoverLetterResult> {
  if (!input.resumeContent?.trim()) {
    return {
      success: false,
      error: "Select a resume with content before generating a cover letter.",
      errorCode: "validation_error",
    }
  }

  if (!input.jobDescription?.trim()) {
    return {
      success: false,
      error: "Add a job description to this application before generating a cover letter.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildCoverLetterPrompt(input)
  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.5,
    logTag: LOG_TAG,
  })

  const providerStatus = getAiProviderStatus()

  if (!result.ok) {
    return {
      success: false,
      error: result.error.message,
      errorCode: result.error.code,
      attempts: result.attempts,
      model: providerStatus.model,
      provider: providerStatus.backend,
      providerLabel: providerDisplayName(providerStatus.backend),
    }
  }

  const coverLetterText = cleanCoverLetterAiOutput(result.text, input.language)
  if (!coverLetterText) {
    return {
      success: false,
      error: "The AI returned an empty cover letter. Try again.",
      errorCode: "empty_response",
      attempts: result.attempts,
      model: providerStatus.model,
      provider: providerStatus.backend,
      providerLabel: providerDisplayName(providerStatus.backend),
    }
  }

  return {
    success: true,
    coverLetterText,
    model: providerStatus.model,
    provider: providerStatus.backend,
    providerLabel: providerDisplayName(providerStatus.backend),
    generatedAt: Date.now(),
    attempts: result.attempts,
  }
}
