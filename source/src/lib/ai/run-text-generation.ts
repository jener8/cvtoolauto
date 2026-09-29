import { generateText } from "ai"
import { logAiEnvDiagnostics } from "@/lib/ai/env-diagnostics"
import { classifyAiError, type AiErrorCode, type ClassifiedAiError } from "@/lib/ai/errors"
import { getAiProviderStatus, resolveTextGenerationModel } from "@/lib/ai/provider"

export type RunTextGenerationOptions = {
  prompt: string
  maxOutputTokens?: number
  temperature?: number
  /** Per-attempt timeout in ms */
  timeoutMs?: number
  maxAttempts?: number
  logTag?: string
}

export type RunTextGenerationResult =
  | { ok: true; text: string; attempts: number }
  | { ok: false; error: ClassifiedAiError; attempts: number }

const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runOnce(
  model: ReturnType<typeof resolveTextGenerationModel>,
  prompt: string,
  maxOutputTokens: number,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const { text } = await generateText({
      model,
      prompt,
      maxOutputTokens,
      temperature,
      abortSignal: controller.signal,
    })
    return text
  } finally {
    clearTimeout(timer)
  }
}

export function getMissingAiKeyError(): ClassifiedAiError | null {
  const status = getAiProviderStatus()
  if (status.configured) return null
  return {
    code: "missing_api_key",
    message: status.setupHint ?? "AI is not configured.",
    retryable: false,
  }
}

export async function runTextGenerationWithRetry(
  options: RunTextGenerationOptions,
): Promise<RunTextGenerationResult> {
  const tag = options.logTag ?? "ai-generation"
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxOutputTokens = options.maxOutputTokens ?? 12000
  const temperature = options.temperature ?? 0.4

  logAiEnvDiagnostics(tag)

  const missing = getMissingAiKeyError()
  if (missing) {
    console.error(`[${tag}] Missing API configuration`, {
      backend: getAiProviderStatus().backend,
      hint: missing.message,
    })
    return { ok: false, error: missing, attempts: 0 }
  }

  const providerStatus = getAiProviderStatus()
  const backend = providerStatus.backend
  const model = resolveTextGenerationModel()
  let lastError: ClassifiedAiError = {
    code: "unknown",
    message: "AI generation failed.",
    retryable: true,
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.info(`[${tag}] Attempt ${attempt}/${maxAttempts}`, {
        backend,
        model: providerStatus.model,
        timeoutMs,
        provider: backend === "openai" ? "OpenAI API" : backend,
      })
      const text = await runOnce(model, options.prompt, maxOutputTokens, temperature, timeoutMs)
      if (!text?.trim()) {
        lastError = {
          code: "empty_response",
          message: "The AI returned an empty response.",
          retryable: true,
        }
        console.warn(`[${tag}] Empty response on attempt ${attempt}`)
      } else {
        console.info(`[${tag}] Success on attempt ${attempt}`, {
          chars: text.length,
        })
        return { ok: true, text, attempts: attempt }
      }
    } catch (error) {
      lastError = classifyAiError(error)
      console.error(`[${tag}] Attempt ${attempt} failed`, {
        code: lastError.code,
        statusCode: lastError.statusCode,
        retryable: lastError.retryable,
        message: lastError.message,
        cause: lastError.cause,
        providerErrorType: lastError.providerErrorType,
        providerErrorCode: lastError.providerErrorCode,
      })
      if (!lastError.retryable) break
    }

    if (attempt < maxAttempts && lastError.retryable) {
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  return { ok: false, error: lastError, attempts: maxAttempts }
}

export function validationError(message: string): ClassifiedAiError {
  return {
    code: "validation_error",
    message,
    retryable: false,
  }
}

export function parseError(message: string, preview?: string): ClassifiedAiError {
  console.warn("[ai-cv] Parse/validation failed", {
    message,
    preview: preview?.slice(0, 200),
  })
  return {
    code: "parse_error",
    message,
    retryable: true,
  }
}

export type { AiErrorCode } from "@/lib/ai/errors"
