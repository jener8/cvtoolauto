import { isManualPageBreakLine } from "./resume-page-breaks"

/** CSS px per mm at typical browser resolution (1in = 96px, 1in = 25.4mm). */
const MM_TO_PX = 96 / 25.4

export const PDF_MANUAL_PAGE_BREAK_PREFERENCE_HTML =
  '<div class="pdf-manual-page-break-preference" aria-hidden="true"></div>'

const MANUAL_PAGE_BREAK_BLOCK_KIND = "manual-page-break-preference"

/**
 * Never let `document.fonts.ready` hang pagination/print forever (seen after
 * print-dialog cancel and on slow webfont loads in production previews).
 */
export const PDF_FONTS_READY_TIMEOUT_MS = 3000
export const PDF_PAGINATION_TIMEOUT_MS = 8000

/** Resolve when document fonts are ready, or after `timeoutMs` — whichever first. */
export function waitForDocumentFonts(
  doc: Document,
  timeoutMs: number = PDF_FONTS_READY_TIMEOUT_MS,
): Promise<void> {
  const fonts = doc.fonts
  if (!fonts?.ready) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    fonts.ready.then(
      () => {
        clearTimeout(timer)
        done()
      },
      () => {
        clearTimeout(timer)
        done()
      },
    )
  })
}

/** Race a promise against a timeout so pagination can never block the UI. */
export function withPdfTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(onTimeout())
    }, timeoutMs)
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(onTimeout())
      },
    )
  })
}

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

/** True for markdown / bullet-list item lines (`-`, `•`, `*`, en/em dashes, etc.). */
export function isPdfBulletLine(line: string): boolean {
  const t = line.trim()
  return /^[-•▪▫●○■□*–—]\s+\S/.test(t) || t.startsWith("-") || t.startsWith("•")
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
 * - `job-head`: header lines (title/company/date/…) + the first 2 bullets (keep together)
 * - `job-bullet`: following bullets in groups of 2 (never a lone bullet chunk when avoidable)
 * - ≤2 bullets (or ≤3 to avoid a trailing orphan) → whole entry as `job-head`
 * - No bullets → whole entry as `job-head`
 *
 * Sections themselves are never atomic — only this small keep-together unit is.
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

  // Keep whole entry when small so we never emit a single trailing bullet chunk.
  if (bulletIndexes.length <= 3) {
    return [{ kind: "job-head", lines: [...lines], continuation: false }]
  }

  // Header + first 2 bullets (everything before the 3rd bullet).
  const headEndExclusive = bulletIndexes[2]
  const chunks: PdfEntryChunk[] = [
    {
      kind: "job-head",
      lines: lines.slice(0, headEndExclusive),
      continuation: false,
    },
  ]

  // Remaining bullets in pairs (take 3 when 3 remain so the last page never
  // starts with a single orphan bullet).
  let bi = 2
  while (bi < bulletIndexes.length) {
    const remaining = bulletIndexes.length - bi
    const take = remaining <= 3 ? remaining : 2
    const start = bulletIndexes[bi]
    const endBi = bi + take
    const end = endBi < bulletIndexes.length ? bulletIndexes[endBi] : lines.length
    chunks.push({
      kind: "job-bullet",
      lines: lines.slice(start, end),
      continuation: true,
    })
    bi += take
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
 * for real DOM; this remains for unit tests and as the orphan-title / absorb reference.
 */
export function packPdfBlocks(
  blocks: PdfPackBlock[],
  maxH: number,
): PackPdfBlocksResult {
  const pages: number[][] = []
  const pageUsedHeights: number[] = []
  /** Page indices that end because of a manual `---PAGE BREAK---` (never absorb across). */
  const manualBreakAfterPage = new Set<number>()
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
      if (pages.length > 0) manualBreakAfterPage.add(pages.length - 1)
      continue
    }

    if (h > maxH + 0.5) {
      hadOverflow = true
    }

    // job-head needs slack so a near-miss slot cannot clip to header + 1 bullet.
    const fitLimit =
      kind === "job-head" || kind === "education-entry" ? maxH - 12 : maxH + 0.5
    if (current.length > 0 && used + h > fitLimit) {
      if (current.length === 1 && currentKinds[0] === "section-title") {
        pushBlock(i)
        continue
      }
      // Orphan/widow: if the next page would start with a lone job-bullet,
      // peel the previous job-bullet so the new page starts with ≥2 bullets.
      if (
        kind === "job-bullet" &&
        currentKinds[currentKinds.length - 1] === "job-bullet" &&
        current.length > 1
      ) {
        const peelIdx = current.pop()!
        currentKinds.pop()
        const peelH = currentHeights.pop()!
        used -= peelH
        flushPage(true)
        pushBlock(peelIdx)
      } else {
        flushPage(true)
      }
      if (current.length > 0 && used + h > fitLimit) {
        pushBlock(i)
        continue
      }
    }
    pushBlock(i)
  }
  flushPage(false)

  // Absorb a short final page into the previous page when height-sum fits
  // (e.g. Sprachen alone when a small gap remains). Never across manual breaks.
  const ABSORB_SLACK_PX = 10
  while (pages.length >= 2) {
    const prevIdx = pages.length - 2
    if (manualBreakAfterPage.has(prevIdx)) break
    const last = pages[pages.length - 1]
    const prev = pages[prevIdx]
    const lastH = last.reduce((s, i) => s + blocks[i].height, 0)
    const prevH = pageUsedHeights[prevIdx]
    // Only pull back a short trailer (avoids collapsing intentional sparse pages).
    if (lastH > maxH * 0.22) break
    if (prevH + lastH <= maxH + ABSORB_SLACK_PX) {
      pages[prevIdx] = [...prev, ...last]
      pageUsedHeights[prevIdx] = prevH + lastH
      pages.pop()
      pageUsedHeights.pop()
      continue
    }
    break
  }

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
      const manualBreakAfterPage = new Set<number>()
      let current: HTMLElement[] = []
      let currentKinds: string[] = []
      let hadOverflow = false
      // Near-miss slack so job-head (header + ≥2 bullets) is never packed into a
      // slot that only fits header + 1 bullet after webfont metrics settle.
      const FIT_SLACK_PX = 12

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

      /** job-head / education-entry must fully fit; near-miss → next page. */
      const exceedsPage = (trialH: number, kind: string) => {
        const limit =
          kind === "job-head" || kind === "education-entry" ? maxH - FIT_SLACK_PX : maxH + 0.5
        return trialH > limit
      }

      for (let i = 0; i < blocks.length; i++) {
        const kind = kinds[i]
        const el = blocks[i]

        if (kind === MANUAL_PAGE_BREAK_BLOCK_KIND) {
          flushPage(true)
          if (pages.length > 0) manualBreakAfterPage.add(pages.length - 1)
          continue
        }

        const aloneH = measureEls([el])
        if (aloneH > maxH + 0.5) {
          hadOverflow = true
        }

        if (current.length > 0) {
          const trialH = measureEls([...current, el])
          if (exceedsPage(trialH, kind)) {
            if (current.length === 1 && currentKinds[0] === "section-title") {
              pushBlock(el, kind)
              continue
            }
            // Orphan/widow: never start the next page with a single job-bullet
            // when the previous page ends with another job-bullet — peel one back.
            if (
              kind === "job-bullet" &&
              currentKinds[currentKinds.length - 1] === "job-bullet" &&
              current.length > 1
            ) {
              const peelEl = current.pop()!
              const peelKind = currentKinds.pop()!
              flushPage(true)
              pushBlock(peelEl, peelKind)
            } else {
              // Keep-together: if job-head does not fully fit in the remaining
              // space, move the whole unit (header + ≥2 bullets) to the next page
              // rather than packing a near-miss that clips to header + 1 bullet.
              flushPage(true)
            }
            if (current.length > 0) {
              const afterCarryH = measureEls([...current, el])
              if (exceedsPage(afterCarryH, kind)) {
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

      // Absorb a short trailing page (e.g. Sprachen alone) into the previous
      // page when the combined measurement fits — including a small near-miss
      // slack so tiny final sections do not force an extra sheet.
      // Never absorb across a manual `---PAGE BREAK---`.
      const ABSORB_SLACK_PX = 10
      let absorbGuard = 0
      while (normalizedPages.length >= 2 && absorbGuard < 20) {
        absorbGuard += 1
        const lastIdx = normalizedPages.length - 1
        const prevIdx = lastIdx - 1
        if (manualBreakAfterPage.has(prevIdx)) break
        const lastH = measureEls(normalizedPages[lastIdx])
        if (lastH > maxH * 0.22) break
        const combined = measureEls([
          ...normalizedPages[prevIdx],
          ...normalizedPages[lastIdx],
        ])
        if (combined <= maxH + ABSORB_SLACK_PX) {
          normalizedPages[prevIdx] = [
            ...normalizedPages[prevIdx],
            ...normalizedPages[lastIdx],
          ]
          normalizedPages.pop()
          continue
        }
        break
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
