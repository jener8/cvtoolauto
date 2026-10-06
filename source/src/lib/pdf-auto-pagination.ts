import { isManualPageBreakLine } from "./resume-page-breaks"

/** CSS px per mm at typical browser resolution (1in = 96px, 1in = 25.4mm). */
const MM_TO_PX = 96 / 25.4

export const PDF_MANUAL_PAGE_BREAK_PREFERENCE_HTML =
  '<div class="pdf-manual-page-break-preference" aria-hidden="true"></div>'

const MANUAL_PAGE_BREAK_BLOCK_KIND = "manual-page-break-preference"

/** Shown only when an ancestor has `.pdf-debug` (see `app/globals.css`). */
export function pdfPageLabelHtml(pageNumber: number): string {
  return `<span class="page-label" aria-hidden="true">Page ${pageNumber} · A4 (210 × 297 mm)</span>`
}

export const PDF_PAGE_BREAK_LABEL_HTML =
  '<div class="page-break-label" aria-hidden="true">↑ ---PAGE BREAK--- marker applied here</div>'

export interface AutoPaginateOptions {
  /** 1-based index for the first printed page in this chunk (default 1). */
  startPageNumber?: number
  /** When true, the last page in this chunk still gets a bottom break label (e.g. a manual `---PAGE BREAK---` chunk follows). */
  forceBreakLabelOnLastPage?: boolean
  /** Show page labels, break markers, and overflow outlines (off in normal preview). */
  debugMode?: boolean
}

/**
 * Must match `@page` margins in `app/globals.css` (and screen `.pdf-page` padding).
 * Content area = A4 minus these margins — no extra padding on printed pages.
 */
export const PDF_PAGE_MARGIN_TOP_MM = 15
export const PDF_PAGE_MARGIN_BOTTOM_MM = 15
export const PDF_PAGE_MARGIN_X_MM = 15
export const PDF_PAGE_HEIGHT_MM = 297
export const PDF_PAGE_WIDTH_MM = 210

/** @deprecated Use PDF_PAGE_MARGIN_TOP_MM — kept for older imports. */
export const PDF_PAGE_PADDING_TOP_MM = PDF_PAGE_MARGIN_TOP_MM
/** @deprecated Use PDF_PAGE_MARGIN_BOTTOM_MM */
export const PDF_PAGE_PADDING_BOTTOM_MM = PDF_PAGE_MARGIN_BOTTOM_MM

/** Vertical space inside one A4 page for flowing content. */
export function pdfPageContentMaxHeightPx(): number {
  return (PDF_PAGE_HEIGHT_MM - PDF_PAGE_MARGIN_TOP_MM - PDF_PAGE_MARGIN_BOTTOM_MM) * MM_TO_PX
}

/** Content column width inside one A4 page (between side margins). */
export function pdfPageContentWidthCss(): string {
  return `calc(${PDF_PAGE_WIDTH_MM}mm - ${PDF_PAGE_MARGIN_X_MM * 2}mm)`
}

/**
 * Split EXPERIENCE section lines into jobs. A new job starts at a line
 * whose trimmed form begins with `#` (job title) but not `##` / `###`.
 */
export type ContentSegment =
  | { type: "block"; lines: string[] }
  | { type: "manual-page-break" }

/**
 * Split section lines into content blocks and optional manual page-break markers.
 * Markers are not included in block lines.
 */
export function splitContentIntoSegments(lines: string[]): ContentSegment[] {
  const segments: ContentSegment[] = []
  let current: string[] = []

  const flush = () => {
    if (current.length > 0) {
      segments.push({ type: "block", lines: current })
      current = []
    }
  }

  for (const line of lines) {
    if (isManualPageBreakLine(line)) {
      flush()
      segments.push({ type: "manual-page-break" })
      continue
    }
    current.push(line)
  }
  flush()

  return segments.length > 0 ? segments : [{ type: "block", lines }]
}

import { isPlausibleJobTitle } from "@/lib/import-cv-structure"

export function splitExperienceLinesIntoJobs(lines: string[]): string[][] {
  const jobs: string[][] = []
  let current: string[] = []

  const isJobTitleLine = (line: string, index: number) => {
    const t = line.trim()
    if (!t.startsWith("#")) return false
    if (t.startsWith("###")) return false
    if (t.startsWith("##")) return false
    return isPlausibleJobTitle(line, lines, index)
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (isManualPageBreakLine(line)) {
      if (current.length > 0) {
        jobs.push(current)
        current = []
      }
      continue
    }
    if (isJobTitleLine(line, index) && current.length > 0) {
      jobs.push(current)
      current = []
    }
    current.push(line)
  }
  if (current.length > 0) {
    jobs.push(current)
  }
  return jobs.length > 0 ? jobs : [lines]
}

/** True for markdown / bullet-list item lines (`-` or `•`). */
export function isPdfBulletLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith("-") || t.startsWith("•")
}

export type PdfEntryChunkKind = "job-head" | "job-bullet"

export type PdfEntryChunk = {
  kind: PdfEntryChunkKind
  lines: string[]
  /** Continuation of a prior chunk in the same entry (no extra list top gap mid-page). */
  continuation: boolean
}

/**
 * Split one job/education entry into paginate-able chunks:
 * - `job-head`: header lines (title/company/date/…) + the first bullet (keep together)
 * - `job-bullet`: each following bullet as its own block (flows freely)
 * - No bullets → whole entry as `job-head`
 */
export function splitEntryLinesIntoPdfChunks(lines: string[]): PdfEntryChunk[] {
  if (lines.length === 0) return []

  const bulletIndexes: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isPdfBulletLine(lines[i])) bulletIndexes.push(i)
  }

  if (bulletIndexes.length === 0) {
    return [{ kind: "job-head", lines: [...lines], continuation: false }]
  }

  if (bulletIndexes.length === 1) {
    return [{ kind: "job-head", lines: [...lines], continuation: false }]
  }

  // Header + first bullet (everything before the 2nd bullet).
  const headEndExclusive = bulletIndexes[1]
  const chunks: PdfEntryChunk[] = [
    {
      kind: "job-head",
      lines: lines.slice(0, headEndExclusive),
      continuation: false,
    },
  ]

  for (let bi = 1; bi < bulletIndexes.length; bi++) {
    const start = bulletIndexes[bi]
    const end = bi + 1 < bulletIndexes.length ? bulletIndexes[bi + 1] : lines.length
    chunks.push({
      kind: "job-bullet",
      lines: lines.slice(start, end),
      continuation: true,
    })
  }

  return chunks
}

export type PdfPackBlock = { kind: string; height: number }

export interface PackPdfBlocksResult {
  /** Each page is an ordered list of source block indices. */
  pages: number[][]
  /** Sum of block heights packed onto each page (when using height-sum packing). */
  pageUsedHeights: number[]
  hadOverflow: boolean
}

/**
 * Pure packer (height-sum). Prefer measure-based packing in `autoPaginateResumeInnerHtml`
 * for real DOM; this remains for unit tests and as the orphan-title rule reference.
 */
export function packPdfBlocks(
  blocks: PdfPackBlock[],
  maxH: number,
): PackPdfBlocksResult {
  const pages: number[][] = []
  const pageUsedHeights: number[] = []
  let current: number[] = []
  let currentKinds: string[] = []
  let currentHeights: number[] = []
  let used = 0
  let hadOverflow = blocks.some((b) => b.height > maxH + 0.5)

  const pushBlock = (index: number) => {
    current.push(index)
    currentKinds.push(blocks[index].kind)
    currentHeights.push(blocks[index].height)
    used += blocks[index].height
  }

  const flushPage = (keepTrailingSectionTitle: boolean) => {
    if (current.length === 0) return

    let carry: number | null = null
    if (
      keepTrailingSectionTitle &&
      currentKinds[currentKinds.length - 1] === "section-title" &&
      current.length > 1
    ) {
      const idx = current.pop()!
      currentKinds.pop()
      const h = currentHeights.pop()!
      used -= h
      carry = idx
    }

    if (current.length === 1 && currentKinds[0] === "section-title") {
      if (carry !== null) pushBlock(carry)
      return
    }

    if (current.length > 0) {
      pages.push(current)
      pageUsedHeights.push(used)
    }
    current = []
    currentKinds = []
    currentHeights = []
    used = 0
    if (carry !== null) pushBlock(carry)
  }

  for (let i = 0; i < blocks.length; i++) {
    const kind = blocks[i].kind
    const h = blocks[i].height

    if (kind === MANUAL_PAGE_BREAK_BLOCK_KIND) {
      flushPage(true)
      continue
    }

    if (h > maxH + 0.5) {
      hadOverflow = true
    }

    if (current.length > 0 && used + h > maxH + 0.5) {
      if (current.length === 1 && currentKinds[0] === "section-title") {
        pushBlock(i)
        continue
      }
      flushPage(true)
      if (current.length > 0 && used + h > maxH + 0.5) {
        pushBlock(i)
        continue
      }
    }
    pushBlock(i)
  }
  flushPage(false)

  return {
    pages,
    pageUsedHeights,
    hadOverflow,
  }
}

export interface AutoPaginateResult {
  /** Full surface HTML: one or more `<section class="pdf-page">…</section>`. */
  html: string
  /** True if any block or packed page is taller than the page content area. */
  hadOverflow: boolean
  /** How many `<section class="pdf-page">` nodes were emitted. */
  pageCount: number
}

function isContinuationBlock(el: HTMLElement): boolean {
  return el.classList.contains("pdf-job-continuation")
}

/**
 * Measure `[data-pdf-block]` nodes and pack them into fixed-height A4 pages.
 * Uses cumulative DOM measurement (not height sums) so collapsed margins match print.
 * Overflowing packed pages are rebalanced instead of growing into blank Chromium sheets.
 */
export function autoPaginateResumeInnerHtml(
  ownerDocument: Document,
  innerHtmlWithMarkers: string,
  columnStyle: string,
  options: AutoPaginateOptions = {},
): AutoPaginateResult {
  const startPageNumber = options.startPageNumber ?? 1
  const forceBreakLabelOnLastPage = options.forceBreakLabelOnLastPage === true
  const debugMode = options.debugMode === true
  const maxH = pdfPageContentMaxHeightPx()
  const contentWidth = pdfPageContentWidthCss()

  const host = ownerDocument.createElement("div")
  host.setAttribute("data-pdf-measurer", "true")
  host.style.cssText =
    "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;z-index:-1;"

  const column = ownerDocument.createElement("div")
  column.className = "pdf-measure-column"
  column.setAttribute(
    "style",
    `${columnStyle};width:${contentWidth};margin:0 auto;box-sizing:border-box;`,
  )
  column.innerHTML = innerHtmlWithMarkers
  host.appendChild(column)
  ownerDocument.body.appendChild(host)

  try {
    let blocks = Array.from(column.querySelectorAll<HTMLElement>("[data-pdf-block]"))

    if (blocks.length === 0) {
      const fallback = ownerDocument.createElement("div")
      fallback.setAttribute("data-pdf-block", "document")
      while (column.firstChild) {
        fallback.appendChild(column.firstChild)
      }
      column.appendChild(fallback)
      blocks = [fallback]
    }

    const kinds = blocks.map((el) => el.getAttribute("data-pdf-block") ?? "")

    const scratch = ownerDocument.createElement("div")
    scratch.setAttribute(
      "style",
      `${columnStyle};width:${contentWidth};margin:0 auto;box-sizing:border-box;`,
    )
    ownerDocument.body.appendChild(scratch)

    const measureEls = (els: HTMLElement[]): number => {
      scratch.replaceChildren(...els.map((b) => b.cloneNode(true) as HTMLElement))
      return scratch.getBoundingClientRect().height
    }

    try {
      const pages: HTMLElement[][] = []
      let current: HTMLElement[] = []
      let currentKinds: string[] = []
      let hadOverflow = false

      const pushBlock = (el: HTMLElement, kind: string) => {
        current.push(el)
        currentKinds.push(kind)
      }

      const flushPage = (keepTrailingSectionTitle: boolean) => {
        if (current.length === 0) return

        let carryEl: HTMLElement | null = null
        let carryKind: string | null = null
        if (
          keepTrailingSectionTitle &&
          currentKinds[currentKinds.length - 1] === "section-title" &&
          current.length > 1
        ) {
          carryEl = current.pop()!
          carryKind = currentKinds.pop()!
        }

        if (current.length === 1 && currentKinds[0] === "section-title") {
          if (carryEl && carryKind) pushBlock(carryEl, carryKind)
          return
        }

        if (current.length > 0) {
          pages.push(current)
        }
        current = []
        currentKinds = []
        if (carryEl && carryKind) pushBlock(carryEl, carryKind)
      }

      for (let i = 0; i < blocks.length; i++) {
        const kind = kinds[i]
        const el = blocks[i]

        if (kind === MANUAL_PAGE_BREAK_BLOCK_KIND) {
          flushPage(true)
          continue
        }

        const aloneH = measureEls([el])
        if (aloneH > maxH + 0.5) {
          hadOverflow = true
        }

        if (current.length > 0) {
          const trialH = measureEls([...current, el])
          if (trialH > maxH + 0.5) {
            if (current.length === 1 && currentKinds[0] === "section-title") {
              pushBlock(el, kind)
              continue
            }
            flushPage(true)
            if (current.length > 0) {
              const afterCarryH = measureEls([...current, el])
              if (afterCarryH > maxH + 0.5) {
                pushBlock(el, kind)
                continue
              }
            }
          }
        }
        pushBlock(el, kind)
      }
      flushPage(false)

      // Drop empty pages; mark continuation that starts a page for top margin.
      const normalizedPages = pages
        .map((pageBlocks) => pageBlocks.filter((b) => (b.getAttribute("data-pdf-block") ?? "") !== MANUAL_PAGE_BREAK_BLOCK_KIND))
        .filter((pageBlocks) => pageBlocks.length > 0)

      for (const pageBlocks of normalizedPages) {
        const first = pageBlocks[0]
        if (first && isContinuationBlock(first)) {
          first.classList.add("pdf-job-continuation--page-start")
        }
      }

      // Rebalance: if a packed page still measures over maxH and has >1 block,
      // peel trailing blocks onto the following page (avoids Chromium blank sheets).
      for (let pi = 0; pi < normalizedPages.length; pi++) {
        let guard = 0
        while (
          normalizedPages[pi].length > 1 &&
          measureEls(normalizedPages[pi]) > maxH + 0.5 &&
          guard < 50
        ) {
          guard += 1
          const moved = normalizedPages[pi].pop()!
          if (!normalizedPages[pi + 1]) normalizedPages[pi + 1] = []
          normalizedPages[pi + 1].unshift(moved)
          hadOverflow = true
        }
        if (normalizedPages[pi].length === 1 && measureEls(normalizedPages[pi]) > maxH + 0.5) {
          hadOverflow = true
        }
      }

      // Remove pages emptied by rebalance; re-apply page-start continuation class.
      const finalPages = normalizedPages.filter((p) => p.length > 0)
      for (const pageBlocks of finalPages) {
        for (const b of pageBlocks) {
          b.classList.remove("pdf-job-continuation--page-start")
        }
        if (pageBlocks[0] && isContinuationBlock(pageBlocks[0])) {
          pageBlocks[0].classList.add("pdf-job-continuation--page-start")
        }
      }

      const htmlParts: string[] = []
      for (let pi = 0; pi < finalPages.length; pi++) {
        const pageBlocks = finalPages[pi]
        const pageH = measureEls(pageBlocks)
        const overflowPage = pageH > maxH + 0.5
        if (overflowPage) hadOverflow = true

        const overflowBanner =
          debugMode && overflowPage
            ? '<div class="pdf-page-overflow-msg" aria-hidden="true">Overflow: block taller than page content area</div>'
            : ""

        const inner = pageBlocks.map((b) => b.outerHTML).join("")
        const warn = debugMode && overflowPage ? " pdf-page-overflow-warning" : ""
        // Only grow when a single unsplittable block exceeds the page — never for
        // multi-block pages (those are rebalanced above to prevent blank sheets).
        const auto = overflowPage && pageBlocks.length === 1 ? " pdf-page--auto" : ""
        const pageNum = startPageNumber + pi
        const showBreakAfter = debugMode && (pi < finalPages.length - 1 || forceBreakLabelOnLastPage)
        const pageLabel = debugMode ? pdfPageLabelHtml(pageNum) : ""
        const breakLabel = showBreakAfter ? PDF_PAGE_BREAK_LABEL_HTML : ""
        htmlParts.push(
          `<section class="pdf-page${auto}${warn}" data-auto-page="${pi + 1}">${pageLabel}${overflowBanner}<div style="${columnStyle};width:100%;margin:0;padding:0;box-sizing:border-box;">${inner}</div>${breakLabel}</section>`,
        )
      }

      return {
        html: htmlParts.join(""),
        hadOverflow,
        pageCount: Math.max(1, finalPages.length),
      }
    } finally {
      scratch.remove()
    }
  } catch (error) {
    console.error("[pdf-auto-pagination] Failed to paginate resume HTML:", error)
    return {
      html: `<section class="pdf-page pdf-page--auto" data-auto-page="1"><div style="${columnStyle};width:100%;margin:0;padding:0;box-sizing:border-box;">${innerHtmlWithMarkers}</div></section>`,
      hadOverflow: true,
      pageCount: 1,
    }
  } finally {
    host.remove()
  }
}
