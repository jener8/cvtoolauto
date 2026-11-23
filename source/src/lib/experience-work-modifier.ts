/**
 * Per-role work relationship for Experience entries.
 *
 * Classification (source of truth): optional `[work=…]` on a `#` title line.
 * Presentation: within EXPERIENCE (icon + label) or a separate Independent Work section.
 *
 * Section placement does not define the relationship. Unmarked roles already under
 * PARALLEL INDEPENDENT WORK still render as parallel-independent for backward compatibility.
 * Independent of the Career Evolution graph (which may summarise parallel work).
 */

import { parseResumeText, serializeParsedResumeSections } from "@/lib/parse-resume-text"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"
import {
  findOverlappingEmployerPairs,
  normalizeCompanyKey,
  splitExperienceJobEntries,
  type ExperienceJobEntry,
} from "@/lib/experience-organization"

/** Classification of an experience entry (nature of the work). */
export type ExperienceWorkRelationship =
  | "standard"
  | "parallel-independent"
  | "parallel-consulting"

/** @deprecated Prefer ExperienceWorkRelationship — kept for existing imports. */
export type ExperienceWorkType = ExperienceWorkRelationship

/** Where a parallel role appears on the CV (same underlying entry). */
export type ExperienceWorkPresentation =
  | "within-experience"
  | "separate-section"

const WORK_MODIFIER_RE =
  /[\[\uFF3B【]\s*work\s*=\s*([a-z0-9_-]+)\s*[\]\uFF3D】]/i

const PARALLEL_SECTION_TITLE_EN = "PARALLEL INDEPENDENT WORK"
const PARALLEL_SECTION_TITLE_DE = "NEBENBERUFLICHE TÄTIGKEIT"

function normalizeModifierSpaces(raw: string): string {
  return raw
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u2060\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Local copy of dash normalisation — avoid importing resume-markup-line (cycle). */
function normalizeTitleDashes(line: string): string {
  return line
    .replace(/[\u00A0\u2003\u2002\u2009\u200B\u202F\uFEFF]/g, " ")
    .replace(/[–—―‐‑‒−]/g, "-")
}

function canonicalizeWorkToken(raw: string): ExperienceWorkRelationship {
  const t = raw.trim().toLowerCase().replace(/_/g, "-")
  if (
    t === "parallel-independent" ||
    t === "independent" ||
    t === "parallel-independent-work"
  ) {
    return "parallel-independent"
  }
  if (
    t === "parallel-consulting" ||
    t === "consulting" ||
    t === "freelance" ||
    t === "parallel-freelance" ||
    t === "contractor"
  ) {
    return "parallel-consulting"
  }
  return "standard"
}

/** Parse optional `[work=…]` on a job title (display text already hash-stripped). */
export function parseExperienceWorkModifier(raw: string): {
  text: string
  workType: ExperienceWorkRelationship
  workRelationship: ExperienceWorkRelationship
} {
  const trimmed = normalizeModifierSpaces(raw)
  const match = trimmed.match(WORK_MODIFIER_RE)
  if (!match) {
    return { text: trimmed, workType: "standard", workRelationship: "standard" }
  }
  const workRelationship = canonicalizeWorkToken(match[1] || "standard")
  const text = trimmed.replace(WORK_MODIFIER_RE, "").replace(/\s+/g, " ").trim()
  return { text, workType: workRelationship, workRelationship }
}

export function stripExperienceWorkModifier(raw: string): string {
  return parseExperienceWorkModifier(raw).text
}

export function experienceWorkModifierToken(
  workRelationship: ExperienceWorkRelationship,
): string | null {
  if (workRelationship === "standard") return null
  return `[work=${workRelationship}]`
}

/** Build display title text with optional work marker for Markdown source. */
export function formatExperienceTitleWithWork(
  title: string,
  workRelationship: ExperienceWorkRelationship,
): string {
  const clean = stripExperienceWorkModifier(title).trim()
  const token = experienceWorkModifierToken(workRelationship)
  return token ? `${clean} ${token}` : clean
}

export function experienceWorkTypeLabel(
  workRelationship: ExperienceWorkRelationship,
  language: "en" | "de" = "en",
): string {
  if (workRelationship === "parallel-independent") {
    return language === "de"
      ? "Parallele unabhängige Tätigkeit"
      : "Parallel independent work"
  }
  if (workRelationship === "parallel-consulting") {
    return language === "de"
      ? "Parallele Beratung / Freelance"
      : "Parallel consulting or freelance work"
  }
  return language === "de" ? "Anstellung" : "Standard employment"
}

export function experienceWorkPresentationLabel(
  presentation: ExperienceWorkPresentation,
  language: "en" | "de" = "en",
): string {
  if (presentation === "separate-section") {
    return language === "de"
      ? "Eigener Abschnitt „Unabhängige Arbeit“"
      : "Separate Independent Work section"
  }
  return language === "de"
    ? "Innerhalb von Experience (Icon + Label)"
    : "Within Experience (icon + label)"
}

export function isParallelExperienceWorkType(
  workRelationship: ExperienceWorkRelationship | null | undefined,
): boolean {
  return (
    workRelationship === "parallel-independent" ||
    workRelationship === "parallel-consulting"
  )
}

/**
 * Resolve effective work relationship for rendering.
 * Classification comes from the `[work=…]` marker.
 * Legacy only: unmarked roles already under PARALLEL_WORK still render as
 * parallel-independent so existing CVs keep working — section placement alone
 * is not a classification mechanism for new edits.
 */
export function resolveExperienceWorkType(options: {
  lineWorkType?: ExperienceWorkRelationship
  workRelationship?: ExperienceWorkRelationship
  sectionIsParallelWork?: boolean
}): ExperienceWorkRelationship {
  const line =
    options.workRelationship ?? options.lineWorkType ?? "standard"
  if (line !== "standard") return line
  if (options.sectionIsParallelWork) return "parallel-independent"
  return "standard"
}

export const resolveExperienceWorkRelationship = resolveExperienceWorkType

/** Inline Lucide-style git-merge icon (print-safe SVG). */
export function gitMergeIconSvg(accentColor: string, size = 12): string {
  const c = accentColor.replace(/"/g, "")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="display:inline-block;vertical-align:-0.15em;flex-shrink:0;"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>`
}

/**
 * Visual badge (icon + readable label) for Standard / High PDF & preview.
 * ATS modes should use `formatParallelWorkAtsSuffix` instead.
 */
export function renderParallelWorkBadgeHtml(options: {
  workType: ExperienceWorkRelationship
  accentColor: string
  language?: "en" | "de"
  fontSizePx?: number
}): string {
  if (!isParallelExperienceWorkType(options.workType)) return ""
  const label = experienceWorkTypeLabel(
    options.workType,
    options.language === "de" ? "de" : "en",
  )
  const accent = options.accentColor || "#0f7b6c"
  const fontSize = Math.max(9, Math.round((options.fontSizePx ?? 14) * 0.72))
  const icon = gitMergeIconSvg(accent, Math.max(11, fontSize))
  return `<span class="cv-parallel-work-badge" data-parallel-work="${options.workType}" style="display:inline-flex;align-items:center;gap:5px;margin-left:8px;vertical-align:middle;color:${accent};font-size:${fontSize}px;font-weight:500;letter-spacing:0.01em;text-transform:none;font-style:normal;white-space:nowrap;">${icon}<span>${escapeBasic(label)}</span></span>`
}

/** Plain-text suffix for ATS Optimized export (no icon). */
export function formatParallelWorkAtsSuffix(
  workType: ExperienceWorkRelationship,
  language: "en" | "de" = "en",
): string {
  if (!isParallelExperienceWorkType(workType)) return ""
  return ` (${experienceWorkTypeLabel(workType, language)})`
}

function escapeBasic(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type ExperienceRoleEditorItem = {
  id: string
  sectionKey: string
  sectionTitle: string
  title: string
  company: string
  dateText: string
  /** Nature of the work (classification). */
  workRelationship: ExperienceWorkRelationship
  /** @deprecated Alias of workRelationship. */
  workType: ExperienceWorkRelationship
  /** Where the role appears — same underlying entry. */
  presentation: ExperienceWorkPresentation
  /** Overlaps another employer — suggest parallel, never auto-apply. */
  overlapSuggested: boolean
  overlapWith?: string
  /** Index among jobs in that section (stable for apply). */
  jobIndex: number
}

function presentationFromSectionKey(sectionKey: string): ExperienceWorkPresentation {
  return sectionKey === "PARALLEL_WORK" ? "separate-section" : "within-experience"
}

/** List EXPERIENCE + PARALLEL_WORK roles for the editor panel. */
export function listExperienceRolesForEditor(
  resumeText: string,
): ExperienceRoleEditorItem[] {
  const sections = parseResumeText(resumeText)
  const items: ExperienceRoleEditorItem[] = []
  const allJobs: Array<{
    job: ExperienceJobEntry
    sectionKey: string
    sectionTitle: string
    sectionIsParallel: boolean
    jobIndex: number
  }> = []

  for (const section of sections) {
    const key = normalizeCvSectionKey(stripSectionColumnModifier(section.title))
    if (key !== "EXPERIENCE" && key !== "PARALLEL_WORK") continue
    const sectionIsParallel = key === "PARALLEL_WORK"
    const jobs = splitExperienceJobEntries(section.content)
    jobs.forEach((job, jobIndex) => {
      allJobs.push({
        job,
        sectionKey: key,
        sectionTitle: stripSectionColumnModifier(section.title).trim(),
        sectionIsParallel,
        jobIndex,
      })
    })
  }

  const flat = allJobs.map((x) => x.job)
  const overlapByCompany = new Map<string, string>()
  for (const pair of findOverlappingEmployerPairs(flat)) {
    const ka = normalizeCompanyKey(pair.a)
    const kb = normalizeCompanyKey(pair.b)
    if (!overlapByCompany.has(ka)) overlapByCompany.set(ka, pair.b)
    if (!overlapByCompany.has(kb)) overlapByCompany.set(kb, pair.a)
  }

  for (const row of allJobs) {
    const parsed = parseExperienceWorkModifier(row.job.title)
    const lineType = row.job.workType ?? parsed.workRelationship
    const workRelationship = resolveExperienceWorkRelationship({
      workRelationship: lineType,
      sectionIsParallelWork: row.sectionIsParallel,
    })
    const companyKey = row.job.company
      ? normalizeCompanyKey(row.job.company)
      : ""
    const overlapWith = companyKey ? overlapByCompany.get(companyKey) : undefined
    const alreadyParallel = isParallelExperienceWorkType(workRelationship)
    const peerJob = overlapWith
      ? flat.find((j) => normalizeCompanyKey(j.company) === normalizeCompanyKey(overlapWith))
      : undefined
    // Suggest only on the likely concurrent independent/consulting activity —
    // never nag primary employment solely because a side project overlaps.
    const overlapSuggested =
      Boolean(overlapWith) &&
      !alreadyParallel &&
      shouldSuggestParallelForOverlap(row.job, peerJob)
    items.push({
      id: `${row.sectionKey}:${row.jobIndex}:${parsed.text}:${row.job.company}`,
      sectionKey: row.sectionKey,
      sectionTitle: row.sectionTitle,
      title: parsed.text || row.job.title,
      company: row.job.company,
      dateText: row.job.dateText,
      workRelationship,
      workType: workRelationship,
      presentation: presentationFromSectionKey(row.sectionKey),
      overlapSuggested,
      overlapWith,
      jobIndex: row.jobIndex,
    })
  }

  return items
}

/** Heuristic: founder / consulting / portfolio-style roles are suggestion targets. */
export function looksLikeParallelWorkCandidate(job: {
  title: string
  company: string
}): boolean {
  const blob = `${job.title} ${job.company}`.toLowerCase()
  return /founder|co-?founder|freelance|consult|independent|contractor|self-?employ|portfolio|side\s*project|\.tools\b|\.io\b|\.dev\b|studio\b|agency\b/.test(
    blob,
  )
}

function shouldSuggestParallelForOverlap(
  job: ExperienceJobEntry,
  peer: ExperienceJobEntry | undefined,
): boolean {
  if (looksLikeParallelWorkCandidate(job)) return true
  if (peer && looksLikeParallelWorkCandidate(peer)) return false
  // Ambiguous overlap between two standard-looking roles — do not auto-nudge.
  return false
}

/** Stable key for UI state (survives en-dash normalisation and work markers). */
export function experienceRoleStableKey(role: {
  title: string
  company: string
}): string {
  const title = normalizeTitleDashes(stripExperienceWorkModifier(role.title))
    .trim()
    .toLowerCase()
  const company = role.company.trim().toLowerCase()
  return `${title}::${company}`
}

function titleKey(raw: string): string {
  return normalizeTitleDashes(stripExperienceWorkModifier(raw)).trim().toLowerCase()
}

function matchJobInList(
  jobs: ExperienceJobEntry[],
  target: {
    title: string
    company: string
    jobIndex: number
  },
): ExperienceJobEntry | null {
  const expectedTitle = titleKey(target.title)
  const expectedCompany = target.company.trim().toLowerCase()

  // Prefer index + title (+ company when present)
  const atIndex = jobs[target.jobIndex]
  if (atIndex && titleKey(atIndex.title) === expectedTitle) {
    if (
      !expectedCompany ||
      atIndex.company.trim().toLowerCase() === expectedCompany
    ) {
      return atIndex
    }
  }

  const byTitleCompany = jobs.find(
    (j) =>
      titleKey(j.title) === expectedTitle &&
      j.company.trim().toLowerCase() === expectedCompany,
  )
  if (byTitleCompany) return byTitleCompany

  // Last resort: unique title match
  const titleMatches = jobs.filter((j) => titleKey(j.title) === expectedTitle)
  if (titleMatches.length === 1) return titleMatches[0]!
  return null
}

/** Replace one job’s lines inside a section’s content (parse-normalized). */
function replaceJobLinesInContent(
  content: string[],
  oldLines: string[],
  newLines: string[],
): string[] {
  if (oldLines.length === 0) return content
  const next = [...content]
  for (let i = 0; i <= next.length - oldLines.length; i++) {
    const slice = next.slice(i, i + oldLines.length)
    if (linesEqualIgnoringTrailingSpace(slice, oldLines)) {
      next.splice(i, oldLines.length, ...newLines)
      return next
    }
  }
  // Fallback: locate by title identity, then replace through next job title
  const oldTitle = oldLines.find((l) => {
    const t = normalizeTitleDashes(l).trim()
    return t.startsWith("# ") && !t.startsWith("## ")
  })
  const newTitle = newLines.find((l) => {
    const t = normalizeTitleDashes(l).trim()
    return t.startsWith("# ") && !t.startsWith("## ")
  })
  if (!oldTitle || !newTitle) return content
  const want = jobTitleIdentity(oldTitle)
  if (!want) return content
  const start = next.findIndex((l) => jobTitleIdentity(l) === want)
  if (start < 0) return content
  let end = start + 1
  while (end < next.length) {
    const t = normalizeTitleDashes(next[end]!).trim()
    if (t.startsWith("# ") && !t.startsWith("## ")) break
    end += 1
  }
  next.splice(start, end - start, ...newLines)
  return next
}

function withUpdatedTitleMarker(
  jobLines: string[],
  workRelationship: ExperienceWorkRelationship,
): string[] {
  return jobLines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("# ") || trimmed.startsWith("## ")) return line
    const prefixMatch = line.match(/^(\s*)/)
    const indent = prefixMatch?.[1] ?? ""
    const body = trimmed.replace(/^#\s+/, "")
    const { text } = parseExperienceWorkModifier(body)
    return `${indent}# ${formatExperienceTitleWithWork(text, workRelationship)}`
  })
}

function linesEqualIgnoringTrailingSpace(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((line, i) => line.trimEnd() === (b[i] ?? "").trimEnd())
}

function removeJobLinesFromContent(
  content: string[],
  jobLines: string[],
): string[] {
  if (jobLines.length === 0) return content
  const next = [...content]
  for (let i = 0; i <= next.length - jobLines.length; i++) {
    const slice = next.slice(i, i + jobLines.length)
    if (linesEqualIgnoringTrailingSpace(slice, jobLines)) {
      next.splice(i, jobLines.length)
      // Trim excess blank lines left behind
      while (i < next.length && next[i]!.trim() === "") next.splice(i, 1)
      if (i > 0 && next[i - 1]!.trim() === "" && (i >= next.length || next[i]!.trim() === "")) {
        next.splice(i - 1, 1)
      }
      return next
    }
  }
  // Fallback: remove by first title line only then until next job title
  const titleLine = jobLines.find((l) => {
    const t = l.trim()
    return t.startsWith("# ") && !t.startsWith("## ")
  })
  if (!titleLine) return content
  const start = next.findIndex((l) => l.trim() === titleLine.trim())
  if (start < 0) return content
  let end = start + 1
  while (end < next.length) {
    const t = next[end]!.trim()
    if (t.startsWith("# ") && !t.startsWith("## ")) break
    end += 1
  }
  next.splice(start, end - start)
  return next
}

function ensureParallelSectionTitle(language: "en" | "de"): string {
  return language === "de" ? PARALLEL_SECTION_TITLE_DE : PARALLEL_SECTION_TITLE_EN
}

/**
 * Set `[work=…]` on the matching role’s `#` title line.
 * Does not change dates, company, bullets, or section placement.
 */
export function setExperienceWorkTypeInResumeText(
  resumeText: string,
  target: {
    sectionKey: string
    title: string
    company: string
    jobIndex: number
  },
  workType: ExperienceWorkRelationship,
): string {
  const sections = parseResumeText(resumeText)
  const section = sections.find(
    (s) =>
      normalizeCvSectionKey(stripSectionColumnModifier(s.title)) ===
      target.sectionKey,
  )
  if (!section) return resumeText

  const jobs = splitExperienceJobEntries(section.content)
  const job = matchJobInList(jobs, target)
  if (!job) return resumeText

  return applyWorkTypeToJobLines(resumeText, job.lines, workType)
}

export const setExperienceWorkRelationshipInResumeText =
  setExperienceWorkTypeInResumeText

/**
 * Apply classification + presentation in one confirmed editor action.
 * Moves the role between EXPERIENCE and PARALLEL INDEPENDENT WORK when needed.
 * Never duplicates the entry; does not invent content.
 */
export function applyExperienceRoleSettings(
  resumeText: string,
  target: {
    sectionKey: string
    title: string
    company: string
    jobIndex: number
  },
  settings: {
    workRelationship: ExperienceWorkRelationship
    presentation: ExperienceWorkPresentation
    language?: "en" | "de"
  },
): string {
  let relationship = settings.workRelationship
  let presentation = settings.presentation

  // Standard employment always lives in Experience
  if (relationship === "standard") {
    presentation = "within-experience"
  }
  // Separate section implies a parallel classification
  if (
    presentation === "separate-section" &&
    relationship === "standard"
  ) {
    relationship = "parallel-independent"
  }

  const desiredSectionKey =
    presentation === "separate-section" ? "PARALLEL_WORK" : "EXPERIENCE"

  const sections = parseResumeText(resumeText)
  const sourceIndex = sections.findIndex(
    (s) =>
      normalizeCvSectionKey(stripSectionColumnModifier(s.title)) ===
      target.sectionKey,
  )
  if (sourceIndex < 0) return resumeText

  const source = sections[sourceIndex]!
  const jobs = splitExperienceJobEntries(source.content)
  const job = matchJobInList(jobs, target)
  if (!job) return resumeText

  const updatedJobLines = withUpdatedTitleMarker(job.lines, relationship)

  // Same section: rewrite job lines in parsed content, then serialize.
  // Avoids fragile raw-string title matching against en-dash / normalised sources.
  if (target.sectionKey === desiredSectionKey) {
    if (linesEqualIgnoringTrailingSpace(job.lines, updatedJobLines)) {
      return resumeText
    }
    const nextSections = sections.map((s, i) => {
      if (i !== sourceIndex) return { ...s, content: [...s.content] }
      return {
        ...s,
        content: replaceJobLinesInContent(s.content, job.lines, updatedJobLines),
      }
    })
    const serialized = serializeParsedResumeSections(nextSections)
    if (serialized === resumeText) {
      // Serializer no-op (e.g. already equivalent) — try direct line rewrite
      return applyWorkTypeToJobLines(resumeText, job.lines, relationship)
    }
    return serialized
  }

  // Move: remove from source, append to destination (create section if needed)
  const nextSections = sections.map((s) => ({
    ...s,
    content: [...s.content],
  }))

  const src = nextSections[sourceIndex]!
  src.content = removeJobLinesFromContent(src.content, job.lines)

  let destIndex = nextSections.findIndex(
    (s) =>
      normalizeCvSectionKey(stripSectionColumnModifier(s.title)) ===
      desiredSectionKey,
  )

  if (destIndex < 0) {
    const title =
      desiredSectionKey === "PARALLEL_WORK"
        ? ensureParallelSectionTitle(settings.language === "de" ? "de" : "en")
        : "EXPERIENCE"
    const insertAt =
      desiredSectionKey === "PARALLEL_WORK"
        ? (() => {
            const expIdx = nextSections.findIndex(
              (s) =>
                normalizeCvSectionKey(stripSectionColumnModifier(s.title)) ===
                "EXPERIENCE",
            )
            return expIdx >= 0 ? expIdx + 1 : sourceIndex + 1
          })()
        : Math.max(0, sourceIndex)
    nextSections.splice(insertAt, 0, {
      title,
      content: [],
    })
    destIndex = insertAt
    // sourceIndex may have shifted if we inserted before it
    if (insertAt <= sourceIndex) {
      // source moved down by 1 — already copied content before insert; find again
    }
  }

  const dest = nextSections[destIndex]!
  if (dest.content.length > 0 && dest.content[dest.content.length - 1]!.trim() !== "") {
    dest.content.push("")
  }
  dest.content.push(...updatedJobLines)

  // Drop empty PARALLEL_WORK section after move-out
  const cleaned = nextSections.filter((s) => {
    const key = normalizeCvSectionKey(stripSectionColumnModifier(s.title))
    if (key === "PARALLEL_WORK") {
      return s.content.some((line) => line.trim().length > 0)
    }
    return true
  })

  return serializeParsedResumeSections(cleaned)
}

/**
 * Identity for a `#` job title line after dash normalisation and marker strip.
 * Needed because parseResumeText normalises en-dashes in section content while
 * the live resumeText may still contain Unicode dashes — exact string replace fails.
 */
function jobTitleIdentity(line: string): string | null {
  const normalized = normalizeTitleDashes(line).trim()
  if (!normalized.startsWith("# ") || normalized.startsWith("## ")) return null
  return parseExperienceWorkModifier(normalized.replace(/^#\s+/, ""))
    .text.trim()
    .toLowerCase()
}

function applyWorkTypeToJobLines(
  resumeText: string,
  jobLines: string[],
  workType: ExperienceWorkRelationship,
): string {
  const titleLine = jobLines.find((l) => {
    const t = normalizeTitleDashes(l).trim()
    return t.startsWith("# ") && !t.startsWith("## ")
  })
  if (!titleLine) return resumeText

  const identity = jobTitleIdentity(titleLine)
  if (!identity) return resumeText

  // Prefer company-aware match when the job block includes ## company
  const companyLine = jobLines.find((l) => {
    const t = normalizeTitleDashes(l).trim()
    return t.startsWith("## ") && !t.startsWith("### ")
  })
  const companyKey = companyLine
    ? normalizeTitleDashes(companyLine)
        .trim()
        .replace(/^##\s+/, "")
        .toLowerCase()
    : ""

  const lines = resumeText.replace(/\r\n/g, "\n").split("\n")
  let matchAt = -1
  for (let i = 0; i < lines.length; i++) {
    if (jobTitleIdentity(lines[i]!) !== identity) continue
    if (companyKey) {
      // Look ahead a few lines for matching company
      let foundCompany = false
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const t = normalizeTitleDashes(lines[j]!).trim()
        if (t.startsWith("# ") && !t.startsWith("## ")) break
        if (t.startsWith("## ") && !t.startsWith("### ")) {
          const c = t.replace(/^##\s+/, "").toLowerCase()
          if (c === companyKey) foundCompany = true
          break
        }
      }
      if (!foundCompany) continue
    }
    matchAt = i
    break
  }
  if (matchAt < 0) return resumeText

  const line = lines[matchAt]!
  const indent = line.match(/^(\s*)/)?.[1] ?? ""
  const body = line.trim().replace(/^#\s+/, "")
  const { text } = parseExperienceWorkModifier(body)
  const next = [...lines]
  next[matchAt] = `${indent}# ${formatExperienceTitleWithWork(text, workType)}`
  return next.join("\n")
}
