import { formattedTextToHtml } from "@/lib/resume-inline-links"
import { normalizeResumeMarkupLine } from "@/lib/resume-markup-line"
import { isManualPageBreakLine } from "@/lib/resume-page-breaks"

export type MarkdownTableAlign = "left" | "center" | "right" | "none"

export type ParsedMarkdownTable = {
  headers: string[]
  alignments: MarkdownTableAlign[]
  rows: string[][]
}

export type ResumeTableSegment =
  | { type: "lines"; lines: string[] }
  | { type: "table"; table: ParsedMarkdownTable }

export type MarkdownTableRenderOptions = {
  fontSize: number
  lineHeight: number | string
  linkColor: string
  /** CV accent hex — soft header tint matching section titles (`#RRGGBB` or `#RRGGBBAA`). */
  accentColor?: string
  /** When false, omit <thead> entirely. */
  showHeader?: boolean
  /** Subset of body rows; defaults to all rows. */
  rows?: string[][]
  /**
   * Continuation body chunk: includes a hidden <thead> that only becomes visible
   * when the packer marks the block as `pdf-job-continuation--page-start`.
   */
  continuation?: boolean
  /** Header-only chunk (no body rows) — used once at the top of the table. */
  headerOnly?: boolean
}

/** Soft dividers — readable without looking like a spreadsheet. */
const RULE_H = "#d4cec4"
const RULE_V = "#e4dfd7"
const FALLBACK_HEADER_BG = "#f3efe9"

/** Soft editor tip when a table cell is denser than comfortable to scan. */
export const TABLE_CELL_SCAN_WORD_HINT = 40

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

/** True when any body cell exceeds the soft scanning guideline. */
export function tableHasDenseCells(
  table: ParsedMarkdownTable,
  limit = TABLE_CELL_SCAN_WORD_HINT,
): boolean {
  return table.rows.some((row) => row.some((cell) => countWords(cell) > limit))
}

function headerBackground(accentColor: string | undefined): string {
  const accent = accentColor?.trim()
  if (!accent) return FALLBACK_HEADER_BG
  // Match section titles: accent + ~12.5% alpha (`20` hex).
  if (/^#[0-9a-fA-F]{6}$/.test(accent)) return `${accent}20`
  if (/^#[0-9a-fA-F]{8}$/.test(accent)) return accent
  return FALLBACK_HEADER_BG
}

/** CSS for CV Markdown tables (preview + PDF share the same classes). */
export const CV_MARKDOWN_TABLE_CSS = `
.cv-md-table {
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 0;
  font-size: inherit;
  line-height: inherit;
  color: #000000;
  border: none;
  break-inside: auto;
  page-break-inside: auto;
}
.cv-md-table th,
.cv-md-table td {
  vertical-align: top;
  text-align: left;
  padding: 0.55em 0.7em;
  border-top: none;
  border-bottom: 1px solid ${RULE_H};
  border-left: none;
  border-right: 1px solid ${RULE_V};
  overflow-wrap: anywhere;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
  line-height: 1.45;
}
.cv-md-table th:last-child,
.cv-md-table td:last-child {
  border-right: none;
}
.cv-md-table thead th {
  font-weight: 700;
  font-size: 1em;
  border-bottom: 1px solid ${RULE_H};
}
.cv-md-table td.cv-md-cell--criterion {
  font-weight: 600;
}
.cv-md-table td.cv-md-cell--evidence {
  font-weight: 400;
}
.cv-md-table td strong,
.cv-md-table th strong {
  font-weight: 700;
}
.cv-md-table--cols-2 col.cv-md-col--0 { width: 30%; }
.cv-md-table--cols-2 col.cv-md-col--1 { width: 70%; }
.cv-md-table--cols-3 col.cv-md-col--0 { width: 28%; }
.cv-md-table--cols-3 col.cv-md-col--1 { width: 52%; }
.cv-md-table--cols-3 col.cv-md-col--2 { width: 20%; }
.cv-md-table--continuation {
  margin-top: 0;
}
.cv-md-table--header-only {
  margin-bottom: 0;
}
.cv-md-table--header-only thead th {
  border-bottom: 1px solid ${RULE_H};
}
.cv-md-table--continuation thead {
  display: none !important;
}
.pdf-job-continuation--page-start .cv-md-table--continuation {
  margin-top: 0.25em;
}
.pdf-job-continuation--page-start .cv-md-table--continuation thead {
  display: table-header-group !important;
}
.pdf-resume-block[data-pdf-block="table-row"],
.pdf-resume-block[data-pdf-block="table-head"] {
  break-inside: avoid;
  page-break-inside: avoid;
}
`

function normalizeTableLine(line: string): string {
  return normalizeResumeMarkupLine(line).trim()
}

/** A pipe table row must start/end with `|` or contain at least one inner `|`. */
export function isMarkdownTableRowLine(line: string): boolean {
  const t = normalizeTableLine(line)
  if (!t || isManualPageBreakLine(t)) return false
  if (!t.includes("|")) return false
  const cells = splitMarkdownTableCells(t)
  return cells.length >= 2
}

/** Separator like `| --- | --- |` or `| :--- | ---: |`. */
export function isMarkdownTableSeparatorLine(line: string): boolean {
  const t = normalizeTableLine(line)
  if (!t.includes("|") && !t.includes("-")) return false
  const cells = splitMarkdownTableCells(t)
  if (cells.length < 2) return false
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
}

export function splitMarkdownTableCells(line: string): string[] {
  let t = normalizeTableLine(line)
  if (t.startsWith("|")) t = t.slice(1)
  if (t.endsWith("|")) t = t.slice(0, -1)
  return t.split("|").map((cell) => cell.trim())
}

function parseAlignFromSeparatorCell(cell: string): MarkdownTableAlign {
  const compact = cell.replace(/\s+/g, "")
  const left = compact.startsWith(":")
  const right = compact.endsWith(":")
  if (left && right) return "center"
  if (right) return "right"
  if (left) return "left"
  return "none"
}

/**
 * Try to parse a GFM pipe table starting at `startIndex`.
 * Requires header row + separator row; body rows are optional.
 */
export function tryParseMarkdownTableAt(
  lines: string[],
  startIndex: number,
): { table: ParsedMarkdownTable; endIndex: number } | null {
  if (startIndex < 0 || startIndex >= lines.length - 1) return null
  const headerLine = lines[startIndex]
  const separatorLine = lines[startIndex + 1]
  if (!isMarkdownTableRowLine(headerLine)) return null
  if (!isMarkdownTableSeparatorLine(separatorLine)) return null

  const headers = splitMarkdownTableCells(headerLine)
  if (headers.length < 2) return null

  const sepCells = splitMarkdownTableCells(separatorLine)
  const alignments: MarkdownTableAlign[] = headers.map((_, i) =>
    sepCells[i] ? parseAlignFromSeparatorCell(sepCells[i]) : "none",
  )

  const rows: string[][] = []
  let i = startIndex + 2
  while (i < lines.length) {
    const line = lines[i]
    if (!isMarkdownTableRowLine(line) || isMarkdownTableSeparatorLine(line)) break
    if (isManualPageBreakLine(line)) break
    const cells = splitMarkdownTableCells(line)
    const normalized = headers.map((_, idx) => cells[idx] ?? "")
    rows.push(normalized)
    i++
  }

  return {
    table: { headers, alignments, rows },
    endIndex: i,
  }
}

/** Split resume lines into plain runs and Markdown pipe tables. */
export function splitLinesByMarkdownTables(lines: string[]): ResumeTableSegment[] {
  const segments: ResumeTableSegment[] = []
  let i = 0
  let buffer: string[] = []

  const flush = () => {
    if (buffer.length > 0) {
      segments.push({ type: "lines", lines: buffer })
      buffer = []
    }
  }

  while (i < lines.length) {
    const parsed = tryParseMarkdownTableAt(lines, i)
    if (parsed) {
      flush()
      segments.push({ type: "table", table: parsed.table })
      i = parsed.endIndex
      continue
    }
    buffer.push(lines[i])
    i++
  }
  flush()
  return segments.length > 0 ? segments : [{ type: "lines", lines }]
}

function alignStyle(align: MarkdownTableAlign | undefined): string {
  if (align === "center" || align === "right" || align === "left") {
    return `text-align:${align};`
  }
  return "text-align:left;"
}

function colgroupHtml(columnCount: number): string {
  const cols = Array.from({ length: columnCount }, (_, i) => {
    return `<col class="cv-md-col--${i}" />`
  }).join("")
  return `<colgroup>${cols}</colgroup>`
}

function cellBorderStyle(isLastColumn: boolean): string {
  const right = isLastColumn ? "border-right:none;" : `border-right:1px solid ${RULE_V};`
  return `border-top:none;border-bottom:1px solid ${RULE_H};border-left:none;${right}`
}

function cellHtml(
  text: string,
  tag: "th" | "td",
  align: MarkdownTableAlign | undefined,
  linkColor: string,
  options: {
    accentColor?: string
    columnIndex: number
    columnCount: number
    isCriterionColumn: boolean
  },
): string {
  const inner = formattedTextToHtml(text, { linkColor, underline: true })
  const isLast = options.columnIndex >= options.columnCount - 1
  const headerBg =
    tag === "th" ? `background:${headerBackground(options.accentColor)};font-weight:700;` : ""
  const bodyWeight =
    tag === "td"
      ? options.isCriterionColumn
        ? "font-weight:600;"
        : "font-weight:400;"
      : ""
  const className =
    tag === "td"
      ? options.isCriterionColumn
        ? ' class="cv-md-cell--criterion"'
        : ' class="cv-md-cell--evidence"'
      : ""

  return `<${tag}${className} style="${cellBorderStyle(isLast)}vertical-align:top;text-align:left;padding:0.55em 0.7em;line-height:1.45;${alignStyle(align)}${headerBg}${bodyWeight}">${inner || "&nbsp;"}</${tag}>`
}

/**
 * Render a semantic HTML table for preview / PDF.
 * Two-column tables use ~30% / ~70%; three-column ~28% / 52% / 20%.
 */
export function renderMarkdownTableHtml(
  table: ParsedMarkdownTable,
  options: MarkdownTableRenderOptions,
): string {
  const continuation = options.continuation === true
  const headerOnly = options.headerOnly === true
  const showHeader = options.showHeader !== false || continuation || headerOnly
  const bodyRows = headerOnly ? [] : (options.rows ?? table.rows)
  const colCount = Math.max(table.headers.length, 2)
  const colsClass =
    colCount === 2 ? " cv-md-table--cols-2" : colCount === 3 ? " cv-md-table--cols-3" : ""
  const contClass = continuation ? " cv-md-table--continuation" : ""
  const headerOnlyClass = headerOnly ? " cv-md-table--header-only" : ""
  const fontSize = options.fontSize || 14
  const lineHeight = options.lineHeight || 1.45
  const font = `font-size:${fontSize}px;line-height:${lineHeight};`

  const theadDisplay = continuation ? "display:none;" : ""

  const thead = showHeader
    ? `<thead style="${theadDisplay}"><tr>${table.headers
        .map((h, i) =>
          cellHtml(h, "th", table.alignments[i], options.linkColor, {
            accentColor: options.accentColor,
            columnIndex: i,
            columnCount: colCount,
            isCriterionColumn: false,
          }),
        )
        .join("")}</tr></thead>`
    : ""

  const tbody =
    bodyRows.length > 0
      ? `<tbody>${bodyRows
          .map(
            (row) =>
              `<tr>${table.headers
                .map((_, i) =>
                  cellHtml(row[i] ?? "", "td", table.alignments[i], options.linkColor, {
                    accentColor: options.accentColor,
                    columnIndex: i,
                    columnCount: colCount,
                    isCriterionColumn: i === 0,
                  }),
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody>`
      : headerOnly
        ? ""
        : "<tbody></tbody>"

  return `<table class="cv-md-table${colsClass}${contClass}${headerOnlyClass}" style="width:100%;border-collapse:collapse;table-layout:fixed;border:none;${font}" role="table">${colgroupHtml(colCount)}${thead}${tbody}</table>`
}

export type MarkdownTablePdfChunk = {
  kind: "table-head" | "table-row"
  html: string
  continuation: boolean
}

/**
 * Emit keep-together PDF chunks:
 * 1. Header-only block (labels once at the top)
 * 2. One body-row block per data row (no visible header mid-table;
 *    header reappears only when a continuation starts a new page)
 */
export function buildMarkdownTablePdfChunks(
  table: ParsedMarkdownTable,
  options: Omit<
    MarkdownTableRenderOptions,
    "rows" | "continuation" | "showHeader" | "headerOnly"
  >,
): MarkdownTablePdfChunk[] {
  const chunks: MarkdownTablePdfChunk[] = []

  chunks.push({
    kind: "table-head",
    html: renderMarkdownTableHtml(table, {
      ...options,
      showHeader: true,
      headerOnly: true,
      continuation: false,
    }),
    continuation: false,
  })

  if (table.rows.length === 0) {
    return chunks
  }

  for (let r = 0; r < table.rows.length; r++) {
    chunks.push({
      kind: "table-row",
      html: renderMarkdownTableHtml(table, {
        ...options,
        showHeader: true,
        rows: [table.rows[r]],
        continuation: true,
      }),
      continuation: true,
    })
  }

  return chunks
}

/** Full table HTML (one piece) for non-paginated / inline markdown rendering. */
export function renderMarkdownTableHtmlFull(
  table: ParsedMarkdownTable,
  options: Omit<MarkdownTableRenderOptions, "rows" | "continuation" | "headerOnly">,
): string {
  return renderMarkdownTableHtml(table, {
    ...options,
    showHeader: true,
    rows: table.rows,
    continuation: false,
  })
}

/** Render tables + plain lines using the same split as PDF pagination. */
export function renderHtmlWithMarkdownTables(
  lines: string[],
  renderLines: (chunk: string[]) => string,
  renderTable: (table: ParsedMarkdownTable) => string,
): string {
  return splitLinesByMarkdownTables(lines)
    .map((segment) => {
      if (segment.type === "table") return renderTable(segment.table)
      return renderLines(segment.lines)
    })
    .join("")
}
