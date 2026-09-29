export function parseJobSearchTitlesResponse(text: string): string[] | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { jobTitles?: unknown }
    if (!Array.isArray(parsed.jobTitles)) return null

    const titles = parsed.jobTitles
      .filter((item): item is string => typeof item === "string")
      .map((title) => title.trim())
      .filter((title) => title.length >= 4 && title.split(/\s+/).length >= 2)

    return titles.length > 0 ? titles.slice(0, 10) : null
  } catch {
    return null
  }
}
