export type KeywordFitLevel = "strong" | "growing"

export type KeywordAccent = "teal" | "rose" | "amber"

export type KeywordSource =
  | {
      kind: "story"
      fieldKey: string
      label: string
    }
  | {
      kind: "application"
      applicationId: string
      jobTitle?: string
      company?: string
    }
  | {
      kind: "search"
      query: string
    }
  | {
      kind: "ability"
      abilityId: string
      name: string
    }
  | {
      kind: "achievement"
      achievementId: string
      description: string
    }

export type KeywordCluster = {
  id: string
  keywordDe: string
  keywordEn: string
  /** Short, evidence-linked sentence (“From your …”). */
  provenance: string
  fitLevel: KeywordFitLevel
  /** 2–3 example role titles. Must be validated/clean. */
  exampleRoleTitles: string[]
  /** The boolean search string to copy. */
  searchString: string
  /** Evidence sources used to justify this keyword. */
  sources: KeywordSource[]
}

export type KeywordCardModel = KeywordCluster & {
  fitLabel: string
  accent: KeywordAccent
  /** Card title display: "DE · EN" or one term if identical. */
  displayTitle: string
}

export type SavedKeywordCluster = KeywordCluster & {
  savedAt: number
}
