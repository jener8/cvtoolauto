"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { providerDisplayName } from "@/lib/ai-transparency"
import {
  buildApplicationStoryWizardPrompt,
  type BuildApplicationStoryWizardPromptInput,
} from "@/lib/application-story-wizard/prompt"
import { parseApplicationStoryWizardResponse } from "@/lib/application-story-wizard/response"
import { fetchCompanyPageText } from "@/lib/application-story-wizard/fetch-company-context"
import type { YourStory } from "@/lib/types"

const LOG_TAG = "generate-application-story-wizard"

export type GenerateApplicationStoryWizardInput = BuildApplicationStoryWizardPromptInput & {
  resumeVersionId: string
}

export type GenerateApplicationStoryWizardResult = {
  success: boolean
  yourStory?: YourStory
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
}

export async function generateApplicationStoryWizard(
  input: GenerateApplicationStoryWizardInput,
): Promise<GenerateApplicationStoryWizardResult> {
  if (!input.resumeContent?.trim()) {
    return {
      success: false,
      error: "A tailored resume with content is required.",
      errorCode: "validation_error",
    }
  }
  if (!input.jobDescription?.trim()) {
    return {
      success: false,
      error: "Add a job description before running the wizard.",
      errorCode: "validation_error",
    }
  }
  if (!input.companyWebsiteUrl?.trim()) {
    return {
      success: false,
      error: "A company website URL is required.",
      errorCode: "validation_error",
    }
  }

  const companyWebsiteText = await fetchCompanyPageText(input.companyWebsiteUrl)
  const prompt = buildApplicationStoryWizardPrompt({
    ...input,
    companyWebsiteText,
  })

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 8000,
    temperature: 0.4,
    timeoutMs: 120_000,
    logTag: LOG_TAG,
  })

  const providerStatus = getAiProviderStatus()

  if (!result.ok) {
    return {
      success: false,
      error: result.error.message,
      errorCode: result.error.code,
      attempts: result.attempts,
    }
  }

  const parsed = parseApplicationStoryWizardResponse(result.text)
  if (!parsed) {
    return {
      success: false,
      error: "The AI returned an invalid wizard format. Try again.",
      errorCode: "empty_response",
      attempts: result.attempts,
    }
  }

  const now = Date.now()
  return {
    success: true,
    attempts: result.attempts,
    yourStory: {
      content: parsed.applicationStory,
      cvEvidence: parsed.cvEvidence,
      resumeVersionId: input.resumeVersionId,
      lastModified: now,
      aiMetadata: {
        model: providerStatus.model,
        provider: providerStatus.backend,
        providerLabel: providerDisplayName(providerStatus.backend),
        generatedAt: now,
      },
      applicationStoryWizard: {
        inputs: {
          companyWebsiteUrl: input.companyWebsiteUrl.trim(),
          jobDescription: input.jobDescription.trim(),
          tailoredResumeVersionId: input.resumeVersionId,
          optionalSources: input.optionalSources,
        },
        analysis: {
          ...parsed.analysis,
          analyzedAt: now,
        },
        storyMap: {
          ...parsed.storyMap,
          lastModified: now,
        },
        illustration: {
          ...parsed.illustration,
          lastModified: now,
        },
        wizardCompletedAt: now,
      },
    },
  }
}
