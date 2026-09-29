"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { chatStatisticsStrategy } from "@/app/actions/statistics-strategy"
import {
  AssistantChatBody,
  newChatMessageId,
} from "@/components/assistant/chat-ui"
import { StatisticsChatMessage } from "@/components/statistics-chat-message"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { computeApplicationStatistics } from "@/lib/application-statistics"
import { buildStatisticsStrategyPayload } from "@/lib/statistics-strategy-payload"
import {
  loadStatisticsChat,
  saveStatisticsChat,
} from "@/lib/statistics-chat-storage"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"
import { revealAssistantMessageContent } from "@/lib/assistant-stream-reveal"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { SectionEmptyState } from "@/components/application-intelligence/section-empty-state"
import { usePageTitle } from "@/hooks/use-page-title"
import { pageTitleForSection, SECTION_PAGE_H1 } from "@/lib/workspace-shell-copy"
import { consumeAiCoachPendingPrompt } from "@/lib/ai-coach-prefill"
import { Sparkles } from "lucide-react"

const COACH_PROMPTS = [
  "Why do I keep getting rejected?",
  "How do I explain a gap in my CV?",
  "Should I apply even if I don't meet all the requirements?",
  "How do I talk about care work as experience?",
  "What salary should I ask for in Germany?",
  "How do I write a cover letter in German?",
] as const

export type AiCoachPageProps = {
  folderId: string
  versions: ResumeVersion[]
  jobApplications: JobApplication[]
  strategicProfile: StrategicProfile | null
  outputLanguage?: "en" | "de"
  userName?: string
}

export function AiCoachPage({
  folderId,
  versions,
  jobApplications,
  strategicProfile,
  outputLanguage = "en",
  userName,
}: AiCoachPageProps) {
  usePageTitle(pageTitleForSection("aiCoach"))
  const lang = outputLanguage === "de" ? "de" : "en"
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const streamRevealCleanupRef = useRef<(() => void) | null>(null)

  const stats = useMemo(
    () => computeApplicationStatistics({ folderId, jobs: jobApplications, versions }),
    [folderId, jobApplications, versions],
  )

  const statsRef = useRef(stats)
  const jobsRef = useRef(jobApplications)
  const versionsRef = useRef(versions)
  statsRef.current = stats
  jobsRef.current = jobApplications
  versionsRef.current = versions

  useEffect(() => {
    setMessages(loadStatisticsChat(folderId))
  }, [folderId])

  useEffect(() => {
    const pending = consumeAiCoachPendingPrompt()
    if (pending) setChatInput(pending)
  }, [])

  useEffect(() => {
    // Never persist [] on mount — that wipes history (React Strict Mode remount).
    if (messages.length > 0) saveStatisticsChat(folderId, messages)
  }, [folderId, messages])

  useEffect(() => {
    return () => {
      streamRevealCleanupRef.current?.()
    }
  }, [])

  const sendChat = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || chatLoading) return

      if (!folderId?.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: newChatMessageId(),
            role: "assistant",
            content: "No workspace selected. Open a workspace, then try again.",
            timestamp: Date.now(),
            status: "error",
          },
        ])
        return
      }

      const nextMessages: AssistantChatMessage[] = [
        ...messages,
        { id: newChatMessageId(), role: "user", content: trimmed, timestamp: Date.now() },
      ]
      setMessages(nextMessages)
      setChatInput("")
      setChatLoading(true)

      try {
        const payload = buildStatisticsStrategyPayload({
          folderId,
          stats: statsRef.current,
          jobs: jobsRef.current,
          versions: versionsRef.current,
          outputLanguage: lang,
        })
        const result = await chatStatisticsStrategy({
          payload,
          message: trimmed,
          conversationHistory: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })

        if (!result.success || !result.reply?.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              id: newChatMessageId(),
              role: "assistant",
              content: result.error ?? "Something went wrong. Please try again.",
              timestamp: Date.now(),
              status: "error",
            },
          ])
          return
        }

        const assistantId = newChatMessageId()
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            timestamp: Date.now(),
            status: "streaming",
          },
        ])

        streamRevealCleanupRef.current?.()
        streamRevealCleanupRef.current = revealAssistantMessageContent(
          setMessages,
          assistantId,
          result.reply,
        )
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: newChatMessageId(),
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "Chat request failed. Please try again.",
            timestamp: Date.now(),
            status: "error",
          },
        ])
      } finally {
        setChatLoading(false)
      }
    },
    [chatLoading, folderId, lang, messages],
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-border/60 px-6 py-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" />
          {SECTION_PAGE_H1.aiCoach}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Supportive guidance grounded in your story and your applications. Use AI safely — you
          review every suggestion.
          {strategicProfile?.careerDirection ? ` Targeting: ${strategicProfile.careerDirection}` : ""}
        </p>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-12 lg:p-8">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Things others have asked</CardTitle>
            <CardDescription>Tap to ask</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {COACH_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="w-full rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => void sendChat(prompt)}
                disabled={chatLoading}
              >
                {prompt}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex min-h-[520px] flex-col lg:col-span-8 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coach conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0 pt-0">
            <div className="flex min-h-[480px] flex-1 flex-col border-t">
              <AssistantChatBody
                messages={messages}
                isLoading={chatLoading}
                loadingLabel="Thinking…"
                input={chatInput}
                onInputChange={setChatInput}
                onSend={() => void sendChat(chatInput)}
                onSuggestion={(t) => void sendChat(t)}
                suggestions={COACH_PROMPTS}
                showSuggestions={
                  messages.length === 0 || messages[messages.length - 1]?.role === "assistant"
                }
                welcomeText="Ask anything about your job search — no judgement, no perfect questions needed."
                inputPlaceholder="Ask anything about your job search — no judgement, no perfect questions needed."
                renderMarkdown
                MessageComponent={StatisticsChatMessage}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
