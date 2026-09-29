"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { providerDisplayName } from "@/lib/ai-transparency"
import type { StrategicProfile } from "@/lib/strategic-profile"
import {
  buildUploadDetailsFieldPrompt,
  buildUploadDetailsPrompt,
  type BuildUploadDetailsPromptInput,
} from "@/lib/upload-details-prompt"
import {
  mergeUploadDetails,
  parseUploadDetailsJson,
  type UploadDetails,
  type UploadDetailsFieldKey,
} from "@/lib/upload-details"

const LOG_TAG = "generate-upload-details"

export type GenerateUploadDetailsInput = BuildUploadDetailsPromptInput & {
  strategicProfile?: StrategicProfile | null
  existingUploadDetails?: UploadDetails | null
}

export type GenerateUploadDetailsResult = {
  success: boolean
  uploadDetails?: UploadDetails
  model?: string
  provider?: string
  providerLabel?: string
  generatedAt?: number
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
}

export async function generateUploadDetails(
  input: GenerateUploadDetailsInput,
): Promise<GenerateUploadDetailsResult> {
  const hasResume = Boolean(input.resumeContent?.trim())
  const hasJobDescription = Boolean(input.jobDescription?.trim())
  if (!hasResume && !hasJobDescription) {
    return {
      success: false,
      error:
        "Add a job description or CV to this application before generating upload details.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildUploadDetailsPrompt(input)
  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4500,
    temperature: 0.45,
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

  const parsed = parseUploadDetailsJson(result.text)
  if (!parsed) {
    return {
      success: false,
      error: "Could not parse AI response. Try again.",
      errorCode: "empty_response",
      attempts: result.attempts,
      model: providerStatus.model,
      provider: providerStatus.backend,
      providerLabel: providerDisplayName(providerStatus.backend),
    }
  }

  const generatedAt = Date.now()
  const uploadDetails = mergeUploadDetails(input.existingUploadDetails ?? undefined, {
    ...parsed,
    generatedAt,
    outputLanguage: input.outputLanguage === "de" ? "de" : input.outputLanguage === "en" ? "en" : undefined,
  })

  return {
    success: true,
    uploadDetails,
    generatedAt,
    model: providerStatus.model,
    provider: providerStatus.backend,
    providerLabel: providerDisplayName(providerStatus.backend),
    attempts: result.attempts,
  }
}

export async function regenerateUploadDetailsField(
  input: GenerateUploadDetailsInput & { field: UploadDetailsFieldKey },
): Promise<GenerateUploadDetailsResult> {
  const hasResume = Boolean(input.resumeContent?.trim())
  const hasJobDescription = Boolean(input.jobDescription?.trim())
  if (!hasResume && !hasJobDescription) {
    return {
      success: false,
      error: "Add a job description or CV before regenerating this field.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildUploadDetailsFieldPrompt(input)
  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.45,
    logTag: `${LOG_TAG}-field`,
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

  const parsed = parseUploadDetailsJson(result.text)
  if (!parsed) {
    return {
      success: false,
      error: "Could not parse AI response. Try again.",
      errorCode: "empty_response",
      attempts: result.attempts,
    }
  }

  const generatedAt = Date.now()
  const patch: Partial<UploadDetails> = { generatedAt }
  if (input.outputLanguage === "de" || input.outputLanguage === "en") {
    patch.outputLanguage = input.outputLanguage
  }
  if (parsed[input.field]) patch[input.field] = parsed[input.field]
  if (input.field === "salaryExpectation" && parsed.salaryGuidance) {
    patch.salaryGuidance = parsed.salaryGuidance
  }

  const uploadDetails = mergeUploadDetails(input.existingUploadDetails ?? undefined, patch)

  return {
    success: true,
    uploadDetails,
    generatedAt,
    model: providerStatus.model,
    provider: providerStatus.backend,
    providerLabel: providerDisplayName(providerStatus.backend),
    attempts: result.attempts,
  }
}
