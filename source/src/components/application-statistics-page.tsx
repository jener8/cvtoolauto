"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  chatStatisticsStrategy,
  generateStatisticsStrategyReport,
} from "@/app/actions/statistics-strategy"
import {
  AssistantChatBody,
  newChatMessageId,
} from "@/components/assistant/chat-ui"
import { getAiConfigurationStatus } from "@/app/actions/platform-status"
import { StatisticsChatMessage } from "@/components/statistics-chat-message"
import { StrategyAnalysisDashboard } from "@/components/strategy-analysis-dashboard"
import type { StrategyAnalysisReport } from "@/lib/strategy-analysis-types"
import { OPENAI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai/messages"
import { ProfileMenu } from "@/components/profile-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  computeApplicationStatistics,
  type ApplicationStatistics,
} from "@/lib/application-statistics"
import {
  loadStatisticsChat,
  saveStatisticsChat,
} from "@/lib/statistics-chat-storage"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"
import { revealAssistantMessageContent } from "@/lib/assistant-stream-reveal"
import {
  assessStatisticsDataReadiness,
  buildStatisticsStrategyPayload,
  estimatePayloadBytes,
} from "@/lib/statistics-strategy-payload"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { BarChart3, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react"

const ANALYSIS_TIMEOUT_MS = 30_000

type AnalysisPhase =
  | "loading_applications"
  | "loading_resumes"
  | "loading_outcomes"
  | "generating_insights"
  | "finalizing"

const PHASE_LABELS: Record<AnalysisPhase, string> = {
  loading_applications: "Loading applications…",
  loading_resumes: "Loading resumes…",
  loading_outcomes: "Loading outcomes…",
  generating_insights: "Generating insights…",
  finalizing: "Finalizing analysis…",
}

const CHAT_SUGGESTIONS = [
  "Why did these applications work better?",
  "What kind of roles should I focus on next?",
  "Which resume version performed best?",
  "What keywords appear in my successful applications?",
  "Where am I wasting effort?",
  "How should I change my strategy?",
] as const

function pct(rate: number | null): string {
  if (rate == null) return "—"
  return `${Math.round(rate * 100)}%`
}

export interface ApplicationStatisticsPageProps {
  folderId: string
  folderName?: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  outputLanguage?: "en" | "de"
  userName?: string
  userEmail?: string
  onSaveProfile?: (name: string, email: string, password: string) => void
}

export function ApplicationStatisticsPage({
  folderId,
  folderName,
  jobApplications,
  versions,
  outputLanguage = "en",
  userName,
  userEmail,
  onSaveProfile,
}: ApplicationStatisticsPageProps) {
  const lang = outputLanguage === "de" ? "de" : "en"

  const stats = useMemo(
    () =>
      computeApplicationStatistics({
        folderId,
        jobs: jobApplications,
        versions,
      }),
    [folderId, jobApplications, versions],
  )

  const [aiAnalysis, setAiAnalysis] = useState<StrategyAnalysisReport | null>(null)
  const [aiGuidance, setAiGuidance] = useState<string | null>(null)
  const [aiUsedFallback, setAiUsedFallback] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPhase, setAiPhase] = useState<AnalysisPhase | null>(null)
  const [aiLastRunAt, setAiLastRunAt] = useState<number | null>(null)
  const [aiDiagnostics, setAiDiagnostics] = useState<Record<string, unknown> | null>(null)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)

  const jobsRef = useRef(jobApplications)
  const versionsRef = useRef(versions)
  const statsRef = useRef(stats)
  jobsRef.current = jobApplications
  versionsRef.current = versions
  statsRef.current = stats

  const analysisRequestRef = useRef(0)

  const dataReadiness = useMemo(() => {
    const payload = buildStatisticsStrategyPayload({
      folderId,
      stats,
      jobs: jobApplications,
      versions,
      outputLanguage: lang,
    })
    return assessStatisticsDataReadiness(payload)
  }, [folderId, stats, jobApplications, versions, lang])

  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const streamRevealCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      streamRevealCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void getAiConfigurationStatus()
      .then((status) => {
        if (!cancelled) setAiConfigured(status.configured)
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadReport = useCallback(async () => {
    if (aiConfigured === false) return

    const requestId = ++analysisRequestRef.current
    const isStale = () => requestId !== analysisRequestRef.current

    setAiLoading(true)
    setAiError(null)
    setAiAnalysis(null)
    setAiGuidance(null)
    setAiUsedFallback(false)
    setAiDiagnostics(null)
    setAiPhase("loading_applications")

    if (process.env.NODE_ENV === "development") {
      console.info("[ai-strategy-ui] Analysis request started", { folderId })
    }

    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      if (isStale()) return
      timedOut = true
      setAiLoading(false)
      setAiPhase(null)
      setAiError("Analysis timed out. Please try again.")
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai-strategy-ui] Client timeout", { folderId, timeoutMs: ANALYSIS_TIMEOUT_MS })
      }
    }, ANALYSIS_TIMEOUT_MS)

    try {
      await new Promise((resolve) => setTimeout(resolve, 80))
      if (isStale() || timedOut) return
      setAiPhase("loading_resumes")

      await new Promise((resolve) => setTimeout(resolve, 80))
      if (isStale() || timedOut) return
      setAiPhase("loading_outcomes")

      const jobs = jobsRef.current
      const vers = versionsRef.current
      const currentStats = statsRef.current
      const payload = buildStatisticsStrategyPayload({
        folderId,
        stats: currentStats,
        jobs,
        versions: vers,
        outputLanguage: lang,
      })
      const readiness = assessStatisticsDataReadiness(payload)

      if (process.env.NODE_ENV === "development") {
        console.info("[ai-strategy-ui] Data ready", {
          folderId,
          applications: readiness.applicationCount,
          resumeVersions: readiness.resumeVersionCount,
          outcomes: readiness.outcomeCount,
          payloadBytes: estimatePayloadBytes(payload),
        })
      }

      if (readiness.emptyStateMessage) {
        if (isStale() || timedOut) return
        setAiGuidance(readiness.emptyStateMessage)
        setAiLastRunAt(Date.now())
        setAiDiagnostics({
          applicationCount: readiness.applicationCount,
          resumeVersionCount: readiness.resumeVersionCount,
          outcomeCount: readiness.outcomeCount,
          skippedAi: true,
        })
        return
      }

      if (isStale() || timedOut) return
      setAiPhase("generating_insights")

      const result = await generateStatisticsStrategyReport(payload)

      if (isStale() || timedOut) return

      setAiPhase("finalizing")
      setAiDiagnostics(result.diagnostics ?? null)
      setAiLastRunAt(Date.now())

      if (!result.success) {
        setAiError(result.error ?? "Could not generate analysis.")
        if (process.env.NODE_ENV === "development") {
          console.error("[ai-strategy-ui] Analysis failed", result)
        }
        return
      }

      if (result.guidance) {
        setAiGuidance(result.guidance)
        return
      }

      if (!result.analysis) {
        setAiError("The AI returned an empty analysis. Please try again.")
        return
      }

      setAiAnalysis(result.analysis)
      setAiUsedFallback(Boolean(result.usedFallback))
      if (process.env.NODE_ENV === "development") {
        console.info("[ai-strategy-ui] Analysis complete", {
          structured: !result.usedFallback,
          diagnostics: result.diagnostics,
        })
      }
    } catch (error) {
      if (isStale() || timedOut) return
      const message = error instanceof Error ? error.message : "Unexpected error during analysis."
      setAiError(message)
      console.error("[ai-strategy-ui] Unhandled error", error)
    } finally {
      clearTimeout(timeoutId)
      if (!isStale() && !timedOut) {
        setAiLoading(false)
        setAiPhase(null)
      }
    }
  }, [folderId, lang, aiConfigured])

  useEffect(() => {
    setMessages(loadStatisticsChat(folderId))
  }, [folderId])

  useEffect(() => {
    if (aiConfigured === null || !aiConfigured) return
    void loadReport()
  }, [folderId, aiConfigured, loadReport])

  useEffect(() => {
    if (messages.length > 0) saveStatisticsChat(folderId, messages)
  }, [folderId, messages])

  const sendChat = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || chatLoading) return

      const nextMessages: AssistantChatMessage[] = [
        ...messages,
        { id: newChatMessageId(), role: "user", content: trimmed, timestamp: Date.now() },
      ]
      setMessages(nextMessages)
      setChatInput("")
      setChatLoading(true)

      try {
        const chatPayload = buildStatisticsStrategyPayload({
          folderId,
          stats: statsRef.current,
          jobs: jobsRef.current,
          versions: versionsRef.current,
          outputLanguage: lang,
        })
        const result = await chatStatisticsStrategy({
          payload: chatPayload,
          message: trimmed,
          conversationHistory: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })

        if (!result.success) {
          setMessages((prev) => [
            ...prev,
            {
              id: newChatMessageId(),
              role: "assistant",
              content: result.error ?? "Something went wrong.",
              timestamp: Date.now(),
              status: "error",
            },
          ])
          return
        }

        const assistantId = newChatMessageId()
        const reply = result.reply ?? ""
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
        if (reply.trim()) {
          streamRevealCleanupRef.current?.()
          streamRevealCleanupRef.current = revealAssistantMessageContent(
            setMessages,
            assistantId,
            reply,
          )
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: newChatMessageId(),
            role: "assistant",
            content:
              error instanceof Error ? error.message : "Chat request failed. Please try again.",
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
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="ui-page-title flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[var(--brand-teal)] shrink-0" aria-hidden />
            Statistics &amp; strategy
          </h1>
          <p className="ui-page-subtitle">
            {folderName ? `${folderName} · ` : ""}
            Charts, funnel metrics, and AI insights from your applications in this workspace.
          </p>
        </div>
        <div className="shrink-0">
          <ProfileMenu
            userName={userName}
            userEmail={userEmail}
            profileImage={null}
            onSaveProfile={onSaveProfile}
          />
        </div>
      </div>

      <div className="space-y-8">
        <MetricsSection stats={stats} />

        <div className="grid lg:grid-cols-2 gap-6">
          <RankedSection title="Best-performing job titles" items={stats.bestJobTitles} />
          <RankedSection title="Best-performing industries" items={stats.bestIndustries} />
          <RankedSection title="Best-performing resume versions" items={stats.bestResumeVersions} />
          <RankedSection title="Top keywords & skills" items={stats.bestKeywords} />
        </div>

        <TrendsSection trends={stats.trendsOverTime} />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                AI strategy analysis
              </CardTitle>
              <CardDescription>
                Evidence-based insights from your outcomes, job descriptions, and resume versions
                in this folder.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={aiLoading || aiConfigured === false}
              onClick={() => void loadReport()}
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh analysis
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiConfigured === false && (
              <div className="rounded-md border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-3 text-sm leading-relaxed text-foreground/90">
                {OPENAI_NOT_CONFIGURED_MESSAGE}
              </div>
            )}

            {aiLoading && aiConfigured !== false && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
                <div>
                  <p>{aiPhase ? PHASE_LABELS[aiPhase] : "Starting analysis…"}</p>
                  <p className="text-xs mt-1 text-muted-foreground/80">
                    This usually takes a few seconds. Times out after 30 seconds.
                  </p>
                </div>
              </div>
            )}

            {!aiLoading && aiError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {aiError}
              </div>
            )}

            {!aiLoading && !aiError && aiGuidance && (
              <div className="rounded-md border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-3 text-sm leading-relaxed text-foreground/90">
                {aiGuidance}
              </div>
            )}

            {!aiLoading && !aiError && aiAnalysis && aiConfigured !== false && (
              <StrategyAnalysisDashboard
                report={aiAnalysis}
                stats={stats}
                usedFallback={aiUsedFallback}
              />
            )}

            {!aiLoading && !aiError && !aiGuidance && !aiAnalysis && (
              <p className="text-sm text-muted-foreground">
                No analysis yet. Click Refresh analysis to generate insights.
              </p>
            )}

            {process.env.NODE_ENV === "development" && (
              <details className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground/80">
                  Development diagnostics
                </summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt>Folder ID</dt>
                  <dd className="font-mono truncate">{folderId}</dd>
                  <dt>Applications</dt>
                  <dd>{dataReadiness.applicationCount}</dd>
                  <dt>Resume versions</dt>
                  <dd>{dataReadiness.resumeVersionCount}</dd>
                  <dt>Recorded outcomes</dt>
                  <dd>{dataReadiness.outcomeCount}</dd>
                  <dt>Loading</dt>
                  <dd>{aiLoading ? "yes" : "no"}</dd>
                  <dt>Phase</dt>
                  <dd>{aiPhase ?? "—"}</dd>
                  <dt>Last analysis</dt>
                  <dd>
                    {aiLastRunAt
                      ? new Date(aiLastRunAt).toLocaleTimeString()
                      : "—"}
                  </dd>
                  <dt>Error</dt>
                  <dd className="text-destructive">{aiError ?? "—"}</dd>
                  {aiDiagnostics && (
                    <>
                      <dt>Diagnostics</dt>
                      <dd className="col-span-1 break-all">
                        {JSON.stringify(aiDiagnostics)}
                      </dd>
                    </>
                  )}
                </dl>
              </details>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-lg">Statistics chat</CardTitle>
            <CardDescription>
              Discuss your job strategy using only this folder&apos;s data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-[360px] p-0 pt-0">
            <div className="flex flex-col flex-1 min-h-[360px] border-t">
              <AssistantChatBody
                messages={messages}
                isLoading={chatLoading}
                loadingLabel="Analyzing your data…"
                input={chatInput}
                onInputChange={setChatInput}
                onSend={() => void sendChat(chatInput)}
                onSuggestion={(t) => void sendChat(t)}
                suggestions={CHAT_SUGGESTIONS}
                showSuggestions={
                  messages.length === 0 || messages[messages.length - 1]?.role === "assistant"
                }
                welcomeText="Ask about what's working, what to change, or where to focus next."
                inputPlaceholder="Ask about your strategy…"
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

function MetricsSection({ stats }: { stats: ApplicationStatistics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <Metric label="Total applications" value={String(stats.totalApplications)} />
      <Metric
        label="Applications / month"
        value={stats.applicationsPerMonth != null ? stats.applicationsPerMonth.toFixed(1) : "—"}
      />
      <Metric label="Interviews received" value={String(stats.interviewsReceived)} />
      <Metric
        label="Interview conversion"
        value={pct(stats.interviewConversionRate)}
        hint="Interviews / applications"
      />
      <Metric
        label="2nd interview conversion"
        value={pct(stats.secondInterviewConversionRate)}
        hint="Second+ / interviews"
      />
      <Metric
        label="Offer conversion"
        value={pct(stats.offerConversionRate)}
        hint="Offers / interviews"
      />
      <Metric label="Acceptance rate" value={pct(stats.acceptanceRate)} hint="Accepted / offers" />
      <Metric label="Hired" value={String(stats.hired)} />
      <Metric label="Rejections" value={String(stats.rejections)} />
      <Metric label="Declined offers" value={String(stats.declined)} />
      <Metric label="No response" value={String(stats.noResponse)} />
      <Metric
        label="Avg days to interview"
        value={stats.avgDaysToInterview != null ? String(stats.avgDaysToInterview) : "—"}
      />
      <Metric
        label="Avg days to rejection"
        value={stats.avgDaysToRejection != null ? String(stats.avgDaysToRejection) : "—"}
      />
      <Metric
        label="Avg days to offer"
        value={stats.avgDaysToOffer != null ? String(stats.avgDaysToOffer) : "—"}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function RankedSection({
  title,
  items,
}: {
  title: string
  items: { label: string; total: number; successful: number; successRate: number | null }[]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.label} className="flex justify-between gap-2">
                <span className="truncate font-medium">{item.label}</span>
                <span className="text-muted-foreground shrink-0">
                  {item.successful}/{item.total}
                  {item.successRate != null && (
                    <span className="ml-1">({pct(item.successRate)})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TrendsSection({
  trends,
}: {
  trends: ApplicationStatistics["trendsOverTime"]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Application trends over time
        </CardTitle>
        <CardDescription>Grouped by application date (month)</CardDescription>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dated applications yet.</p>
        ) : (
          <ScrollArea className="max-h-48">
            <ul className="space-y-2 text-sm pr-4">
              {trends.map((t) => (
                <li
                  key={t.monthKey}
                  className="flex flex-wrap justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {t.applications} applications · {t.interview} interview stages · {t.offer} offers ·{" "}
                    {t.hired} hired · {t.rejected} rejected · {t.noResponse} no response · {t.withdrawn} withdrawn
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

