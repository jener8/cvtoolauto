import {
  EMPTY_LINKEDIN_SECTIONS,
  type LinkedInProfileSections,
} from "@/lib/linkedin-profile-types"

const SECTION_HEADERS: Array<{ key: keyof LinkedInProfileSections; patterns: RegExp[] }> = [
  {
    key: "about",
    patterns: [/^(about|summary|profile|über mich|profil)\s*$/i],
  },
  {
    key: "experience",
    patterns: [
      /^(experience|work experience|employment|berufserfahrung|erfahrung)\s*$/i,
    ],
  },
  {
    key: "projects",
    patterns: [/^(projects|projekte)\s*$/i],
  },
  {
    key: "education",
    patterns: [/^(education|ausbildung|studium)\s*$/i],
  },
  {
    key: "certificates",
    patterns: [
      /^(certificates|certifications|licenses|zertifikate|zertifizierungen)\s*$/i,
    ],
  },
  {
    key: "skills",
    patterns: [/^(skills|fähigkeiten|kenntnisse)\s*$/i],
  },
]

function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** Build CV text used by the application flow from structured sections. */
export function sectionsToGeneralCv(sections: LinkedInProfileSections): string {
  const blocks: string[] = []
  const push = (title: string, body: string) => {
    const t = body.trim()
    if (t) blocks.push(`${title.toUpperCase()}\n${t}`)
  }
  push("About", sections.about)
  push("Experience", sections.experience)
  push("Projects", sections.projects)
  push("Education", sections.education)
  push("Certificates", sections.certificates)
  push("Skills", sections.skills)
  return blocks.join("\n\n")
}

export function hasMeaningfulLinkedInContent(
  sections: LinkedInProfileSections,
  fallbackText?: string | null,
): boolean {
  const total = Object.values(sections).join(" ").trim().length
  if (total >= 60) return true
  const flat = fallbackText?.trim() ?? ""
  return flat.length >= 60
}

export function countPopulatedSections(sections: LinkedInProfileSections): number {
  return Object.values(sections).filter((s) => s.trim().length >= 12).length
}

/** Best-effort split of flat profile text into sections. */
export function parseProfileTextToSections(text: string): LinkedInProfileSections {
  const normalized = normalizeBlock(text)
  if (!normalized) return { ...EMPTY_LINKEDIN_SECTIONS }

  const lines = normalized.split("\n")
  const result = { ...EMPTY_LINKEDIN_SECTIONS }
  let currentKey: keyof LinkedInProfileSections | null = null
  const buffer: string[] = []

  const flush = () => {
    if (!currentKey || buffer.length === 0) return
    const chunk = normalizeBlock(buffer.join("\n"))
    if (chunk) {
      result[currentKey] = result[currentKey] ? `${result[currentKey]}\n\n${chunk}` : chunk
    }
    buffer.length = 0
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const header = SECTION_HEADERS.find((h) =>
      h.patterns.some((p) => p.test(trimmed)),
    )
    if (header) {
      flush()
      currentKey = header.key
      continue
    }
    if (!currentKey) {
      if (!result.about) currentKey = "about"
      else currentKey = "experience"
    }
    buffer.push(line)
  }
  flush()

  if (!Object.values(result).some((v) => v.trim()) && normalized.length > 0) {
    result.about = normalized
  }

  return result
}

export function mergeLinkedInSections(
  primary: LinkedInProfileSections,
  secondary: LinkedInProfileSections,
): LinkedInProfileSections {
  const keys = Object.keys(EMPTY_LINKEDIN_SECTIONS) as (keyof LinkedInProfileSections)[]
  const merged = { ...EMPTY_LINKEDIN_SECTIONS }
  for (const key of keys) {
    merged[key] = primary[key]?.trim() || secondary[key]?.trim() || ""
  }
  return merged
}

export function coerceLinkedInSections(
  raw: unknown,
  fallbackText?: string | null,
): LinkedInProfileSections {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    const fromObj: LinkedInProfileSections = { ...EMPTY_LINKEDIN_SECTIONS }
    for (const key of Object.keys(EMPTY_LINKEDIN_SECTIONS) as (keyof LinkedInProfileSections)[]) {
      if (typeof o[key] === "string") fromObj[key] = (o[key] as string).trim()
    }
    if (hasMeaningfulLinkedInContent(fromObj)) return fromObj
  }
  if (fallbackText?.trim()) return parseProfileTextToSections(fallbackText)
  return { ...EMPTY_LINKEDIN_SECTIONS }
}
