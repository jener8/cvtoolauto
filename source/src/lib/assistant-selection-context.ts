export type AssistantSelectionSource = "resume" | "job_description" | "cover_letter"

export type AssistantDocumentContext = "resume" | "cover_letter"

export type AssistantSelectionContext = {
  source: AssistantSelectionSource
  text: string
  capturedAt: number
}

const STORAGE_KEY = "assistant-selection-context"
const MAX_AGE_MS = 30 * 60 * 1000

export const ASSISTANT_SELECTION_CHANGED_EVENT = "assistant-selection-changed"

function notifySelectionChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(ASSISTANT_SELECTION_CHANGED_EVENT))
}

export function saveAssistantSelection(ctx: AssistantSelectionContext | null): void {
  if (typeof window === "undefined") return
  try {
    if (!ctx?.text.trim()) {
      sessionStorage.removeItem(STORAGE_KEY)
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx))
    }
    notifySelectionChanged()
  } catch {
    /* ignore */
  }
}

export function loadAssistantSelection(): AssistantSelectionContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AssistantSelectionContext
    if (!parsed?.text?.trim() || !parsed.source) return null
    if (Date.now() - parsed.capturedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearAssistantSelection(): void {
  saveAssistantSelection(null)
}

export function captureTextareaSelection(
  source: AssistantSelectionSource,
  element: HTMLTextAreaElement | HTMLInputElement,
): void {
  const start = element.selectionStart
  const end = element.selectionEnd
  if (start == null || end == null || start === end) return
  const text = element.value.substring(start, end).trim()
  if (text.length < 3) return
  saveAssistantSelection({ source, text, capturedAt: Date.now() })
}

/** Capture text highlighted in a preview panel (e.g. formatted cover letter). */
export function captureVisibleTextSelection(
  source: AssistantSelectionSource,
  container?: HTMLElement | null,
): void {
  if (typeof window === "undefined") return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
  const text = sel.toString().trim()
  if (text.length < 3) return
  if (container) {
    const range = sel.getRangeAt(0)
    if (!container.contains(range.commonAncestorContainer)) return
  }
  saveAssistantSelection({ source, text, capturedAt: Date.now() })
}

export function resolveAssistantSelectionForDocument(
  selection: AssistantSelectionContext | null,
  documentContext: AssistantDocumentContext,
  coverLetterText: string,
): AssistantSelectionContext | null {
  if (!selection?.text?.trim()) return null

  if (documentContext === "cover_letter") {
    if (selection.source === "cover_letter" || selection.source === "job_description") {
      return selection
    }
    const snippet = selection.text.trim()
    if (coverLetterText.includes(snippet)) {
      return { ...selection, source: "cover_letter" }
    }
    return null
  }

  if (selection.source === "cover_letter") return null
  return selection
}

export function selectionSourceLabel(source: AssistantSelectionSource): string {
  switch (source) {
    case "resume":
      return "Resume"
    case "job_description":
      return "Job description"
    case "cover_letter":
      return "Cover letter"
  }
}
