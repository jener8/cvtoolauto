"use server"

import { extractRefineAiResponse, extractSelectionReplacement, fallbackChangeSummary, isAddBulletInstruction, mergeBulletFragmentIntoCv } from "@/lib/ai-refine-response"
import { isUsableCvMarkdown, recoverCvFromAiResponse } from "@/lib/ai-cv-response"
import { getAiProviderStatus } from "@/lib/ai/provider"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { buildExplainabilityFromChangeWhy } from "@/lib/ai-transparency"
import { assessEditRisk } from "@/lib/cv-edit-risk"
import { computeCvDiff, formatCvEditSummary } from "@/lib/cv-diff"
import type { CvEditChange } from "@/lib/cv-edit-types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { validateAndSanitizeRefinedCv, formatUnknownEmployerError } from "@/lib/cv-factual-validation"
import {
  buildConsolidateExperienceEditorHint,
  ensureExperienceEntriesHaveBullets,
  isConsolidateExperienceInstruction,
} from "@/lib/cv-experience-consolidation"
import { mergePartialCvEdit } from "@/lib/cv-tailor-sections"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import {
  REFINE_CV_PROMPT,
  REFINE_SELECTION_ONLY_PROMPT,
  type RefineSelectionContext,
} from "@/lib/refine-cv-prompt"
import { replaceSelectionInResume } from "@/lib/cv-selection-replace"
import { isTranslateInstruction } from "@/lib/unified-assistant/modes"

export type RefineConversationTurn = {
  role: "user" | "assistant"
  content: string
}

export type RefineResumeInput = {
  currentCv: string
  jobDescription: string
  instruction: string
  outputLanguage?: "en" | "de"
  strategicProfile?: StrategicProfile | null
  conversationHistory?: RefineConversationTurn[]
  folderId?: string
  learningMemory?: PersonalLearningMemory | null
  selection?: RefineSelectionContext | null
  selectionOnly?: boolean
  confirmRiskyEdit?: boolean
  confirmBypassValidation?: boolean
  selectedJobTitle?: string
  currentVersionName?: string
}

export type RefineResumeResult = {
  success: boolean
  mode?: "edit_cv"
  cvText?: string
  previousCvText?: string
  changeSummary?: string
  changeWhy?: string
  changes?: CvEditChange[]
  versionName?: string
  selectionReplacement?: string
  requiresConfirmation?: boolean
  riskReasons?: string[]
  validationWarnings?: string[]
  strippedEmployers?: string[]
  requiresValidationOverride?: boolean
  model?: string
  provider?: string
  explainability?: import("@/lib/ai-transparency").AiExplainability
  error?: string
}

const LOG_TAG = "refine-resume"

const REFINE_FORMAT_RETRY_SUFFIX = `

CRITICAL OUTPUT RULES (override everything above):
- Return the COMPLETE updated resume in one markdown code block (triple backticks).
- Also include the required JSON block with "updatedResume" containing the same full resume text.
- Do NOT return only a bullet, diff, or partial section — include every existing section unchanged unless the user asked to remove it.
- Use # for job titles, ## for companies, ### for dates, - for bullets, and ALL CAPS section headers.`

function isExperienceRewriteInstruction(instruction: string): boolean {
  return /\b(experience|bullet|bullets|achiev|passive|accomplish|impact|result)\b/i.test(
    instruction,
  )
}

function buildRefineEditorHints(
  instruction: string,
  selection?: RefineSelectionContext | null,
): string | null {
  const hints: string[] = []

  if (/\b(achiev|passive|impact|result|doing y|with z)\b/i.test(instruction)) {
    hints.push(
      'Rewrite experience bullets in achievement format: "Achieved [outcome] by [action] with/through [method/tool]". Use only facts supported by the current CV — do not invent metrics, employers, or tools.',
    )
  }

  if (
    selection?.text?.trim() &&
    /\b(experience|bullet|bullets)\b/i.test(instruction) &&
    !/\bexperience\b/i.test(selection.text)
  ) {
    hints.push(
      "The highlighted text is background context only. Apply this edit to the EXPERIENCE section bullet points, not the highlighted profile line.",
    )
  }

  if (isConsolidateExperienceInstruction(instruction)) {
    hints.push(buildConsolidateExperienceEditorHint())
  }

  return hints.length > 0 ? hints.join("\n\n") : null
}

function resolveRefinedCvText(
  raw: string,
  baselineCv: string,
  instruction: string,
  initialCvText: string,
): string {
  let cvText = initialCvText
  const recoveredFragment = recoverCvFromAiResponse(raw).text

  if (!isUsableCvMarkdown(cvText) && isAddBulletInstruction(instruction)) {
    const merged = mergeBulletFragmentIntoCv(baselineCv, recoveredFragment)
    if (merged) cvText = merged
  }

  if (!isUsableCvMarkdown(cvText)) {
    const merged = mergePartialCvEdit(baselineCv, recoveredFragment, {
      preferredSection: isExperienceRewriteInstruction(instruction)
        ? "EXPERIENCE"
        : undefined,
    })
    if (merged && isUsableCvMarkdown(merged)) cvText = merged
  }

  if (!isUsableCvMarkdown(cvText) && baselineCv.trim()) {
    const selectionFocused =
      isTranslateInstruction(instruction) ||
      /\b(this|selected|highlighted)\b/i.test(instruction)
    if (
      !selectionFocused &&
      recoveredFragment.length > baselineCv.length * 0.35 &&
      isUsableCvMarkdown(recoveredFragment)
    ) {
      cvText = recoveredFragment
    }
  }

  return cvText
}

export async function refineResumeWithAi(input: RefineResumeInput): Promise<RefineResumeResult> {
  const currentCv = input.currentCv?.trim() ?? ""
  const instruction = input.instruction?.trim() ?? ""
  const outputLanguage = input.outputLanguage === "de" ? "de" : "en"
  const providerStatus = getAiProviderStatus()
  const modelInfo = {
    model: providerStatus.model,
    provider: providerStatus.backend,
    explainability: buildExplainabilityFromChangeWhy(undefined, instruction, input.jobDescription),
  }

  if (!currentCv) {
    return { success: false, error: "No resume content to edit." }
  }
  if (!instruction) {
    return { success: false, error: "Please enter what you want to change." }
  }

  const folderId = input.folderId?.trim() ?? ""

  if (input.selectionOnly && input.selection?.text?.trim()) {
    const selPrompt = REFINE_SELECTION_ONLY_PROMPT(
      currentCv,
      input.jobDescription ?? "",
      instruction,
      input.selection,
      outputLanguage,
    )
    const selGen = await runTextGenerationWithRetry({
      prompt: selPrompt,
      maxOutputTokens: isTranslateInstruction(instruction) ? 6000 : 2000,
      temperature: 0.35,
      timeoutMs: 60_000,
      maxAttempts: 2,
      logTag: "refine-selection",
    })
    if (!selGen.ok) {
      return { success: false, error: selGen.error.message }
    }
    const replacement = extractSelectionReplacement(selGen.text)
    if (!replacement) {
      return {
        success: false,
        error: "Could not parse rewritten text. Try again or rephrase your request.",
      }
    }
    const merged = replaceSelectionInResume(currentCv, input.selection.text, replacement)
    if (!merged) {
      return {
        success: false,
        error: "Could not locate the selected text in your CV. Try selecting again.",
      }
    }
    const factual = validateAndSanitizeRefinedCv({
      baselineCv: currentCv,
      jobDescription: input.jobDescription ?? "",
      refinedCv: merged,
      options: {
        selectionText: input.selection.text,
        logTag: "refine-selection",
        skipEmployerRemoval: input.confirmBypassValidation,
      },
    })
    const cvText = input.confirmBypassValidation ? merged : factual.sanitizedCv
    const validationWarnings = factual.strippedEmployers?.map(
      (employer) => `Removed employer not found in your CV: ${employer}`,
    )

    if (
      !input.confirmBypassValidation &&
      factual.unknownEmployers.length > 0 &&
      !isUsableCvMarkdown(cvText)
    ) {
      return {
        success: false,
        error: formatUnknownEmployerError(factual.unknownEmployers),
        previousCvText: currentCv,
        cvText: merged,
        validationWarnings,
        strippedEmployers: factual.strippedEmployers,
        requiresValidationOverride: true,
      }
    }

    const changes = computeCvDiff(currentCv, cvText)
    return {
      success: true,
      mode: "edit_cv",
      previousCvText: currentCv,
      cvText,
      selectionReplacement: replacement,
      changeSummary: `Rewrote selected text: ${fallbackChangeSummary(instruction)}`,
      changes,
      validationWarnings,
      strippedEmployers: factual.strippedEmployers,
      requiresValidationOverride: Boolean(
        !input.confirmBypassValidation && factual.unknownEmployers.length > 0,
      ),
      requiresConfirmation: true,
    }
  }

  const prompt = REFINE_CV_PROMPT(
    currentCv,
    input.jobDescription ?? "",
    instruction,
    outputLanguage,
    input.strategicProfile,
    input.conversationHistory,
    input.learningMemory,
    folderId || undefined,
    input.selection,
    buildRefineEditorHints(instruction, input.selection),
  )

  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 12000,
    temperature: 0.35,
    timeoutMs: 90_000,
    maxAttempts: 2,
    logTag: "refine-resume",
  })

  if (!gen.ok) {
    return { success: false, error: gen.error.message }
  }

  let rawResponse = gen.text
  let { cvText, changeSummary: parsedSummary, changeWhy, structured } =
    extractRefineAiResponse(rawResponse)
  cvText = resolveRefinedCvText(rawResponse, currentCv, instruction, cvText)

  if (
    input.selection?.text?.trim() &&
    isTranslateInstruction(instruction) &&
    !input.selectionOnly
  ) {
    const replacement = extractSelectionReplacement(rawResponse)
    if (replacement) {
      const merged = replaceSelectionInResume(currentCv, input.selection.text, replacement)
      if (merged) cvText = merged
    }
  }

  if (!isUsableCvMarkdown(cvText)) {
    const retryGen = await runTextGenerationWithRetry({
      prompt: `${prompt}${REFINE_FORMAT_RETRY_SUFFIX}`,
      maxOutputTokens: 12000,
      temperature: 0.25,
      timeoutMs: 90_000,
      maxAttempts: 1,
      logTag: `${LOG_TAG}-format-retry`,
    })

    if (retryGen.ok) {
      rawResponse = retryGen.text
      const retried = extractRefineAiResponse(rawResponse)
      cvText = resolveRefinedCvText(rawResponse, currentCv, instruction, retried.cvText)
      parsedSummary = retried.changeSummary ?? parsedSummary
      changeWhy = retried.changeWhy ?? changeWhy
      structured = retried.structured ?? structured
    }
  }

  if (!isUsableCvMarkdown(cvText)) {
    console.warn("[refine-resume] Invalid formatted output", {
      length: cvText.length,
      preview: cvText.slice(0, 120),
      instruction,
    })
    return {
      success: false,
      error: "The AI response did not contain valid resume formatting. Your original CV was not changed.",
    }
  }

  const factual = validateAndSanitizeRefinedCv({
    baselineCv: currentCv,
    jobDescription: input.jobDescription ?? "",
    refinedCv: cvText,
    options: {
      selectionText: input.selection?.text,
      logTag: "refine-resume",
      skipEmployerRemoval: input.confirmBypassValidation,
      relaxedBulletGrounding: isConsolidateExperienceInstruction(instruction),
    },
  })

  const validationWarnings = factual.strippedEmployers?.map(
    (employer) => `Removed employer not found in your CV: ${employer}`,
  )

  if (
    !input.confirmBypassValidation &&
    factual.unknownEmployers.length > 0 &&
    !isUsableCvMarkdown(factual.sanitizedCv)
  ) {
    return {
      success: false,
      error: formatUnknownEmployerError(factual.unknownEmployers),
      previousCvText: currentCv,
      cvText,
      validationWarnings,
      strippedEmployers: factual.strippedEmployers,
      requiresValidationOverride: true,
    }
  }

  let sanitizedCv = input.confirmBypassValidation ? cvText : factual.sanitizedCv
  sanitizedCv = ensureExperienceEntriesHaveBullets(sanitizedCv, currentCv)

  if (factual.removedCount > 8 && !input.confirmBypassValidation) {
    return {
      success: false,
      error:
        "Validation failed: too many experience bullets were flagged as unsupported. Your original version was not changed.",
    }
  }

  if (!isUsableCvMarkdown(sanitizedCv)) {
    return {
      success: false,
      error: "Validation failed after factual checks. Your original version was not changed.",
    }
  }

  const combinedRiskReasons = [
    ...(validationWarnings ?? []),
    ...(factual.unknownEmployers.length > 0 && input.confirmBypassValidation
      ? factual.unknownEmployers.map(
          (employer) => `Applied with unverified employer: ${employer}`,
        )
      : []),
  ]

  const risk = assessEditRisk(currentCv, sanitizedCv, instruction)

  if (risk.isRisky && !input.confirmRiskyEdit) {
    const aiChanges = (
      structured?.changes?.length ? structured.changes : computeCvDiff(currentCv, sanitizedCv)
    ).map((change) => ({ ...change, authorship: "ai_enhanced" as const }))
    const summary = parsedSummary || structured?.summary || fallbackChangeSummary(instruction)
    return {
      success: true,
      mode: "edit_cv",
      previousCvText: currentCv,
      cvText: sanitizedCv,
      changeSummary: summary,
      changes: aiChanges,
      requiresConfirmation: true,
      riskReasons: [...risk.reasons, ...combinedRiskReasons],
      validationWarnings,
      strippedEmployers: factual.strippedEmployers,
      requiresValidationOverride: Boolean(
        !input.confirmBypassValidation && factual.unknownEmployers.length > 0,
      ),
      ...modelInfo,
      explainability: buildExplainabilityFromChangeWhy(undefined, instruction, input.jobDescription),
    }
  }

  const rawChanges =
    structured?.changes?.length && structured.changes.length > 0
      ? structured.changes
      : computeCvDiff(currentCv, sanitizedCv)
  const changes = rawChanges.map((change) => ({
    ...change,
    authorship: "ai_enhanced" as const,
  }))

  const summary =
    parsedSummary ||
    structured?.summary ||
    fallbackChangeSummary(instruction)

  const summaryBullets = formatCvEditSummary(changes)
  const fullSummary = [summary, ...summaryBullets.map((b) => `- ${b}`)].join("\n")

  return {
    success: true,
    mode: "edit_cv",
    previousCvText: currentCv,
    cvText: sanitizedCv,
    changeSummary: changeWhy ? `${fullSummary}\n\nWhy: ${changeWhy}` : fullSummary,
    changeWhy,
    changes,
    requiresConfirmation: true,
    validationWarnings,
    strippedEmployers: factual.strippedEmployers,
    requiresValidationOverride: Boolean(
      !input.confirmBypassValidation && factual.unknownEmployers.length > 0,
    ),
    riskReasons: combinedRiskReasons.length > 0 ? combinedRiskReasons : undefined,
    ...modelInfo,
    explainability: buildExplainabilityFromChangeWhy(changeWhy, instruction, input.jobDescription),
  }
}
