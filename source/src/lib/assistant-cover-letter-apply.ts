import type { CoverLetterAiMetadata } from "@/lib/cover-letter-ai"

export const ASSISTANT_COVER_LETTER_APPLIED_EVENT = "assistant-cover-letter-applied"

export type AssistantCoverLetterAppliedDetail = {
  contentEn: string
  contentDe: string
  language: "en" | "de"
  insertAsVersion?: boolean
  aiMetadata?: CoverLetterAiMetadata
}

export function dispatchAssistantCoverLetterApplied(
  detail: AssistantCoverLetterAppliedDetail,
): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(ASSISTANT_COVER_LETTER_APPLIED_EVENT, { detail }),
  )
}

export function subscribeAssistantCoverLetterApplied(
  handler: (detail: AssistantCoverLetterAppliedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {}
  const listener = (event: Event) => {
    handler((event as CustomEvent<AssistantCoverLetterAppliedDetail>).detail)
  }
  window.addEventListener(ASSISTANT_COVER_LETTER_APPLIED_EVENT, listener)
  return () => window.removeEventListener(ASSISTANT_COVER_LETTER_APPLIED_EVENT, listener)
}
