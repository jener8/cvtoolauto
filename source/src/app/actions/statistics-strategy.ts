"use server"

import { OPENAI_NOT_CONFIGURED_MESSAGE } from "@/lib/ai/messages"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import {
  buildStatisticsChatPrompt,
  buildStatisticsStrategyReportPrompt,
} from "@/lib/statistics-strategy-prompt"
import { parseStrategyAnalysisReport } from "@/lib/strategy-analysis-parse"
import type { StrategyAnalysisReport } from "@/lib/strategy-analysis-types"
import {
  assessStatisticsDataReadiness,
  estimatePayloadBytes,
  type StatisticsStrategyPayload,
} from "@/lib/statistics-strategy-payload"

const LOG_TAG = "statistics-strategy-report"
const ANALYSIS_TIMEOUT_MS = 30_000

function logStep(step: string, detail?: Record<string, unknown>) {
  console.info(`[${LOG_TAG}] ${step}`, detail ?? {})
}

export async function generateStatisticsStrategyReport(
  payload: StatisticsStrategyPayload,
): Promise<{
  success: boolean
  report?: string
  analysis?: StrategyAnalysisReport
  guidance?: string
  usedFallback?: boolean
  error?: string
  diagnostics?: Record<string, unknown>
}> {
  const startedAt = Date.now()

  try {
    logStep("Analysis request started")

    const folderId = payload.folderId?.trim()
    if (!folderId) {
      return { success: false, error: "No workspace selected." }
    }

    logStep("Folder loaded", { folderId })

    const missingAi = getMissingAiKeyError()
    if (missingAi) {
      logStep("OpenAI not configured", { code: missingAi.code })
      return {
        success: false,
        error: missingAi.message || OPENAI_NOT_CONFIGURED_MESSAGE,
        diagnostics: { aiConfigured: false },
      }
    }

    const readiness = assessStatisticsDataReadiness(payload)

    logStep("Applications loaded", {
      applicationCount: readiness.applicationCount,
      resumeVersionCount: readiness.resumeVersionCount,
    })

    logStep("Outcomes loaded", {
      outcomeCount: readiness.outcomeCount,
      hasRecordedOutcomes: readiness.hasRecordedOutcomes,
      payloadBytes: estimatePayloadBytes(payload),
    })

    if (readiness.emptyStateMessage) {
      logStep("Insufficient data — returning guidance", {
        message: readiness.emptyStateMessage,
      })
      return {
        success: true,
        guidance: readiness.emptyStateMessage,
        diagnostics: {
          ...readiness,
          durationMs: Date.now() - startedAt,
          skippedAi: true,
        },
      }
    }

    logStep("Prompt generated", {
      jobSummaries: payload.jobs.length,
      versionSummaries: payload.versions.length,
    })

    const prompt = buildStatisticsStrategyReportPrompt(
      payload.stats,
      payload.jobs,
      payload.versions,
      payload.outputLanguage,
    )

    logStep("OpenAI request sent", {
      promptChars: prompt.length,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    })

    const gen = await runTextGenerationWithRetry({
      prompt,
      maxOutputTokens: 4000,
      temperature: 0.4,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
      maxAttempts: 1,
      logTag: LOG_TAG,
    })

    logStep("OpenAI response received", {
      ok: gen.ok,
      attempts: gen.attempts,
      durationMs: Date.now() - startedAt,
    })

    if (!gen.ok) {
      return {
        success: false,
        error: gen.error.message,
        diagnostics: {
          ...readiness,
          aiErrorCode: gen.error.code,
          durationMs: Date.now() - startedAt,
        },
      }
    }

    const raw = gen.text.trim()
    if (!raw) {
      return {
        success: false,
        error: "The AI returned an empty analysis. Please try again.",
        diagnostics: { durationMs: Date.now() - startedAt },
      }
    }

    const { report: analysis, usedFallback } = parseStrategyAnalysisReport(raw)

    logStep("Analysis saved", {
      reportChars: raw.length,
      structured: !usedFallback,
      sections: Object.keys(analysis).length,
    })

    return {
      success: true,
      analysis,
      usedFallback,
      diagnostics: {
        ...readiness,
        durationMs: Date.now() - startedAt,
        reportChars: raw.length,
        structured: !usedFallback,
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during analysis."
    console.error(`[${LOG_TAG}] Unhandled failure`, error)
    return {
      success: false,
      error: message,
      diagnostics: { durationMs: Date.now() - startedAt },
    }
  }
}

export async function chatStatisticsStrategy(input: {
  payload: StatisticsStrategyPayload
  message: string
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
}): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const message = input.message?.trim() ?? ""
    if (!message) return { success: false, error: "Please enter a message." }
    if (!input.payload.folderId?.trim()) {
      return { success: false, error: "No workspace selected." }
    }

    const prompt = buildStatisticsChatPrompt(
      input.payload.stats,
      input.payload.jobs,
      input.payload.versions,
      message,
      input.conversationHistory ?? [],
      input.payload.outputLanguage,
    )

    const gen = await runTextGenerationWithRetry({
      prompt,
      maxOutputTokens: 3000,
      temperature: 0.45,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
      maxAttempts: 1,
      logTag: "statistics-strategy-chat",
    })

    if (!gen.ok) return { success: false, error: gen.error.message }
    return { success: true, reply: gen.text.trim() }
  } catch (error) {
    console.error("[statistics-strategy-chat] Unhandled failure", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Chat request failed.",
    }
  }
}
