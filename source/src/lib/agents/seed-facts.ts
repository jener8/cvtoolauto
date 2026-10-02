import type { QualificationProfile } from "@/lib/qualification-profile/types"
import { parseResumeText } from "@/lib/parse-resume-text"
import { isResumeTemplateVersion } from "@/lib/resume-classification"
import type { ResumeVersion } from "@/lib/types"
import type { AgentFactCategory, AgentProfileFactInsert } from "@/lib/agents/types"
import { filterResumesToOwnPerson } from "@/lib/agents/own-resumes"

type SeedFact = AgentProfileFactInsert & { sourceKey: string }

function pushFact(
  facts: SeedFact[],
  input: {
    category: AgentFactCategory
    factText: string
    source: SeedFact["source"]
    sourceKey: string
    sourceRef?: Record<string, unknown>
    sortOrder: number
  },
) {
  const text = input.factText.trim()
  if (!text) return
  facts.push({
    category: input.category,
    factText: text,
    status: "unconfirmed",
    source: input.source,
    sourceKey: input.sourceKey,
    sourceRef: input.sourceRef ?? {},
    sortOrder: input.sortOrder,
  })
}

function categoryForSection(title: string): AgentFactCategory {
  const upper = title.toUpperCase()
  if (upper.includes("EDUCATION") || upper.includes("AUSBILDUNG") || upper.includes("STUDIUM")) {
    return "education"
  }
  if (upper.includes("SKILL") || upper.includes("COMPETENC") || upper.includes("FÄHIGKEIT")) {
    return "skill"
  }
  if (upper.includes("LANGUAGE") || upper.includes("SPRACH")) {
    return "language"
  }
  if (upper.includes("CERTIF") || upper.includes("ZERTIFIK")) {
    return "certification"
  }
  if (
    upper.includes("EXPERIENCE") ||
    upper.includes("EMPLOYMENT") ||
    upper.includes("WORK") ||
    upper.includes("BERUF") ||
    upper.includes("ERFAHRUNG")
  ) {
    return "experience"
  }
  if (upper.includes("PROFILE") || upper.includes("SUMMARY") || upper.includes("PROFIL")) {
    return "summary"
  }
  return "other"
}

function lineKind(line: string): "role" | "employer" | "dates" | "bullet" | "text" {
  const trimmed = line.trim()
  if (trimmed.startsWith("###")) return "dates"
  if (trimmed.startsWith("##")) return "employer"
  if (trimmed.startsWith("#") && !trimmed.startsWith("##")) return "role"
  if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) {
    return "bullet"
  }
  return "text"
}

function stripMarkupPrefix(line: string): string {
  return line
    .trim()
    .replace(/^#{1,3}\s*/, "")
    .replace(/^[-•*]\s*/, "")
    .trim()
}

/** Prefer reusable/template CVs; fall back to richest resume_text. */
export function pickSeedResume(versions: ResumeVersion[]): ResumeVersion | null {
  const withText = versions.filter((v) => v.resumeText?.trim())
  if (withText.length === 0) return null

  const templates = withText.filter((v) => isResumeTemplateVersion(v))
  const pool = templates.length > 0 ? templates : withText
  return pool.reduce((best, cur) =>
    (cur.resumeText?.length ?? 0) > (best.resumeText?.length ?? 0) ? cur : best,
  )
}

export function extractFactsFromResume(version: ResumeVersion): SeedFact[] {
  const facts: SeedFact[] = []
  let order = 0
  const resumeId = version.id
  const contact = version.contactInfo

  if (contact?.name?.trim()) {
    pushFact(facts, {
      category: "identity",
      factText: contact.name.trim(),
      source: "resume",
      sourceKey: `resume:${resumeId}:contact:name`,
      sourceRef: { resumeId, field: "name" },
      sortOrder: order++,
    })
  }
  if (contact?.professionalTitle?.trim()) {
    pushFact(facts, {
      category: "identity",
      factText: `Professional title: ${contact.professionalTitle.trim()}`,
      source: "resume",
      sourceKey: `resume:${resumeId}:contact:professionalTitle`,
      sourceRef: { resumeId, field: "professionalTitle" },
      sortOrder: order++,
    })
  }
  if (contact?.citizenship?.trim()) {
    pushFact(facts, {
      category: "identity",
      factText: `Citizenship: ${contact.citizenship.trim()}`,
      source: "resume",
      sourceKey: `resume:${resumeId}:contact:citizenship`,
      sourceRef: { resumeId, field: "citizenship" },
      sortOrder: order++,
    })
  }

  const sections = parseResumeText(version.resumeText ?? "")
  sections.forEach((section, sectionIndex) => {
    const sectionCategory = categoryForSection(section.title)
    section.content.forEach((line, lineIndex) => {
      const kind = lineKind(line)
      const text = stripMarkupPrefix(line)
      if (!text) return

      let category: AgentFactCategory = sectionCategory
      if (kind === "role") category = "role"
      else if (kind === "employer") category = "employer"
      else if (kind === "dates") category = "dates"
      else if (kind === "bullet") category = "achievement"

      pushFact(facts, {
        category,
        factText: text,
        source: "resume",
        sourceKey: `resume:${resumeId}:s${sectionIndex}:l${lineIndex}`,
        sourceRef: {
          resumeId,
          section: section.title,
          sectionIndex,
          lineIndex,
          kind,
        },
        sortOrder: order++,
      })
    })
  })

  return facts
}

/** Build unconfirmed items from pasted/uploaded CV text (no resume_versions row required). */
export function extractFactsFromResumeText(input: {
  resumeText: string
  label?: string
  importKey?: string
}): SeedFact[] {
  const text = input.resumeText.trim()
  if (!text) return []
  const importKey = (input.importKey ?? `upload:${Date.now()}`).slice(0, 80)
  const label = input.label?.trim() || "uploaded CV"
  const facts: SeedFact[] = []
  let order = 0
  const sections = parseResumeText(text)
  sections.forEach((section, sectionIndex) => {
    const sectionCategory = categoryForSection(section.title)
    section.content.forEach((line, lineIndex) => {
      const kind = lineKind(line)
      const lineText = stripMarkupPrefix(line)
      if (!lineText) return

      let category: AgentFactCategory = sectionCategory
      if (kind === "role") category = "role"
      else if (kind === "employer") category = "employer"
      else if (kind === "dates") category = "dates"
      else if (kind === "bullet") category = "achievement"

      pushFact(facts, {
        category,
        factText: lineText,
        source: "resume",
        sourceKey: `${importKey}:s${sectionIndex}:l${lineIndex}:${lineText.slice(0, 40)}`,
        sourceRef: {
          section: section.title,
          sectionIndex,
          lineIndex,
          kind,
          label,
          importKey,
        },
        sortOrder: order++,
      })
    })
  })
  return facts
}

export function extractFactsFromQualificationProfile(
  profile: QualificationProfile | null | undefined,
): SeedFact[] {
  if (!profile) return []
  const facts: SeedFact[] = []
  let order = 10_000

  const educationParts = [
    profile.degree,
    profile.fieldOfStudy ? `in ${profile.fieldOfStudy}` : null,
    profile.institution ? `at ${profile.institution}` : null,
    profile.yearsAttended ? `(${profile.yearsAttended})` : null,
  ].filter(Boolean)
  if (educationParts.length > 0) {
    pushFact(facts, {
      category: "education",
      factText: educationParts.join(" "),
      source: "qualification_profile",
      sourceKey: "qualification:education:summary",
      sourceRef: { field: "education_summary" },
      sortOrder: order++,
    })
  }

  if (profile.studyCountry?.trim()) {
    pushFact(facts, {
      category: "education",
      factText: `Studied in ${profile.studyCountry.trim()}`,
      source: "qualification_profile",
      sourceKey: "qualification:studyCountry",
      sourceRef: { field: "studyCountry" },
      sortOrder: order++,
    })
  }
  if (profile.specialisation?.trim()) {
    pushFact(facts, {
      category: "education",
      factText: `Specialisation: ${profile.specialisation.trim()}`,
      source: "qualification_profile",
      sourceKey: "qualification:specialisation",
      sourceRef: { field: "specialisation" },
      sortOrder: order++,
    })
  }
  if (profile.educationType) {
    pushFact(facts, {
      category: "education",
      factText: `Education type: ${profile.educationType}`,
      source: "qualification_profile",
      sourceKey: "qualification:educationType",
      sourceRef: { field: "educationType" },
      sortOrder: order++,
    })
  }
  if (profile.yearsOfExperience?.trim()) {
    pushFact(facts, {
      category: "experience",
      factText: `Years of experience: ${profile.yearsOfExperience.trim()}`,
      source: "qualification_profile",
      sourceKey: "qualification:yearsOfExperience",
      sourceRef: { field: "yearsOfExperience" },
      sortOrder: order++,
    })
  }
  if (profile.workExperience?.trim()) {
    pushFact(facts, {
      category: "experience",
      factText: profile.workExperience.trim(),
      source: "qualification_profile",
      sourceKey: "qualification:workExperience",
      sourceRef: { field: "workExperience" },
      sortOrder: order++,
    })
  }
  if (profile.recognitionStatus) {
    pushFact(facts, {
      category: "certification",
      factText: `Qualification recognition status: ${profile.recognitionStatus}`,
      source: "qualification_profile",
      sourceKey: "qualification:recognitionStatus",
      sourceRef: { field: "recognitionStatus" },
      sortOrder: order++,
    })
  }

  for (const achievement of profile.achievements ?? []) {
    const parts = [
      achievement.description,
      achievement.duration ? `Duration: ${achievement.duration}` : null,
      achievement.scale ? `Scale: ${achievement.scale}` : null,
      achievement.outcome ? `Outcome: ${achievement.outcome}` : null,
      achievement.tags?.length ? `Tags: ${achievement.tags.join(", ")}` : null,
    ].filter(Boolean)
    pushFact(facts, {
      category: "achievement",
      factText: parts.join(" — "),
      source: "qualification_profile",
      sourceKey: `qualification:achievement:${achievement.id}`,
      sourceRef: { field: "achievement", achievementId: achievement.id },
      sortOrder: order++,
    })
  }

  for (const ability of profile.abilities ?? []) {
    const extras = [
      ability.category,
      ability.languageLevel,
      ability.cefr,
    ].filter(Boolean)
    pushFact(facts, {
      category: "skill",
      factText: extras.length ? `${ability.name} (${extras.join(", ")})` : ability.name,
      source: "qualification_profile",
      sourceKey: `qualification:ability:${ability.id}`,
      sourceRef: { field: "ability", abilityId: ability.id },
      sortOrder: order++,
    })
  }

  for (const language of profile.languages ?? []) {
    const level = [language.level, language.cefr].filter(Boolean).join(", ")
    pushFact(facts, {
      category: "language",
      factText: level ? `${language.name} — ${level}` : language.name,
      source: "qualification_profile",
      sourceKey: `qualification:language:${language.id}`,
      sourceRef: { field: "language", languageId: language.id },
      sortOrder: order++,
    })
  }

  return facts
}

/** Build unconfirmed seed facts from resume versions + qualification profile (read-only). */
export function buildSeedFacts(input: {
  versions: ResumeVersion[]
  qualificationProfile?: QualificationProfile | null
  /** When set, prefer this uploaded/pasted text over (or in addition to) workspace versions. */
  resumeText?: string | null
  resumeLabel?: string | null
  resumeVersionId?: string | null
  /** Import every workspace CV with text and surface multi-direction role suggestions. */
  allWorkspaceResumes?: boolean
  /**
   * Client-side CVs (localStorage / browser workspace). DEV cloud often has none;
   * the profile UI sends these so “review my saved CVs” still works.
   */
  clientVersions?: ResumeVersion[]
  /** When set, only seed CVs for this person key (name:/email:…). */
  ownerKey?: string | null
  /** Soft match on contact name/email when ownerKey is absent. */
  ownerHint?: string | null
}): {
  facts: SeedFact[]
  resumeId: string | null
  resumeName: string | null
  directions: string[]
  resumeCount: number
  ownerLabel: string | null
} {
  if (input.resumeText?.trim()) {
    const fromText = extractFactsFromResumeText({
      resumeText: input.resumeText,
      label: input.resumeLabel ?? "uploaded CV",
    })
    const fromQual = extractFactsFromQualificationProfile(input.qualificationProfile)
    return {
      facts: [...fromText, ...fromQual],
      resumeId: null,
      resumeName: input.resumeLabel ?? "uploaded CV",
      directions: [],
      resumeCount: 1,
      ownerLabel: null,
    }
  }

  const mergedVersions = mergeSeedVersions(input.versions, input.clientVersions ?? [])

  if (input.allWorkspaceResumes) {
    const ownOnly = filterResumesToOwnPerson(mergedVersions, {
      ownerKey: input.ownerKey,
      ownerHint: input.ownerHint,
    })
    const withText = ownOnly.filter((v) => v.resumeText?.trim())
    const ownerLabel =
      withText[0]?.contactInfo?.name?.trim() ||
      withText[0]?.contactInfo?.email?.trim() ||
      null
    const seenKeys = new Set<string>()
    const merged: SeedFact[] = []
    for (const version of withText) {
      for (const fact of extractFactsFromResume(version)) {
        const dedupeKey = `${fact.category}::${fact.factText.trim().toLowerCase()}`
        if (seenKeys.has(dedupeKey)) continue
        seenKeys.add(dedupeKey)
        merged.push(fact)
      }
    }
    const directions = deriveCareerDirections(withText)
    let order = 50_000
    for (const direction of directions) {
      pushFact(merged, {
        category: "summary",
        factText: `Possible work direction: ${direction}`,
        source: "resume",
        sourceKey: `directions:all:${direction.toLowerCase().replace(/\s+/g, "-").slice(0, 60)}`,
        sourceRef: {
          field: "career_direction",
          label: ownerLabel ? `CVs for ${ownerLabel}` : "your CVs only",
          direction,
        },
        sortOrder: order++,
      })
    }
    const fromQual = extractFactsFromQualificationProfile(input.qualificationProfile)
    return {
      facts: [...merged, ...fromQual],
      resumeId: null,
      resumeName:
        withText.length === 0
          ? null
          : ownerLabel
            ? `${withText.length} CV${withText.length === 1 ? "" : "s"} for ${ownerLabel}`
            : `${withText.length} workspace CV${withText.length === 1 ? "" : "s"}`,
      directions,
      resumeCount: withText.length,
      ownerLabel,
    }
  }

  const versions = input.resumeVersionId
    ? mergedVersions.filter((v) => v.id === input.resumeVersionId)
    : mergedVersions
  const resume = pickSeedResume(versions.length ? versions : mergedVersions)
  const fromResume = resume ? extractFactsFromResume(resume) : []
  const fromQual = extractFactsFromQualificationProfile(input.qualificationProfile)
  return {
    facts: [...fromResume, ...fromQual],
    resumeId: resume?.id ?? null,
    resumeName: resume?.name ?? null,
    directions: resume ? deriveCareerDirections([resume]) : [],
    resumeCount: resume ? 1 : 0,
    ownerLabel:
      resume?.contactInfo?.name?.trim() || resume?.contactInfo?.email?.trim() || null,
  }
}

/** Prefer client text when cloud rows are empty shells; keep unique ids. */
function mergeSeedVersions(
  cloud: ResumeVersion[],
  client: ResumeVersion[],
): ResumeVersion[] {
  const byId = new Map<string, ResumeVersion>()
  for (const version of cloud) {
    if (!version?.id) continue
    byId.set(version.id, version)
  }
  for (const version of client) {
    if (!version?.id) continue
    const existing = byId.get(version.id)
    if (!existing) {
      byId.set(version.id, version)
      continue
    }
    const clientHasText = Boolean(version.resumeText?.trim())
    const cloudHasText = Boolean(existing.resumeText?.trim())
    if (clientHasText && !cloudHasText) {
      byId.set(version.id, version)
    } else if (clientHasText && cloudHasText) {
      // Prefer longer text (more complete snapshot)
      if ((version.resumeText?.length ?? 0) > (existing.resumeText?.length ?? 0)) {
        byId.set(version.id, version)
      }
    }
  }
  // Client-only versions without colliding with cloud
  for (const version of client) {
    if (!version?.id) continue
    if (!byId.has(version.id)) byId.set(version.id, version)
  }
  return [...byId.values()]
}

/**
 * Pull distinct role-like titles across CVs so the profile can show
 * multiple possible work directions (e.g. design leadership + AI enablement).
 */
export function deriveCareerDirections(versions: ResumeVersion[]): string[] {
  const titles = new Map<string, string>()
  for (const version of versions) {
    const contactTitle = version.contactInfo?.professionalTitle?.trim()
    if (contactTitle) {
      const key = normalizeDirectionKey(contactTitle)
      if (key && !titles.has(key)) titles.set(key, contactTitle)
    }
    const name = version.name?.trim()
    if (name && !/^cv|resume|lebenslauf|untitled/i.test(name) && name.length < 80) {
      const cleaned = name.replace(/\s+v\d+$/i, "").trim()
      const key = normalizeDirectionKey(cleaned)
      if (key && key.length > 3 && !titles.has(key)) titles.set(key, cleaned)
    }
    for (const fact of extractFactsFromResume(version)) {
      if (fact.category !== "role" && fact.category !== "experience") continue
      const role = extractRoleTitle(fact.factText)
      if (!role) continue
      const key = normalizeDirectionKey(role)
      if (key && !titles.has(key)) titles.set(key, role)
    }
  }
  return [...titles.values()].slice(0, 12)
}

function normalizeDirectionKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9äöüß+&/\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractRoleTitle(factText: string): string | null {
  const text = factText.trim()
  if (!text || text.length > 100) return null
  // "Head of Design · Acme · 2021–current"
  const beforeSep = text.split(/\s*[·|—–-]\s*/)[0]?.trim()
  if (!beforeSep) return null
  if (/^\d{4}/.test(beforeSep)) return null
  if (beforeSep.length < 3) return null
  return beforeSep
}
