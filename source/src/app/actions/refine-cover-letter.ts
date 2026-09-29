"use server"

import { extractSelectionReplacement } from "@/lib/ai-refine-response"
import { getAiProviderStatus } from "@/lib/ai/provider"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { replaceSelectionInCoverLetter } from "@/lib/cover-letter-selection-replace"
import { computeCvDiff } from "@/lib/cv-diff"
import type { CvEditChange } from "@/lib/cv-edit-types"
import {
  REFINE_COVER_LETTER_FULL_PROMPT,
  REFINE_COVER_LETTER_SELECTION_PROMPT,
} from "@/lib/refine-cover-letter-prompt"

export type RefineCoverLetterInput = {
  currentLetter: string
  jobDescription?: string
  resumeExcerpt?: string
  instruction: string
  outputLanguage?: "en" | "de"
  selection?: { text: string } | null
  selectionOnly?: boolean
}

export type RefineCoverLetterResult = {
  success: boolean
  error?: string
  previousLetterText?: string
  letterText?: string
  selectionReplacement?: string
  selectionOnly?: boolean
  changeSummary?: string
  changeWhy?: string
  changes?: CvEditChange[]
  model?: string
  provider?: string
}

function parseFullLetterResponse(raw: string): {
  updatedLetter?: string
  rationale?: string
  summary?: string
} | null {
  const jsonFence = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidates = [jsonFence?.[1], raw.trim()].filter(Boolean) as string[]
  for (const candidate of candidates) {
    try {
      const start = candidate.indexOf("{")
      const end = candidate.lastIndexOf("}")
      if (start < 0 || end <= start) continue
      return JSON.parse(candidate.slice(start, end + 1)) as {
        updatedLetter?: string
        rationale?: string
        summary?: string
      }
    } catch {
      continue
    }
  }
  return null
}

function parseSelectionRationale(raw: string): string | undefined {
  const jsonFence = raw.match(/```json\s*([\s\S]*?)```/i)
  if (!jsonFence?.[1]) return undefined
  try {
    const parsed = JSON.parse(jsonFence[1]) as { rationale?: string }
    return parsed.rationale?.trim()
  } catch {
    return undefined
  }
}

export async function refineCoverLetterWithAi(
  input: RefineCoverLetterInput,
): Promise<RefineCoverLetterResult> {
  const currentLetter = input.currentLetter?.trim() ?? ""
  const instruction = input.instruction?.trim() ?? ""
  const outputLanguage = input.outputLanguage === "de" ? "de" : "en"
  const providerStatus = getAiProviderStatus()

  if (!currentLetter) {
    return { success: false, error: "Open a cover letter with content before applying edits." }
  }
  if (!instruction) {
    return { success: false, error: "Please describe how to change the cover letter." }
  }

  const selectionText = input.selection?.text?.trim() ?? ""
  const selectionOnly = Boolean(input.selectionOnly && selectionText)

  if (selectionOnly) {
    const prompt = REFINE_COVER_LETTER_SELECTION_PROMPT(
      currentLetter,
      input.jobDescription ?? "",
      input.resumeExcerpt ?? "",
      instruction,
      selectionText,
      outputLanguage,
    )
    const gen = await runTextGenerationWithRetry({
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.4,
      timeoutMs: 60_000,
      maxAttempts: 2,
      logTag: "refine-cover-letter-selection",
    })
    if (!gen.ok) {
      return { success: false, error: gen.error.message }
    }

    const replacement = extractSelectionReplacement(gen.text)
    if (!replacement) {
      return {
        success: false,
        error: "Could not parse rewritten text. Try again or rephrase your request.",
      }
    }

    const merged = replaceSelectionInCoverLetter(currentLetter, selectionText, replacement)
    if (!merged) {
      return {
        success: false,
        error: "Could not locate the selected text in your cover letter. Try selecting again.",
      }
    }

    const changes = computeCvDiff(currentLetter, merged).map((c) => ({
      ...c,
      section: "Cover letter",
    }))

    return {
      success: true,
      previousLetterText: currentLetter,
      letterText: merged,
      selectionReplacement: replacement,
      selectionOnly: true,
      changeSummary: `Rewrote selected cover letter text`,
      changeWhy: parseSelectionRationale(gen.text),
      changes,
      model: providerStatus.model,
      provider: providerStatus.backend,
    }
  }

  const prompt = REFINE_COVER_LETTER_FULL_PROMPT(
    currentLetter,
    input.jobDescription ?? "",
    input.resumeExcerpt ?? "",
    instruction,
    outputLanguage,
  )
  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.45,
    timeoutMs: 90_000,
    maxAttempts: 2,
    logTag: "refine-cover-letter-full",
  })
  if (!gen.ok) {
    return { success: false, error: gen.error.message }
  }

  const parsed = parseFullLetterResponse(gen.text)
  const updatedLetter = parsed?.updatedLetter?.trim() ?? extractSelectionReplacement(gen.text)
  if (!updatedLetter) {
    return {
      success: false,
      error: "Could not parse the updated cover letter. Try again.",
    }
  }

  const changes = computeCvDiff(currentLetter, updatedLetter).map((c) => ({
    ...c,
    section: "Cover letter",
  }))

  return {
    success: true,
    previousLetterText: currentLetter,
    letterText: updatedLetter,
    selectionOnly: false,
    changeSummary: parsed?.summary?.trim() || `Updated cover letter`,
    changeWhy: parsed?.rationale?.trim(),
    changes,
    model: providerStatus.model,
    provider: providerStatus.backend,
  }
}
