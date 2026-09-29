import { normalizeYourStoryCvEvidence } from "@/lib/your-story"
import type { YourStoryCvEvidenceItem } from "@/lib/types"

export type ParsedYourStoryResponse = {
  story: string
  cvEvidence: YourStoryCvEvidenceItem[]
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) return trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]?.trim().startsWith("{")) return fence[1].trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return null
}

export function parseYourStoryResponse(raw: string): ParsedYourStoryResponse | null {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const story = String(parsed.story ?? parsed.content ?? "").trim()
    if (!story) return null
    const cvEvidence = normalizeYourStoryCvEvidence(parsed.cvEvidence ?? parsed.cv_evidence)
    return { story, cvEvidence }
  } catch {
    return null
  }
}
