"use server"

import { extractStrategicAssistantResponse } from "@/lib/strategic-assistant-response"
import { STRATEGIC_ASSISTANT_PROMPT } from "@/lib/strategic-assistant-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"

export type StrategicConversationTurn = {
  role: "user" | "assistant"
  content: string
}

export type StrategicAssistantInput = {
  message: string
  strategicProfile: StrategicProfile
  jobDescription?: string
  resumeExcerpt?: string
  conversationHistory?: StrategicConversationTurn[]
}

export type StrategicAssistantResult = {
  success: boolean
  reply?: string
  profilePatch?: Partial<StrategicProfile>
  error?: string
}

export async function chatStrategicAssistant(
  input: StrategicAssistantInput,
): Promise<StrategicAssistantResult> {
  const message = input.message?.trim() ?? ""
  if (!message) {
    return { success: false, error: "Please enter a message." }
  }

  const prompt = STRATEGIC_ASSISTANT_PROMPT(
    message,
    input.strategicProfile ?? {},
    input.jobDescription ?? "",
    input.resumeExcerpt ?? "",
    input.conversationHistory,
  )

  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.5,
    timeoutMs: 90_000,
    maxAttempts: 2,
    logTag: "strategic-assistant",
  })

  if (!gen.ok) {
    return { success: false, error: gen.error.message }
  }

  const { reply, profilePatch } = extractStrategicAssistantResponse(gen.text)
  if (!reply.trim()) {
    return { success: false, error: "The assistant returned an empty response." }
  }

  return {
    success: true,
    reply: reply.trim(),
    profilePatch: Object.keys(profilePatch).length > 0 ? profilePatch : undefined,
  }
}
