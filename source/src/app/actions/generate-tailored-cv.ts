"use server"

import {
  cleanupCvMarkdown,
  diagnoseCvMarkdown,
  recoverCvFromAiResponse,
  type CvParseDiagnostics,
} from "@/lib/ai-cv-response"
import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { parseError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { validateAndSanitizeTailoredCv } from "@/lib/cv-factual-validation"
import { finalizeTailoredCv, type CvSectionValidation } from "@/lib/cv-tailor-sections"
import { COMBINED_PROMPT } from "@/lib/tailored-cv-prompt"

function applyFactualValidation(
  sourceCv: string,
  jobDescription: string,
  generatedCv: string,
): string {
  const result = validateAndSanitizeTailoredCv({
    sourceCv,
    jobDescription,
    generatedCv,
  })
  if (result.removedCount > 0) {
    console.warn(`[${LOG_TAG}] Factual validation removed ${result.removedCount} item(s)`, {
      flagged: result.flagged.slice(0, 8),
      unknownEmployers: result.unknownEmployers,
    })
  }
  return result.sanitizedCv
}

function tryParseCv(
  raw: string,
  stage: string,
): { text: string; diagnostics: CvParseDiagnostics } {
  const recovered = recoverCvFromAiResponse(raw)
  console.info(`[${LOG_TAG}] Parse stage: ${stage}`, {
    rawChars: raw.length,
    extractedChars: recovered.text.length,
    usable: recovered.diagnostics.usable,
    recoveryMethod: recovered.diagnostics.recoveryMethod,
    hasHeading: recovered.diagnostics.hasHeading,
    hasCompanyLine: recovered.diagnostics.hasCompanyLine,
    hasSectionHeader: recovered.diagnostics.hasSectionHeader,
    bulletCount: recovered.diagnostics.bulletCount,
    looksLikeJson: recovered.diagnostics.looksLikeJson,
    validationError: recovered.diagnostics.validationError,
    preview: recovered.diagnostics.preview,
  })
  return recovered
}

export type GenerateTailoredCvInput = {
  jobDescription: string
  cvContent: string
  outputLanguage: "en" | "de"
  strategicProfile?: StrategicProfile | null
}

export type GenerateTailoredCvResult = {
  success: boolean
  cvText?: string
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
  /** Internal prompt — returned only on failure for advanced manual fallback */
  prompt?: string
  /** Raw AI text — preserved on failure for recovery */
  rawAiResponse?: string
  /** Best-effort extracted text — may be usable with manual review */
  extractedText?: string
  parseDiagnostics?: CvParseDiagnostics
  sectionValidation?: CvSectionValidation
  restoredSections?: Array<"experience" | "education">
}

const LOG_TAG = "generate-tailored-cv"

const FORMAT_RETRY_SUFFIX = `

CRITICAL OUTPUT RULES (override everything above):
- Return ONLY the tailored CV inside ONE markdown code block (triple backticks).
- Do NOT return JSON, analysis, chat text, Job Match, Gaps, Positioning, or commentary outside the code block.
- Use # for job titles, ## for companies, ### for dates, - for bullets.
- Every experience bullet must use metric-first wording (metric + context + impact) where credible metrics exist; otherwise action verb + context + impact. Avoid "responsible for", "worked on", or other passive task phrasing. Never invent numbers.
- Never inflate partial matches into strong claims; omit unsupported requirements.
- Section headers in ALL CAPS without # prefix (e.g. PROFILE, EXPERIENCE).
- The existing CV is the only factual source. Job description is tailoring context only.`

export async function generateTailoredCv(
  input: GenerateTailoredCvInput,
): Promise<GenerateTailoredCvResult> {
  const jobDescription = input.jobDescription?.trim() ?? ""
  const cvContent = input.cvContent?.trim() ?? ""
  const outputLanguage = input.outputLanguage === "de" ? "de" : "en"

  const prompt = COMBINED_PROMPT(
    jobDescription,
    cvContent,
    outputLanguage,
    input.strategicProfile,
  )

  if (!jobDescription || !cvContent) {
    return {
      success: false,
      error: "Job description and CV content are required.",
      errorCode: "validation_error",
      prompt,
    }
  }

  const provider = getAiProviderStatus()
  console.info(`[${LOG_TAG}] Starting generation`, {
    backend: provider.backend,
    model: provider.model,
    jobDescriptionChars: jobDescription.length,
    cvContentChars: cvContent.length,
  })

  if (!provider.configured) {
    console.error(`[${LOG_TAG}] AI not configured`, { backend: provider.backend })
    return {
      success: false,
      error: provider.setupHint ?? "AI is not configured.",
      errorCode: "missing_api_key",
      attempts: 0,
      prompt,
    }
  }

  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 12000,
    temperature: 0.4,
    timeoutMs: 120_000,
    maxAttempts: 3,
    logTag: LOG_TAG,
  })

  if (!gen.ok) {
    return {
      success: false,
      error: gen.error.message,
      errorCode: gen.error.code,
      attempts: gen.attempts,
      prompt,
    }
  }

  console.info(`[${LOG_TAG}] AI response received`, { chars: gen.text.length })

  let { text: cvText, diagnostics } = tryParseCv(gen.text, "initial")

  if (!diagnostics.usable) {
    console.warn(`[${LOG_TAG}] Initial parse failed`, diagnostics)

    const retryParse = await runTextGenerationWithRetry({
      prompt: `${prompt}${FORMAT_RETRY_SUFFIX}`,
      maxOutputTokens: 12000,
      temperature: 0.25,
      timeoutMs: 120_000,
      maxAttempts: 1,
      logTag: `${LOG_TAG}-format-retry`,
    })

    if (retryParse.ok) {
      const retryResult = tryParseCv(retryParse.text, "format-retry")
      if (retryResult.diagnostics.usable) {
        console.info(`[${LOG_TAG}] Format retry succeeded`)
        cvText = retryResult.text
        diagnostics = retryResult.diagnostics
        const sanitized = applyFactualValidation(cvContent, jobDescription, cvText)
        const finalized = finalizeTailoredCv({ sourceCv: cvContent, generatedCv: sanitized })
        return {
          success: true,
          cvText: finalized.resumeText,
          attempts: gen.attempts + (retryParse.attempts ?? 0),
          sectionValidation: finalized.validation,
          restoredSections: finalized.restoredSections,
        }
      }
      console.warn(`[${LOG_TAG}] Format retry still invalid`, retryResult.diagnostics)
    }

    // Last resort: return cleaned extraction even if validation is weak — UI can offer "use anyway"
    const cleanedFallback = cleanupCvMarkdown(cvText)
    const fallbackDiag = diagnoseCvMarkdown(cleanedFallback)

    const parseErr = parseError(
      "The AI response did not contain valid resume formatting. Try again or use advanced fallback.",
      diagnostics.preview,
    )
    return {
      success: false,
      error: parseErr.message,
      errorCode: parseErr.code,
      attempts: gen.attempts,
      prompt,
      rawAiResponse: gen.text,
      extractedText: cleanedFallback || undefined,
      parseDiagnostics: fallbackDiag.usable ? fallbackDiag : diagnostics,
    }
  }

  const sanitizedCv = applyFactualValidation(cvContent, jobDescription, cvText)
  let finalized = finalizeTailoredCv({ sourceCv: cvContent, generatedCv: sanitizedCv })

  if (!finalized.resumeText.trim() && cvText.trim()) {
    console.warn(`[${LOG_TAG}] Sanitized CV empty after finalize — falling back to parsed text`)
    finalized = finalizeTailoredCv({ sourceCv: cvContent, generatedCv: cvText })
  }

  if (finalized.restoredSections.length > 0) {
    console.warn(`[${LOG_TAG}] Restored sections from source CV`, finalized.restoredSections)
  }

  if (!finalized.resumeText.trim()) {
    return {
      success: false,
      error: "Factual validation removed all generated content. Try again with a more detailed source CV.",
      errorCode: "validation_error",
      attempts: gen.attempts,
      prompt,
      rawAiResponse: gen.text,
      extractedText: cvText,
      parseDiagnostics: diagnostics,
    }
  }

  console.info(`[${LOG_TAG}] CV generated via ${provider.backend}`, {
    attempts: gen.attempts,
    chars: finalized.resumeText.length,
    backend: provider.backend,
    model: provider.model,
    sectionValidation: finalized.validation,
    restoredSections: finalized.restoredSections,
  })

  return {
    success: true,
    cvText: finalized.resumeText,
    attempts: gen.attempts,
    sectionValidation: finalized.validation,
    restoredSections: finalized.restoredSections,
  }
}

/** Preflight check for client UI (optional). */
export async function getTailoredCvAiStatus(): Promise<{
  configured: boolean
  backend: string
  model?: string
  setupHint?: string
  openaiKeyPresent: boolean
}> {
  const status = getAiProviderStatus()
  return {
    configured: status.configured,
    backend: status.backend,
    model: status.model,
    setupHint: status.setupHint,
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
  }
}
