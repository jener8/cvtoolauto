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

/** Must match `.pdf-page` padding in `app/globals.css`. */
export const PDF_PAGE_PADDING_TOP_MM = 18
export const PDF_PAGE_PADDING_BOTTOM_MM = 22
export const PDF_PAGE_HEIGHT_MM = 297

/** Vertical space inside one A4 page for flowing content (padding is inside the box). */
export function pdfPageContentMaxHeightPx(): number {
  return (PDF_PAGE_HEIGHT_MM - PDF_PAGE_PADDING_TOP_MM - PDF_PAGE_PADDING_BOTTOM_MM) * MM_TO_PX
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

export interface AutoPaginateResult {
  /** Full surface HTML: one or more `<section class="pdf-page">…</section>`. */
  html: string
  /** True if any block or packed page is taller than the page content area. */
  hadOverflow: boolean
  /** How many `<section class="pdf-page">` nodes were emitted. */
  pageCount: number
}

/**
 * Measure `[data-pdf-block]` nodes and pack them into fixed-height A4 pages.
 * Nothing is clipped: if a page is still too tall, the section gets
 * `pdf-page-overflow-warning` for debugging.
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

  const host = ownerDocument.createElement("div")
  host.setAttribute("data-pdf-measurer", "true")
  host.style.cssText =
    "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;z-index:-1;"

  const column = ownerDocument.createElement("div")
  column.className = "pdf-measure-column"
  column.setAttribute(
    "style",
    `${columnStyle};width:calc(210mm - 36mm);margin:0 auto;box-sizing:border-box;`,
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

    const heights = blocks.map((el) => el.getBoundingClientRect().height)
    const kinds = blocks.map((el) => el.getAttribute("data-pdf-block") ?? "")
    let hadOverflow = heights.some((h) => h > maxH + 0.5)

    const pages: HTMLElement[][] = []
    let current: HTMLElement[] = []
    let currentKinds: string[] = []
    let currentHeights: number[] = []
    let used = 0

    const pushBlock = (el: HTMLElement, kind: string, h: number) => {
      current.push(el)
      currentKinds.push(kind)
      currentHeights.push(h)
      used += h
    }

    /**
     * Flush the current page. When `keepTrailingSectionTitle` is true, a trailing
     * `section-title` is carried onto the next page so EXPERIENCE/EDUCATION
     * headings never sit alone above a blank A4 (classic orphan-title bug).
     */
    const flushPage = (keepTrailingSectionTitle: boolean) => {
      if (current.length === 0) return

      let carry: { el: HTMLElement; kind: string; h: number } | null = null
      if (
        keepTrailingSectionTitle &&
        currentKinds[currentKinds.length - 1] === "section-title" &&
        current.length > 1
      ) {
        const el = current.pop()!
        const kind = currentKinds.pop()!
        const h = currentHeights.pop()!
        used -= h
        carry = { el, kind, h }
      }

      // Never emit a page whose only content is a section title.
      if (current.length === 1 && currentKinds[0] === "section-title") {
        if (carry) {
          pushBlock(carry.el, carry.kind, carry.h)
        }
        return
      }

      if (current.length > 0) {
        pages.push(current)
      }
      current = []
      currentKinds = []
      currentHeights = []
      used = 0
      if (carry) {
        pushBlock(carry.el, carry.kind, carry.h)
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      const kind = kinds[i]
      const h = heights[i]

      if (kind === MANUAL_PAGE_BREAK_BLOCK_KIND) {
        // ---PAGE BREAK--- must always start a new A4 page at this exact point.
        flushPage(true)
        continue
      }

      if (h > maxH + 0.5) {
        hadOverflow = true
      }

      if (current.length > 0 && used + h > maxH + 0.5) {
        // Lone section-title + oversized next block: keep them together on one
        // page (page will auto-grow) rather than orphaning the heading.
        if (current.length === 1 && currentKinds[0] === "section-title") {
          pushBlock(blocks[i], kind, h)
          continue
        }
        flushPage(true)
        // After carrying a section-title, if it still doesn't fit with `h`,
        // force them onto the same page instead of looping forever.
        if (current.length > 0 && used + h > maxH + 0.5) {
          pushBlock(blocks[i], kind, h)
          continue
        }
      }
      pushBlock(blocks[i], kind, h)
    }
    flushPage(false)

    const measurePageHeight = (pageBlocks: HTMLElement[]): number => {
      const scratch = ownerDocument.createElement("div")
      scratch.setAttribute(
        "style",
        `${columnStyle};width:calc(210mm - 36mm);margin:0 auto;box-sizing:border-box;`,
      )
      for (const b of pageBlocks) {
        scratch.appendChild(b.cloneNode(true) as HTMLElement)
      }
      ownerDocument.body.appendChild(scratch)
      try {
        return scratch.getBoundingClientRect().height
      } finally {
        ownerDocument.body.removeChild(scratch)
      }
    }

    const htmlParts: string[] = []
    for (let pi = 0; pi < pages.length; pi++) {
      const pageBlocks = pages[pi]
      const pageH = measurePageHeight(pageBlocks)
      const overflowPage = pageH > maxH + 0.5
      if (overflowPage) {
        hadOverflow = true
      }

      const overflowBanner =
        debugMode && overflowPage
          ? '<div class="pdf-page-overflow-msg" aria-hidden="true">Overflow: block taller than page content area</div>'
          : ""

      const inner = pageBlocks.map((b) => b.outerHTML).join("")
      const warn = debugMode && overflowPage ? " pdf-page-overflow-warning" : ""
      // Grow past 297mm when content cannot split further (tall job blocks),
      // so preview/PDF never clip bullets that wrap to multiple lines.
      const auto = overflowPage ? " pdf-page--auto" : ""
      const pageNum = startPageNumber + pi
      const showBreakAfter = debugMode && (pi < pages.length - 1 || forceBreakLabelOnLastPage)
      const pageLabel = debugMode ? pdfPageLabelHtml(pageNum) : ""
      const breakLabel = showBreakAfter ? PDF_PAGE_BREAK_LABEL_HTML : ""
      htmlParts.push(
        `<section class="pdf-page${auto}${warn}" data-auto-page="${pi + 1}">${pageLabel}${overflowBanner}<div style="${columnStyle};width:100%;margin:0;padding:0;box-sizing:border-box;">${inner}</div>${breakLabel}</section>`,
      )
    }

    return { html: htmlParts.join(""), hadOverflow, pageCount: Math.max(1, pages.length) }
  } catch (error) {
    console.error("[pdf-auto-pagination] Failed to paginate resume HTML:", error)
    // Fallback: single auto-height page with the raw marked HTML so content stays visible.
    return {
      html: `<section class="pdf-page pdf-page--auto" data-auto-page="1"><div style="${columnStyle};width:100%;margin:0;padding:0;box-sizing:border-box;">${innerHtmlWithMarkers}</div></section>`,
      hadOverflow: true,
      pageCount: 1,
    }
  } finally {
    host.remove()
  }
}
