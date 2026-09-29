import { normalizeResumeMarkupLine } from "@/lib/resume-markup-line"

export type SectionColumnBlockCount = 2 | 3

export type ResumeContentSegment =
  | { type: "lines"; lines: string[] }
  | { type: "column-block"; columns: SectionColumnBlockCount; columnLines: string[][] }

const COLUMN_BLOCK_OPEN_RE = /^\[\s*columns\s*=\s*([123])\s*\]$/i
const COLUMN_BLOCK_SPLIT_RE = /^\[\s*column\s*\]$/i
const COLUMN_BLOCK_CLOSE_RE = /^\[\s*\/\s*columns\s*\]$/i

/** Normalize bracket lookalikes so `[columns=2]` tokens match reliably. */
export function normalizeColumnBlockLine(line: string): string {
  return normalizeResumeMarkupLine(line)
    .trim()
    .replace(/[\uFF3B【]/g, "[")
    .replace(/[\uFF3D】]/g, "]")
}

/** True when the line is a column-block markup token (never show as body text). */
export function isColumnBlockMarkerLine(line: string): boolean {
  const normalized = normalizeColumnBlockLine(line)
  return (
    COLUMN_BLOCK_OPEN_RE.test(normalized) ||
    COLUMN_BLOCK_SPLIT_RE.test(normalized) ||
    COLUMN_BLOCK_CLOSE_RE.test(normalized)
  )
}

/**
 * Split resume lines into plain line runs and `[columns=n] … [column] … [/columns]` blocks.
 * Markup tokens are consumed here — they must not reach Markdown rendering.
 */
export function splitLinesByColumnBlocks(lines: string[]): ResumeContentSegment[] {
  const segments: ResumeContentSegment[] = []
  let i = 0

  while (i < lines.length) {
    const normalized = normalizeColumnBlockLine(lines[i])
    const openMatch = normalized.match(COLUMN_BLOCK_OPEN_RE)

    if (openMatch) {
      const columns = Number(openMatch[1]) as SectionColumnBlockCount
      const columnLines: string[][] = Array.from({ length: columns }, () => [])
      let colIndex = 0
      i++

      while (i < lines.length) {
        const token = normalizeColumnBlockLine(lines[i])
        if (COLUMN_BLOCK_CLOSE_RE.test(token)) {
          i++
          break
        }
        if (COLUMN_BLOCK_SPLIT_RE.test(token)) {
          colIndex = Math.min(colIndex + 1, columns - 1)
          i++
          continue
        }
        columnLines[colIndex].push(lines[i])
        i++
      }

      segments.push({ type: "column-block", columns, columnLines })
      continue
    }

    const regular: string[] = []
    while (i < lines.length) {
      const token = normalizeColumnBlockLine(lines[i])
      if (COLUMN_BLOCK_OPEN_RE.test(token)) break
      regular.push(lines[i])
      i++
    }

    if (regular.length > 0) {
      segments.push({ type: "lines", lines: regular })
    }
  }

  return segments.length > 0 ? segments : [{ type: "lines", lines }]
}

/** Render line segments, delegating column blocks to `renderColumnBlock`. */
export function renderHtmlWithColumnBlocks(
  lines: string[],
  renderLines: (chunk: string[]) => string,
  renderColumnBlock: (columnLines: string[][], columns: SectionColumnBlockCount) => string,
): string {
  return splitLinesByColumnBlocks(lines)
    .map((segment) => {
      if (segment.type === "column-block") {
        return renderColumnBlock(segment.columnLines, segment.columns)
      }
      return renderLines(segment.lines)
    })
    .join("")
}
