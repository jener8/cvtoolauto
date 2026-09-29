import { isUsableCvMarkdown } from "@/lib/ai-cv-response"
import { formatImportedCv } from "@/app/actions/format-imported-cv"
import {
  validateAndRepairImportedCv,
  type ImportCvApplicationContext,
  type ImportCvConfidence,
} from "@/lib/import-cv-structure"

export type PrepareImportedCvResult =
  | {
      ok: true
      text: string
      rawText: string
      formatted: boolean
      confidence: ImportCvConfidence
      needsReview: boolean
      warnings: string[]
      issues: string[]
      score: number
    }
  | { ok: false; error: string; errorCode?: string; rawText?: string }

/**
 * Ensures uploaded or pasted CV text uses resume-builder syntax (# titles, ## companies, - bullets).
 * Runs structure repair and confidence scoring after formatting.
 */
export async function prepareImportedCvText(
  rawText: string,
  options?: {
    outputLanguage?: "en" | "de"
    applicationContext?: ImportCvApplicationContext
  },
): Promise<PrepareImportedCvResult> {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return { ok: false, error: "No text was extracted from the file." }
  }

  let workingText = trimmed
  let formatted = false

  if (!isUsableCvMarkdown(trimmed)) {
    const result = await formatImportedCv({
      rawCvText: trimmed,
      outputLanguage: options?.outputLanguage ?? "en",
      applicationContext: options?.applicationContext,
    })

    if (!result.success || !result.cvText?.trim()) {
      return {
        ok: false,
        error:
          result.error ??
          "Could not convert the CV to the correct format. Try the application wizard or paste the text manually.",
        errorCode: result.errorCode,
        rawText: trimmed,
      }
    }

    workingText = result.cvText.trim()
    formatted = true
  }

  const validation = validateAndRepairImportedCv(workingText, {
    applicationContext: options?.applicationContext,
  })

  return {
    ok: true,
    text: validation.text,
    rawText: trimmed,
    formatted,
    confidence: validation.confidence,
    needsReview: validation.needsReview,
    warnings: validation.warnings,
    issues: validation.issues,
    score: validation.score,
  }
}

/** True when an existing saved CV should not be replaced without explicit confirmation. */
export function existingCvShouldBlockSilentOverwrite(resumeText?: string | null): boolean {
  return isUsableCvMarkdown((resumeText ?? "").trim())
}
