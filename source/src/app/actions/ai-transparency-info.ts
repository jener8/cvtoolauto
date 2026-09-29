"use server"

import { getAiProviderStatus } from "@/lib/ai/provider"
import { providerDisplayName } from "@/lib/ai-transparency"

export type AiTransparencyInfo = {
  configured: boolean
  provider: string
  providerLabel: string
  model: string
}

export async function getAiTransparencyInfo(): Promise<AiTransparencyInfo> {
  const status = getAiProviderStatus()
  return {
    configured: status.configured,
    provider: status.backend,
    providerLabel: providerDisplayName(status.backend),
    model: status.model ?? "Not configured",
  }
}
