const SESSION_KEY = "ai-coach-pending-prompt"

/** Queue a message for the AI Coach page input (consumed on next visit). */
export function setAiCoachPendingPrompt(message: string): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SESSION_KEY, message.trim())
}

/** Read and clear any queued AI Coach prompt. */
export function consumeAiCoachPendingPrompt(): string | null {
  if (typeof window === "undefined") return null
  const value = sessionStorage.getItem(SESSION_KEY)
  if (value) sessionStorage.removeItem(SESSION_KEY)
  return value
}
