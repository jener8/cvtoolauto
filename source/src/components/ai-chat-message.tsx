"use client"

import { AiMarkdownContent } from "@/components/ai/ai-markdown-content"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"
import { cn } from "@/lib/utils"

export interface AIChatMessageProps {
  message: AssistantChatMessage
}

/** ChatGPT-style assistant message with markdown rendering. User messages stay plain text. */
export function AIChatMessage({ message }: AIChatMessageProps) {
  const isUser = message.role === "user"
  const isError = message.status === "error"

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
        !isUser && !isError && "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3.5 py-2.5 shadow-sm transition-opacity",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md text-sm leading-relaxed"
            : isError
              ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-md text-sm leading-relaxed"
              : "bg-muted/80 text-foreground border border-border/60 rounded-bl-md",
        )}
      >
        {isUser || isError ? (
          <span className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</span>
        ) : (
          <AiMarkdownContent content={message.content} />
        )}
      </div>
    </div>
  )
}
