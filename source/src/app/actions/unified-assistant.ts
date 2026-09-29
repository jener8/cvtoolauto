"use server"

import { refineCoverLetterWithAi } from "@/app/actions/refine-cover-letter"
import { refineResumeWithAi } from "@/app/actions/refine-resume"
import { chatStrategicAssistant } from "@/app/actions/strategic-assistant"
import { buildUnifiedAdvisoryPrompt } from "@/lib/unified-assistant-prompt"
import { classifyAssistantIntent, intentLabel } from "@/lib/unified-assistant/intent"
import {
  buildApplyCoverLetterRecommendationsInstruction,
  buildApplyRecommendationsInstruction,
  canOfferCoverLetterApply,
  canOfferCvApply,
  getWorkflowMode,
  isCoverLetterSelectionOnlyEdit,
  isSelectionOnlyEdit,
} from "@/lib/unified-assistant/modes"
import type { AssistantDocumentContext } from "@/lib/assistant-selection-context"
import { resolveAssistantSelectionForDocument } from "@/lib/assistant-selection-context"
import { getAiProviderStatus } from "@/lib/ai/provider"
import { runTextGenerationWithRetry } from "@/lib/ai/run-text-generation"
import { buildExplainabilityFromChangeWhy, providerDisplayName } from "@/lib/ai-transparency"
import { buildAiEditVersionName } from "@/lib/cv-edit-version-name"
import { formatProposedChangesMarkdown } from "@/lib/ai-edit-review"
import { formatCvEditSummary } from "@/lib/cv-diff"
import type { AssistantSelectionContext } from "@/lib/assistant-selection-context"
import type { CvEditChange } from "@/lib/cv-edit-types"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import type { StrategicProfile } from "@/lib/strategic-profile"

export type UnifiedAssistantInput = {
  message: string
  folderId: string
  resumeText: string
  coverLetterText?: string
  jobDescription: string
  outputLanguage?: "en" | "de"
  strategicProfile?: StrategicProfile | null
  learningMemory?: PersonalLearningMemory | null
  learningEnabled?: boolean
  selectedJobTitle?: string
  selectedCompany?: string
  currentVersionName?: string
  conversationHistory?: { role: "user" | "assistant"; content: string }[]
  selection?: AssistantSelectionContext | null
  confirmRiskyEdit?: boolean
  confirmBypassValidation?: boolean
  /** Active document the user is editing in the UI */
  documentContext?: AssistantDocumentContext
  /** When user clicks Apply on a prior advice message */
  applyFromAdvice?: string
}

export type UnifiedAssistantResult = {
  success: boolean
  mode?: "edit_cv" | "edit_cover_letter" | "career_advice" | "application_analysis" | "chat" | "advice_only"
  reply?: string
  intent?: string
  cvText?: string
  previousCvText?: string
  coverLetterText?: string
  previousCoverLetterText?: string
  changeSummary?: string
  changes?: CvEditChange[]
  versionName?: string
  selectionReplacement?: string
  selectionOnly?: boolean
  canApplyRecommendations?: boolean
  requiresConfirmation?: boolean
  riskReasons?: string[]
  validationWarnings?: string[]
  strippedEmployers?: string[]
  requiresValidationOverride?: boolean
  model?: string
  provider?: string
  providerLabel?: string
  explainability?: import("@/lib/ai-transparency").AiExplainability
  profilePatch?: Partial<StrategicProfile>
  error?: string
}

function buildCoverLetterEditReply(opts: {
  summary: string
  changes: CvEditChange[]
  applied: boolean
  selectionOnly?: boolean
  rationale?: string
}): string {
  if (opts.applied) {
    return `Done — your cover letter was updated.\n\n${opts.summary}`
  }

  const proposed = formatCvEditSummary(opts.changes)
  const intro =
    opts.selectionOnly
      ? "I've rewritten the selected text. Review the comparison below before applying."
      : "I've prepared a cover letter edit for your review. Nothing has been changed yet."

  return [intro, "", formatProposedChangesMarkdown(proposed)].join("\n")
}

function buildEditReply(opts: {
  versionName: string
  summary: string
  changes: CvEditChange[]
  applied: boolean
  pendingConfirmation?: boolean
  riskReasons?: string[]
  selectionOnly?: boolean
  validationWarnings?: string[]
}): string {
  if (opts.applied) {
    const bullets = formatCvEditSummary(opts.changes)
    return [
      "Done — I updated your resume.",
      "",
      formatProposedChangesMarkdown(bullets),
      opts.summary ? `\n${opts.summary}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  }

  const lines: string[] = []
  lines.push(
    opts.selectionOnly
      ? "I've rewritten the selected text. Review the comparison below before applying."
      : "I've prepared a resume edit for your review. Nothing has been changed yet.",
  )

  if (opts.pendingConfirmation && opts.riskReasons?.length) {
    lines.push("", "**Please review these risks before applying:**")
    for (const r of opts.riskReasons) lines.push(`- ${r}`)
  }

  if (opts.validationWarnings?.length) {
    lines.push("", "**Validation notes:**")
    for (const warning of opts.validationWarnings) lines.push(`- ${warning}`)
  }

  lines.push("", formatProposedChangesMarkdown(formatCvEditSummary(opts.changes)))
  return lines.join("\n")
}

function appendAdviceApplyOffer(
  reply: string,
  mode: string,
  documentContext: AssistantDocumentContext,
): string {
  if (mode !== "career_advice" && mode !== "application_analysis") return reply
  if (documentContext === "cover_letter") {
    return `${reply.trim()}\n\n---\n\n**Would you like me to update your cover letter?** Use the buttons below to apply, preview, or explain these changes.`
  }
  return `${reply.trim()}\n\n---\n\n**Would you like me to update your CV?** Use the buttons below to apply, preview, or explain these changes.`
}

export async function chatUnifiedAssistant(
  input: UnifiedAssistantInput,
): Promise<UnifiedAssistantResult> {
  const message = input.applyFromAdvice?.trim() || input.message?.trim() || ""
  const folderId = input.folderId?.trim() ?? ""
  const resumeText = input.resumeText?.trim() ?? ""
  const coverLetterText = input.coverLetterText?.trim() ?? ""
  const outputLanguage = input.outputLanguage === "de" ? "de" : "en"
  const strategicProfile = input.strategicProfile ?? {}
  const learningMemory =
    input.learningEnabled !== false && input.learningMemory?.folderId === folderId
      ? input.learningMemory
      : null
  const selection = resolveAssistantSelectionForDocument(
    input.selection?.text?.trim() ? input.selection : null,
    input.documentContext === "cover_letter" ? "cover_letter" : "resume",
    coverLetterText,
  )

  if (!message) return { success: false, error: "Please enter a message." }
  if (!folderId) return { success: false, error: "No workspace selected." }

  const documentContext: AssistantDocumentContext =
    input.documentContext === "cover_letter" ? "cover_letter" : "resume"

  const effectiveMessage = input.applyFromAdvice
    ? documentContext === "cover_letter"
      ? buildApplyCoverLetterRecommendationsInstruction(input.applyFromAdvice)
      : buildApplyRecommendationsInstruction(input.applyFromAdvice, outputLanguage)
    : message

  const intent = input.applyFromAdvice
    ? documentContext === "cover_letter"
      ? "cover_letter_edit"
      : "resume_edit"
    : classifyAssistantIntent(message, selection, documentContext)
  const intentName = intentLabel(intent)
  const workflowMode = getWorkflowMode(intent, message, selection, Boolean(resumeText))

  if (intent === "cover_letter_edit") {
    if (!coverLetterText) {
      return {
        success: false,
        error: "Open a cover letter with content to apply edits.",
        intent: intentName,
      }
    }

    const selectionOnly = isCoverLetterSelectionOnlyEdit(message, selection)

    const result = await refineCoverLetterWithAi({
      currentLetter: coverLetterText,
      jobDescription: input.jobDescription ?? "",
      resumeExcerpt: resumeText.slice(0, 2500),
      instruction: effectiveMessage,
      outputLanguage,
      selection: selection ? { text: selection.text } : null,
      selectionOnly,
    })

    if (!result.success) {
      return { success: false, error: result.error, intent: intentName }
    }

    const changes = result.changes ?? []
    const summaryLine = result.changeSummary ?? "Updated your cover letter."
    const providerStatus = getAiProviderStatus()

    return {
      success: true,
      mode: "edit_cover_letter",
      intent: intentName,
      coverLetterText: result.letterText,
      previousCoverLetterText: result.previousLetterText,
      changeSummary: result.changeSummary,
      changes,
      selectionReplacement: result.selectionReplacement,
      selectionOnly: result.selectionOnly,
      requiresConfirmation: true,
      model: result.model ?? providerStatus.model,
      provider: result.provider ?? providerStatus.backend,
      providerLabel: providerDisplayName(result.provider ?? providerStatus.backend),
      explainability: buildExplainabilityFromChangeWhy(
        result.changeWhy,
        effectiveMessage,
        input.jobDescription,
      ),
      reply: buildCoverLetterEditReply({
        summary: summaryLine,
        changes,
        applied: false,
        selectionOnly: result.selectionOnly,
        rationale: result.changeWhy,
      }),
    }
  }

  if (intent === "resume_edit" && documentContext === "cover_letter") {
    return {
      success: false,
      error: "Switch to the resume editor to apply CV edits, or ask me to update your cover letter.",
      intent: intentName,
    }
  }

  if (intent === "resume_edit") {
    if (!resumeText) {
      return {
        success: false,
        error: "Open a resume with content to apply edits.",
        intent: intentName,
      }
    }

    const selectionOnly =
      !input.applyFromAdvice && isSelectionOnlyEdit(message, selection)

    const versionName = buildAiEditVersionName({
      instruction: effectiveMessage,
      applicationTitle: input.selectedJobTitle,
      currentVersionName: input.currentVersionName,
    })

    const result = await refineResumeWithAi({
      currentCv: resumeText,
      jobDescription: input.jobDescription ?? "",
      instruction: effectiveMessage,
      outputLanguage,
      strategicProfile,
      conversationHistory: input.conversationHistory,
      folderId,
      learningMemory,
      selection: selection ? { source: selection.source, text: selection.text } : null,
      selectionOnly,
      confirmRiskyEdit: input.confirmRiskyEdit,
      confirmBypassValidation: input.confirmBypassValidation,
      selectedJobTitle: input.selectedJobTitle,
      currentVersionName: input.currentVersionName,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        intent: intentName,
        cvText: result.cvText,
        previousCvText: result.previousCvText,
        requiresValidationOverride: result.requiresValidationOverride,
        validationWarnings: result.validationWarnings,
        strippedEmployers: result.strippedEmployers,
      }
    }

    const changes = result.changes ?? []
    const summaryLine = result.changeSummary?.split("\n")[0] ?? "Updated your CV."
    const providerStatus = getAiProviderStatus()
    const requiresConfirmation = true

    return {
      success: true,
      mode: "edit_cv",
      intent: intentName,
      cvText: result.cvText,
      previousCvText: result.previousCvText,
      changeSummary: result.changeSummary,
      changes,
      versionName,
      selectionReplacement: result.selectionReplacement,
      selectionOnly,
      requiresConfirmation,
      riskReasons: result.riskReasons,
      validationWarnings: result.validationWarnings,
      strippedEmployers: result.strippedEmployers,
      requiresValidationOverride: result.requiresValidationOverride,
      model: result.model ?? providerStatus.model,
      provider: result.provider ?? providerStatus.backend,
      providerLabel: providerDisplayName(result.provider ?? providerStatus.backend),
      explainability:
        result.explainability ??
        buildExplainabilityFromChangeWhy(
          result.changeWhy,
          effectiveMessage,
          input.jobDescription,
        ),
      reply: buildEditReply({
        versionName,
        summary: summaryLine,
        changes,
        applied: false,
        pendingConfirmation: true,
        riskReasons: result.riskReasons,
        validationWarnings: result.validationWarnings,
        selectionOnly,
      }),
    }
  }

  if (intent === "strategy") {
    const result = await chatStrategicAssistant({
      message,
      strategicProfile,
      jobDescription: input.jobDescription ?? "",
      resumeExcerpt: resumeText.slice(0, 2500),
      conversationHistory: input.conversationHistory,
    })
    if (!result.success) {
      return { success: false, error: result.error, intent: intentName }
    }
    return {
      success: true,
      mode: "chat",
      intent: intentName,
      reply: result.reply,
      profilePatch: result.profilePatch,
    }
  }

  const prompt = buildUnifiedAdvisoryPrompt({
    intent,
    message,
    resumeExcerpt: resumeText,
    coverLetterExcerpt: coverLetterText,
    documentContext,
    jobDescription: input.jobDescription ?? "",
    strategicProfile,
    learningMemory,
    folderId,
    selectedJobTitle: input.selectedJobTitle,
    selectedCompany: input.selectedCompany,
    conversation: input.conversationHistory,
    outputLanguage,
    selection,
  })

  const gen = await runTextGenerationWithRetry({
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.45,
    timeoutMs: 90_000,
    maxAttempts: 2,
    logTag: "unified-assistant",
  })

  if (!gen.ok) {
    return { success: false, error: gen.error.message, intent: intentName }
  }

  const replyText = gen.text.trim()
  const offerApply =
    documentContext === "cover_letter"
      ? canOfferCoverLetterApply(workflowMode, Boolean(coverLetterText))
      : canOfferCvApply(workflowMode, Boolean(resumeText))
  const responseMode =
    workflowMode === "application_analysis"
      ? "application_analysis"
      : workflowMode === "career_advice"
        ? "career_advice"
        : "chat"

  return {
    success: true,
    mode: responseMode,
    intent: intentName,
    reply: offerApply ? appendAdviceApplyOffer(replyText, responseMode, documentContext) : replyText,
    canApplyRecommendations: offerApply,
  }
}
