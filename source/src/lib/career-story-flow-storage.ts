import type { CareerStoryFieldKey } from "@/lib/career-story-sections"

export type CareerStoryDraftState =
  | "ready"
  | "recording"
  | "review_transcript"
  | "processing"
  | "review_paragraph"

export type CareerStoryDraftMode = "voice" | "type" | null

export type CareerStoryQuestionDraft = {
  mode: CareerStoryDraftMode
  state: CareerStoryDraftState
  transcriptDraft: string
  paragraphDraft: string
  /** When we strip a trailing spoken navigation command, we show this note once. */
  strippedNote?: string
}

export type CareerStoryFlowState = {
  visitedUpTo: number
  skippedKeys: CareerStoryFieldKey[]
  drafts: Partial<Record<CareerStoryFieldKey, CareerStoryQuestionDraft>>
}

const STORAGE_PREFIX = "career-story-flow"

function storageKey(folderId: string): string {
  return `${STORAGE_PREFIX}:${folderId}`
}

function emptyFlow(): CareerStoryFlowState {
  return { visitedUpTo: 0, skippedKeys: [], drafts: {} }
}

export function loadCareerStoryFlow(folderId: string): CareerStoryFlowState {
  if (typeof window === "undefined") return emptyFlow()
  try {
    const raw = localStorage.getItem(storageKey(folderId))
    if (!raw) return emptyFlow()
    const parsed = JSON.parse(raw) as Partial<CareerStoryFlowState>
    if (typeof parsed !== "object" || parsed === null) return emptyFlow()
    return {
      visitedUpTo: typeof parsed.visitedUpTo === "number" ? parsed.visitedUpTo : 0,
      skippedKeys: Array.isArray(parsed.skippedKeys)
        ? (parsed.skippedKeys.filter((k): k is CareerStoryFieldKey => typeof k === "string") as CareerStoryFieldKey[])
        : [],
      drafts:
        typeof parsed.drafts === "object" && parsed.drafts !== null
          ? (parsed.drafts as CareerStoryFlowState["drafts"])
          : {},
    }
  } catch {
    return emptyFlow()
  }
}

export function saveCareerStoryFlow(folderId: string, state: CareerStoryFlowState): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(folderId), JSON.stringify(state))
}

