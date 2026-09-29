import {
  type AssistantChatMessage,
  loadAssistantChat,
  saveAssistantChat,
} from "@/lib/assistant-chat-storage"

const PREFIX = "unified-assistant-chat:"

export function unifiedChatSessionKey(folderId: string, resumeSessionId: string): string {
  return `${folderId}:${resumeSessionId}`
}

export function loadUnifiedAssistantConversation(
  folderId: string,
  resumeSessionId: string,
): AssistantChatMessage[] {
  if (!folderId) return []
  return loadAssistantChat(PREFIX, unifiedChatSessionKey(folderId, resumeSessionId))
}

export function saveUnifiedAssistantConversation(
  folderId: string,
  resumeSessionId: string,
  messages: AssistantChatMessage[],
): void {
  if (!folderId) return
  saveAssistantChat(PREFIX, unifiedChatSessionKey(folderId, resumeSessionId), messages)
}
