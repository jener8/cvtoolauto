export type SectionColumnCount = 1 | 2 | 3

function columnModifierPattern(): RegExp {
  // Fresh regex each call — a shared /g regex can leave lastIndex stuck and fail to strip.
  return /[\[\uFF3B【]\s*columns\s*=\s*([123])\s*[\]\uFF3D】]/i
}

/** @deprecated Prefer parseSectionColumnModifier; pattern is recreated per call. */
export const SECTION_COLUMN_MODIFIER_RE = /[\[\uFF3B【]\s*columns\s*=\s*([123])\s*[\]\uFF3D】]/i

function normalizeModifierSpaces(raw: string): string {
  return raw
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u2060\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Parse optional `[columns=n]` marker on section headings (n = 1, 2, or 3). */
export function parseSectionColumnModifier(raw: string): {
  title: string
  columns: SectionColumnCount
} {
  const trimmed = normalizeModifierSpaces(raw)
  const match = trimmed.match(columnModifierPattern())
  if (!match) {
    return { title: trimmed, columns: 1 }
  }

  const columns = Number(match[1]) as SectionColumnCount
  const title = trimmed.replace(columnModifierPattern(), "").replace(/\s+/g, " ").trim()
  return { title, columns }
}

export function stripSectionColumnModifier(raw: string): string {
  return parseSectionColumnModifier(raw).title
}
