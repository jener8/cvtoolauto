export type RoleFitLevel = "strong" | "growing"

export type RoleMatchAccent = "teal" | "rose" | "amber"

export type RoleMatchResult = {
  id: string
  title: string
  matchingSkills: string[]
  fitLevel: RoleFitLevel
}

export type RoleMatchCardModel = RoleMatchResult & {
  fitLabel: string
  accent: RoleMatchAccent
}

export type SavedRoleMatch = RoleMatchResult & {
  savedAt: number
}

export type RoleMatchesCache = {
  matches: RoleMatchResult[]
  searchQuery?: string
  generatedAt: number
  source: "ai" | "fallback"
}
