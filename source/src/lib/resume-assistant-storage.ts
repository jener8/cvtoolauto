import {
  type AssistantChatMessage,
  loadAssistantChat,
  saveAssistantChat,
} from "@/lib/assistant-chat-storage"

export type { AssistantChatMessage } from "@/lib/assistant-chat-storage"

const STORAGE_PREFIX = "resume-assistant-chat:"

export function loadAssistantConversation(resumeSessionId: string): AssistantChatMessage[] {
  return loadAssistantChat(STORAGE_PREFIX, resumeSessionId)
}

export function saveAssistantConversation(
  resumeSessionId: string,
  messages: AssistantChatMessage[],
): void {
  saveAssistantChat(STORAGE_PREFIX, resumeSessionId, messages)
}

export function clearAssistantConversation(resumeSessionId: string): void {
  if (typeof window === "undefined" || !resumeSessionId) return
  sessionStorage.removeItem(`${STORAGE_PREFIX}${resumeSessionId}`)
}
