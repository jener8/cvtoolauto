import { NextResponse } from "next/server"
import {
  getMissingAiKeyError,
  runTextGenerationWithRetry,
} from "@/lib/ai/run-text-generation"
import {
  alignTranslatedResumeMarkup,
  isLikelyTruncatedTranslation,
  lockManualPageBreaks,
  unlockManualPageBreaks,
} from "@/lib/resume-translate-markup"

function buildTranslatePrompt(input: {
  text: string
  targetLanguage: "en" | "de"
  preserveResumeMarkup: boolean
}): string {
  const languageName = input.targetLanguage === "de" ? "German" : "English"
  const sourceLanguage = input.targetLanguage === "de" ? "English" : "German"

  const markupRules = input.preserveResumeMarkup
    ? `
This is resume content. Preserve ALL markup and structure exactly:
- Keep lines starting with #, ##, ### (translate only the text after the hashes)
- Keep bullet lines starting with - or •
- Keep sentinel tokens like <<<EQUITAI_PAGE_BREAK_0>>> on their own line, unchanged and in the same position — do not move, remove, invent, or translate them
- Do NOT add or relocate ---PAGE BREAK--- markers
- Keep URLs, emails, phone numbers, and dates as-is
- Keep company names; translate job titles naturally when appropriate
- For German section headers use canonical ALL-CAPS forms: PROFIL, BERUFSERFAHRUNG, AUSBILDUNG, FÄHIGKEITEN, SPRACHEN, PROJEKTE (prefer BERUFSERFAHRUNG over ERFAHRUNG)
- For English section headers use: PROFILE, EXPERIENCE, EDUCATION, SKILLS, LANGUAGES, PROJECTS
- Translate the FULL document — do not summarize or omit later sections
- Do not add commentary or markdown fences
`
    : ""

  return `Translate the following text from ${sourceLanguage} to ${languageName}.
Keep the same tone, formatting, and structure. Only return the translated text, nothing else.
${markupRules}
Text to translate:
${input.text}`
}

/** Split long resume text into chunks that preserve section boundaries. */
function chunkText(text: string, maxChars = 3500): string[] {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return [trimmed]

  const parts = trimmed.split(/\n(?=#+\s|[A-ZÄÖÜ][A-ZÄÖÜ\s/&-]{2,}\s*$)/m)
  const chunks: string[] = []
  let current = ""

  for (const part of parts) {
    if (!part.trim()) continue
    if (!current) {
      current = part
      continue
    }
    if (current.length + part.length + 1 <= maxChars) {
      current = `${current}\n${part}`
    } else {
      chunks.push(current)
      current = part
    }
  }
  if (current.trim()) chunks.push(current)

  // Fallback: hard-split any remaining oversized chunk
  const final: string[] = []
  for (const chunk of chunks.length > 0 ? chunks : [trimmed]) {
    if (chunk.length <= maxChars) {
      final.push(chunk)
      continue
    }
    for (let i = 0; i < chunk.length; i += maxChars) {
      final.push(chunk.slice(i, i + maxChars))
    }
  }
  return final
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string
      targetLanguage?: "en" | "de"
      preserveResumeMarkup?: boolean
    }
    const text = body.text || ""
    const targetLanguage = body.targetLanguage
    const preserveResumeMarkup = Boolean(body.preserveResumeMarkup)

    if (!text || !targetLanguage) {
      return NextResponse.json({ translatedText: text || "", rateLimited: false })
    }

    if (text.trim().length < 3) {
      return NextResponse.json({ translatedText: text, rateLimited: false })
    }

    const missing = getMissingAiKeyError()
    if (missing) {
      return NextResponse.json(
        {
          translatedText: text,
          rateLimited: false,
          error: missing.message,
          errorCode: missing.code,
        },
        { status: 503 },
      )
    }

    const { lockedText, breakCount } = preserveResumeMarkup
      ? lockManualPageBreaks(text)
      : { lockedText: text, breakCount: 0 }

    const chunks = chunkText(lockedText)
    const translatedChunks: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      const result = await runTextGenerationWithRetry({
        prompt: buildTranslatePrompt({
          text: chunk,
          targetLanguage,
          preserveResumeMarkup,
        }),
        maxOutputTokens: Math.min(
          8000,
          Math.max(preserveResumeMarkup ? 2500 : 1200, Math.ceil(chunk.length * 2.4)),
        ),
        temperature: 0.2,
        timeoutMs: 90_000,
        maxAttempts: 2,
        logTag: `translate-resume-${i + 1}-of-${chunks.length}`,
      })

      if (!result.ok) {
        const isRateLimit = result.error.code === "rate_limit" || result.error.code === "quota_exceeded"
        return NextResponse.json(
          {
            translatedText: text,
            rateLimited: isRateLimit,
            error: result.error.message,
            errorCode: result.error.code,
          },
          { status: isRateLimit ? 429 : 502 },
        )
      }

      translatedChunks.push(result.text.trim())
    }

    let translatedText = translatedChunks.join("\n").trim()
    if (preserveResumeMarkup) {
      translatedText = unlockManualPageBreaks(translatedText, breakCount)
      translatedText = alignTranslatedResumeMarkup(text, translatedText)

      if (isLikelyTruncatedTranslation(text, translatedText)) {
        return NextResponse.json(
          {
            translatedText: text,
            rateLimited: false,
            error: "Translation looked incomplete. Please try again.",
            errorCode: "truncated_translation",
          },
          { status: 502 },
        )
      }
    }

    return NextResponse.json({
      translatedText,
      rateLimited: false,
    })
  } catch (error) {
    console.error("[api/translate] Unexpected failure", error)
    return NextResponse.json(
      {
        translatedText: "",
        rateLimited: false,
        error: error instanceof Error ? error.message : "Translation failed.",
        errorCode: "unknown",
      },
      { status: 500 },
    )
  }
}
