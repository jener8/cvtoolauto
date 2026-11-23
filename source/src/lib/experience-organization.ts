/**
 * Experience organisation for CV preview / PDF.
 *
 * - Groups consecutive roles at the same employer (employer heading once + role rails).
 * - Display order is always title → employer → dates → bullets (presentation only).
 * - Overall employment dates use the union of role ranges (no “Overall employment” copy).
 * - Does NOT auto-classify overlapping employers as independent work.
 * - Work relationship comes from `[work=…]` markers (see experience-work-modifier);
 *   PARALLEL_WORK section placement is presentation only (legacy unmarked roles still render).
 * - Markdown source stays # title / ## company / ### dates / - bullets.
 */

import { isPlausibleJobTitle } from "@/lib/import-cv-structure"
import {
  calculateEmploymentDurationMonths,
  formatEmploymentDurationLabel,
  monthsBetweenEmployment,
  parseEmploymentMonthToken,
  splitEmploymentDateRange,
  type EmploymentDurationLanguage,
  type ParsedEmploymentMonth,
} from "@/lib/employment-duration"
import { isManualPageBreakLine } from "@/lib/resume-page-breaks"
import {
  formatExperienceTitleWithWork,
  parseExperienceWorkModifier,
  type ExperienceWorkType,
} from "@/lib/experience-work-modifier"

export type ExperienceJobEntry = {
  /** Original lines for this role (title, company, dates, bullets, …). */
  lines: string[]
  /** Display title without `[work=…]` marker. */
  title: string
  company: string
  /** Raw ### date line text without hashes. */
  dateText: string
  start: ParsedEmploymentMonth | null
  end: ParsedEmploymentMonth | null | "present"
  /** Index in the original section for stable ordering. */
  sourceIndex: number
  /** Explicit `[work=…]` on the title line (standard when absent). */
  workType: ExperienceWorkType
}

export type ExperienceEmployerGroup = {
  company: string
  jobs: ExperienceJobEntry[]
  /** Inclusive tenure span across roles (union endpoints). */
  tenureStart: ParsedEmploymentMonth | null
  tenureEnd: ParsedEmploymentMonth | null | "present"
  /** Union duration in calendar months (overlaps counted once). */
  tenureMonths: number | null
  tenureDateLabel: string | null
}

function stripHashes(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").trim()
}

function normalizeCompanyKey(company: string): string {
  return company
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

function parseJobDateBounds(
  dateText: string,
  now: Date,
): {
  start: ParsedEmploymentMonth | null
  end: ParsedEmploymentMonth | null | "present"
} {
  const split = splitEmploymentDateRange(dateText)
  if (!split) return { start: null, end: null }
  const start = parseEmploymentMonthToken(split.start, { assumeMonth: 1 })
  const endRaw = parseEmploymentMonthToken(split.end, { assumeMonth: 1 })
  if (!start || start === "present" || !endRaw) return { start: null, end: null }
  return { start, end: endRaw }
}

function toSortValue(
  bound: ParsedEmploymentMonth | null | "present",
  now: Date,
  empty: number,
): number {
  if (!bound) return empty
  if (bound === "present") {
    return now.getFullYear() * 12 + (now.getMonth() + 1)
  }
  return bound.year * 12 + bound.month
}

/**
 * Union length of month ranges. Overlapping months count once.
 * Convention matches employment-duration (no +1 inclusive).
 */
export function unionTenureMonths(
  ranges: Array<{ start: ParsedEmploymentMonth; end: ParsedEmploymentMonth }>,
): number | null {
  if (ranges.length === 0) return null
  const normalized = ranges
    .map((r) => {
      const a = r.start.year * 12 + r.start.month
      const b = r.end.year * 12 + r.end.month
      return a <= b ? { a, b } : { a: b, b: a }
    })
    .sort((x, y) => x.a - y.a)

  let total = 0
  let curA = normalized[0]!.a
  let curB = normalized[0]!.b
  for (let i = 1; i < normalized.length; i++) {
    const next = normalized[i]!
    if (next.a <= curB) {
      curB = Math.max(curB, next.b)
    } else {
      total += curB - curA
      curA = next.a
      curB = next.b
    }
  }
  total += curB - curA
  return total >= 1 ? total : null
}

export function splitExperienceJobEntries(
  lines: string[],
  now: Date = new Date(),
): ExperienceJobEntry[] {
  const jobs: ExperienceJobEntry[] = []
  let current: string[] = []
  let sourceIndex = 0

  const flush = () => {
    if (current.length === 0) return
    const entry = jobEntryFromLines(current, sourceIndex, now)
    if (entry) jobs.push(entry)
    sourceIndex += 1
    current = []
  }

  const isJobTitleLine = (line: string, index: number) => {
    const t = line.trim()
    if (!t.startsWith("#") || t.startsWith("##")) return false
    return isPlausibleJobTitle(line, lines, index)
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (isManualPageBreakLine(line)) {
      flush()
      continue
    }
    if (isJobTitleLine(line, index) && current.length > 0) flush()
    current.push(line)
  }
  flush()
  return jobs
}

function jobEntryFromLines(
  lines: string[],
  sourceIndex: number,
  now: Date,
): ExperienceJobEntry | null {
  let title = ""
  let company = ""
  let dateText = ""
  let workType: ExperienceWorkType = "standard"
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith("# ") && !t.startsWith("## ")) {
      if (!title) {
        const parsed = parseExperienceWorkModifier(stripHashes(t))
        title = parsed.text
        workType = parsed.workType
      }
    } else if (t.startsWith("## ") && !t.startsWith("### ")) {
      if (!company) company = stripHashes(t)
    } else if (t.startsWith("### ")) {
      if (!dateText) dateText = stripHashes(t)
    }
  }
  if (!title && !company) return null
  const { start, end } = parseJobDateBounds(dateText, now)
  return {
    lines,
    title: title || "Role",
    company: company || "",
    dateText,
    start,
    end,
    sourceIndex,
    workType,
  }
}

function resolveEndMonth(
  end: ParsedEmploymentMonth | null | "present",
  now: Date,
): ParsedEmploymentMonth | null {
  if (!end) return null
  if (end === "present") {
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  return end
}

export function formatTenureRangeLabel(
  start: ParsedEmploymentMonth | null,
  end: ParsedEmploymentMonth | null | "present",
  language: EmploymentDurationLanguage,
): string | null {
  if (!start) return null
  const monthNamesEn = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  const monthNamesDe = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ]
  const names = language === "de" ? monthNamesDe : monthNamesEn
  const startLabel = `${names[start.month - 1]} ${start.year}`
  const endLabel =
    end === "present"
      ? language === "de"
        ? "Heute"
        : "Present"
      : end
        ? `${names[end.month - 1]} ${end.year}`
        : null
  if (!endLabel) return null
  return `${startLabel} – ${endLabel}`
}

/**
 * Employer heading for grouped roles: "Company · Location" when the company
 * line stores a comma-separated location. Does not invent location text.
 */
export function formatEmployerDisplayName(company: string): string {
  const raw = company.trim()
  if (!raw) return ""
  const comma = raw.indexOf(",")
  if (comma <= 0) return raw
  const name = raw.slice(0, comma).trim()
  const location = raw.slice(comma + 1).trim()
  if (!name || !location) return raw
  return `${name} · ${location}`
}

/** Overall employment dates for the employer heading (no duration, no label copy). */
export function overallEmploymentDateLabel(
  group: ExperienceEmployerGroup,
  language: EmploymentDurationLanguage = "en",
): string | null {
  return formatTenureRangeLabel(group.tenureStart, group.tenureEnd, language)
}

function finalizeEmployerGroup(
  jobs: ExperienceJobEntry[],
  language: EmploymentDurationLanguage,
  now: Date,
): ExperienceEmployerGroup {
  const groupJobs = [...jobs].sort((a, b) => {
    const endDiff = toSortValue(b.end, now, 0) - toSortValue(a.end, now, 0)
    if (endDiff !== 0) return endDiff
    return toSortValue(b.start, now, 0) - toSortValue(a.start, now, 0)
  })

  const company = groupJobs.find((j) => j.company)?.company ?? ""
  let tenureStart: ParsedEmploymentMonth | null = null
  let tenureEnd: ParsedEmploymentMonth | null | "present" = null
  const ranges: Array<{ start: ParsedEmploymentMonth; end: ParsedEmploymentMonth }> = []

  for (const job of groupJobs) {
    if (job.start) {
      if (
        !tenureStart ||
        job.start.year * 12 + job.start.month <
          tenureStart.year * 12 + tenureStart.month
      ) {
        tenureStart = job.start
      }
    }
    if (job.end === "present") {
      tenureEnd = "present"
    } else if (job.end) {
      if (
        tenureEnd !== "present" &&
        (!tenureEnd ||
          job.end.year * 12 + job.end.month > tenureEnd.year * 12 + tenureEnd.month)
      ) {
        tenureEnd = job.end
      }
    }
    const endMonth = resolveEndMonth(job.end, now)
    if (job.start && endMonth) {
      ranges.push({ start: job.start, end: endMonth })
    }
  }

  const tenureMonths = unionTenureMonths(ranges)
  const rangeLabel = formatTenureRangeLabel(tenureStart, tenureEnd, language)
  let tenureDateLabel: string | null = rangeLabel
  if (rangeLabel && tenureMonths != null) {
    const dur = formatEmploymentDurationLabel(tenureMonths, language)
    tenureDateLabel = dur ? `${rangeLabel} (${dur})` : rangeLabel
  }

  return {
    company,
    jobs: groupJobs,
    tenureStart,
    tenureEnd,
    tenureMonths,
    tenureDateLabel,
  }
}

/**
 * Group consecutive roles that share the same employer.
 * Non-adjacent same-employer roles stay separate (do not jump unrelated jobs).
 * Roles without a company stay as singleton groups.
 * Within a multi-role group, roles sort newest-first. Groups sort by latest end.
 */
export function groupExperienceByEmployer(
  jobs: ExperienceJobEntry[],
  options?: {
    language?: EmploymentDurationLanguage
    now?: Date
  },
): ExperienceEmployerGroup[] {
  const language = options?.language ?? "en"
  const now = options?.now ?? new Date()

  type Draft = { key: string; jobs: ExperienceJobEntry[] }
  const drafts: Draft[] = []

  for (const job of jobs) {
    const key = job.company
      ? normalizeCompanyKey(job.company)
      : `__solo_${job.sourceIndex}`
    const last = drafts[drafts.length - 1]
    if (last && job.company && last.key === key) {
      last.jobs.push(job)
    } else {
      drafts.push({ key, jobs: [job] })
    }
  }

  const groups = drafts.map((d) => finalizeEmployerGroup(d.jobs, language, now))

  // Sort company groups by latest end, then earliest start (long tenure first when both Present)
  groups.sort((a, b) => {
    const endDiff =
      toSortValue(b.tenureEnd, now, 0) - toSortValue(a.tenureEnd, now, 0)
    if (endDiff !== 0) return endDiff
    return (
      toSortValue(a.tenureStart, now, Number.MAX_SAFE_INTEGER) -
      toSortValue(b.tenureStart, now, Number.MAX_SAFE_INTEGER)
    )
  })

  return groups
}

export function organizeExperienceLines(
  lines: string[],
  options?: { language?: EmploymentDurationLanguage; now?: Date },
): ExperienceEmployerGroup[] {
  return groupExperienceByEmployer(splitExperienceJobEntries(lines, options?.now), options)
}

/** True when at least one employer has 2+ roles (grouping worth applying). */
export function shouldGroupExperienceByEmployer(groups: ExperienceEmployerGroup[]): boolean {
  return groups.some((g) => g.jobs.length > 1 && g.company)
}

/**
 * Detect overlapping date ranges across different employers.
 * Hint only — never auto-moves content into Parallel Independent Work.
 */
export function findOverlappingEmployerPairs(
  jobs: ExperienceJobEntry[],
  now: Date = new Date(),
): Array<{ a: string; b: string }> {
  const withBounds = jobs
    .map((job) => {
      const end = resolveEndMonth(job.end, now)
      if (!job.start || !end || !job.company) return null
      return {
        company: job.company,
        key: normalizeCompanyKey(job.company),
        a: job.start.year * 12 + job.start.month,
        b: end.year * 12 + end.month,
      }
    })
    .filter(Boolean) as Array<{ company: string; key: string; a: number; b: number }>

  const pairs: Array<{ a: string; b: string }> = []
  const seen = new Set<string>()
  for (let i = 0; i < withBounds.length; i++) {
    for (let j = i + 1; j < withBounds.length; j++) {
      const x = withBounds[i]!
      const y = withBounds[j]!
      if (x.key === y.key) continue
      if (x.a <= y.b && y.a <= x.b) {
        const id = [x.key, y.key].sort().join("|")
        if (seen.has(id)) continue
        seen.add(id)
        pairs.push({ a: x.company, b: y.company })
      }
    }
  }
  return pairs
}

/**
 * Build suggested Markdown: group same-employer roles in EXPERIENCE and
 * optionally move named companies into PARALLEL INDEPENDENT WORK.
 * Does not invent content; only reorders existing job blocks.
 */
export function rebuildExperienceMarkdown(options: {
  experienceLines: string[]
  parallelCompanyKeys?: string[]
  language?: EmploymentDurationLanguage
  now?: Date
}): { experienceLines: string[]; parallelLines: string[]; movedCompanies: string[] } {
  const now = options.now ?? new Date()
  const jobs = splitExperienceJobEntries(options.experienceLines, now)
  const parallelKeys = new Set(
    (options.parallelCompanyKeys ?? []).map((k) => normalizeCompanyKey(k)),
  )

  const primaryJobs = jobs.filter(
    (j) => !j.company || !parallelKeys.has(normalizeCompanyKey(j.company)),
  )
  const parallelJobs = jobs.filter(
    (j) => j.company && parallelKeys.has(normalizeCompanyKey(j.company)),
  )

  const toLines = (list: ExperienceJobEntry[]) => {
    const groups = groupExperienceByEmployer(list, {
      language: options.language,
      now,
    })
    const out: string[] = []
    for (const group of groups) {
      for (const job of group.jobs) {
        if (out.length > 0) out.push("")
        out.push(...job.lines)
      }
    }
    return out
  }

  return {
    experienceLines: toLines(primaryJobs),
    parallelLines: toLines(parallelJobs),
    movedCompanies: [
      ...new Set(parallelJobs.map((j) => j.company).filter(Boolean)),
    ],
  }
}

/** Role date line for grouped display — optional per-role duration. */
export function formatRoleDateForGroup(
  dateText: string,
  options?: {
    showDuration?: boolean
    language?: EmploymentDurationLanguage
    now?: Date
  },
): string {
  const text = dateText.trim()
  if (!text || !options?.showDuration) return text
  const months = calculateEmploymentDurationMonths(text, options.now)
  if (months == null) return text
  const label = formatEmploymentDurationLabel(months, options.language ?? "en")
  return label ? `${text} (${label})` : text
}

function isJobTitleMarkupLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith("# ") && !t.startsWith("## ")
}

function isCompanyMarkupLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith("## ") && !t.startsWith("### ")
}

function isDateMarkupLine(line: string): boolean {
  return line.trim().startsWith("### ")
}

/**
 * Canonical Experience display order for one role:
 * job title → employer → dates → bullets / other body.
 * Presentation only — does not mutate stored markdown.
 */
export function orderExperienceRoleDisplayLines(lines: string[]): string[] {
  const titles: string[] = []
  const companies: string[] = []
  const dates: string[] = []
  const rest: string[] = []
  for (const line of lines) {
    if (isJobTitleMarkupLine(line)) titles.push(line)
    else if (isCompanyMarkupLine(line)) companies.push(line)
    else if (isDateMarkupLine(line)) dates.push(line)
    else rest.push(line)
  }
  return [...titles, ...companies, ...dates, ...rest]
}

/**
 * Role lines for the accent rail: title → dates → bullets.
 * Employer is never included here — it renders above/outside the rail.
 * Roles with no company keep title → dates → bullets (no ## company line).
 */
export function buildEmployerGroupRoleBlocks(
  group: ExperienceEmployerGroup,
): string[][] {
  const blocks: string[][] = []
  for (const job of group.jobs) {
    const roleLines: string[] = []
    const workType: ExperienceWorkType = job.workType ?? "standard"
    roleLines.push(`# ${formatExperienceTitleWithWork(job.title, workType)}`)
    if (job.dateText) {
      roleLines.push(`### ${job.dateText}`)
    }
    for (const line of job.lines) {
      const t = line.trim()
      if (isJobTitleMarkupLine(line)) continue
      if (isCompanyMarkupLine(line)) continue
      if (isDateMarkupLine(line)) continue
      if (!t && roleLines.length > 0 && !roleLines[roleLines.length - 1]!.trim()) {
        continue
      }
      roleLines.push(line)
    }
    blocks.push(roleLines)
  }
  return blocks
}

/**
 * @deprecated Prefer buildEmployerGroupRoleBlocks — employer always renders separately.
 * Kept for callers; same role blocks (no company lines).
 */
export function buildEmployerGroupDisplayBlocks(
  group: ExperienceEmployerGroup,
): string[][] {
  return buildEmployerGroupRoleBlocks(group)
}

/** True when this group has 2+ roles at one employer. */
export function isMultiRoleEmployerGroup(group: ExperienceEmployerGroup): boolean {
  return group.jobs.length > 1 && Boolean(group.company?.trim())
}

/** True when an employer heading should sit above the role rail(s). */
export function hasEmployerHeading(group: ExperienceEmployerGroup): boolean {
  return Boolean(group.company?.trim())
}

export { normalizeCompanyKey, monthsBetweenEmployment }
