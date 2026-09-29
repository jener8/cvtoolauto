export type PhraseCategoryId =
  | "career-direction"
  | "professional-strengths"
  | "transferable-skills"
  | "values"
  | "motivation"
  | "career-goals"
  | "confidence-builders"

export type PhraseCategory = {
  id: PhraseCategoryId
  label: string
  description: string
}

export type CareerPhrase = {
  id: string
  categoryId: PhraseCategoryId
  title: string
  example: string
  goodFor: string[]
  relatedIds: string[]
  tags: string[]
}

export type PhraseSuggestionResult = {
  reason: string
  phrases: CareerPhrase[]
}

export type ActivePhraseField = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  element: HTMLTextAreaElement | HTMLInputElement | null
}
