"use client"

import { AIChatMessage } from "@/components/ai-chat-message"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"

/** Statistics chat uses the same markdown rendering as the main AI assistant. */
export function StatisticsChatMessage({ message }: { message: AssistantChatMessage }) {
  return <AIChatMessage message={message} />
}
