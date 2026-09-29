import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { formattedTextToHtml } from "@/lib/resume-inline-links"
import { isColumnBlockMarkerLine } from "@/lib/resume-column-block"
import { isManualPageBreakLine } from "@/lib/resume-page-breaks"
import {
  parseSectionColumnModifier,
  stripSectionColumnModifier,
  type SectionColumnCount,
} from "@/lib/section-column-modifier"

export const TWO_COLUMN_MIN_ITEMS = 6

const TWO_COLUMN_LINE_SPLIT = /\s{2,}|\t/

export type ColumnListBulletStyle = {
  symbol: string
  color: string
  size: string
  bulletMargin: number
  bulletIndent: number
  lineHeight: number | string
  fontSize: number
  linkColor: string
}

export type SectionColumnInput = {
  title: string
  content: string[]
  columns?: SectionColumnCount
}

/** Section titles that may use a two-column skills/tools layout. */
export function isTwoColumnSectionTitle(title: string): boolean {
  const stripped = stripSectionColumnModifier(title).trim().toUpperCase()
  if (stripped === "TOOLS" || stripped.startsWith("TOOLS ")) return true
  if (/\bTOOLS\b/.test(stripped) && stripped.length <= 40) return true
  return normalizeCvSectionKey(stripped) === "SKILLS"
}

export function shouldUseTwoColumnLayout(items: string[]): boolean {
  return items.length >= TWO_COLUMN_MIN_ITEMS
}

/** Explicit `[columns=n]` modifier wins; otherwise legacy SKILLS/TOOLS auto-layout. */
export function resolveSectionColumnCount(input: SectionColumnInput): SectionColumnCount {
  const fromTitle = parseSectionColumnModifier(input.title).columns
  if (input.columns && input.columns > 1) return input.columns
  if (fromTitle > 1) return fromTitle
  if (input.columns === 1) return 1
  if (isTwoColumnSectionTitle(stripSectionColumnModifier(input.title))) {
    const items = parseTwoColumnSectionItems(input.content)
    if (shouldUseTwoColumnLayout(items)) {
      return 2
    }
  }
  return 1
}

export function shouldRenderColumnLayout(input: SectionColumnInput): boolean {
  return resolveSectionColumnCount(input) > 1
}

/** Parse plain lines, bullets, or tab/multi-space paired rows into a flat item list. */
export function parseTwoColumnSectionItems(lines: string[]): string[] {
  const items: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || isManualPageBreakLine(line) || isColumnBlockMarkerLine(line)) continue
    if (/^#{1,3}\s/.test(line)) continue

    let text = line.replace(/^[•-]\s*/, "").trim()
    if (!text) continue

    const parts = text
      .split(TWO_COLUMN_LINE_SPLIT)
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length >= 2) {
      items.push(...parts)
    } else {
      items.push(text)
    }
  }

  return items
}

export function pairTwoColumnItems(
  items: string[],
): Array<{ left: string; right: string | null }> {
  const rows: Array<{ left: string; right: string | null }> = []
  for (let i = 0; i < items.length; i += 2) {
    rows.push({
      left: items[i],
      right: items[i + 1] ?? null,
    })
  }
  return rows
}

/** Shared CSS for preview, print, and server PDF HTML. */
export const CV_TWO_COLUMN_LIST_CSS = `
.cv-column-list,
.cv-two-column-list {
  width: 100%;
  box-sizing: border-box;
}
.cv-column-list__item,
.cv-two-column-list__item {
  margin: 0;
  color: #000000;
  break-inside: avoid;
  page-break-inside: avoid;
}
.cv-two-column-list__item--empty {
  min-height: 0;
}
`

/**
 * Multi-column bullet list using a table (not CSS column-count / grid).
 * Tables survive PDF preview measurement, html2canvas, and narrow panes.
 */
export function renderCVColumnListHtml(
  items: string[],
  columns: 2 | 3,
  bullet: ColumnListBulletStyle,
): string {
  if (items.length === 0) return ""

  const inline = (text: string) =>
    formattedTextToHtml(text, { linkColor: bullet.linkColor, underline: true })

  const renderItem = (item: string) =>
    `<div class="cv-column-list__item" style="margin: ${bullet.bulletMargin / 2}px 0; padding-left: ${bullet.bulletIndent}px; line-height: ${bullet.lineHeight}; position: relative; font-size: ${bullet.fontSize}px; color: #000000;"><span style="position: absolute; left: 0; top: 0; line-height: ${bullet.lineHeight}; font-size: ${bullet.size}; color: ${bullet.color};">${bullet.symbol}</span>${inline(item)}</div>`

  const colBuckets: string[][] = Array.from({ length: columns }, () => [])
  items.forEach((item, index) => {
    colBuckets[index % columns].push(item)
  })

  const widthPct = (100 / columns).toFixed(4)
  const cells = colBuckets
    .map((bucket) => {
      const body = bucket.map(renderItem).join("")
      return `<td class="cv-column-list__col" style="width: ${widthPct}%; vertical-align: top; padding: 0; padding-right: 12px;">${body}</td>`
    })
    .join("")

  return `<table class="cv-column-list cv-column-list--cols-${columns} pdf-block-keep-together" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: ${bullet.bulletMargin}px 0; padding: 0; font-size: ${bullet.fontSize}px; line-height: ${bullet.lineHeight};"><tbody><tr>${cells}</tr></tbody></table>`
}

/**
 * Split a section into entry blocks. A new block starts at `# title` or `## company`
 * (not ### dates). Used for ZERTIFIKATE / EDUCATION with `[columns=n]`.
 */
export function splitSectionIntoEntryBlocks(lines: string[]): string[][] {
  const blocks: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    const t = line.trim()
    if (isManualPageBreakLine(t)) {
      if (current.length > 0) {
        blocks.push(current)
        current = []
      }
      continue
    }

    const isJobOrDegreeTitle = /^#\s+/.test(t) && !/^##/.test(t)
    const isCompanyOrCertTitle = /^##\s+/.test(t) && !/^###/.test(t)
    if ((isJobOrDegreeTitle || isCompanyOrCertTitle) && current.length > 0) {
      blocks.push(current)
      current = []
    }
    current.push(line)
  }

  if (current.length > 0) blocks.push(current)
  return blocks.length > 0 ? blocks : [lines]
}

/** True when the section looks like structured entries (certs/education/jobs), not a flat skill list. */
export function sectionHasStructuredEntries(lines: string[]): boolean {
  return lines.some((line) => {
    const t = line.trim()
    return (/^#\s+/.test(t) && !/^##/.test(t)) || (/^##\s+/.test(t) && !/^###/.test(t))
  })
}

/** Place pre-rendered HTML entry blocks into a multi-column table. */
export function renderCVColumnBlocksHtml(blockHtmls: string[], columns: 2 | 3): string {
  const nonEmpty = blockHtmls.filter((html) => html.trim().length > 0)
  if (nonEmpty.length === 0) return ""

  const colBuckets: string[][] = Array.from({ length: columns }, () => [])
  nonEmpty.forEach((html, index) => {
    colBuckets[index % columns].push(html)
  })

  const widthPct = (100 / columns).toFixed(4)
  const cells = colBuckets
    .map((bucket) => {
      const body = bucket
        .map(
          (html) =>
            `<div class="cv-column-list__block" style="margin: 0 0 12px 0; break-inside: avoid; page-break-inside: avoid;">${html}</div>`,
        )
        .join("")
      return `<td class="cv-column-list__col" style="width: ${widthPct}%; vertical-align: top; padding: 0; padding-right: 12px;">${body}</td>`
    })
    .join("")

  return `<table class="cv-column-list cv-column-list--cols-${columns} pdf-block-keep-together" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 4px 0; padding: 0;"><tbody><tr>${cells}</tr></tbody></table>`
}

