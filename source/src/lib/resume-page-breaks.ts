export const MANUAL_PAGE_BREAK_MARKER = "---PAGE BREAK---"

/** ChatGPT prompt: single mandatory break for a 2-page A4 CV (replaces optional-break wording). */
export const CHATGPT_PAGE_BREAK_RULES_EN = `PAGE BREAKS:
- The resume must fit on exactly 2 A4 pages (see LENGTH above).
- Include exactly ONE ${MANUAL_PAGE_BREAK_MARKER} marker in the entire resume.
- Place it on its own line immediately before the ## company/institution line where page 2 should begin.
- Typical pattern: page 1 = profile, recent experience, and skills; page 2 starts at the ## line of the next role or education entry.
- Never place the break inside a bullet list, between ### dates and bullets, or in the middle of a role description.
- Do not add any other page breaks.`

export const CHATGPT_PAGE_BREAK_RULES_DE = `SEITENUMBRÜCHE:
- Der Lebenslauf muss auf genau 2 A4-Seiten passen (siehe LÄNGE oben).
- Genau EINE Markierung ${MANUAL_PAGE_BREAK_MARKER} im gesamten Lebenslauf.
- Auf eigener Zeile unmittelbar vor der ##-Zeile (Unternehmen/Institution), wo Seite 2 beginnt.
- Typisch: Seite 1 = Profil, aktuelle Berufserfahrung und Fähigkeiten; Seite 2 beginnt bei der ##-Zeile der nächsten Rolle oder Ausbildung.
- Nie mitten in einer Aufzählungsliste, zwischen ###-Datum und Stichpunkten oder in einer Rollenbeschreibung.
- Keine weiteren Seitenumbrüche.`

/** Legacy hard break element (prefer soft pagination via pdf-auto-pagination). */
export const MANUAL_PAGE_BREAK_HTML = '<div class="page-break"></div>'

export function resumeContainsManualPageBreak(text: string): boolean {
  return text.split(/\r?\n/).some((line) => isManualPageBreakLine(line))
}

export function isManualPageBreakLine(line: string): boolean {
  const normalized = line
    .trim()
    .replace(/[\u00A0\u2003\u2002\u2009\u200B\u202F\uFEFF]/g, " ")
    .replace(/[–—―‐‑‒−]/g, "-")
  return /^\s*---\s*PAGE BREAK\s*---\s*$/i.test(normalized)
}

export function removeManualPageBreakMarkers(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !isManualPageBreakLine(line))
    .join("\n")
}

/** Drop leading blank lines and page-break markers that leave page 1 empty after the header. */
export function stripLeadingManualPageBreaks(text: string): string {
  const lines = text.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (!trimmed || isManualPageBreakLine(lines[i])) {
      i++
      continue
    }
    break
  }
  return i === 0 ? text : lines.slice(i).join("\n")
}

export function splitResumeByManualPageBreaks(text: string): string[] {
  const pages: string[] = []
  let currentLines: string[] = []

  for (const line of text.split(/\r?\n/)) {
    if (isManualPageBreakLine(line)) {
      const pageText = currentLines.join("\n").trim()
      if (pageText) pages.push(pageText)
      currentLines = []
      continue
    }
    currentLines.push(line)
  }

  const finalPage = currentLines.join("\n").trim()
  if (finalPage) pages.push(finalPage)

  if (pages.length === 0) {
    return [removeManualPageBreakMarkers(text).trim()]
  }

  return pages
}

export function validateManualPageBreakSplit(text: string): {
  pages: string[]
  hasMultiplePages: boolean
  hasNoBlankPages: boolean
} {
  const pages = splitResumeByManualPageBreaks(text)
  return {
    pages,
    hasMultiplePages: pages.length > 1,
    hasNoBlankPages: pages.every((page) => page.trim().length > 0),
  }
}
