import {
  type AssistantChatMessage,
  loadAssistantChat,
  saveAssistantChat,
} from "@/lib/assistant-chat-storage"

const STORAGE_PREFIX = "strategic-assistant-chat:"

export function loadStrategicAssistantConversation(
  sessionId: string,
): AssistantChatMessage[] {
  return loadAssistantChat(STORAGE_PREFIX, sessionId)
}

export function saveStrategicAssistantConversation(
  sessionId: string,
  messages: AssistantChatMessage[],
): void {
  saveAssistantChat(STORAGE_PREFIX, sessionId, messages)
}
