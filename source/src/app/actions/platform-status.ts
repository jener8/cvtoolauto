"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import {
  getAiConfigurationMessage,
  OPENAI_ENV_VAR,
  OPENAI_NOT_CONFIGURED_HINT_LOCAL,
  OPENAI_NOT_CONFIGURED_HINT_VERCEL,
} from "@/lib/ai/messages"

export type AiConfigurationStatus = {
  configured: boolean
  backend: string
  model?: string
  envVar: string
  message: string
  setupHintLocal: string
  setupHintVercel: string
}

/** Server-side AI configuration check (reads process.env — never expose the key). */
export async function getAiConfigurationStatus(): Promise<AiConfigurationStatus> {
  const status = getAiProviderStatus()
  return {
    configured: status.configured,
    backend: status.backend,
    model: status.model,
    envVar: OPENAI_ENV_VAR,
    message: getAiConfigurationMessage(status.configured),
    setupHintLocal: OPENAI_NOT_CONFIGURED_HINT_LOCAL,
    setupHintVercel: OPENAI_NOT_CONFIGURED_HINT_VERCEL,
  }
}
