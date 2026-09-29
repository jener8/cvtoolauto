import type { Dispatch, SetStateAction } from "react"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"

type SetMessages = Dispatch<SetStateAction<AssistantChatMessage[]>>

type RevealOptions = {
  charsPerTick?: number
  intervalMs?: number
}

/** Reveal assistant text in small chunks so the chat can follow naturally. */
export function revealAssistantMessageContent(
  setMessages: SetMessages,
  messageId: string,
  fullContent: string,
  options?: RevealOptions,
): () => void {
  const charsPerTick = options?.charsPerTick ?? 5
  const intervalMs = options?.intervalMs ?? 18

  if (fullContent.length <= charsPerTick * 2) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: fullContent, status: "success" } : m,
      ),
    )
    return () => {}
  }

  let index = Math.min(charsPerTick * 2, fullContent.length)
  setMessages((prev) =>
    prev.map((m) =>
      m.id === messageId
        ? { ...m, content: fullContent.slice(0, index), status: "streaming" }
        : m,
    ),
  )

  const timer = window.setInterval(() => {
    index = Math.min(index + charsPerTick, fullContent.length)
    const done = index >= fullContent.length
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: fullContent.slice(0, index),
              status: done ? "success" : "streaming",
            }
          : m,
      ),
    )
    if (done) window.clearInterval(timer)
  }, intervalMs)

  return () => window.clearInterval(timer)
}
