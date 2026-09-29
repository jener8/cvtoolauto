/**
 * Helpers when users ask the AI to compress / merge multiple experience roles.
 */

import { cvBulletPromptBlock } from "@/lib/cv-bullet-guidance"
import { cvRecruiterStrategyPromptBlock } from "@/lib/cv-recruiter-strategy-guidance"
import { cvRoleAlignmentPromptBlock } from "@/lib/cv-role-alignment-guidance"

export function isConsolidateExperienceInstruction(instruction: string): boolean {
  const m = instruction.toLowerCase()
  if (/\b(compress|consolidat|condense|collapse|shorten)\b/.test(m)) return true
  if (
    /\b(merge|combine|group|rollup|roll\s*up)\b/.test(m) &&
    /\b(role|roles|job|jobs|experience|position|entries|earlier|older)\b/.test(m)
  ) {
    return true
  }
  return false
}

const EXPERIENCE_HEADERS = new Set([
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "berufserfahrung",
  "erfahrung",
])

const OTHER_SECTION_HEADERS = new Set([
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
  "profile",
  "summary",
  "contact",
  "ausbildung",
  "fähigkeiten",
  "sprachen",
  "projekte",
  "zertifikate",
  "profil",
  "zusammenfassung",
  "kontakt",
])

function normalizeHeader(line: string): string {
  return line.trim().toLowerCase()
}

function isExperienceHeader(line: string): boolean {
  const key = normalizeHeader(line)
  for (const marker of EXPERIENCE_HEADERS) {
    if (key === marker || key.startsWith(`${marker} `)) return true
  }
  return false
}

function isOtherSectionHeader(line: string): boolean {
  const key = normalizeHeader(line)
  if (isExperienceHeader(line)) return false
  for (const marker of OTHER_SECTION_HEADERS) {
    if (key === marker || key.startsWith(`${marker} `)) return true
  }
  return /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&().-]{2,}$/.test(line.trim())
}

type JobBlock = {
  titleLine: string
  companyLine?: string
  dateLine?: string
  bullets: string[]
  otherLines: string[]
}

function splitExperienceIntoJobs(lines: string[]): JobBlock[] {
  const blocks: JobBlock[] = []
  let current: JobBlock | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      if (current) blocks.push(current)
      current = { titleLine: line, bullets: [], otherLines: [] }
      continue
    }
    if (!current) continue
    if (trimmed.startsWith("## ")) {
      current.companyLine = line
    } else if (trimmed.startsWith("### ")) {
      current.dateLine = line
    } else if (trimmed.startsWith("- ")) {
      current.bullets.push(line)
    } else if (trimmed) {
      current.otherLines.push(line)
    }
  }
  if (current) blocks.push(current)
  return blocks
}

function extractExperienceLines(cv: string): string[] {
  const lines = cv.split("\n")
  const exp: string[] = []
  let inExp = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!inExp && trimmed && isExperienceHeader(trimmed)) {
      inExp = true
      continue
    }
    if (inExp && trimmed && isOtherSectionHeader(trimmed)) break
    if (inExp) exp.push(line)
  }

  return exp
}

export function splitEmployerNames(companyLine: string): string[] {
  const text = companyLine.replace(/^##\s+/, "").trim()
  return text
    .split(/\s*&\s*|\s*,\s*|\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function employerMatches(needle: string, hay: string): boolean {
  const n = needle.toLowerCase().replace(/[^a-z0-9]/g, "")
  const h = hay.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!n || !h) return false
  if (h.includes(n) || n.includes(h)) return true
  return needle
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .some((word) => hay.toLowerCase().includes(word.toLowerCase()))
}

function collectSourceBulletsForEmployers(sourceCv: string, employers: string[]): string[] {
  const sourceJobs = splitExperienceIntoJobs(extractExperienceLines(sourceCv))
  const bullets: string[] = []

  for (const job of sourceJobs) {
    const company = job.companyLine?.replace(/^##\s+/, "").trim() ?? ""
    const title = job.titleLine.replace(/^#\s+/, "").trim()
    const matches =
      employers.length === 0 ||
      employers.some((employer) => employerMatches(employer, company) || employerMatches(employer, title))

    if (matches) bullets.push(...job.bullets)
  }

  return [...new Set(bullets)]
}

/** Fill experience entries that have title/company/dates but no bullets. */
export function ensureExperienceEntriesHaveBullets(cv: string, sourceCv: string): string {
  const lines = cv.split("\n")
  let expStart = -1
  let expEnd = lines.length

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? ""
    if (expStart < 0 && trimmed && isExperienceHeader(trimmed)) {
      expStart = i + 1
      continue
    }
    if (expStart >= 0 && trimmed && isOtherSectionHeader(trimmed)) {
      expEnd = i
      break
    }
  }

  if (expStart < 0) return cv

  const expLines = lines.slice(expStart, expEnd)
  const jobs = splitExperienceIntoJobs(expLines)
  let changed = false
  const rebuiltExp: string[] = []

  for (const job of jobs) {
    rebuiltExp.push(job.titleLine)
    if (job.companyLine) rebuiltExp.push(job.companyLine)
    if (job.dateLine) rebuiltExp.push(job.dateLine)
    rebuiltExp.push(...job.otherLines)

    if (job.bullets.length > 0) {
      rebuiltExp.push(...job.bullets)
      continue
    }

    const employers = job.companyLine ? splitEmployerNames(job.companyLine) : []
    const sourced = collectSourceBulletsForEmployers(sourceCv, employers).slice(0, 3)
    if (sourced.length > 0) {
      rebuiltExp.push(...sourced)
      changed = true
    }
  }

  if (!changed) return cv
  return [...lines.slice(0, expStart), ...rebuiltExp, ...lines.slice(expEnd)].join("\n")
}

export function buildConsolidateExperienceEditorHint(): string {
  return [
    "The user wants to COMPRESS or MERGE multiple experience entries into fewer roles.",
    "Replace the listed roles with one consolidated entry using this structure:",
    "# Collective role title (e.g. Digital Media & Visual Storytelling)",
    "## Combined employers separated by & or | (e.g. Framestore, The Walt Disney Company & Berliner Film Companie)",
    "### Combined date span covering all merged roles (e.g. 2001–2006)",
    "- 2 to 4 metric-first or accomplishment-driven bullets synthesizing impact from EVERY merged role — never leave bullets empty.",
    cvRecruiterStrategyPromptBlock("en"),
    cvRoleAlignmentPromptBlock("en"),
    cvBulletPromptBlock("en"),
    "Remove the separate entries that were merged. Keep all other experience entries unchanged.",
    "Use only facts from the current resume; you may reframe and combine but do not invent employers or projects.",
  ].join("\n")
}
