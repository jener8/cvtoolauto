"use server"

import {
  diagnoseCvMarkdown,
  recoverCvFromAiResponse,
  type CvParseDiagnostics,
} from "@/lib/ai-cv-response"
import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import {
  buildFormatImportedCvPrompt,
  FORMAT_IMPORTED_CV_RETRY_SUFFIX,
} from "@/lib/format-imported-cv-prompt"
import { validateAndRepairImportedCv, type ImportCvApplicationContext } from "@/lib/import-cv-structure"

const LOG_TAG = "format-imported-cv"

export type FormatImportedCvInput = {
  rawCvText: string
  outputLanguage?: "en" | "de"
  applicationContext?: ImportCvApplicationContext
}

export type FormatImportedCvResult = {
  success: boolean
  cvText?: string
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
  parseDiagnostics?: CvParseDiagnostics
  needsReview?: boolean
  warnings?: string[]
  score?: number
}

function finalizeFormattedCv(
  text: string,
  applicationContext?: ImportCvApplicationContext,
): {
  cvText: string
  needsReview: boolean
  warnings: string[]
  score: number
  diagnostics: CvParseDiagnostics
} {
  const validation = validateAndRepairImportedCv(text, { applicationContext })
  const diagnostics = diagnoseCvMarkdown(validation.text)
  return {
    cvText: validation.text,
    needsReview: validation.needsReview,
    warnings: validation.warnings,
    score: validation.score,
    diagnostics,
  }
}

function tryParseFormattedCv(raw: string): { text: string; diagnostics: CvParseDiagnostics } {
  const recovered = recoverCvFromAiResponse(raw)
  console.info(`[${LOG_TAG}] Parse`, {
    rawChars: raw.length,
    extractedChars: recovered.text.length,
    usable: recovered.diagnostics.usable,
    validationError: recovered.diagnostics.validationError,
  })
  return recovered
}

export async function formatImportedCv(
  input: FormatImportedCvInput,
): Promise<FormatImportedCvResult> {
  const rawCvText = input.rawCvText?.trim() ?? ""
  const outputLanguage = input.outputLanguage === "de" ? "de" : "en"

  if (!rawCvText) {
    return {
      success: false,
      error: "No CV text to format.",
      errorCode: "validation_error",
    }
  }

  const provider = getAiProviderStatus()
  if (!provider.configured) {
    return {
      success: false,
      error: provider.setupHint ?? "AI is not configured.",
      errorCode: "missing_api_key",
      attempts: 0,
    }
  }

  const prompt = buildFormatImportedCvPrompt(
    rawCvText,
    outputLanguage,
    input.applicationContext,
  )

  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 12000,
    temperature: 0.2,
    timeoutMs: 120_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (!gen.ok) {
    return {
      success: false,
      error: gen.error.message,
      errorCode: gen.error.code,
      attempts: gen.attempts,
    }
  }

  let { text: cvText, diagnostics } = tryParseFormattedCv(gen.text)

  if (!diagnostics.usable) {
    console.warn(`[${LOG_TAG}] Initial parse failed`, diagnostics)

    const retry = await runTextGenerationWithRetry({
      prompt: `${prompt}${FORMAT_IMPORTED_CV_RETRY_SUFFIX}`,
      maxOutputTokens: 12000,
      temperature: 0.15,
      timeoutMs: 120_000,
      maxAttempts: 1,
      logTag: `${LOG_TAG}-retry`,
    })

    if (retry.ok) {
      const retryResult = tryParseFormattedCv(retry.text)
      if (retryResult.diagnostics.usable) {
        const finalized = finalizeFormattedCv(retryResult.text, input.applicationContext)
        return {
          success: true,
          cvText: finalized.cvText,
          attempts: gen.attempts + (retry.attempts ?? 0),
          parseDiagnostics: finalized.diagnostics,
          needsReview: finalized.needsReview,
          warnings: finalized.warnings,
          score: finalized.score,
        }
      }
      diagnostics = retryResult.diagnostics
    }
  } else {
    const finalized = finalizeFormattedCv(cvText, input.applicationContext)
    return {
      success: true,
      cvText: finalized.cvText,
      attempts: gen.attempts,
      parseDiagnostics: finalized.diagnostics,
      needsReview: finalized.needsReview,
      warnings: finalized.warnings,
      score: finalized.score,
    }
  }

  return {
    success: false,
    error:
      diagnostics.validationError ??
      "The CV could not be converted to the correct format. Try pasting the text manually or use the application wizard.",
    errorCode: "empty_response",
    attempts: gen.attempts,
    parseDiagnostics: diagnostics,
  }
}
