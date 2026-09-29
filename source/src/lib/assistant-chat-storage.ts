import type { AssistantCoverLetterEditResult, AssistantCvEditResult } from "@/lib/cv-edit-types"

export type AssistantChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  changeSummary?: string
  status?: "success" | "error" | "streaming"
  intent?: string
  mode?: "edit_cv" | "edit_cover_letter" | "career_advice" | "application_analysis" | "chat" | "advice_only"
  canApplyRecommendations?: boolean
  selectionReplacement?: string
  selectionOnly?: boolean
  adviceDismissed?: boolean
  showDiffRequested?: boolean
  /** Full resume text ready to apply to the editor */
  applicableCvText?: string
  /** Selection context used for this exchange */
  selectionContext?: string
  /** Structured CV edit result for versioning / diff / undo */
  cvEdit?: AssistantCvEditResult
  /** Structured cover letter edit awaiting user approval */
  coverLetterEdit?: AssistantCoverLetterEditResult
}

export function loadAssistantChat(
  storagePrefix: string,
  sessionId: string,
): AssistantChatMessage[] {
  if (typeof window === "undefined" || !sessionId) return []
  try {
    const raw = sessionStorage.getItem(`${storagePrefix}${sessionId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is AssistantChatMessage =>
        typeof m === "object" &&
        m !== null &&
        (m as AssistantChatMessage).role !== undefined &&
        typeof (m as AssistantChatMessage).content === "string",
    )
  } catch {
    return []
  }
}

export function saveAssistantChat(
  storagePrefix: string,
  sessionId: string,
  messages: AssistantChatMessage[],
): void {
  if (typeof window === "undefined" || !sessionId) return
  try {
    sessionStorage.setItem(
      `${storagePrefix}${sessionId}`,
      JSON.stringify(messages.slice(-50)),
    )
  } catch {
    /* quota */
  }
}
