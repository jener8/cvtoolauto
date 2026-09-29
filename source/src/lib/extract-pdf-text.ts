/**
 * Client-side PDF text extraction via pdfjs-dist.
 * Uses spatial ordering (top-to-bottom, left-to-right) for multi-column layouts.
 */

let workerConfigured = false

async function configurePdfWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (workerConfigured || typeof window === "undefined") return
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  workerConfigured = true
}

export function cleanExtractedCvText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/Apache FOP[^\n]*/gi, "")
    .replace(
      /\b(?:Producer|Creator|CreationDate|ModDate|Trapped)\s*(?:\([^)]*\)|<[^>]*>|\/[^\s]+)?/gi,
      "",
    )
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim()
}

type PdfTextItem = {
  str?: string
  transform?: number[]
  height?: number
  width?: number
  hasEOL?: boolean
}

type PositionedFragment = {
  str: string
  x: number
  y: number
  page: number
  height: number
}

function fragmentFromItem(item: PdfTextItem, page: number): PositionedFragment | null {
  if (typeof item.str !== "string" || !item.str.trim()) return null
  const t = item.transform
  const x = Array.isArray(t) && t.length >= 6 ? t[4] : 0
  const y = Array.isArray(t) && t.length >= 6 ? t[5] : 0
  return {
    str: item.str,
    x,
    y,
    page,
    height: typeof item.height === "number" && item.height > 0 ? item.height : 12,
  }
}

function groupFragmentsIntoLines(fragments: PositionedFragment[]): string[] {
  if (fragments.length === 0) return []

  const sorted = [...fragments].sort((a, b) => {
    const yDiff = b.y - a.y
    if (Math.abs(yDiff) > 1) return yDiff
    return a.x - b.x
  })

  const lines: string[] = []
  let currentLine: PositionedFragment[] = []
  let currentY = sorted[0].y
  const yTolerance = Math.max(4, sorted[0].height * 0.6)

  const flush = () => {
    if (currentLine.length === 0) return
    currentLine.sort((a, b) => a.x - b.x)
    const text = currentLine
      .map((f) => f.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (text) lines.push(text)
    currentLine = []
  }

  for (const frag of sorted) {
    if (currentLine.length > 0 && Math.abs(frag.y - currentY) > yTolerance) {
      flush()
      currentY = frag.y
    }
    currentLine.push(frag)
    currentY = (currentY + frag.y) / 2
  }
  flush()

  return lines
}

function joinTextContentItems(items: PdfTextItem[]): string {
  let text = ""
  for (const item of items) {
    if (typeof item.str !== "string") continue
    text += item.str
    text += item.hasEOL ? "\n" : " "
  }
  return text
}

async function extractPageTextSpatial(page: import("pdfjs-dist").PDFPageProxy): Promise<string> {
  const content = await page.getTextContent()
  const pageNumber = page.pageNumber
  const fragments = (content.items as PdfTextItem[])
    .map((item) => fragmentFromItem(item, pageNumber))
    .filter((f): f is PositionedFragment => f !== null)

  if (fragments.length === 0) return ""

  const lines = groupFragmentsIntoLines(fragments)
  if (lines.length > 0) return lines.join("\n")

  return joinTextContentItems(content.items as PdfTextItem[])
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist")
  await configurePdfWorker(pdfjs)

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
  })

  const pdf = await loadingTask.promise
  const pageTexts: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const pageText = await extractPageTextSpatial(page)
    if (pageText.trim()) pageTexts.push(pageText.trim())
  }

  await pdf.destroy()

  return cleanExtractedCvText(pageTexts.join("\n\n"))
}
