"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import type { AiErrorCode } from "@/lib/ai/errors"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { providerDisplayName } from "@/lib/ai-transparency"
import {
  buildRefineYourStoryPrompt,
  buildSuggestCvFromStoryPrompt,
  type RefineYourStoryMode,
} from "@/lib/your-story-prompt"
import { parseYourStoryResponse } from "@/lib/your-story-response"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { YourStory } from "@/lib/types"

const LOG_TAG = "refine-your-story"

export type RefineYourStoryInput = {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  resumeVersionId: string
  currentStory: YourStory
  mode: RefineYourStoryMode
  customInstruction?: string
  strategicProfile?: StrategicProfile | null
}

export type RefineYourStoryResult = {
  success: boolean
  yourStory?: YourStory
  error?: string
  errorCode?: AiErrorCode
}

export async function refineYourStoryWithAi(
  input: RefineYourStoryInput,
): Promise<RefineYourStoryResult> {
  if (!input.currentStory.content?.trim()) {
    return { success: false, error: "No story content to refine.", errorCode: "validation_error" }
  }

  const prompt = buildRefineYourStoryPrompt({
    language: input.language,
    jobTitle: input.jobTitle,
    company: input.company,
    jobDescription: input.jobDescription,
    resumeContent: input.resumeContent,
    currentStory: input.currentStory.content,
    mode: input.mode,
    customInstruction: input.customInstruction,
    strategicProfile: input.strategicProfile,
  })

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 6000,
    temperature: 0.4,
    logTag: LOG_TAG,
  })

  if (!result.ok) {
    return { success: false, error: result.error.message, errorCode: result.error.code }
  }

  const parsed = parseYourStoryResponse(result.text)
  if (!parsed) {
    return { success: false, error: "Could not parse the revised story.", errorCode: "empty_response" }
  }

  const providerStatus = getAiProviderStatus()
  const now = Date.now()
  return {
    success: true,
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

export type SuggestCvFromStoryInput = {
  language: "en" | "de"
  jobTitle: string
  company: string
  jobDescription: string
  resumeContent: string
  storyContent: string
}

export type SuggestCvFromStoryResult = {
  success: boolean
  suggestionsMarkdown?: string
  error?: string
  errorCode?: AiErrorCode
}

export async function suggestCvEditsFromYourStory(
  input: SuggestCvFromStoryInput,
): Promise<SuggestCvFromStoryResult> {
  if (!input.storyContent?.trim()) {
    return { success: false, error: "Generate or write a story first.", errorCode: "validation_error" }
  }

  const prompt = buildSuggestCvFromStoryPrompt(input)
  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.35,
    logTag: "suggest-cv-from-story",
  })

  if (!result.ok) {
    return { success: false, error: result.error.message, errorCode: result.error.code }
  }

  const text = result.text.trim()
  if (!text) {
    return { success: false, error: "No suggestions returned.", errorCode: "empty_response" }
  }

  return { success: true, suggestionsMarkdown: text }
}
