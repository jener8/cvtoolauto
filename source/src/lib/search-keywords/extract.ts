import type { StrategicProfile } from "@/lib/strategic-profile"
import type { JobApplication } from "@/lib/types"
import { CAREER_STORY_SECTIONS, storySectionValue } from "@/lib/career-story-sections"
import type { KeywordCluster, KeywordSource } from "@/lib/search-keywords/types"

type GlossaryCluster = {
  id: string
  keywordDe: string
  keywordEn: string
  /** Lowercased terms to match in user text. */
  synonyms: string[]
  /** Optional helper terms to enrich boolean searches. */
  domainHints?: string[]
}

const GLOSSARY: GlossaryCluster[] = [
  {
    id: "accessibility",
    keywordDe: "Barrierefreiheit",
    keywordEn: "Accessibility",
    synonyms: [
      "barrierefreiheit",
      "barrierefrei",
      "accessibility",
      "a11y",
      "wcag",
      "accessible design",
    ],
    domainHints: ["UX", "Design"],
  },
  {
    id: "project-management",
    keywordDe: "Projektmanagement",
    keywordEn: "Project management",
    synonyms: ["projektmanagement", "project management", "pm", "projektleitung"],
  },
  {
    id: "user-research",
    keywordDe: "Nutzerforschung",
    keywordEn: "User research",
    synonyms: ["nutzerforschung", "user research", "ux research", "interviews", "usability tests"],
    domainHints: ["UX", "Design"],
  },
  {
    id: "stakeholder",
    keywordDe: "Stakeholder-Management",
    keywordEn: "Stakeholder management",
    synonyms: ["stakeholder", "stakeholder management", "stakeholder-management"],
  },
  {
    id: "data-analysis",
    keywordDe: "Datenanalyse",
    keywordEn: "Data analysis",
    synonyms: ["datenanalyse", "data analysis", "analyse", "analytics"],
  },
  {
    id: "figma",
    keywordDe: "Figma",
    keywordEn: "Figma",
    synonyms: ["figma"],
    domainHints: ["UX", "Design"],
  },
  {
    id: "jira",
    keywordDe: "Jira",
    keywordEn: "Jira",
    synonyms: ["jira"],
  },
  {
    id: "excel",
    keywordDe: "Excel",
    keywordEn: "Excel",
    synonyms: ["excel"],
  },
  {
    id: "power-bi",
    keywordDe: "Power BI",
    keywordEn: "Power BI",
    synonyms: ["power bi", "powerbi"],
  },
  {
    id: "facilitation",
    keywordDe: "Workshop-Moderation",
    keywordEn: "workshop facilitation",
    synonyms: [
      "workshop facilitation",
      "workshop moderat",
      "facilitat",
      "workshop",
      "facilitation",
      "moderation",
    ],
    domainHints: ["Facilitation", "Moderation"],
  },
  {
    id: "ux-design",
    keywordDe: "UX-Design",
    keywordEn: "UX design",
    synonyms: ["ux design", "user experience", "nutzererfahrung", "ux designer", "head of ux"],
    domainHints: ["UX", "Design"],
  },
  {
    id: "responsible-ai",
    keywordDe: "Verantwortungsvolle KI",
    keywordEn: "responsible AI",
    synonyms: [
      "responsible ai",
      "verantwortungsvolle ki",
      "ai governance",
      "ki-governance",
      "ai ethics",
      "responsible artificial intelligence",
    ],
    domainHints: ["AI", "Governance"],
  },
]

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function hasDateOrFileLike(input: string): boolean {
  return (
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(input) ||
    /\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/.test(input) ||
    /\b(?:pdf|docx?|pptx?|xlsx?|png|jpe?g)\b/i.test(input)
  )
}

export function isCleanRoleTitle(input: string): boolean {
  const title = normalizeWhitespace(input)
  if (!title) return false
  if (title.length < 3 || title.length > 64) return false
  if (hasDateOrFileLike(title)) return false
  if (title.split(" ").length > 6) return false
  if (/^[a-z]/.test(title)) return false // reject mid-phrase fragments like "of UX"
  if (/[.!?]$/.test(title)) return false
  return true
}

function includesAny(textLower: string, synonyms: string[]): boolean {
  return synonyms.some((syn) => {
    const needle = syn.toLowerCase()
    if (needle.length <= 2) return false
    return textLower.includes(needle)
  })
}

function displayPair(keywordDe: string, keywordEn: string): string {
  const de = normalizeWhitespace(keywordDe)
  const en = normalizeWhitespace(keywordEn)
  if (!de) return en
  if (!en) return de
  if (de.toLowerCase() === en.toLowerCase()) return de
  return `${de} · ${en}`
}

function buildSearchString(keywordDe: string, keywordEn: string, domainHints?: string[]): string {
  const de = normalizeWhitespace(keywordDe)
  const en = normalizeWhitespace(keywordEn)
  const parts: string[] = []
  if (de && en && de.toLowerCase() !== en.toLowerCase()) {
    parts.push(`${de} OR ${en}`)
  } else {
    parts.push(de || en)
  }

  const hints = (domainHints ?? []).filter(Boolean)
  if (hints.length > 0) {
    parts.push(`(${hints.join(" OR ")})`)
  }

  return parts.filter(Boolean).join(" ")
}

function uniqueTop(items: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = item.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item.trim())
    if (out.length >= limit) break
  }
  return out
}

function storySources(profile: StrategicProfile | null): Array<{ key: string; label: string; text: string }> {
  if (!profile) return []
  return CAREER_STORY_SECTIONS.map((section) => ({
    key: section.key,
    label: section.cardLabel,
    text: storySectionValue(profile, section.key),
  })).filter((row) => row.text.trim().length > 0)
}

function buildProvenanceFromSource(source: KeywordSource): string {
  if (source.kind === "story") {
    return `From your “${source.label}” story section.`
  }
  if (source.kind === "application") {
    const title = source.jobTitle ? normalizeWhitespace(source.jobTitle) : ""
    const company = source.company ? normalizeWhitespace(source.company) : ""
    if (title && company) return `From your application for ${title} at ${company}.`
    if (title) return `From your application for ${title}.`
    return "From your job applications."
  }
  if (source.kind === "ability") {
    return `From your abilities: “${normalizeWhitespace(source.name)}”.`
  }
  if (source.kind === "achievement") {
    const snippet = normalizeWhitespace(source.description).slice(0, 72)
    return snippet
      ? `From an achievement you added: “${snippet}${source.description.length > 72 ? "…" : ""}”.`
      : "From an achievement you added."
  }
  return "Your search."
}

function isValidSkillPhrase(input: string): boolean {
  const phrase = normalizeWhitespace(input)
  if (!phrase) return false
  if (phrase.length < 3 || phrase.length > 48) return false
  if (hasDateOrFileLike(phrase)) return false
  if (phrase.split(" ").length > 5) return false
  if (/^[a-z]/.test(phrase) && phrase.split(" ").length === 1) return false
  if (/^(of|and|the|in|mit|und|für|for|with)\b/i.test(phrase)) return false
  if (/[.!?]$/.test(phrase)) return false
  if (isCleanRoleTitle(phrase) && phrase.split(" ").length <= 2) return false
  return true
}

function splitSkillPhrases(text: string): string[] {
  return text
    .split(/[,;•\n]|(?:\s+and\s+)|(?:\s+und\s+)/i)
    .map((part) => normalizeWhitespace(part.replace(/^[-–•]\s*/, "")))
    .filter(isValidSkillPhrase)
}

function phraseClusterId(phrase: string): string {
  return `kw-phrase-${phrase.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").slice(0, 48)}`
}

function clusterKeyphrase(phrase: string): string {
  return phrase.toLowerCase().replace(/\s+/g, " ").trim()
}

function buildPhraseCluster(input: {
  phrase: string
  sources: KeywordSource[]
  jobs: JobApplication[]
  jobTextById: Map<string, string>
  glossarySynonyms?: string[]
}): KeywordCluster {
  const phrase = normalizeWhitespace(input.phrase)
  const synonyms = [phrase, ...(input.glossarySynonyms ?? [])].map((s) => s.toLowerCase())

  const evidenceCount = uniqueTop(
    input.sources.map((s) =>
      s.kind === "story"
        ? `story:${s.fieldKey}`
        : s.kind === "application"
          ? `app:${s.applicationId}`
          : s.kind === "ability"
            ? `ability:${s.abilityId}`
            : s.kind === "achievement"
              ? `ach:${s.achievementId}`
              : `search:${s.query}`,
    ),
    99,
  ).length

  const fitLevel: KeywordCluster["fitLevel"] = evidenceCount >= 2 ? "strong" : "growing"

  const exampleTitles = uniqueTop(
    input.jobs
      .filter((job) => {
        const textLower = input.jobTextById.get(job.id) ?? ""
        return includesAny(textLower, synonyms)
      })
      .map((job) => normalizeWhitespace(job.jobTitle))
      .filter(isCleanRoleTitle),
    3,
  )

  const provenanceSource = input.sources[0]!

  return {
    id: phraseClusterId(phrase),
    keywordDe: phrase,
    keywordEn: phrase,
    provenance: buildProvenanceFromSource(provenanceSource),
    fitLevel,
    exampleRoleTitles: exampleTitles,
    searchString: phrase,
    sources: input.sources,
  }
}

function collectProfilePhrases(input: {
  strategicProfile: StrategicProfile | null
  qualificationProfile?: import("@/lib/qualification-profile/types").QualificationProfile | null
}): Array<{ phrase: string; sources: KeywordSource[] }> {
  const out: Array<{ phrase: string; sources: KeywordSource[] }> = []
  const seen = new Set<string>()

  const pushPhrase = (phrase: string, sources: KeywordSource[]) => {
    const key = clusterKeyphrase(phrase)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ phrase: normalizeWhitespace(phrase), sources })
  }

  for (const ab of input.qualificationProfile?.abilities ?? []) {
    const name = normalizeWhitespace(ab.name)
    if (!isValidSkillPhrase(name)) continue
    pushPhrase(name, [{ kind: "ability", abilityId: ab.id, name }])
  }

  for (const ach of input.qualificationProfile?.achievements ?? []) {
    for (const phrase of splitSkillPhrases(ach.description)) {
      pushPhrase(phrase, [
        { kind: "achievement", achievementId: ach.id, description: ach.description },
      ])
    }
  }

  if (input.strategicProfile?.professionalStrengths) {
    for (const phrase of splitSkillPhrases(input.strategicProfile.professionalStrengths)) {
      pushPhrase(phrase, [{ kind: "story", fieldKey: "professionalStrengths", label: "Strengths" }])
    }
  }

  if (input.strategicProfile?.careerDirection) {
    for (const phrase of splitSkillPhrases(input.strategicProfile.careerDirection)) {
      if (phrase.split(" ").length <= 4) {
        pushPhrase(phrase, [{ kind: "story", fieldKey: "careerDirection", label: "Direction" }])
      }
    }
  }

  return out
}

export function extractKeywordClusters(input: {
  folderId: string
  strategicProfile: StrategicProfile | null
  jobApplications: JobApplication[]
  qualificationProfile?: import("@/lib/qualification-profile/types").QualificationProfile | null
  maxCards?: number
}): KeywordCluster[] {
  const maxCards = input.maxCards ?? 10
  const story = storySources(input.strategicProfile)
  const jobs = input.jobApplications ?? []
  const achievements = input.qualificationProfile?.achievements ?? []
  const abilities = input.qualificationProfile?.abilities ?? []

  const jobTextById = new Map<string, string>()
  for (const job of jobs) {
    const blob = `${job.jobTitle}\n${job.company}\n${job.jobDescription ?? ""}\n${job.strategySummary ?? ""}`
    jobTextById.set(job.id, blob.toLowerCase())
  }

  const clusters: KeywordCluster[] = []

  for (const def of GLOSSARY) {
    const sources: KeywordSource[] = []

    for (const row of story) {
      const textLower = row.text.toLowerCase()
      if (includesAny(textLower, def.synonyms)) {
        sources.push({ kind: "story", fieldKey: row.key, label: row.label })
      }
    }

    for (const job of jobs) {
      const textLower = jobTextById.get(job.id) ?? ""
      if (includesAny(textLower, def.synonyms)) {
        sources.push({
          kind: "application",
          applicationId: job.id,
          jobTitle: isCleanRoleTitle(job.jobTitle) ? normalizeWhitespace(job.jobTitle) : undefined,
          company: job.company?.trim() ? normalizeWhitespace(job.company) : undefined,
        })
      }
    }

    for (const ach of achievements) {
      const textLower = ach.description.toLowerCase()
      if (includesAny(textLower, def.synonyms)) {
        sources.push({
          kind: "achievement",
          achievementId: ach.id,
          description: ach.description,
        })
      }
    }

    for (const ab of abilities) {
      const textLower = ab.name.toLowerCase()
      if (includesAny(textLower, def.synonyms)) {
        sources.push({
          kind: "ability",
          abilityId: ab.id,
          name: ab.name,
        })
      }
    }

    if (sources.length === 0) continue

    // Choose a provenance source: prefer story evidence, otherwise application evidence.
    const provenanceSource =
      sources.find((s) => s.kind === "story") ?? sources.find((s) => s.kind === "application") ?? sources[0]!

    const evidenceCount = uniqueTop(
      sources.map((s) =>
        s.kind === "story"
          ? `story:${s.fieldKey}`
          : s.kind === "application"
            ? `app:${s.applicationId}`
            : s.kind === "ability"
              ? `ability:${s.abilityId}`
              : s.kind === "achievement"
                ? `ach:${s.achievementId}`
                : `search:${s.query}`,
      ),
      99,
    ).length

    const fitLevel: KeywordCluster["fitLevel"] = evidenceCount >= 2 ? "strong" : "growing"

    const exampleTitles = uniqueTop(
      jobs
        .filter((job) => {
          const textLower = jobTextById.get(job.id) ?? ""
          return includesAny(textLower, def.synonyms)
        })
        .map((job) => normalizeWhitespace(job.jobTitle))
        .filter(isCleanRoleTitle),
      3,
    )

    clusters.push({
      id: `kw-${def.id}`,
      keywordDe: def.keywordDe,
      keywordEn: def.keywordEn,
      provenance: buildProvenanceFromSource(provenanceSource),
      fitLevel,
      exampleRoleTitles: exampleTitles,
      searchString: buildSearchString(def.keywordDe, def.keywordEn, def.domainHints),
      sources,
    })
  }

  const glossaryKeys = new Set(
    clusters.flatMap((c) => [clusterKeyphrase(c.keywordDe), clusterKeyphrase(c.keywordEn)]),
  )

  for (const row of collectProfilePhrases({
    strategicProfile: input.strategicProfile,
    qualificationProfile: input.qualificationProfile,
  })) {
    const key = clusterKeyphrase(row.phrase)
    const alreadyCovered = [...glossaryKeys].some(
      (gk) => gk.includes(key) || key.includes(gk),
    )
    if (alreadyCovered) continue

    clusters.push(
      buildPhraseCluster({
        phrase: row.phrase,
        sources: row.sources,
        jobs,
        jobTextById,
      }),
    )
    glossaryKeys.add(key)
  }

  // Order by strength of evidence, then alphabetically.
  const ordered = clusters
    .sort((a, b) => {
      if (a.fitLevel !== b.fitLevel) return a.fitLevel === "strong" ? -1 : 1
      return displayPair(a.keywordDe, a.keywordEn).localeCompare(displayPair(b.keywordDe, b.keywordEn))
    })
    .slice(0, maxCards)

  return ordered
}

export function buildExploreKeywordCluster(query: string): KeywordCluster | null {
  const cleaned = normalizeWhitespace(query)
  if (!cleaned) return null
  if (cleaned.length > 60) return null
  if (hasDateOrFileLike(cleaned)) return null

  return {
    id: `kw-search-${cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`,
    keywordDe: cleaned,
    keywordEn: cleaned,
    provenance: "Your search.",
    fitLevel: "growing",
    exampleRoleTitles: [],
    searchString: cleaned,
    sources: [{ kind: "search", query: cleaned }],
  }
}

export function toKeywordCardModels(clusters: KeywordCluster[]): Array<import("./types").KeywordCardModel> {
  const ACCENTS: Array<import("./types").KeywordAccent> = ["teal", "rose", "amber"]
  return clusters.map((cluster, index) => ({
    ...cluster,
    fitLabel: cluster.fitLevel === "strong" ? "Strong fit" : "Growing fit",
    accent: ACCENTS[index % ACCENTS.length]!,
    displayTitle: displayPair(cluster.keywordDe, cluster.keywordEn),
  }))
}

