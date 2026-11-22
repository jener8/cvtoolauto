"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import {
  buildEvidenceAssessmentPrompt,
  parseEvidenceAssessmentResponse,
  type EvidenceAssessmentPlan,
} from "@/lib/evidence-assessment"
import type { StrategicProfile } from "@/lib/strategic-profile"

export type AssessEvidenceInput = {
  jobDescription: string
  cvContent: string
  outputLanguage: "en" | "de"
  strategicProfile?: StrategicProfile | null
}

export type AssessEvidenceResult = {
  success: boolean
  plan?: EvidenceAssessmentPlan
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
}

const LOG_TAG = "assess-evidence"

export async function assessEvidenceForRole(
  input: AssessEvidenceInput,
): Promise<AssessEvidenceResult> {
  const jobDescription = input.jobDescription?.trim() ?? ""
  const cvContent = input.cvContent?.trim() ?? ""
  const outputLanguage = input.outputLanguage === "de" ? "de" : "en"

  if (!jobDescription || !cvContent) {
    return {
      success: false,
      error: "Job description and CV content are required.",
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

  const prompt = buildEvidenceAssessmentPrompt({
    jobDescription,
    cvContent,
    outputLanguage,
    strategicProfile: input.strategicProfile,
  })

  console.info(`[${LOG_TAG}] Starting assessment`, {
    backend: provider.backend,
    model: provider.model,
    jobDescriptionChars: jobDescription.length,
    cvContentChars: cvContent.length,
  })

  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.3,
    timeoutMs: 90_000,
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

  const plan = parseEvidenceAssessmentResponse(gen.text)
  if (!plan) {
    console.warn(`[${LOG_TAG}] Failed to parse assessment JSON`, {
      preview: gen.text.slice(0, 240),
    })
    return {
      success: false,
      error: "Could not parse evidence assessment. Try again.",
      errorCode: "parse_error",
      attempts: gen.attempts,
    }
  }

  console.info(`[${LOG_TAG}] Assessment ready`, {
    attempts: gen.attempts,
    rows: plan.rows.length,
  })

  return {
    success: true,
    plan,
    attempts: gen.attempts,
  }
}
