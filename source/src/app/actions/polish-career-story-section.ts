"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import type { CareerStoryFieldKey } from "@/lib/career-story-sections"
import type { StrategicProfile } from "@/lib/strategic-profile"

const LOG_TAG = "polish-career-story-section"

export type PolishCareerStorySectionInput = {
  fieldKey: CareerStoryFieldKey
  sectionLabel: string
  question: string
  rawTranscript: string
  strategicProfile: StrategicProfile
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
}

export type PolishCareerStorySectionResult = {
  success: boolean
  narrative?: string
  followUpQuestion?: string
  error?: string
  errorCode?: AiErrorCode
}

function parsePolishResponse(text: string): { narrative?: string; followUpQuestion?: string } {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() ?? text.trim()
  try {
    const parsed = JSON.parse(candidate) as {
      narrative?: string
      followUpQuestion?: string
    }
    return {
      narrative: parsed.narrative?.trim(),
      followUpQuestion: parsed.followUpQuestion?.trim(),
    }
  } catch {
    return { narrative: text.trim() }
  }
}

/**
 * Rewrites a spoken or typed answer into a short third-person narrative for story cards.
 * Uses the same text-generation stack as other AI assistant actions.
 */
export async function polishCareerStorySection(
  input: PolishCareerStorySectionInput,
): Promise<PolishCareerStorySectionResult> {
  const transcript = input.rawTranscript.trim()
  if (!transcript) {
    return { success: false, error: "Nothing to rewrite yet.", errorCode: "validation_error" }
  }

  const missing = getMissingAiKeyError()
  if (missing) {
    return { success: false, error: missing.message, errorCode: missing.code }
  }

  const profileContext = [
    input.strategicProfile.careerDirection &&
      `Career direction: ${input.strategicProfile.careerDirection}`,
    input.strategicProfile.professionalStrengths &&
      `Strengths: ${input.strategicProfile.professionalStrengths}`,
    input.strategicProfile.strategicEmphasis &&
      `Values: ${input.strategicProfile.strategicEmphasis}`,
    input.strategicProfile.longTermGoal && `Goals: ${input.strategicProfile.longTermGoal}`,
  ]
    .filter(Boolean)
    .join("\n")

  const history =
    input.conversationHistory && input.conversationHistory.length > 0
      ? `RECENT CONVERSATION:\n${input.conversationHistory
          .slice(-6)
          .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
          .join("\n")}\n\n`
      : ""

  const prompt = `You help a job seeker shape their career story for a supportive career platform.

The user answered this question in their own words (possibly via speech-to-text):
"${input.question}"

Section: ${input.sectionLabel} (field: ${input.fieldKey})

USER'S RAW ANSWER:
${transcript}

${history}EXISTING STORY CONTEXT:
${profileContext || "(none yet)"}

TASK:
1. Rewrite the answer as a warm, confident 2–3 sentence narrative paragraph in THIRD PERSON (e.g. "She brings...", "They are drawn to..."). Use only facts from the raw answer — do not invent employers, degrees, or experience.
2. Suggest ONE short natural follow-up question (one sentence) to draw out more detail before moving to the next topic. Base it on what they just said.

Return ONLY valid JSON (no markdown outside the JSON):
{
  "narrative": "third person paragraph",
  "followUpQuestion": "one follow-up question"
}`

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 800,
    temperature: 0.45,
    timeoutMs: 45_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (!result.ok) {
    return { success: false, error: result.error.message, errorCode: result.error.code }
  }

  const parsed = parsePolishResponse(result.text)
  if (!parsed.narrative) {
    return {
      success: false,
      error: "Could not read the rewritten story.",
      errorCode: "empty_response",
    }
  }

  return {
    success: true,
    narrative: parsed.narrative,
    followUpQuestion: parsed.followUpQuestion,
  }
}
