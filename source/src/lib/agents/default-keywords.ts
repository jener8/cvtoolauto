/**
 * Default Job Scout keyword pre-filter (OR match on title + description).
 * Seeded into Search settings when keywords are empty; editable there.
 */
export const DEFAULT_JOB_SCOUT_KEYWORDS: readonly string[] = [
  "AI adoption",
  "AI enablement",
  "AI transformation",
  "responsible AI",
  "human-centred AI",
  "human-centered AI",
  "ethical AI",
  "product design",
  "product designer",
  "UX",
  "user experience",
  "UX designer",
  "UX lead",
  "head of UX",
  "design lead",
  "head of design",
  "design director",
  "AI design",
  "service design",
  "experience design",
  "design manager",
  "designops",
]

export const FILTERED_OUT_NOT_TARGET_ROLE = "Filtered out: not a target role"

/** Activity / log line for a dropped listing. */
export function filteredOutActivityMessage(title: string): string {
  const clean = title.trim() || "(untitled)"
  return `${FILTERED_OUT_NOT_TARGET_ROLE} — ${clean}`
}

export function effectiveJobScoutKeywords(keywords: string[] | null | undefined): string[] {
  const cleaned = (keywords ?? []).map((k) => k.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned : [...DEFAULT_JOB_SCOUT_KEYWORDS]
}
