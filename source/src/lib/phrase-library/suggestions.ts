import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { CAREER_PHRASES, PHRASE_BY_ID } from "@/lib/phrase-library/phrases"
import type { CareerPhrase, PhraseSuggestionResult } from "@/lib/phrase-library/types"
import type { StrategicProfile } from "@/lib/strategic-profile"

const TOPIC_TRIGGERS: Array<{ pattern: RegExp; reason: string; phraseIds: string[] }> = [
  {
    pattern: /hospitality|hotel|restaurant|guest|service/i,
    reason: "You mentioned hospitality.",
    phraseIds: ["ts-hospitality", "ts-customers", "ps-calm-pressure", "ps-team-player"],
  },
  {
    pattern: /healthcare|nursing|care|patient|hospital|pflege/i,
    reason: "You mentioned healthcare.",
    phraseIds: ["ts-healthcare", "ps-calm-pressure", "val-helping", "ps-attention-detail"],
  },
  {
    pattern: /retail|shop|sales|customer/i,
    reason: "You mentioned retail or customer work.",
    phraseIds: ["ts-retail", "ts-customers", "ps-customer-focused", "ps-calm-pressure"],
  },
  {
    pattern: /teach|education|school|child|kindergarten/i,
    reason: "You mentioned education or childcare.",
    phraseIds: ["ts-teaching", "ts-childcare", "val-helping", "ps-communication"],
  },
  {
    pattern: /admin|office|secretary|reception/i,
    reason: "You mentioned administration.",
    phraseIds: ["ts-administration", "ps-organised", "ts-documentation", "ps-communication"],
  },
  {
    pattern: /engineer|technical|manufactur|production|factory/i,
    reason: "You mentioned technical or manufacturing work.",
    phraseIds: ["ts-engineering", "ts-manufacturing", "ts-problem-solving", "val-quality"],
  },
  {
    pattern: /design|creative|ux|ui/i,
    reason: "You mentioned design or creative work.",
    phraseIds: ["ts-design", "val-innovation", "ts-research", "cb-perspective"],
  },
  {
    pattern: /it|software|tech|digital|computer/i,
    reason: "You mentioned IT or technology.",
    phraseIds: ["ts-it", "ps-quick-learner", "ts-problem-solving", "val-innovation"],
  },
  {
    pattern: /germany|german|deutsch/i,
    reason: "You're building a career in Germany.",
    phraseIds: ["cd-germany-long-term", "cg-long-term", "cb-international", "cb-transferable"],
  },
  {
    pattern: /team|collaborat|together/i,
    reason: "You mentioned teamwork.",
    phraseIds: ["ps-team-player", "mot-collaborative", "ps-leadership", "val-respect"],
  },
  {
    pattern: /learn|study|course|training/i,
    reason: "You mentioned learning.",
    phraseIds: ["mot-learning", "ps-quick-learner", "cb-still-learning", "cd-learning"],
  },
  {
    pattern: /lead|manag|supervis|coordinate/i,
    reason: "You mentioned leadership or coordination.",
    phraseIds: ["ps-leadership", "ps-coordination", "cg-responsibility", "ts-training"],
  },
]

function profileBlob(
  strategicProfile?: StrategicProfile | null,
  qualificationProfile?: QualificationProfile | null,
): string {
  const parts = [
    strategicProfile?.careerDirection,
    strategicProfile?.professionalStrengths,
    strategicProfile?.strategicEmphasis,
    strategicProfile?.longTermGoal,
    qualificationProfile?.fieldOfStudy,
    qualificationProfile?.workExperience,
    qualificationProfile?.studyCountry,
    qualificationProfile?.degree,
  ]
  return parts.filter(Boolean).join(" ")
}

function uniquePhrases(ids: string[]): CareerPhrase[] {
  const seen = new Set<string>()
  const result: CareerPhrase[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const phrase = PHRASE_BY_ID[id]
    if (!phrase) continue
    seen.add(id)
    result.push(phrase)
  }
  return result
}

export function suggestPhrases(input: {
  fieldText?: string
  fieldLabel?: string
  strategicProfile?: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
  limit?: number
}): PhraseSuggestionResult | null {
  const limit = input.limit ?? 4
  const combined = `${input.fieldText ?? ""} ${input.fieldLabel ?? ""} ${profileBlob(input.strategicProfile, input.qualificationProfile)}`.trim()
  if (combined.length < 3) return null

  for (const trigger of TOPIC_TRIGGERS) {
    if (!trigger.pattern.test(combined)) continue
    const phrases = uniquePhrases(trigger.phraseIds).slice(0, limit)
    if (phrases.length > 0) {
      return { reason: trigger.reason, phrases }
    }
  }

  const tokens = combined.toLowerCase().split(/[^a-zäöüß0-9]+/).filter((t) => t.length > 2)
  if (tokens.length === 0) return null

  const scored = CAREER_PHRASES.map((phrase) => {
    const haystack = `${phrase.title} ${phrase.example} ${phrase.tags.join(" ")} ${phrase.goodFor.join(" ")}`.toLowerCase()
    let score = 0
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1
    }
    return { phrase, score }
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null

  return {
    reason: "Based on what you've written so far.",
    phrases: scored.slice(0, limit).map((row) => row.phrase),
  }
}
