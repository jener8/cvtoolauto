import {
  type AssistantChatMessage,
  loadAssistantChat,
  saveAssistantChat,
} from "@/lib/assistant-chat-storage"

const PREFIX = "statistics-strategy-chat:"

export function loadStatisticsChat(folderId: string): AssistantChatMessage[] {
  if (!folderId) return []
  return loadAssistantChat(PREFIX, folderId)
}

export function saveStatisticsChat(folderId: string, messages: AssistantChatMessage[]): void {
  if (!folderId) return
  saveAssistantChat(PREFIX, folderId, messages)
}

export function clearStatisticsChat(folderId: string): void {
  if (typeof window === "undefined" || !folderId) return
  sessionStorage.removeItem(`${PREFIX}${folderId}`)
}
