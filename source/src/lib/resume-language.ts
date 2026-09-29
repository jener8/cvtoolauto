import type { ResumeVersion } from "@/lib/types"

export type ResumeLanguage = "en" | "de" | "unknown"

export type ResumeLanguageFilter = "all" | ResumeLanguage

const GERMAN_SECTION_MARKERS =
  /\b(BERUFSERFAHRUNG|AUSBILDUNG|F[ÄA]HIGKEITEN|F[ÄA]HIGKEIT|PROFIL|ZUSAMMENFASSUNG|SPRACHEN|KONTAKT|WERDEGANG|KENNTNISSE|QUALIFIKATIONEN|PRAXISERFAHRUNG|STUDIUM)\b/gi

const ENGLISH_SECTION_MARKERS =
  /\b(EXPERIENCE|EDUCATION|SKILLS|PROFILE|SUMMARY|LANGUAGES|CONTACT|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|QUALIFICATIONS)\b/gi

/** Common standalone tokens that strongly signal German body copy. */
const GERMAN_WORD_MARKERS =
  /\b(und|oder|mit|für|bei|von|zum|zur|eine|einer|einem|sowie|durch|nach|seit|Jahre|Jahren|verantwortlich|Erfahrung|Kenntnisse|Tätigkeiten|Abschluss|Studium|Ausbildung|beruflich|Unternehmen|Bereich)\b/gi

/** Common standalone tokens that strongly signal English body copy. */
const ENGLISH_WORD_MARKERS =
  /\b(and|or|with|for|the|from|into|across|years|responsible|experience|skills|education|degree|university|professional|company|managed|developed|led)\b/gi

const GERMAN_CHAR_MARKERS = /[äöüÄÖÜß]/g

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

function scoreResumeLanguage(text: string): { en: number; de: number } {
  const sample = text.trim().slice(0, 8000)
  if (!sample) return { en: 0, de: 0 }

  const de =
    countMatches(sample, GERMAN_SECTION_MARKERS) * 4 +
    countMatches(sample, GERMAN_WORD_MARKERS) +
    countMatches(sample, GERMAN_CHAR_MARKERS) * 2

  const en =
    countMatches(sample, ENGLISH_SECTION_MARKERS) * 4 +
    countMatches(sample, ENGLISH_WORD_MARKERS)

  return { en, de }
}

/** Best-effort language guess from CV section headings and body text. */
export function inferResumeLanguageFromText(text: string): ResumeLanguage | null {
  const { en, de } = scoreResumeLanguage(text)
  if (de === 0 && en === 0) return null
  // Prefer a clear winner; ties stay unknown so callers can fall back to metadata.
  if (de > en) return "de"
  if (en > de) return "en"
  return null
}

/**
 * Language of the resume *body* for translation / switcher alignment.
 * Prefers text detection over stored metadata when they disagree.
 */
export function detectResumeBodyLanguage(
  text: string,
  stored?: string | null,
): "en" | "de" {
  const inferred = inferResumeLanguageFromText(text)
  if (inferred === "en" || inferred === "de") return inferred
  if (stored === "de" || stored === "en") return stored
  return "en"
}

export function getResumeLanguage(version: ResumeVersion | null | undefined): ResumeLanguage {
  if (!version?.resumeText?.trim()) return "unknown"

  const inferred = inferResumeLanguageFromText(version.resumeText)
  if (inferred === "en" || inferred === "de") return inferred

  const stored = version.contactInfo?.language
  if (stored === "de" || stored === "en") return stored

  return "unknown"
}

export function getResumeLanguageLabel(language: ResumeLanguage): string {
  switch (language) {
    case "en":
      return "English"
    case "de":
      return "Deutsch"
    default:
      return "Other"
  }
}

export function getResumeLanguageShortLabel(language: ResumeLanguage): string {
  switch (language) {
    case "en":
      return "EN"
    case "de":
      return "DE"
    default:
      return "—"
  }
}

export function getResumeLanguageFilterLabel(filter: ResumeLanguageFilter): string {
  switch (filter) {
    case "all":
      return "All CV languages"
    case "en":
      return "English CVs"
    case "de":
      return "German CVs"
    default:
      return "Other / no CV"
  }
}

export function countResumeLanguages(
  versions: ResumeVersion[],
): Record<ResumeLanguage, number> {
  const counts: Record<ResumeLanguage, number> = {
    en: 0,
    de: 0,
    unknown: 0,
  }

  for (const version of versions) {
    counts[getResumeLanguage(version)] += 1
  }

  return counts
}

export function matchesResumeLanguageFilter(
  language: ResumeLanguage,
  filter: ResumeLanguageFilter,
): boolean {
  if (filter === "all") return true
  return language === filter
}
