"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { getMissingAiKeyError, runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import {
  canRunOpenAiWebSearch,
  runWebSearchGeneration,
} from "@/lib/ai/run-web-search-generation"
import { buildFallbackCompanyTargets } from "@/lib/job-search-companies-fallback"
import { buildJobSearchCompaniesPrompt } from "@/lib/job-search-companies-prompt"
import { parseJobSearchCompaniesResponse } from "@/lib/job-search-companies-parse"
import { appliedCompanyNames, type CompanySearchTarget } from "@/lib/job-search-focus"
import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication } from "@/lib/types"

const LOG_TAG = "discover-job-search-companies"
const CV_EXCERPT_MAX = 6000

export type DiscoverJobSearchCompaniesInput = {
  strategicProfile: StrategicProfile | null
  resumeText: string
  jobs: JobApplication[]
  jobTitles: string[]
  outputLanguage?: "en" | "de"
}

export type DiscoverJobSearchCompaniesResult = {
  success: boolean
  companies?: CompanySearchTarget[]
  source?: "ai" | "fallback"
  error?: string
  errorCode?: AiErrorCode
}

export async function discoverJobSearchCompanies(
  input: DiscoverJobSearchCompaniesInput,
): Promise<DiscoverJobSearchCompaniesResult> {
  const exclude = [...appliedCompanyNames(input.jobs)]
  const fallback = buildFallbackCompanyTargets(input.jobTitles, exclude)

  if (input.jobTitles.length === 0 && fallback.length === 0) {
    return {
      success: false,
      error: "Add job titles first so we can suggest employers to explore.",
      errorCode: "validation_error",
    }
  }

  const resumeExcerpt = input.resumeText.trim().slice(0, CV_EXCERPT_MAX)
  const prompt = buildJobSearchCompaniesPrompt({
    strategicProfile: input.strategicProfile,
    resumeExcerpt,
    jobs: input.jobs,
    jobTitles: input.jobTitles,
    outputLanguage: input.outputLanguage,
  })

  if (canRunOpenAiWebSearch()) {
    const webResult = await runWebSearchGeneration({
      prompt,
      maxOutputTokens: 2500,
      temperature: 0.35,
      timeoutMs: 90_000,
      logTag: LOG_TAG,
    })

    if (webResult.ok) {
      const companies = parseJobSearchCompaniesResponse(webResult.text, exclude)
      if (companies?.length) {
        return { success: true, companies, source: "ai" }
      }
    }
  }

  const missing = getMissingAiKeyError()
  if (missing && fallback.length > 0) {
    return { success: true, companies: fallback, source: "fallback" }
  }

  if (missing) {
    return { success: false, error: missing.message, errorCode: missing.code }
  }

  const textResult = await runTextGenerationWithRetry({
    prompt: `${prompt}

(If you cannot browse the web, use your knowledge of major Berlin and European employers that hire for these roles.)`,
    maxOutputTokens: 2500,
    temperature: 0.35,
    timeoutMs: 60_000,
    maxAttempts: 2,
    logTag: LOG_TAG,
  })

  if (textResult.ok) {
    const companies = parseJobSearchCompaniesResponse(textResult.text, exclude)
    if (companies?.length) {
      return { success: true, companies, source: "ai" }
    }
  }

  if (fallback.length > 0) {
    return { success: true, companies: fallback, source: "fallback" }
  }

  return {
    success: false,
    error: "Could not find employer suggestions. Try again shortly.",
    errorCode: "empty_response",
  }
}
