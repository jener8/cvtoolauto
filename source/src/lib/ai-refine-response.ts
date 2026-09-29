import { extractCvMarkdownFromAiResponse, recoverCvFromAiResponse, isUsableCvMarkdown, diagnoseCvMarkdown } from "@/lib/ai-cv-response"
import type { CvEditChange, CvEditStructuredResponse } from "@/lib/cv-edit-types"

function normalizeUpdatedResumeField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.replace(/\\n/g, "\n").trim()
  return text || undefined
}

function pickBestUsableCv(candidates: string[], rawFallback: string): string {
  let best = ""
  let bestScore = -1

  for (const candidate of candidates) {
    const text = recoverCvFromAiResponse(candidate).text
    if (!text) continue
    const diag = diagnoseCvMarkdown(text)
    if (!diag.usable) continue
    const score = text.length + diag.bulletCount * 12 + (diag.hasSectionHeader ? 40 : 0)
    if (score > bestScore) {
      best = text
      bestScore = score
    }
  }

  return best || recoverCvFromAiResponse(rawFallback).text
}

function extractNonJsonCodeFences(raw: string): string[] {
  const blocks: string[] = []
  const re = /```(?!json)(?:markdown|md|text|txt)?\s*\n?([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const body = match[1]?.trim()
    if (body) blocks.push(body)
  }
  return blocks
}

export function isAddBulletInstruction(instruction: string): boolean {
  return /\bbullet(?:\s+point)?\b/i.test(instruction)
}

/** Merge a short bullet-only AI reply into the baseline CV. */
export function mergeBulletFragmentIntoCv(baseline: string, fragment: string): string | null {
  const baselineTrimmed = baseline.trim()
  if (!baselineTrimmed) return null

  const lines = fragment
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return null

  let bulletLines = lines.filter((line) => line.startsWith("- "))
  if (bulletLines.length === 0 && lines.length <= 4) {
    bulletLines = [`- ${lines.join(" ").replace(/^-\s*/, "")}`]
  }
  if (bulletLines.length === 0) return null

  const baselineLines = baseline.split("\n")
  let sectionEnd = baselineLines.length
  for (let i = 0; i < baselineLines.length; i++) {
    const upper = baselineLines[i]?.trim().toUpperCase() ?? ""
    if (
      upper === "EDUCATION" ||
      upper === "SKILLS" ||
      upper === "LANGUAGES" ||
      upper === "PROJECTS" ||
      upper === "CERTIFICATIONS" ||
      upper.startsWith("EDUCATION ") ||
      upper.startsWith("SKILLS ")
    ) {
      sectionEnd = i
      break
    }
  }

  let insertAt = sectionEnd
  for (let i = sectionEnd - 1; i >= 0; i--) {
    const trimmed = baselineLines[i]?.trim() ?? ""
    if (trimmed.startsWith("- ")) {
      insertAt = i + 1
      break
    }
    if (/^(EXPERIENCE|BERUFSERFAHRUNG|PROFILE|PROFIL)\b/i.test(trimmed)) {
      insertAt = i + 1
      break
    }
  }

  const merged = [
    ...baselineLines.slice(0, insertAt),
    ...bulletLines,
    ...baselineLines.slice(insertAt),
  ].join("\n")

  return isUsableCvMarkdown(merged) ? merged : null
}

export function extractRefineAiResponse(raw: string): {
  cvText: string
  changeSummary?: string
  changeWhy?: string
  structured?: CvEditStructuredResponse
} {
  const structured = parseStructuredEditResponse(raw)
  const changeSummaryMatch = raw.match(/CHANGE_SUMMARY:\s*(.+?)(?:\n|$)/im)
  const changeWhyMatch = raw.match(/CHANGE_WHY:\s*(.+?)(?:\n|$)/im)

  const candidates = [
    structured?.updatedResume,
    ...extractNonJsonCodeFences(raw),
    extractCvMarkdownFromAiResponse(raw),
    recoverCvFromAiResponse(raw).text,
  ].filter((value): value is string => Boolean(value?.trim()))

  const cvText = pickBestUsableCv(candidates, raw)

  return {
    cvText,
    changeSummary: structured?.summary || changeSummaryMatch?.[1]?.trim(),
    changeWhy: changeWhyMatch?.[1]?.trim(),
    structured: structured ?? undefined,
  }
}

function parseStructuredEditResponse(raw: string): CvEditStructuredResponse | null {
  const jsonFence = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidates = [jsonFence?.[1], raw.trim()].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const start = candidate.indexOf("{")
      const end = candidate.lastIndexOf("}")
      if (start < 0 || end <= start) continue
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Partial<CvEditStructuredResponse>
      if (parsed.mode !== "edit_cv" && !parsed.updatedResume && !parsed.summary) continue

      const changes = Array.isArray(parsed.changes)
        ? parsed.changes
            .filter((c): c is CvEditChange => Boolean(c && typeof c === "object"))
            .map((c) => ({
              section: String(c.section ?? "CV"),
              type: (c.type === "added" || c.type === "removed" || c.type === "updated"
                ? c.type
                : "updated") as CvEditChange["type"],
              description: c.description ? String(c.description) : undefined,
              before: c.before ? String(c.before) : undefined,
              after: c.after ? String(c.after) : undefined,
            }))
        : []

      return {
        mode: "edit_cv",
        summary: String(parsed.summary ?? "").trim(),
        changes,
        updatedResume: normalizeUpdatedResumeField(parsed.updatedResume),
      }
    } catch {
      continue
    }
  }
  return null
}

export function extractSelectionReplacement(raw: string): string | null {
  const jsonFence = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidates = [jsonFence?.[1], raw.trim()].filter(Boolean) as string[]
  for (const candidate of candidates) {
    try {
      const start = candidate.indexOf("{")
      const end = candidate.lastIndexOf("}")
      if (start < 0 || end <= start) continue
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
        replacementText?: string
      }
      const text = parsed.replacementText?.trim()
      if (text) return text
    } catch {
      continue
    }
  }
  const trimmed = raw.trim()
  if (trimmed && !trimmed.startsWith("{") && trimmed.length < 4000) {
    return trimmed
  }
  return null
}

export function fallbackChangeSummary(instruction: string): string {
  const short = instruction.trim()
  if (short.length <= 120) return `Applied your request: ${short}`
  return `Applied your request: ${short.slice(0, 117)}…`
}
