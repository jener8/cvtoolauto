import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"

const DEFAULT_AGENTS_ANTHROPIC_MODEL = "claude-sonnet-5"

/**
 * Dedicated Anthropic client for job agents (Phase 4+).
 * Does NOT use the app's OpenAI-first resolveTextGenerationModel.
 * API key only from env — never hard-coded.
 */
export function getAgentsAnthropicApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  return key || null
}

export function getAgentsAnthropicModelId(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_AGENTS_ANTHROPIC_MODEL
}

export function isAgentsAnthropicConfigured(): boolean {
  return Boolean(getAgentsAnthropicApiKey())
}

export function resolveAgentsAnthropicModel(): LanguageModel | null {
  const apiKey = getAgentsAnthropicApiKey()
  if (!apiKey) return null

  const anthropic = createAnthropic({ apiKey })
  return anthropic(getAgentsAnthropicModelId())
}
