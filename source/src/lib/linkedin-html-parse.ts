import {
  EMPTY_LINKEDIN_SECTIONS,
  type LinkedInProfileSections,
} from "@/lib/linkedin-profile-types"
import {
  countPopulatedSections,
  mergeLinkedInSections,
  sectionsToGeneralCv,
} from "@/lib/linkedin-profile-sections"
import type { LinkedInSyncDebug } from "@/lib/linkedin-sync-types"

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
}

function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return raw.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown
      if (Array.isArray(parsed)) blocks.push(...parsed)
      else blocks.push(parsed)
    } catch {
      /* skip */
    }
  }
  return blocks
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

function formatJobList(items: unknown): string {
  if (!Array.isArray(items)) return ""
  const lines: string[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const job = item as Record<string, unknown>
    const title = asString(job.title ?? job.name ?? job.position)
    const company =
      asString(job.companyName) ||
      (job.company && typeof job.company === "object"
        ? asString((job.company as Record<string, unknown>).name)
        : "") ||
      (job.worksFor && typeof job.worksFor === "object"
        ? asString((job.worksFor as Record<string, unknown>).name)
        : "")
    const dates = [asString(job.startDate), asString(job.endDate)].filter(Boolean).join(" – ")
    const desc = stripHtml(asString(job.description))
    const line = [title, company, dates].filter(Boolean).join(" · ")
    if (line) lines.push(line)
    if (desc) lines.push(desc)
    lines.push("")
  }
  return lines.join("\n").trim()
}

function formatSchoolList(items: unknown): string {
  if (!Array.isArray(items)) return ""
  const lines: string[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const school = item as Record<string, unknown>
    const name = asString(school.name ?? school.schoolName)
    const degree = asString(school.degree ?? school.studyType)
    const field = asString(school.field ?? school.area)
    const dates = [asString(school.startDate), asString(school.endDate)].filter(Boolean).join(" – ")
    const line = [name, [degree, field].filter(Boolean).join(", "), dates].filter(Boolean).join(" · ")
    if (line) lines.push(line)
  }
  return lines.join("\n").trim()
}

function sectionsFromJsonLd(blocks: unknown[]): LinkedInProfileSections {
  const out = { ...EMPTY_LINKEDIN_SECTIONS }

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return
    const record = node as Record<string, unknown>
    const type = asString(record["@type"]).toLowerCase()

    if (type.includes("person") || type.includes("profilepage") || record.description || record.jobTitle) {
      if (!out.about) {
        const headline = asString(record.jobTitle ?? record.occupation)
        const desc =
          asString(record.description) ||
          asString(record.disambiguatingDescription) ||
          stripHtml(asString(record.summary))
        out.about = [headline, desc].filter(Boolean).join("\n\n")
      }

      const jobs =
        record.hasOccupation ??
        record.worksFor ??
        record.workExperience ??
        record.experience ??
        record.position
      const jobText = formatJobList(Array.isArray(jobs) ? jobs : jobs ? [jobs] : [])
      if (jobText) out.experience = out.experience ? `${out.experience}\n\n${jobText}` : jobText

      const schools = record.alumniOf ?? record.education ?? record.educationalCredential
      const eduText = formatSchoolList(Array.isArray(schools) ? schools : schools ? [schools] : [])
      if (eduText) out.education = out.education ? `${out.education}\n\n${eduText}` : eduText

      const skills = record.knowsAbout ?? record.skills
      if (Array.isArray(skills)) {
        const skillLine = skills
          .map((s) => (typeof s === "string" ? s : asString((s as Record<string, unknown>).name)))
          .filter(Boolean)
          .join(", ")
        if (skillLine) out.skills = out.skills ? `${out.skills}, ${skillLine}` : skillLine
      }

      const certs = record.hasCredential ?? record.certifications
      if (Array.isArray(certs)) {
        const certLines = certs
          .map((c) => {
            if (typeof c !== "object" || !c) return ""
            const cert = c as Record<string, unknown>
            return [asString(cert.name), asString(cert.issuedBy)].filter(Boolean).join(" · ")
          })
          .filter(Boolean)
        if (certLines.length) {
          out.certificates = out.certificates
            ? `${out.certificates}\n${certLines.join("\n")}`
            : certLines.join("\n")
        }
      }
    }

    if (Array.isArray(record["@graph"])) {
      for (const g of record["@graph"]) visit(g)
    }
  }

  for (const block of blocks) visit(block)
  return out
}

function extractMetaContent(html: string, attr: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  )
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    "i",
  )
  return decodeHtmlEntities(html.match(re)?.[1]?.trim() || html.match(alt)?.[1]?.trim() || "")
}

function extractOgAndMeta(html: string): { about: string; sources: string[] } {
  const sources: string[] = []
  const ogDesc = extractMetaContent(html, "property", "og:description")
  const ogTitle = extractMetaContent(html, "property", "og:title")
  const desc = extractMetaContent(html, "name", "description")
  const twDesc = extractMetaContent(html, "name", "twitter:description")

  const parts: string[] = []
  if (ogTitle && ogTitle.length > 3 && !/linkedin/i.test(ogTitle)) {
    parts.push(ogTitle)
    sources.push("og:title")
  }
  for (const chunk of [ogDesc, desc, twDesc]) {
    if (chunk && chunk.length > 20) {
      parts.push(chunk)
      sources.push("meta:description")
      break
    }
  }
  return { about: parts.join("\n\n"), sources }
}

function extractInlineProfileJson(html: string): {
  sections: LinkedInProfileSections
  sources: string[]
} {
  const out = { ...EMPTY_LINKEDIN_SECTIONS }
  const sources: string[] = []

  const fields: Array<{ key: keyof LinkedInProfileSections; patterns: RegExp[] }> = [
    { key: "about", patterns: [/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/] },
    { key: "about", patterns: [/"headline"\s*:\s*"((?:\\.|[^"\\])*)"/] },
    { key: "about", patterns: [/"occupation"\s*:\s*"((?:\\.|[^"\\])*)"/] },
    {
      key: "experience",
      patterns: [/"position"\s*:\s*"((?:\\.|[^"\\])*)"/g],
    },
  ]

  for (const { key, patterns } of fields) {
    for (const pattern of patterns) {
      if (pattern.global) {
        const lines: string[] = []
        let m: RegExpExecArray | null
        const global = new RegExp(pattern.source, pattern.flags)
        while ((m = global.exec(html)) !== null) {
          const val = unescapeJsonString(m[1])
          if (val.length > 2) lines.push(val)
        }
        if (lines.length) {
          out[key] = out[key] ? `${out[key]}\n${lines.join("\n")}` : lines.join("\n")
          sources.push(`inline:${key}`)
        }
      } else {
        const m = html.match(pattern)
        if (m?.[1]) {
          const val = unescapeJsonString(m[1])
          if (val) {
            out[key] = out[key] ? `${out[key]}\n\n${val}` : val
            sources.push(`inline:${key}`)
          }
        }
      }
    }
  }

  // Voyager-style position blocks
  const positionBlocks = html.matchAll(
    /"title"\s*:\s*"((?:\\.|[^"\\])*)"[^}]{0,400}?"companyName"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  )
  const jobs: string[] = []
  for (const m of positionBlocks) {
    const title = unescapeJsonString(m[1])
    const company = unescapeJsonString(m[2])
    if (title || company) jobs.push([title, company].filter(Boolean).join(" · "))
  }
  if (jobs.length) {
    out.experience = out.experience ? `${out.experience}\n\n${jobs.join("\n")}` : jobs.join("\n")
    sources.push("inline:positions")
  }

  const schoolBlocks = html.matchAll(
    /"schoolName"\s*:\s*"((?:\\.|[^"\\])*)"[^}]{0,200}?"degreeName"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  )
  const schools: string[] = []
  for (const m of schoolBlocks) {
    schools.push([unescapeJsonString(m[1]), unescapeJsonString(m[2])].filter(Boolean).join(" · "))
  }
  if (schools.length) {
    out.education = out.education ? `${out.education}\n\n${schools.join("\n")}` : schools.join("\n")
    sources.push("inline:education")
  }

  const skillBlocks = html.matchAll(/"skillName"\s*:\s*"((?:\\.|[^"\\])*)"/g)
  const skills: string[] = []
  for (const m of skillBlocks) {
    const s = unescapeJsonString(m[1])
    if (s) skills.push(s)
  }
  if (skills.length) {
    out.skills = [...new Set(skills)].join(", ")
    sources.push("inline:skills")
  }

  return { sections: out, sources }
}

export type LoginWallDetection = {
  loginWall: boolean
  reason?: string
}

export function detectLinkedInLoginWall(
  html: string,
  httpStatus: number,
): LoginWallDetection {
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 999) {
    return { loginWall: true, reason: `HTTP ${httpStatus} from LinkedIn` }
  }
  const lower = html.toLowerCase()
  if (html.length < 500) {
    return { loginWall: true, reason: "Response body too small (likely blocked)" }
  }
  if (lower.includes("authwall")) {
    return { loginWall: true, reason: "LinkedIn auth wall detected" }
  }
  if (lower.includes("join linkedin") && lower.includes("sign up")) {
    return { loginWall: true, reason: "Join/sign-up wall" }
  }
  if (lower.includes("sign in to linkedin") || lower.includes("login-card")) {
    return { loginWall: true, reason: "Sign-in prompt detected" }
  }
  if (
    lower.includes("linkedin.com/login") &&
    html.length < 100_000 &&
    !lower.includes('"@type":"person"')
  ) {
    return { loginWall: true, reason: "Redirected to login page" }
  }
  if (lower.includes("challenge-platform") || lower.includes("captcha")) {
    return { loginWall: true, reason: "Bot challenge / CAPTCHA" }
  }
  return { loginWall: false }
}

export type ParseLinkedInHtmlResult = {
  sections: LinkedInProfileSections
  profileText: string | null
  loginWall: boolean
  emptyContent: boolean
  parseFailed: boolean
  extractionSources: string[]
  loginWallReason?: string
}

export function parseLinkedInHtml(
  html: string,
  httpStatus: number,
): ParseLinkedInHtmlResult {
  const extractionSources: string[] = []
  const wall = detectLinkedInLoginWall(html, httpStatus)

  if (wall.loginWall && html.length < 2000) {
    return {
      sections: { ...EMPTY_LINKEDIN_SECTIONS },
      profileText: null,
      loginWall: true,
      emptyContent: true,
      parseFailed: false,
      extractionSources,
      loginWallReason: wall.reason,
    }
  }

  try {
    const jsonLd = sectionsFromJsonLd(extractJsonLdBlocks(html))
    if (countPopulatedSections(jsonLd) > 0) extractionSources.push("json-ld")

    const inline = extractInlineProfileJson(html)
    extractionSources.push(...inline.sources)

    const meta = extractOgAndMeta(html)
    extractionSources.push(...meta.sources)

    let sections = mergeLinkedInSections(jsonLd, inline.sections)
    if (meta.about) {
      sections = {
        ...sections,
        about: sections.about ? `${sections.about}\n\n${meta.about}` : meta.about,
      }
    }

    const profileText = sectionsToGeneralCv(sections) || meta.about || null
    const hasContent = Boolean(profileText && profileText.trim().length >= 40)
    const loginWall = wall.loginWall && !hasContent

    return {
      sections,
      profileText: hasContent ? profileText : meta.about || null,
      loginWall,
      emptyContent: !hasContent,
      parseFailed: extractionSources.length === 0 && !hasContent,
      extractionSources: [...new Set(extractionSources)],
      loginWallReason: loginWall ? wall.reason : undefined,
    }
  } catch (e) {
    return {
      sections: { ...EMPTY_LINKEDIN_SECTIONS },
      profileText: null,
      loginWall: wall.loginWall,
      emptyContent: true,
      parseFailed: true,
      extractionSources,
      loginWallReason: wall.reason ?? (e instanceof Error ? e.message : "Parse error"),
    }
  }
}

/** @deprecated Use detectLinkedInLoginWall */
export function looksLikeLinkedInBlock(html: string, status: number): boolean {
  return detectLinkedInLoginWall(html, status).loginWall
}

export function buildParseDebug(
  parsed: ParseLinkedInHtmlResult,
  httpStatus: number,
  htmlLength: number,
  attempt: number,
): LinkedInSyncDebug {
  return {
    httpStatus,
    htmlLength,
    attempt,
    loginWall: parsed.loginWall,
    emptyContent: parsed.emptyContent,
    parseFailed: parsed.parseFailed,
    populatedSections: countPopulatedSections(parsed.sections),
    extractionSources: parsed.extractionSources,
    reason: parsed.loginWallReason,
  }
}
