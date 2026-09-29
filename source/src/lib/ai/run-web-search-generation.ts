import { createOpenAI, openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { classifyAiError, type ClassifiedAiError } from "@/lib/ai/errors"
import { getOpenAiModelId } from "@/lib/ai/provider"

export type RunWebSearchGenerationOptions = {
  prompt: string
  maxOutputTokens?: number
  temperature?: number
  timeoutMs?: number
  logTag?: string
}

export type RunWebSearchGenerationResult =
  | { ok: true; text: string }
  | { ok: false; error: ClassifiedAiError }

const DEFAULT_TIMEOUT_MS = 90_000

export function canRunOpenAiWebSearch(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export async function runWebSearchGeneration(
  options: RunWebSearchGenerationOptions,
): Promise<RunWebSearchGenerationResult> {
  const tag = options.logTag ?? "web-search-generation"
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: "missing_api_key",
        message: "OpenAI is required for web search company discovery.",
        retryable: false,
      },
    }
  }

  const modelId = getOpenAiModelId()
  const client = createOpenAI({ apiKey })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const { text } = await generateText({
      model: client(modelId),
      prompt: options.prompt,
      maxOutputTokens: options.maxOutputTokens ?? 2500,
      temperature: options.temperature ?? 0.35,
      abortSignal: controller.signal,
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: "medium",
          userLocation: {
            type: "approximate",
            city: "Berlin",
            country: "DE",
            region: "Berlin",
          },
        }),
      },
      toolChoice: { type: "tool", toolName: "web_search" },
    })

    if (!text.trim()) {
      return {
        ok: false,
        error: {
          code: "empty_response",
          message: "Web search returned no company suggestions.",
          retryable: true,
        },
      }
    }

    return { ok: true, text }
  } catch (error) {
    console.error(`[${tag}] Web search generation failed`, error)
    return { ok: false, error: classifyAiError(error) }
  } finally {
    clearTimeout(timer)
  }
}
