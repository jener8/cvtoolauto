"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import {
  buildMatchSupportOrganizationsPrompt,
  parseMatchSupportOrganizationsResponse,
  type MatchSupportOrganizationsInput,
} from "@/lib/support-organizations/match-prompt"
import { localMatchOrganizations } from "@/lib/support-organizations/filter"

const LOG_TAG = "match-support-organizations"

export type MatchSupportOrganizationsResult = {
  success: boolean
  organizationIds?: string[]
  reasoning?: string
  source?: "ai" | "local"
  error?: string
  errorCode?: AiErrorCode
}

export async function matchSupportOrganizations(
  input: MatchSupportOrganizationsInput,
): Promise<MatchSupportOrganizationsResult> {
  const query = input.query.trim()
  if (!query) {
    return { success: false, error: "Enter a search phrase first.", errorCode: "validation_error" }
  }
  if (input.organizations.length === 0) {
    return { success: false, error: "No organisations in the directory yet.", errorCode: "validation_error" }
  }

  const allowedIds = new Set(input.organizations.map((org) => org.id))
  const missing = getMissingAiKeyError()

  if (missing) {
    const local = localMatchOrganizations(query, input.organizations)
    return {
      success: true,
      organizationIds: local.map((org) => org.id),
      source: "local",
      reasoning: "Matched by keywords (AI unavailable).",
    }
  }

  const prompt = buildMatchSupportOrganizationsPrompt(input)

  const result = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 800,
    temperature: 0.2,
    timeoutMs: 45_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (!result.ok) {
    const local = localMatchOrganizations(query, input.organizations)
    if (local.length > 0) {
      return {
        success: true,
        organizationIds: local.map((org) => org.id),
        source: "local",
        reasoning: "AI match failed — showing keyword results instead.",
      }
    }
    return { success: false, error: result.error.message, errorCode: result.error.code }
  }

  const parsed = parseMatchSupportOrganizationsResponse(result.text, allowedIds)
  if (!parsed) {
    const local = localMatchOrganizations(query, input.organizations)
    return {
      success: true,
      organizationIds: local.map((org) => org.id),
      source: "local",
      reasoning: "Could not read AI response — showing keyword results.",
    }
  }

  return {
    success: true,
    organizationIds: parsed.organizationIds,
    reasoning: parsed.reasoning,
    source: "ai",
  }
}
