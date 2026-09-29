import type { RoleMatchCardModel, RoleMatchResult } from "@/lib/role-matches/types"

const ACCENTS: RoleMatchCardModel["accent"][] = ["teal", "rose", "amber"]

/** Generic placeholders — never show on cards or keyword chips. */
const GENERIC_MATCHING_SKILLS = new Set([
  "relevant experience",
  "transferable skills",
])

export function sanitizeMatchingSkills(skills: string[]): string[] {
  return skills.filter((skill) => {
    const key = skill.trim().toLowerCase()
    return key.length >= 2 && !GENERIC_MATCHING_SKILLS.has(key)
  })
}

export function sanitizeRoleMatches(matches: RoleMatchResult[]): RoleMatchResult[] {
  return matches.map((match) => ({
    ...match,
    matchingSkills: sanitizeMatchingSkills(match.matchingSkills),
  }))
}

export function toRoleMatchCards(matches: RoleMatchResult[]): RoleMatchCardModel[] {
  return sanitizeRoleMatches(matches).map((match, index) => ({
    ...match,
    fitLabel: match.fitLevel === "strong" ? "Strong fit" : "Growing fit",
    accent: ACCENTS[index % ACCENTS.length]!,
  }))
}

export function buildKeywordChipsFromMatches(matches: RoleMatchResult[]): string[] {
  const seen = new Set<string>()
  const chips: string[] = []
  for (const match of matches) {
    for (const skill of sanitizeMatchingSkills(match.matchingSkills)) {
      const key = skill.trim().toLowerCase()
      if (key.length < 3 || seen.has(key)) continue
      seen.add(key)
      chips.push(skill.trim())
    }
  }
  return chips.slice(0, 12)
}

export function filterMatchesByQuery(
  matches: RoleMatchResult[],
  query: string,
): RoleMatchResult[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return matches
  return matches.filter(
    (match) =>
      match.title.toLowerCase().includes(needle) ||
      match.matchingSkills.some((skill) => skill.toLowerCase().includes(needle)),
  )
}

export function orphanedSavedMatches(
  current: RoleMatchResult[],
  saved: RoleMatchResult[],
): RoleMatchResult[] {
  const currentIds = new Set(current.map((match) => match.id))
  const currentTitles = new Set(current.map((match) => match.title.toLowerCase()))
  return saved.filter(
    (match) => !currentIds.has(match.id) && !currentTitles.has(match.title.toLowerCase()),
  )
}
