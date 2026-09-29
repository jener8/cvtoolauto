"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { providerDisplayName } from "@/lib/ai-transparency"
import { buildYourStoryPrompt, type BuildYourStoryPromptInput } from "@/lib/your-story-prompt"
import { parseYourStoryResponse } from "@/lib/your-story-response"
import type { YourStory } from "@/lib/types"

const LOG_TAG = "generate-your-story"

export type GenerateYourStoryInput = BuildYourStoryPromptInput & {
  resumeVersionId: string
}

export type GenerateYourStoryResult = {
  success: boolean
  yourStory?: YourStory
  error?: string
  errorCode?: AiErrorCode
  attempts?: number
}

export async function generateYourStory(
  input: GenerateYourStoryInput,
): Promise<GenerateYourStoryResult> {
  if (!input.resumeContent?.trim()) {
    return {
      success: false,
      error: "A CV with content is required before generating Your Story.",
      errorCode: "validation_error",
    }
  }

  if (!input.jobDescription?.trim()) {
    return {
      success: false,
      error: "Add a job description before generating Your Story.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildYourStoryPrompt(input)
  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 3500,
    temperature: 0.45,
    timeoutMs: 90_000,
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

  const parsed = parseYourStoryResponse(result.text)
  if (!parsed) {
    return {
      success: false,
      error: "The AI returned an invalid story format. Try again.",
      errorCode: "empty_response",
      attempts: result.attempts,
    }
  }

  const now = Date.now()
  return {
    success: true,
    attempts: result.attempts,
    yourStory: {
      content: parsed.story,
      cvEvidence: parsed.cvEvidence,
      resumeVersionId: input.resumeVersionId,
      lastModified: now,
      aiMetadata: {
        model: providerStatus.model,
        provider: providerStatus.backend,
        providerLabel: providerDisplayName(providerStatus.backend),
        generatedAt: now,
      },
    },
  }
}
