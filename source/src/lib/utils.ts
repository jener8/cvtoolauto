import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeLower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : ""
}

// Shared translation rate limit tracking
const RATE_LIMIT_KEY = "translation_rate_limited_until"

export function isTranslationRateLimited(): boolean {
  if (typeof window === "undefined") return false
  
  // Always clear old rate limits on check - user has credits now
  const limitedUntil = localStorage.getItem(RATE_LIMIT_KEY)
  if (limitedUntil) {
    // Clear any rate limit that's older than 1 minute (stale from before credits were added)
    const limitTime = parseInt(limitedUntil, 10)
    if (Date.now() > limitTime || limitTime - Date.now() > 60000) {
      localStorage.removeItem(RATE_LIMIT_KEY)
      return false
    }
    return Date.now() < limitTime
  }
  return false
}

export function setTranslationRateLimited(): void {
  if (typeof window === "undefined") return
  // Short cooldown only for real rate limits
  localStorage.setItem(RATE_LIMIT_KEY, String(Date.now() + 60_000))
}

export function clearTranslationRateLimit(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(RATE_LIMIT_KEY)
}

// Translation feature enabled - using Anthropic Claude instead of OpenAI
const ENABLE_TRANSLATION = true

export async function translateTextWithRateLimit(
  text: string,
  targetLanguage: "en" | "de",
  options?: { preserveResumeMarkup?: boolean },
): Promise<{
  translatedText: string
  rateLimited: boolean
  disabled?: boolean
  error?: string
}> {
  if (!ENABLE_TRANSLATION) {
    return { translatedText: text, rateLimited: false, disabled: true }
  }

  if (!text || text.trim().length < 3) {
    return { translatedText: text, rateLimited: false }
  }

  if (isTranslationRateLimited()) {
    return {
      translatedText: text,
      rateLimited: true,
      error: "Translation is cooling down after a rate limit. Try again shortly.",
    }
  }

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        targetLanguage,
        preserveResumeMarkup: options?.preserveResumeMarkup === true,
      }),
    })
    const data = (await response.json()) as {
      translatedText?: string
      rateLimited?: boolean
      error?: string
    }

    if (response.status === 429 || data.rateLimited) {
      setTranslationRateLimited()
      return {
        translatedText: text,
        rateLimited: true,
        error: data.error || "Translation rate limited. Try again shortly.",
      }
    }

    if (!response.ok) {
      return {
        translatedText: text,
        rateLimited: false,
        error: data.error || "Translation failed.",
      }
    }

    const translated = (data.translatedText || "").trim()
    if (!translated) {
      return {
        translatedText: text,
        rateLimited: false,
        error: data.error || "Translation returned empty text.",
      }
    }

    clearTranslationRateLimit()
    return {
      translatedText: translated,
      rateLimited: false,
    }
  } catch {
    return {
      translatedText: text,
      rateLimited: false,
      error: "Could not reach the translation service.",
    }
  }
}

export function isTranslationDisabled(): boolean {
  return !ENABLE_TRANSLATION
}
