"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { chatUnifiedAssistant } from "@/app/actions/unified-assistant"
import { AiCareerChatMessage } from "@/components/ai-career-chat-message"
import { buildProposedChangesList } from "@/lib/ai-edit-review"
import {
  AssistantChatBody,
  AssistantDesktopPanel,
  AssistantMobileDrawer,
  AssistantPanelHeader,
  newChatMessageId,
  RestorePreviousButton,
} from "@/components/assistant/chat-ui"
import { LearningInsightsDashboard } from "@/components/learning-insights-dashboard"
import { PersonalLearningPanel } from "@/components/personal-learning-panel"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { AssistantChatMessage } from "@/lib/assistant-chat-storage"
import { revealAssistantMessageContent } from "@/lib/assistant-stream-reveal"
import {
  ASSISTANT_SELECTION_CHANGED_EVENT,
  clearAssistantSelection,
  loadAssistantSelection,
  resolveAssistantSelectionForDocument,
  saveAssistantSelection,
  selectionSourceLabel,
  type AssistantDocumentContext,
  type AssistantSelectionContext,
} from "@/lib/assistant-selection-context"
import { analyzeWorkspaceForLearning } from "@/lib/personal-learning/analyze-workspace"
import {
  loadLearningMemory,
  loadLearningSettings,
  saveLearningMemory,
} from "@/lib/personal-learning/storage"
import type { PersonalLearningMemory } from "@/lib/personal-learning/types"
import {
  loadUnifiedAssistantConversation,
  saveUnifiedAssistantConversation,
} from "@/lib/unified-assistant-storage"
import type { AiResumeEditPayload, AiResumeEditResult } from "@/lib/cv-edit-types"
import { uniqueAiEditVersionName } from "@/lib/cv-edit-version-name"
import {
  buildExplainCoverLetterRecommendationsInstruction,
  buildExplainRecommendationsInstruction,
} from "@/lib/unified-assistant/modes"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { patchStrategicProfile } from "@/lib/strategic-profile"
import { AiAssistantFab } from "@/components/ai-assistant-fab"
import { Settings2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const GENERAL_PROMPTS = [
  "What are my strongest differentiators?",
  "Help me with a cover letter opening",
  "Prep me for likely interview questions",
  "Analyze this application fit",
] as const

const RESUME_EDIT_PROMPTS = [
  "Rewrite selected text",
  "Make shorter",
  "Make more senior",
  "Make more strategic",
  "Tailor to job description",
  "Add ATS keywords",
  "Improve leadership focus",
  "Improve AI focus",
] as const

const COVER_LETTER_EDIT_PROMPTS = [
  "Make this cover letter shorter",
  "Rewrite selected text",
  "Tailor to the job description",
  "Make the opening stronger",
] as const

const TAILOR_WITH_SELECTION_PROMPT = "Tailor resume more to this"

export type CoverLetterApplyPayload = {
  previousLetterText: string
  newLetterText: string
  language: "en" | "de"
  insertAsVersion?: boolean
  summary?: string
  model?: string
  provider?: string
  providerLabel?: string
  assistantMessageId?: string
  explainability?: import("@/lib/ai-transparency").AiExplainability
}

export interface UnifiedAiAssistantProps {
  folderId: string
  resumeSessionId: string
  resumeText: string
  coverLetterText?: string
  coverLetterLanguage?: "en" | "de"
  jobDescription: string
  outputLanguage?: "en" | "de"
  strategicProfile: StrategicProfile
  onStrategicProfileChange: (profile: StrategicProfile) => void
  onResumeApply?: (updatedResumeText: string) => void
  onResumeEdit?: (payload: AiResumeEditPayload) => Promise<AiResumeEditResult>
  onCoverLetterApply?: (payload: CoverLetterApplyPayload) => Promise<boolean>
  onUndoResumeEdit?: (previousVersionId: string | null, previousResumeText: string) => void
  canRestoreResume?: boolean
  onRestoreResume?: () => void
  currentVersionName?: string
  currentVersionId?: string | null
  versions?: ResumeVersion[]
  jobApplications?: JobApplication[]
  selectedJobTitle?: string
  selectedCompany?: string
  requireResume?: boolean
  requireCoverLetter?: boolean
  accentColorHex?: string | null
  onLogAiActivity?: (
    event: Omit<import("@/lib/ai-activity-log").AiActivityEntry, "id">,
  ) => void
  /** Extra classes for the floating open button (e.g. avoid overlapping primary FABs). */
  fabClassName?: string
  fabLabel?: string
  fabTooltip?: string
  /** Allow FAB when resume/cover letter text is still empty (mobile create flow). */
  showWhenEmpty?: boolean
}

export function UnifiedAiAssistant({
  folderId,
  resumeSessionId,
  resumeText,
  coverLetterText = "",
  coverLetterLanguage = "en",
  jobDescription,
  outputLanguage = "en",
  strategicProfile,
  onStrategicProfileChange,
  onResumeApply,
  onResumeEdit,
  onCoverLetterApply,
  onUndoResumeEdit,
  canRestoreResume = false,
  onRestoreResume,
  currentVersionName,
  currentVersionId,
  versions = [],
  jobApplications = [],
  selectedJobTitle,
  selectedCompany,
  requireResume = true,
  requireCoverLetter = false,
  accentColorHex,
  onLogAiActivity,
  fabClassName,
  fabLabel,
  fabTooltip,
  showWhenEmpty = false,
}: UnifiedAiAssistantProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [showLearningSettings, setShowLearningSettings] = useState(false)
  const [showInsightsDashboard, setShowInsightsDashboard] = useState(false)

  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [lastReadAt, setLastReadAt] = useState(() => Date.now())
  const [selection, setSelection] = useState<AssistantSelectionContext | null>(null)

  const [learningEnabled, setLearningEnabled] = useState(true)
  const [learningMemory, setLearningMemory] = useState<PersonalLearningMemory | null>(null)

  const resumeTextRef = useRef(resumeText)
  const coverLetterTextRef = useRef(coverLetterText)
  const strategicProfileRef = useRef(strategicProfile)
  const learningMemoryRef = useRef(learningMemory)
  const versionsRef = useRef(versions)
  const jobApplicationsRef = useRef(jobApplications)
  const streamRevealCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      streamRevealCleanupRef.current?.()
    }
  }, [])

  const documentContext: AssistantDocumentContext = requireCoverLetter
    ? "cover_letter"
    : "resume"

  const getActiveSelection = useCallback((): AssistantSelectionContext | null => {
    return resolveAssistantSelectionForDocument(
      loadAssistantSelection(),
      documentContext,
      coverLetterTextRef.current,
    )
  }, [documentContext])

  useEffect(() => {
    resumeTextRef.current = resumeText
  }, [resumeText])
  useEffect(() => {
    coverLetterTextRef.current = coverLetterText
  }, [coverLetterText])
  useEffect(() => {
    strategicProfileRef.current = strategicProfile
  }, [strategicProfile])
  useEffect(() => {
    versionsRef.current = versions
  }, [versions])
  useEffect(() => {
    jobApplicationsRef.current = jobApplications
  }, [jobApplications])
  useEffect(() => {
    learningMemoryRef.current = learningMemory
  }, [learningMemory])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const refresh = () => setSelection(getActiveSelection())
    refresh()
    window.addEventListener(ASSISTANT_SELECTION_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(ASSISTANT_SELECTION_CHANGED_EVENT, refresh)
  }, [getActiveSelection])

  useEffect(() => {
    if (documentContext !== "cover_letter") return
    const current = loadAssistantSelection()
    if (!current) return
    const resolved = resolveAssistantSelectionForDocument(
      current,
      "cover_letter",
      coverLetterTextRef.current,
    )
    if (!resolved) {
      clearAssistantSelection()
    } else if (resolved.source !== current.source) {
      saveAssistantSelection(resolved)
    }
    setSelection(getActiveSelection())
  }, [documentContext, coverLetterText, getActiveSelection])

  const refreshLearning = useCallback(() => {
    if (!folderId) return
    const settings = loadLearningSettings(folderId)
    setLearningEnabled(settings.enabled)
    if (settings.enabled) {
      const analyzed = analyzeWorkspaceForLearning({
        folderId,
        versions: versionsRef.current,
        jobs: jobApplicationsRef.current,
        excludedApplicationIds: settings.excludedApplicationIds,
      })
      const existing = loadLearningMemory(folderId)
      const prevById = new Map(existing.insights.map((i) => [i.id, i]))
      const mergedInsights = analyzed.insights.map((a) => {
        const prev = prevById.get(a.id)
        if (!prev) return a
        return {
          ...a,
          dismissed: prev.dismissed,
          userCorrection: prev.userCorrection,
        }
      })
      const conversationOnly = existing.insights.filter(
        (e) =>
          e.source === "conversation" &&
          !mergedInsights.some((a) => a.id === e.id),
      )
      const merged: PersonalLearningMemory = {
        ...analyzed,
        insights: [...conversationOnly, ...mergedInsights].slice(0, 30),
      }
      saveLearningMemory(merged)
      setLearningMemory(merged)
      learningMemoryRef.current = merged
    } else {
      setLearningMemory(loadLearningMemory(folderId))
    }
  }, [folderId])

  useEffect(() => {
    if (!folderId || !resumeSessionId) return
    setMessages(loadUnifiedAssistantConversation(folderId, resumeSessionId))
    setLastReadAt(Date.now())
    refreshLearning()
  }, [folderId, resumeSessionId, refreshLearning])

  useEffect(() => {
    if (open) setLastReadAt(Date.now())
  }, [open])

  useEffect(() => {
    if (!folderId || !resumeSessionId || messages.length === 0) return
    saveUnifiedAssistantConversation(folderId, resumeSessionId, messages)
  }, [folderId, resumeSessionId, messages])

  useEffect(() => {
    if (open) refreshLearning()
  }, [open, refreshLearning])

  const conversationForApi = useCallback(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.role === "assistant" ? (m.changeSummary ?? m.content) : m.content,
      })),
    [messages],
  )

  const suggestions = useMemo(() => {
    if (selection?.source === "cover_letter") {
      return [...COVER_LETTER_EDIT_PROMPTS]
    }
    if (selection?.text) {
      return [TAILOR_WITH_SELECTION_PROMPT, ...RESUME_EDIT_PROMPTS.slice(0, 4)]
    }
    if (requireCoverLetter && coverLetterText.trim()) {
      return [...COVER_LETTER_EDIT_PROMPTS, ...GENERAL_PROMPTS.slice(0, 1)]
    }
    if (requireResume && resumeText.trim()) {
      return [...RESUME_EDIT_PROMPTS.slice(0, 4), ...GENERAL_PROMPTS.slice(0, 2)]
    }
    return [...GENERAL_PROMPTS]
  }, [selection, requireResume, requireCoverLetter, resumeText, coverLetterText])

  const applyCvEdit = useCallback(
    async (
      result: Awaited<ReturnType<typeof chatUnifiedAssistant>>,
      instruction: string,
      assistantMessageId?: string,
    ) => {
      if (!result.cvText || !onResumeEdit) return null

      const versionName = uniqueAiEditVersionName(
        result.versionName ?? "Resume — AI-edited version",
        versions,
      )

      const editResult = await onResumeEdit({
        previousResumeText: result.previousCvText ?? resumeTextRef.current,
        newResumeText: result.cvText,
        summary: result.changeSummary?.split("\n")[0] ?? "Updated your CV.",
        changes: result.changes ?? [],
        versionName,
        instruction,
        previousVersionId: currentVersionId ?? null,
        model: result.model,
        provider: result.provider,
        providerLabel: result.providerLabel,
        feature: result.selectionOnly ? "Selection rewrite" : "CV edit",
        explainability: result.explainability,
        approvalStatus: "approved",
        assistantMessageId,
      })

      if (editResult.success) {
        resumeTextRef.current = result.cvText
      }
      return editResult
    },
    [onResumeEdit, versions, currentVersionId],
  )

  const buildCoverLetterEditFromResult = useCallback(
    (
      result: Awaited<ReturnType<typeof chatUnifiedAssistant>>,
      applied = false,
    ) => {
      if (!result.coverLetterText) return undefined
      const changes = result.changes ?? []
      return {
        mode: "edit_cover_letter" as const,
        summary: result.changeSummary?.split("\n")[0] ?? "Updated your cover letter.",
        proposedChanges: buildProposedChangesList({
          changes,
          summary: result.changeSummary,
          explainability: result.explainability,
        }),
        changes,
        previousLetterText: result.previousCoverLetterText ?? coverLetterTextRef.current,
        newLetterText: result.coverLetterText,
        applied,
        selectionOnly: result.selectionOnly,
        pendingConfirmation: !applied,
        selectionReplacement: result.selectionReplacement,
        model: result.model,
        provider: result.provider,
        providerLabel: result.providerLabel,
        explainability: result.explainability,
      }
    },
    [],
  )

  const applyCoverLetterEditFromResult = useCallback(
    async (
      messageId: string,
      result: Awaited<ReturnType<typeof chatUnifiedAssistant>>,
      instruction: string,
    ) => {
      if (!result.coverLetterText || !onCoverLetterApply) return false

      const ok = await onCoverLetterApply({
        previousLetterText: result.previousCoverLetterText ?? coverLetterTextRef.current,
        newLetterText: result.coverLetterText,
        language: coverLetterLanguage,
        summary: result.changeSummary?.split("\n")[0] ?? "Updated your cover letter.",
        model: result.model,
        provider: result.provider,
        providerLabel: result.providerLabel,
        assistantMessageId: messageId,
        explainability: result.explainability,
      })

      if (!ok) return false

      coverLetterTextRef.current = result.coverLetterText
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                mode: "edit_cover_letter" as const,
                content: `Done — your cover letter was updated.\n\n${result.changeSummary?.split("\n")[0] ?? ""}`,
                selectionOnly: false,
                canApplyRecommendations: false,
                coverLetterEdit: buildCoverLetterEditFromResult(result, true),
              }
            : m,
        ),
      )
      return true
    },
    [buildCoverLetterEditFromResult, coverLetterLanguage, onCoverLetterApply],
  )

  const sendMessage = useCallback(
    async (text: string, options?: { confirmRiskyEdit?: boolean; confirmBypassValidation?: boolean }) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      if (!folderId) {
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
      if (requireResume && !resumeTextRef.current.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: newChatMessageId(),
            role: "assistant",
            content: "Open a resume first so I can tailor it to the job description.",
            timestamp: Date.now(),
            status: "error",
          },
        ])
        return
      }
      if (requireCoverLetter && !coverLetterTextRef.current.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: newChatMessageId(),
            role: "assistant",
            content: "Open a cover letter first so I can edit it.",
            timestamp: Date.now(),
            status: "error",
          },
        ])
        return
      }

      const activeSelection = getActiveSelection()

      setMessages((prev) => [
        ...prev,
        {
          id: newChatMessageId(),
          role: "user",
          content: trimmed,
          timestamp: Date.now(),
          selectionContext: activeSelection?.text,
        },
      ])
      setInput("")
      setLoading(true)

      try {
      const result = await chatUnifiedAssistant({
        message: trimmed,
        folderId,
        resumeText: resumeTextRef.current,
        coverLetterText: coverLetterTextRef.current,
        jobDescription,
        outputLanguage,
        strategicProfile: strategicProfileRef.current,
        learningMemory: learningMemoryRef.current,
        learningEnabled,
        selectedJobTitle,
        selectedCompany,
        currentVersionName,
        conversationHistory: [...conversationForApi(), { role: "user", content: trimmed }],
        selection: activeSelection,
        documentContext,
        confirmRiskyEdit: options?.confirmRiskyEdit,
        confirmBypassValidation: options?.confirmBypassValidation,
      })

      if (!result.success) {
        const validationOverrideEdit =
          result.requiresValidationOverride && result.cvText
            ? {
                mode: "edit_cv" as const,
                summary: result.error ?? "Validation blocked this edit.",
                proposedChanges: result.validationWarnings ?? [],
                changes: result.changes ?? [],
                previousResumeText: result.previousCvText ?? resumeTextRef.current,
                newResumeText: result.cvText,
                versionName: result.versionName ?? "AI-edited version",
                applied: false,
                pendingConfirmation: true,
                requiresValidationOverride: true,
                validationWarnings: result.validationWarnings,
                strippedEmployers: result.strippedEmployers,
                riskReasons: result.validationWarnings,
              }
            : undefined

        setMessages((prev) => [
          ...prev,
          {
            id: newChatMessageId(),
            role: "assistant",
            content: result.error ?? "Something went wrong.",
            timestamp: Date.now(),
            status: validationOverrideEdit ? "success" : "error",
            cvEdit: validationOverrideEdit,
          },
        ])
        return
      }

      let reply = result.reply ?? ""

      if (result.profilePatch && Object.keys(result.profilePatch).length > 0) {
        const merged = patchStrategicProfile(result.profilePatch)
        onStrategicProfileChange(merged)
        strategicProfileRef.current = merged
        reply += "\n\n✓ Strategic Profile updated."
      }

      const assistantId = newChatMessageId()
      let cvEdit = undefined
      let coverLetterEdit = undefined

      if (result.mode === "edit_cover_letter" && result.coverLetterText) {
        const changes = result.changes ?? []
        coverLetterEdit = {
          mode: "edit_cover_letter" as const,
          summary: result.changeSummary?.split("\n")[0] ?? "Updated your cover letter.",
          proposedChanges: buildProposedChangesList({
            changes,
            summary: result.changeSummary,
            explainability: result.explainability,
          }),
          changes,
          previousLetterText: result.previousCoverLetterText ?? coverLetterTextRef.current,
          newLetterText: result.coverLetterText,
          applied: false,
          selectionOnly: result.selectionOnly,
          pendingConfirmation: true,
          selectionReplacement: result.selectionReplacement,
          model: result.model,
          provider: result.provider,
          providerLabel: result.providerLabel,
          explainability: result.explainability,
        }
      }

      if (result.mode === "edit_cv" && result.cvText) {
        const changes = result.changes ?? []
        cvEdit = {
          mode: "edit_cv" as const,
          summary: result.changeSummary?.split("\n")[0] ?? "Updated your CV.",
          proposedChanges: buildProposedChangesList({
            changes,
            summary: result.changeSummary,
            explainability: result.explainability,
          }),
          changes,
          previousResumeText: result.previousCvText ?? resumeTextRef.current,
          newResumeText: result.cvText,
          versionName: result.versionName ?? "AI-edited version",
          applied: false,
          selectionOnly: result.selectionOnly,
          selectionReplacement: result.selectionReplacement,
          pendingConfirmation: true,
          riskReasons: result.riskReasons,
          requiresValidationOverride: result.requiresValidationOverride,
          validationWarnings: result.validationWarnings,
          strippedEmployers: result.strippedEmployers,
          model: result.model,
          provider: result.provider,
          providerLabel: result.providerLabel,
          explainability: result.explainability,
        }
      }

      const assistantMessage: AssistantChatMessage = {
        id: assistantId,
        role: "assistant",
        content:
          cvEdit || coverLetterEdit
            ? reply || "Here's what I suggest."
            : reply.trim()
              ? ""
              : "I couldn't generate a reply. Please try again with a shorter request.",
        changeSummary: result.changeSummary,
        timestamp: Date.now(),
        status: cvEdit || coverLetterEdit ? "success" : reply.trim() ? "streaming" : "error",
        intent: result.intent,
        mode: result.mode,
        canApplyRecommendations: result.canApplyRecommendations,
        selectionReplacement: result.selectionReplacement,
        selectionOnly: result.selectionOnly,
        cvEdit,
        coverLetterEdit,
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (!cvEdit && !coverLetterEdit && reply.trim()) {
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
              error instanceof Error
                ? error.message
                : "Chat request failed. Please try again.",
            timestamp: Date.now(),
            status: "error",
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [
      loading,
      folderId,
      jobDescription,
      outputLanguage,
      learningEnabled,
      selectedJobTitle,
      selectedCompany,
      currentVersionName,
      currentVersionId,
      requireResume,
      requireCoverLetter,
      documentContext,
      getActiveSelection,
      onStrategicProfileChange,
      onResumeEdit,
      applyCvEdit,
      conversationForApi,
    ],
  )

  const stripAdviceFooter = (content: string) =>
    content.replace(/\n*---\n*\n*\*\*Would you like me to update your CV\?\*\*[\s\S]*$/i, "").trim()

  const applyEditFromResult = useCallback(
    async (
      messageId: string,
      result: Awaited<ReturnType<typeof chatUnifiedAssistant>>,
      instruction: string,
    ) => {
      if (!result.cvText) return false
      const appliedResult = await applyCvEdit(result, instruction, messageId)
      if (!appliedResult?.success) return false

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                mode: "edit_cv" as const,
                content: `Done — I updated your CV.\n\n**Changes made:**\n${(result.changes ?? [])
                  .slice(0, 5)
                  .map((c) => `- ${c.description ?? c.section}`)
                  .join("\n") || "- See diff for details"}`,
                selectionOnly: false,
                canApplyRecommendations: false,
                cvEdit: {
                  mode: "edit_cv",
                  summary: result.changeSummary?.split("\n")[0] ?? "",
                  proposedChanges: buildProposedChangesList({
                    changes: result.changes ?? [],
                    summary: result.changeSummary,
                    explainability: result.explainability,
                  }),
                  changes: result.changes ?? [],
                  previousResumeText: result.previousCvText ?? resumeTextRef.current,
                  newResumeText: result.cvText!,
                  versionName: appliedResult.newVersionName ?? result.versionName ?? "",
                  applied: true,
                  pendingConfirmation: false,
                  appliedAt: Date.now(),
                  previousVersionId: appliedResult.previousVersionId,
                  newVersionId: appliedResult.newVersionId,
                  newVersionName: appliedResult.newVersionName,
                  model: result.model,
                  provider: result.provider,
                  providerLabel: result.providerLabel,
                  explainability: result.explainability,
                },
              }
            : m,
        ),
      )
      return true
    },
    [applyCvEdit],
  )

  const handleApplyRecommendations = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target) return
      setLoading(true)
      const result = await chatUnifiedAssistant({
        message: "",
        applyFromAdvice: stripAdviceFooter(target.content),
        folderId,
        resumeText: resumeTextRef.current,
        coverLetterText: coverLetterTextRef.current,
        jobDescription,
        outputLanguage,
        strategicProfile: strategicProfileRef.current,
        learningMemory: learningMemoryRef.current,
        learningEnabled,
        selectedJobTitle,
        selectedCompany,
        currentVersionName,
        conversationHistory: conversationForApi(),
        selection: getActiveSelection(),
        documentContext,
      })
      setLoading(false)
      if (!result.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: `${m.content}\n\n⚠ ${result.error ?? "Could not apply."}`, status: "error" }
              : m,
          ),
        )
        return
      }

      if (documentContext === "cover_letter" && result.coverLetterText) {
        const ok = await applyCoverLetterEditFromResult(
          messageId,
          result,
          "Apply recommendations from advice",
        )
        if (!ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: `${m.content}\n\n⚠ Could not save cover letter changes.` }
                : m,
            ),
          )
        }
        return
      }

      if (!result.cvText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: `${m.content}\n\n⚠ ${result.error ?? "Could not apply."}`, status: "error" }
              : m,
          ),
        )
        return
      }
      const ok = await applyEditFromResult(messageId, result, "Apply recommendations from advice")
      if (!ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: `${m.content}\n\n⚠ Could not save CV changes.` }
              : m,
          ),
        )
      }
    },
    [
      messages,
      folderId,
      jobDescription,
      outputLanguage,
      learningEnabled,
      selectedJobTitle,
      selectedCompany,
      currentVersionName,
      applyEditFromResult,
      applyCoverLetterEditFromResult,
      conversationForApi,
      documentContext,
      getActiveSelection,
    ],
  )

  const handlePreviewRecommendations = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target) return
      setLoading(true)
      const result = await chatUnifiedAssistant({
        message: "",
        applyFromAdvice: stripAdviceFooter(target.content),
        folderId,
        resumeText: resumeTextRef.current,
        coverLetterText: coverLetterTextRef.current,
        jobDescription,
        outputLanguage,
        strategicProfile: strategicProfileRef.current,
        learningMemory: learningMemoryRef.current,
        learningEnabled,
        selectedJobTitle,
        selectedCompany,
        currentVersionName,
        conversationHistory: conversationForApi(),
        selection: getActiveSelection(),
        documentContext,
      })
      setLoading(false)
      if (!result.success) return

      if (documentContext === "cover_letter" && result.coverLetterText) {
        const coverLetterEdit = buildCoverLetterEditFromResult(result, false)
        if (!coverLetterEdit) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  mode: "edit_cover_letter" as const,
                  coverLetterEdit,
                }
              : m,
          ),
        )
        return
      }

      if (!result.cvText) return

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                cvEdit: {
                  mode: "edit_cv",
                  summary: result.changeSummary?.split("\n")[0] ?? "Preview",
                  proposedChanges: buildProposedChangesList({
                    changes: result.changes ?? [],
                    summary: result.changeSummary,
                    explainability: result.explainability,
                  }),
                  changes: result.changes ?? [],
                  previousResumeText: result.previousCvText ?? resumeTextRef.current,
                  newResumeText: result.cvText!,
                  versionName: result.versionName ?? "Preview",
                  applied: false,
                  pendingConfirmation: true,
                  model: result.model,
                  provider: result.provider,
                  providerLabel: result.providerLabel,
                  explainability: result.explainability,
                },
              }
            : m,
        ),
      )
    },
    [
      messages,
      folderId,
      jobDescription,
      outputLanguage,
      learningEnabled,
      selectedJobTitle,
      selectedCompany,
      currentVersionName,
      conversationForApi,
      documentContext,
      getActiveSelection,
      buildCoverLetterEditFromResult,
    ],
  )

  const handleExplainRecommendations = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target) return
      const advice = stripAdviceFooter(target.content)
      void sendMessage(
        documentContext === "cover_letter"
          ? buildExplainCoverLetterRecommendationsInstruction(advice)
          : buildExplainRecommendationsInstruction(advice),
      )
    },
    [messages, sendMessage, documentContext],
  )

  const selectionFromUserTurn = useCallback(
    (selectionContext?: string) => {
      if (!selectionContext) return getActiveSelection()
      return resolveAssistantSelectionForDocument(
        {
          source: documentContext === "cover_letter" ? "cover_letter" : "resume",
          text: selectionContext,
          capturedAt: Date.now(),
        },
        documentContext,
        coverLetterTextRef.current,
      )
    },
    [documentContext, getActiveSelection],
  )

  const handleDismissAdvice = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, adviceDismissed: true } : m)),
    )
  }, [])

  const handleApplyPendingEdit = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target?.cvEdit?.newResumeText) return
      const result = {
        success: true,
        cvText: target.cvEdit.newResumeText,
        previousCvText: target.cvEdit.previousResumeText,
        changeSummary: target.cvEdit.summary,
        changes: target.cvEdit.changes,
        versionName: target.cvEdit.versionName,
      }
      await applyEditFromResult(messageId, result as Awaited<ReturnType<typeof chatUnifiedAssistant>>, "Apply previewed changes")
    },
    [messages, applyEditFromResult],
  )

  const handleConfirmBypassValidation = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target?.cvEdit?.requiresValidationOverride) return

      const userTurn = messages
        .slice(0, messages.findIndex((m) => m.id === messageId))
        .reverse()
        .find((m) => m.role === "user")
      if (!userTurn) return

      setLoading(true)
      const result = await chatUnifiedAssistant({
        message: userTurn.content,
        folderId,
        resumeText: resumeTextRef.current,
        coverLetterText: coverLetterTextRef.current,
        jobDescription,
        outputLanguage,
        strategicProfile: strategicProfileRef.current,
        learningMemory: learningMemoryRef.current,
        learningEnabled,
        selectedJobTitle,
        selectedCompany,
        currentVersionName,
        conversationHistory: conversationForApi(),
        selection: selectionFromUserTurn(userTurn.selectionContext),
        documentContext,
        confirmBypassValidation: true,
      })
      setLoading(false)

      if (!result.success || !result.cvText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: result.error ?? "Could not apply edit.",
                  status: "error" as const,
                }
              : m,
          ),
        )
        return
      }

      const appliedResult = await applyCvEdit(result, userTurn.content)
      if (!appliedResult?.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: appliedResult?.error ?? "Could not save edit.",
                  status: "error" as const,
                }
              : m,
          ),
        )
        return
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.cvEdit
            ? {
                ...m,
                content: "Applied AI edit with validation override.",
                cvEdit: {
                  ...m.cvEdit,
                  applied: true,
                  pendingConfirmation: false,
                  requiresValidationOverride: false,
                  newResumeText: result.cvText!,
                },
              }
            : m,
        ),
      )
    },
    [
      messages,
      folderId,
      jobDescription,
      outputLanguage,
      learningEnabled,
      selectedJobTitle,
      selectedCompany,
      currentVersionName,
      conversationForApi,
      applyCvEdit,
      documentContext,
      selectionFromUserTurn,
    ],
  )

  const handleConfirmRiskyEdit = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target?.cvEdit?.pendingConfirmation) return

      const userTurn = messages
        .slice(0, messages.findIndex((m) => m.id === messageId))
        .reverse()
        .find((m) => m.role === "user")
      if (!userTurn) return

      setLoading(true)
      const result = await chatUnifiedAssistant({
        message: userTurn.content,
        folderId,
        resumeText: resumeTextRef.current,
        coverLetterText: coverLetterTextRef.current,
        jobDescription,
        outputLanguage,
        strategicProfile: strategicProfileRef.current,
        learningMemory: learningMemoryRef.current,
        learningEnabled,
        selectedJobTitle,
        selectedCompany,
        currentVersionName,
        conversationHistory: conversationForApi(),
        selection: selectionFromUserTurn(userTurn.selectionContext),
        documentContext,
        confirmRiskyEdit: true,
      })
      setLoading(false)

      if (!result.success || !result.cvText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: result.error ?? "Could not apply edit.",
                  status: "error" as const,
                }
              : m,
          ),
        )
        return
      }

      const appliedResult = await applyCvEdit(result, userTurn.content)
      if (!appliedResult?.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: appliedResult?.error ?? "Could not save edit.",
                  status: "error" as const,
                }
              : m,
          ),
        )
        return
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: `Done — I updated your CV and created a new version: **${appliedResult.newVersionName}**.\n\n${result.changeSummary?.split("\n")[0] ?? ""}`,
                cvEdit: {
                  mode: "edit_cv",
                  summary: result.changeSummary?.split("\n")[0] ?? "",
                  proposedChanges: buildProposedChangesList({
                    changes: result.changes ?? [],
                    summary: result.changeSummary,
                    explainability: result.explainability,
                  }),
                  changes: result.changes ?? [],
                  previousResumeText: result.previousCvText ?? resumeTextRef.current,
                  newResumeText: result.cvText!,
                  versionName: appliedResult.newVersionName ?? result.versionName ?? "",
                  applied: true,
                  pendingConfirmation: false,
                  appliedAt: Date.now(),
                  previousVersionId: appliedResult.previousVersionId,
                  newVersionId: appliedResult.newVersionId,
                  newVersionName: appliedResult.newVersionName,
                  model: result.model,
                  provider: result.provider,
                  providerLabel: result.providerLabel,
                  explainability: result.explainability,
                },
              }
            : m,
        ),
      )
    },
    [
      messages,
      folderId,
      jobDescription,
      outputLanguage,
      learningEnabled,
      selectedJobTitle,
      selectedCompany,
      currentVersionName,
      applyCvEdit,
      conversationForApi,
      documentContext,
      selectionFromUserTurn,
    ],
  )

  const handleUndoEdit = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target?.cvEdit?.applied) return
      onUndoResumeEdit?.(
        target.cvEdit.previousVersionId ?? null,
        target.cvEdit.previousResumeText,
      )
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.cvEdit
            ? {
                ...m,
                content: `${m.content}\n\n↩ Reverted to the previous version.`,
                cvEdit: { ...m.cvEdit, applied: false },
              }
            : m,
        ),
      )
    },
    [messages, onUndoResumeEdit],
  )

  const handleKeepEdit = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: `${m.content}\n\n✓ Keeping this version.` }
          : m,
      ),
    )
  }, [])

  const applyCoverLetterEditFromMessage = useCallback(
    async (messageId: string, insertAsVersion?: boolean) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target?.coverLetterEdit?.newLetterText || !onCoverLetterApply) return false

      const ok = await onCoverLetterApply({
        previousLetterText: target.coverLetterEdit.previousLetterText,
        newLetterText: target.coverLetterEdit.newLetterText,
        language: coverLetterLanguage,
        insertAsVersion,
        summary: target.coverLetterEdit.summary,
        model: target.coverLetterEdit.model,
        provider: target.coverLetterEdit.provider,
        providerLabel: target.coverLetterEdit.providerLabel,
        assistantMessageId: messageId,
        explainability: target.coverLetterEdit.explainability,
      })

      if (!ok) return false

      coverLetterTextRef.current = target.coverLetterEdit.newLetterText
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.coverLetterEdit
            ? {
                ...m,
                content: `Done — your cover letter was updated.\n\n${m.coverLetterEdit.summary}`,
                coverLetterEdit: {
                  ...m.coverLetterEdit,
                  applied: true,
                  pendingConfirmation: false,
                  appliedAt: Date.now(),
                },
              }
            : m,
        ),
      )
      return true
    },
    [messages, onCoverLetterApply, coverLetterLanguage],
  )

  const handleApplyCoverLetter = useCallback(
    (messageId: string) => {
      void applyCoverLetterEditFromMessage(messageId, false)
    },
    [applyCoverLetterEditFromMessage],
  )

  const handleInsertCoverLetterVersion = useCallback(
    (messageId: string) => {
      void applyCoverLetterEditFromMessage(messageId, true)
    },
    [applyCoverLetterEditFromMessage],
  )

  const handleInsertResumeVersion = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (!target?.cvEdit?.newResumeText) return
      const result = {
        success: true,
        cvText: target.cvEdit.newResumeText,
        previousCvText: target.cvEdit.previousResumeText,
        changeSummary: target.cvEdit.summary,
        changes: target.cvEdit.changes,
        versionName: `AI edit — ${target.cvEdit.summary || target.cvEdit.versionName}`,
        model: target.cvEdit.model,
        provider: target.cvEdit.provider,
        providerLabel: target.cvEdit.providerLabel,
        explainability: target.cvEdit.explainability,
      }
      await applyEditFromResult(
        messageId,
        result as Awaited<ReturnType<typeof chatUnifiedAssistant>>,
        "Insert as new version",
      )
    },
    [messages, applyEditFromResult],
  )

  const handleRejectCoverLetterEdit = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (target?.coverLetterEdit) {
        onLogAiActivity?.({
          createdAt: Date.now(),
          rejectedAt: Date.now(),
          action: "Updated Cover Letter",
          model: target.coverLetterEdit.model ?? "Unknown",
          provider: target.coverLetterEdit.provider ?? "unknown",
          providerLabel: target.coverLetterEdit.providerLabel,
          approvalStatus: "rejected",
          changes: target.coverLetterEdit.changes,
          explainability: target.coverLetterEdit.explainability,
          assistantMessageId: messageId,
        })
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.coverLetterEdit
            ? {
                ...m,
                content: `${m.content}\n\n✗ Cover letter change rejected. Your document was not modified.`,
                coverLetterEdit: {
                  ...m.coverLetterEdit,
                  applied: false,
                  pendingConfirmation: false,
                  rejected: true,
                },
              }
            : m,
        ),
      )
    },
    [messages, onLogAiActivity],
  )

  const handleRejectEdit = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      if (target?.coverLetterEdit) {
        handleRejectCoverLetterEdit(messageId)
        return
      }
      if (target?.cvEdit) {
        onLogAiActivity?.({
          createdAt: Date.now(),
          rejectedAt: Date.now(),
          action: target.cvEdit.summary || "AI CV edit",
          model: target.cvEdit.model ?? "Unknown",
          provider: target.cvEdit.provider ?? "unknown",
          providerLabel: target.cvEdit.providerLabel,
          approvalStatus: "rejected",
          changes: target.cvEdit.changes,
          explainability: target.cvEdit.explainability,
          resumeId: currentVersionId ?? undefined,
          resumeName: currentVersionName,
          assistantMessageId: messageId,
        })
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.cvEdit
            ? {
                ...m,
                content: `${m.content}\n\n✗ Changes rejected. Your CV was not modified.`,
                cvEdit: {
                  ...m.cvEdit,
                  applied: false,
                  pendingConfirmation: false,
                  rejected: true,
                },
              }
            : m,
        ),
      )
    },
    [messages, onLogAiActivity, currentVersionId, currentVersionName, handleRejectCoverLetterEdit],
  )

  const CareerMessage = useCallback(
    ({ message }: { message: AssistantChatMessage }) => (
      <AiCareerChatMessage
        message={message}
        documentContext={documentContext}
        onApplyRecommendations={(id) => void handleApplyRecommendations(id)}
        onPreviewRecommendations={(id) => void handlePreviewRecommendations(id)}
        onExplainRecommendations={handleExplainRecommendations}
        onDismissAdvice={handleDismissAdvice}
        onApplyPendingEdit={(id) => void handleApplyPendingEdit(id)}
        onInsertResumeVersion={(id) => void handleInsertResumeVersion(id)}
        onConfirmRiskyEdit={(id) => void handleConfirmRiskyEdit(id)}
        onConfirmBypassValidation={(id) => void handleConfirmBypassValidation(id)}
        onRejectEdit={handleRejectEdit}
        onUndoEdit={handleUndoEdit}
        onKeepEdit={handleKeepEdit}
        onApplyCoverLetter={handleApplyCoverLetter}
        onInsertCoverLetterVersion={handleInsertCoverLetterVersion}
        onRejectCoverLetterEdit={handleRejectCoverLetterEdit}
      />
    ),
    [
      handleApplyRecommendations,
      handlePreviewRecommendations,
      handleExplainRecommendations,
      handleDismissAdvice,
      handleApplyPendingEdit,
      handleInsertResumeVersion,
      handleConfirmRiskyEdit,
      handleConfirmBypassValidation,
      handleRejectEdit,
      handleUndoEdit,
      handleKeepEdit,
      handleApplyCoverLetter,
      handleInsertCoverLetterVersion,
      handleRejectCoverLetterEdit,
      documentContext,
    ],
  )

  const hasUnreadReply = useMemo(
    () =>
      !open &&
      messages.some((message) => message.role === "assistant" && message.timestamp > lastReadAt),
    [open, messages, lastReadAt],
  )

  const hasLearningInsights = useMemo(
    () =>
      !open &&
      learningEnabled &&
      (learningMemory?.insights?.some((insight) => !insight.dismissed) ?? false),
    [open, learningEnabled, learningMemory],
  )

  const hasRefinementWaiting = !open && canRestoreResume
  const hasAttention = hasUnreadReply || hasLearningInsights || hasRefinementWaiting

  if (!mounted || !folderId) return null
  if (requireResume && !resumeText.trim() && !showWhenEmpty) return null
  if (requireCoverLetter && !coverLetterText.trim() && !showWhenEmpty) return null

  const selectionBanner = selection?.text ? (
    <div className="shrink-0 mx-4 mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          Selection from {selectionSourceLabel(selection.source)}
        </p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2">
          &ldquo;{selection.text}&rdquo;
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => clearAssistantSelection()}
        aria-label="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  ) : null

  const chatBody = (
    <>
      <AssistantChatBody
        messages={messages}
        isLoading={loading}
        loadingLabel="AI is writing…"
        input={input}
        onInputChange={setInput}
        onSend={() => void sendMessage(input)}
        onSuggestion={(t) => void sendMessage(t)}
        suggestions={suggestions}
        showSuggestions={
          messages.length === 0 || messages[messages.length - 1]?.role === "assistant"
        }
        welcomeText="Highlight text in your resume or job description, then ask me to tailor, strengthen, or rewrite your CV. I edit the resume directly, create a new version, and explain what changed."
        inputPlaceholder="Ask about tailoring, edits, ATS, strategy…"
        renderMarkdown
        MessageComponent={CareerMessage}
        suggestionsPlacement="below-last-response"
        headerExtra={selectionBanner}
        footerExtra={
          canRestoreResume && onRestoreResume ? (
            <RestorePreviousButton onRestore={onRestoreResume} disabled={loading} />
          ) : null
        }
      />
      {showLearningSettings && learningMemory && (
        <PersonalLearningPanel
          folderId={folderId}
          memory={learningMemory}
          learningEnabled={learningEnabled}
          onOpenInsightsDashboard={() => setShowInsightsDashboard(true)}
          onSettingsChange={(enabled) => {
            setLearningEnabled(enabled)
            refreshLearning()
          }}
          onMemoryChange={(m) => {
            setLearningMemory(m)
            learningMemoryRef.current = m
          }}
        />
      )}
    </>
  )

  const learningSettingsButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={() => setShowLearningSettings((v) => !v)}
      aria-label="Learning settings"
      title="Personal learning privacy"
    >
      <Settings2 className="h-4 w-4" />
    </Button>
  )

  const panelHeader = (
    <AssistantPanelHeader
      title="AI Career Assistant"
      subtitle="Resume · strategy · ATS · interviews"
      icon={Sparkles}
      accentClassName="bg-primary/10 text-primary"
      onMinimize={() => setOpen(false)}
      onClose={isMobile ? () => setOpen(false) : undefined}
      trailing={learningSettingsButton}
    />
  )

  return createPortal(
    <>
      <LearningInsightsDashboard
        open={showInsightsDashboard}
        onOpenChange={setShowInsightsDashboard}
        folderId={folderId}
        versions={versions}
        jobApplications={jobApplications}
        onMemoryUpdated={(m) => {
          setLearningMemory(m)
          learningMemoryRef.current = m
        }}
      />
      {!open && (
        <AiAssistantFab
          onClick={() => setOpen(true)}
          label={fabLabel}
          tooltip={fabTooltip}
          hasAttention={hasAttention}
          accentColorHex={accentColorHex}
          className={fabClassName}
        />
      )}

      {!isMobile && open && (
        <AssistantDesktopPanel open>
          {panelHeader}
          <div className="flex flex-col flex-1 min-h-0">{chatBody}</div>
        </AssistantDesktopPanel>
      )}

      {isMobile && (
        <AssistantMobileDrawer
          open={open}
          onOpenChange={setOpen}
          title="AI Career Assistant"
          description="Your personal application coach"
        >
          {panelHeader}
          <div className="flex flex-col flex-1 min-h-0">{chatBody}</div>
        </AssistantMobileDrawer>
      )}
    </>,
    document.body,
  )
}

/** @deprecated Use UnifiedAiAssistant */
export const AiAssistantDock = UnifiedAiAssistant
