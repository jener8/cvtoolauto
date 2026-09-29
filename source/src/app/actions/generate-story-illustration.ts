"use server"

import type { AiErrorCode } from "@/lib/ai/errors"
import { buildStoryIllustrationImagePrompt } from "@/lib/application-story-wizard/prompt"
import type { ApplicationIllustration, IllustrationStyle } from "@/lib/application-story-wizard/types"

const LOG_TAG = "generate-story-illustration"

export type GenerateStoryIllustrationInput = {
  illustrationPrompt: string
  style: IllustrationStyle
  company: string
  jobTitle: string
  hotspots: ApplicationIllustration["hotspots"]
}

export type GenerateStoryIllustrationResult = {
  success: boolean
  illustration?: ApplicationIllustration
  error?: string
  errorCode?: AiErrorCode
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const contentType = response.headers.get("content-type") || "image/png"
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export async function generateStoryIllustration(
  input: GenerateStoryIllustrationInput,
): Promise<GenerateStoryIllustrationResult> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) {
    return {
      success: false,
      error: "Illustration generation requires an OpenAI API key.",
      errorCode: "missing_api_key",
    }
  }

  if (!input.illustrationPrompt?.trim()) {
    return {
      success: false,
      error: "No illustration prompt available. Run the Application Story Wizard first.",
      errorCode: "validation_error",
    }
  }

  const prompt = buildStoryIllustrationImagePrompt({
    illustrationPrompt: input.illustrationPrompt,
    style: input.style,
    company: input.company,
    jobTitle: input.jobTitle,
  })

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
      signal: AbortSignal.timeout(90_000),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error(`[${LOG_TAG}] OpenAI images error`, response.status, body.slice(0, 300))
      return {
        success: false,
        error: "Could not generate illustration. Try again.",
        errorCode: "provider_error",
      }
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string }>
    }
    const imageUrl = data.data?.[0]?.url
    if (!imageUrl) {
      return {
        success: false,
        error: "No image returned from the provider.",
        errorCode: "empty_response",
      }
    }

    const imageDataUrl = await fetchImageAsDataUrl(imageUrl)
    const now = Date.now()

    return {
      success: true,
      illustration: {
        prompt: input.illustrationPrompt,
        style: input.style,
        hotspots: input.hotspots,
        imageDataUrl: imageDataUrl ?? undefined,
        lastModified: now,
        aiMetadata: {
          model: "dall-e-3",
          generatedAt: now,
        },
      },
    }
  } catch (error) {
    console.error(`[${LOG_TAG}]`, error)
    return {
      success: false,
      error: "Illustration generation timed out or failed.",
      errorCode: "timeout",
    }
  }
}
