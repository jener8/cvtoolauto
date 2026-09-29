import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { logAiEnvDiagnostics } from "@/lib/ai/env-diagnostics"
import { OPENAI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai/messages"

export type AiBackend = "openai" | "anthropic" | "gateway" | "none"

const ANTHROPIC_CV_MODEL_ID = "claude-sonnet-4-20250514"
const DEFAULT_OPENAI_CV_MODEL = "gpt-4o"
const GATEWAY_MODEL = `anthropic/${ANTHROPIC_CV_MODEL_ID}`

let providerInitLogged = false

export type AiProviderStatus = {
  configured: boolean
  backend: AiBackend
  model?: string
  /** Safe hint for developers — never includes secrets */
  setupHint?: string
}

export function getOpenAiModelId(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_CV_MODEL
}

export function getAiProviderStatus(): AiProviderStatus {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return {
      configured: true,
      backend: "openai",
      model: getOpenAiModelId(),
    }
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return {
      configured: true,
      backend: "anthropic",
      model: ANTHROPIC_CV_MODEL_ID,
    }
  }
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return {
      configured: true,
      backend: "gateway",
      model: GATEWAY_MODEL,
    }
  }
  return {
    configured: false,
    backend: "none",
    setupHint: OPENAI_NOT_CONFIGURED_MESSAGE,
  }
}

function logProviderInitOnce(status: AiProviderStatus): void {
  if (providerInitLogged) return
  providerInitLogged = true
  logAiEnvDiagnostics("ai-provider-init")
  console.info("[ai-provider-init] Resolved backend", {
    backend: status.backend,
    model: status.model,
    configured: status.configured,
  })
}

/** Priority: OpenAI → Anthropic direct → Vercel AI Gateway */
export function resolveTextGenerationModel(): LanguageModel | string {
  const status = getAiProviderStatus()
  logProviderInitOnce(status)

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    const modelId = getOpenAiModelId()
    const openai = createOpenAI({ apiKey: openaiKey })
    console.info("[ai-provider] Using OpenAI", {
      model: modelId,
      keyPresent: true,
      keyLength: openaiKey.length,
    })
    return openai(modelId)
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (anthropicKey) {
    const anthropic = createAnthropic({ apiKey: anthropicKey })
    console.info("[ai-provider] Using Anthropic", {
      model: ANTHROPIC_CV_MODEL_ID,
      keyPresent: true,
      keyLength: anthropicKey.length,
    })
    return anthropic(ANTHROPIC_CV_MODEL_ID)
  }

  console.info("[ai-provider] Using AI Gateway", { model: GATEWAY_MODEL })
  return GATEWAY_MODEL
}
