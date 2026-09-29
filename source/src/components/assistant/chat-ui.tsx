"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { AIChatMessage } from "@/components/ai-chat-message"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"
import { ArrowDown, Loader2, Minus, RotateCcw, Send, X, type LucideIcon } from "lucide-react"

const SCROLL_NEAR_BOTTOM_PX = 96

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_NEAR_BOTTOM_PX
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start" aria-live="polite" aria-busy="true">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-muted/80 text-foreground border border-border/60 shadow-sm">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1 h-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <span>{label}</span>
        </div>
      </div>
    </div>
  )
}

function useChatScroll(messages: AssistantChatMessage[], isLoading: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const prevLoadingRef = useRef(false)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  const jumpToLatest = useCallback(() => {
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
    scrollToBottom("smooth")
  }, [scrollToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      const near = isNearBottom(el)
      stickToBottomRef.current = near
      setShowJumpToLatest(!near)
    }

    onScroll()
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const content = contentRef.current
    const scroll = scrollRef.current
    if (!content || !scroll) return

    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        scroll.scrollTo({ top: scroll.scrollHeight, behavior: "auto" })
      }
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const loadingStarted = isLoading && !prevLoadingRef.current
    prevLoadingRef.current = isLoading

    if (loadingStarted) {
      stickToBottomRef.current = true
      setShowJumpToLatest(false)
    }

    if (!stickToBottomRef.current) return

    const frame = requestAnimationFrame(() => {
      scrollToBottom("smooth")
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, isLoading, scrollToBottom])

  return { scrollRef, contentRef, showJumpToLatest, jumpToLatest }
}

export function newChatMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function ChatBubble({ message }: { message: AssistantChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
        !isUser &&
          message.status !== "error" &&
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm transition-opacity",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : message.status === "error"
              ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-md"
              : "bg-muted/80 text-foreground border border-border/60 rounded-bl-md",
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

export function AssistantChatBody({
  messages,
  isLoading,
  loadingLabel = "AI is writing…",
  input,
  onInputChange,
  onSend,
  onSuggestion,
  suggestions = [],
  showSuggestions,
  welcomeText,
  inputPlaceholder = "Type a message…",
  footerExtra,
  headerExtra,
  renderMarkdown = false,
  MessageComponent,
  suggestionsPlacement = "above-input",
}: {
  messages: AssistantChatMessage[]
  isLoading: boolean
  loadingLabel?: string
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onSuggestion: (text: string) => void
  suggestions?: readonly string[]
  showSuggestions: boolean
  welcomeText: string
  inputPlaceholder?: string
  footerExtra?: React.ReactNode
  headerExtra?: React.ReactNode
  renderMarkdown?: boolean
  MessageComponent?: React.ComponentType<{ message: AssistantChatMessage }>
  /** Where to show quick-action chips — career assistant uses below-last-response */
  suggestionsPlacement?: "above-input" | "below-last-response"
}) {
  const { scrollRef, contentRef, showJumpToLatest, jumpToLatest } = useChatScroll(
    messages,
    isLoading,
  )
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id
  const lastMessage = messages[messages.length - 1]
  const showTyping =
    isLoading ||
    (lastMessage?.role === "assistant" &&
      lastMessage.status === "streaming" &&
      !lastMessage.content.trim())

  const responseInProgress =
    isLoading || showTyping || lastMessage?.status === "streaming"

  const suggestionChips =
    showSuggestions && !responseInProgress && suggestions.length > 0 ? (
      <div className="flex flex-wrap gap-2 px-1 py-2">
        {suggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSuggestion(prompt)}
            className="text-xs rounded-full border bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    ) : null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {headerExtra}

      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overflow-x-hidden px-4 scroll-smooth [overflow-anchor:auto]"
        >
          <div ref={contentRef} className="space-y-4 py-4 pb-10">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center px-2 py-8 leading-relaxed">
                {welcomeText}
              </p>
            )}
            {messages.map((m) => {
              if (m.status === "streaming" && !m.content.trim()) return null

              return (
                <div key={m.id} className="space-y-3">
                  {renderMarkdown ? (
                    MessageComponent ? (
                      <MessageComponent message={m} />
                    ) : (
                      <AIChatMessage message={m} />
                    )
                  ) : (
                    <ChatBubble message={m} />
                  )}
                  {suggestionsPlacement === "below-last-response" &&
                    m.id === lastAssistantId &&
                    suggestionChips}
                </div>
              )
            })}
            {showTyping && <TypingIndicator label={loadingLabel} />}
          </div>
        </div>

        {showJumpToLatest && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center z-10">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="pointer-events-auto h-9 gap-1.5 rounded-full px-4 text-xs font-medium shadow-lg border-2 border-primary/30 bg-background backdrop-blur-sm"
              onClick={jumpToLatest}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to latest answer
            </Button>
          </div>
        )}
      </div>

      {suggestionsPlacement === "above-input" && (
        <div className="shrink-0 px-4">{suggestionChips}</div>
      )}

      <div className="assistant-chat-input-footer shrink-0 border-t p-4 space-y-2 bg-background/95">
        {footerExtra}
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder={inputPlaceholder}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={isLoading}
            rows={3}
            className="min-h-[52px] max-h-[140px] text-sm resize-none bg-muted/30 flex-1 leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (isLoading || !input.trim()) return
                onSend()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0 h-11 w-11 rounded-xl"
            disabled={isLoading || !input.trim()}
            onClick={onSend}
            aria-label="Send"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AssistantPanelHeader({
  title,
  subtitle,
  icon: Icon,
  accentClassName,
  onMinimize,
  onClose,
  trailing,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  accentClassName: string
  onMinimize: () => void
  onClose?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/95 shrink-0 rounded-t-2xl">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
          accentClassName,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      {trailing}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onMinimize}
        aria-label="Minimize"
      >
        <Minus className="h-4 w-4" />
      </Button>
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export function AssistantDesktopPanel({
  open,
  children,
  className,
}: {
  open: boolean
  children: React.ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <div
      className={cn(
        "fixed z-[100] flex flex-col overflow-hidden rounded-2xl border bg-background/98 backdrop-blur-md",
        "shadow-[0_8px_40px_-8px_rgba(0,0,0,0.25)]",
        "bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4 duration-200",
        "w-[min(520px,calc(100vw-2rem))] h-[min(720px,calc(100vh-4rem))]",
        "resize min-w-[360px] min-h-[480px] max-w-[92vw] max-h-[92vh]",
        className,
      )}
      style={{ resize: "both" }}
    >
      {children}
    </div>
  )
}

export function AssistantMobileDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="max-h-[94vh] flex flex-col p-0 gap-0">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col flex-1 min-h-0 h-[calc(94vh-4rem)]">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

export function RestorePreviousButton({
  onRestore,
  disabled,
}: {
  onRestore: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 text-xs gap-1.5 w-full justify-start text-muted-foreground"
      onClick={onRestore}
      disabled={disabled}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restore previous version
    </Button>
  )
}
