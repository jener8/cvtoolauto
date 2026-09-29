"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import {
  canRunOpenAiWebSearch,
  runWebSearchGeneration,
} from "@/lib/ai/run-web-search-generation"
import type { UnverifiedSupportResult } from "@/lib/support-organizations/types"
import {
  buildWebSupportSearchPrompt,
  parseWebSupportSearchResponse,
  type WebSupportSearchInput,
} from "@/lib/support-organizations/web-search-prompt"

const LOG_TAG = "search-support-organizations-web"

export type SearchSupportOrganizationsWebResult = {
  success: boolean
  results?: UnverifiedSupportResult[]
  source?: "web_search" | "ai_knowledge"
  error?: string
  errorCode?: AiErrorCode
}

function slugId(name: string, index: number): string {
  return `web-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}-${index}`
}

function toUnverified(
  rows: Array<{ name: string; type: string; location: string; description: string; externalUrl?: string }>,
): UnverifiedSupportResult[] {
  return rows.map((row, index) => ({
    id: slugId(row.name, index),
    name: row.name,
    type: row.type,
    location: row.location,
    description: row.description,
    externalUrl: row.externalUrl,
    vetted: false as const,
  }))
}

export async function searchSupportOrganizationsWeb(
  input: WebSupportSearchInput,
): Promise<SearchSupportOrganizationsWebResult> {
  const query = input.query.trim()
  if (!query) {
    return { success: false, error: "Enter what you are looking for first.", errorCode: "validation_error" }
  }

  const prompt = buildWebSupportSearchPrompt(input)

  if (canRunOpenAiWebSearch()) {
    const webResult = await runWebSearchGeneration({
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.35,
      timeoutMs: 90_000,
      logTag: LOG_TAG,
    })

    if (webResult.ok) {
      const parsed = parseWebSupportSearchResponse(webResult.text)
      if (parsed.length > 0) {
        return { success: true, results: toUnverified(parsed), source: "web_search" }
      }
    }
  }

  const missing = getMissingAiKeyError()
  if (missing) {
    return {
      success: false,
      error:
        "Live web search needs an OpenAI API key with web search enabled. Add OPENAI_API_KEY to enable this fallback.",
      errorCode: missing.code,
    }
  }

  const textResult = await runTextGenerationWithRetry({
    prompt: `${prompt}

(If you cannot browse the web, suggest only well-known public services you are confident exist — mark uncertainty in the description.)`,
    maxOutputTokens: 2000,
    temperature: 0.35,
    timeoutMs: 60_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (!textResult.ok) {
    return { success: false, error: textResult.error.message, errorCode: textResult.error.code }
  }

  const parsed = parseWebSupportSearchResponse(textResult.text)
  if (parsed.length === 0) {
    return {
      success: false,
      error: "No web results found. Try different keywords or check back later.",
      errorCode: "empty_response",
    }
  }

  return { success: true, results: toUnverified(parsed), source: "ai_knowledge" }
}
