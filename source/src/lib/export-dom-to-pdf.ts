import { flattenImagesForPdfExport, waitForImageElement } from "@/lib/compress-image"
import { flattenOptionsForPreset } from "@/lib/pdf-export-optimize"
import {
  DEFAULT_PDF_EXPORT_PRESET,
  PDF_EXPORT_PRESETS,
  type PdfExportPreset,
} from "@/lib/pdf-export-presets"
import {
  finalizeCoverLetterCloneForPdf,
  stripUnsupportedStylesFromClone,
} from "@/lib/prepare-dom-for-html2canvas"

/** Target max size for client-side cover letter PDF exports (ATS preset). */
export const COVER_LETTER_PDF_MAX_BYTES = 1_200 * 1024

export function coverLetterPdfMaxBytesForPreset(
  preset: PdfExportPreset = DEFAULT_PDF_EXPORT_PRESET,
): number {
  const config = PDF_EXPORT_PRESETS[preset]
  return Math.round(config.targetWithCoverLetterBytes * 0.4)
}

const A4_WIDTH_PX = 794
/** Match Playwright @page side margins (18mm) so header phone/photo stay inside the page. */
const A4_PADDING_SIDE_MM = 18
const A4_PADDING_TOP_MM = 16
const A4_PADDING_BOTTOM_MM = 16
const MM_TO_PX = 96 / 25.4
const A4_PADDING_X_PX = A4_PADDING_SIDE_MM * MM_TO_PX
const A4_PADDING_TOP_PX = A4_PADDING_TOP_MM * MM_TO_PX
const A4_PADDING_BOTTOM_PX = A4_PADDING_BOTTOM_MM * MM_TO_PX

/** Safari/Chrome canvas edge; skip scales that would exceed this. */
const MAX_CANVAS_DIMENSION = 16384

function applyCoverLetterExportLayout(
  clone: HTMLElement,
  source: HTMLElement,
  letterBodyText?: string,
): void {
  const computed = window.getComputedStyle(source)
  clone.style.width = `${A4_WIDTH_PX}px`
  clone.style.maxWidth = `${A4_WIDTH_PX}px`
  clone.style.minWidth = `${A4_WIDTH_PX}px`
  clone.style.boxSizing = "border-box"
  clone.style.margin = "0"
  clone.style.padding = `${A4_PADDING_TOP_PX}px ${A4_PADDING_X_PX}px ${A4_PADDING_BOTTOM_PX}px ${A4_PADDING_X_PX}px`
  clone.style.backgroundColor = "#ffffff"
  clone.style.color = computed.color || "#000000"
  clone.style.fontFamily = computed.fontFamily || "Georgia, 'Times New Roman', serif"
  clone.style.lineHeight = "1.35"
  clone.style.fontSize = "11pt"
  clone.style.borderRadius = "0"
  clone.style.boxShadow = "none"
  clone.style.textAlign = "left"
  clone.style.textAlignLast = "left"
  finalizeCoverLetterCloneForPdf(clone, letterBodyText)
}

type JsPDFConstructor = typeof import("jspdf").default
type JsPDFInstance = InstanceType<JsPDFConstructor>

/** Drop trailing blank rows html2canvas often adds below the letter. */
function getTrimmedCanvasHeight(canvas: HTMLCanvasElement, paddingPx = 32): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return canvas.height

  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let lastContentRow = 0
  const whiteThreshold = 250

  for (let y = height - 1; y >= 0; y--) {
    let rowHasInk = false
    for (let x = 0; x < width; x += 6) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < 12) continue
      if (
        data[i] < whiteThreshold ||
        data[i + 1] < whiteThreshold ||
        data[i + 2] < whiteThreshold
      ) {
        rowHasInk = true
        break
      }
    }
    if (rowHasInk) {
      lastContentRow = y + 1
      break
    }
  }

  if (lastContentRow === 0) return canvas.height
  return Math.min(canvas.height, lastContentRow + paddingPx)
}

function buildPdfFromCanvas(
  canvas: HTMLCanvasElement,
  jpegQuality: number,
  jsPDF: JsPDFConstructor,
  contentHeightPx?: number,
): JsPDFInstance {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  /** Canvas pixels that map to one PDF page height at full page width. */
  const pageSliceHeightPx = Math.floor((canvas.width * pageHeight) / imgWidth)
  const totalHeight = Math.min(
    contentHeightPx ?? canvas.height,
    canvas.height,
  )

  let sourceY = 0
  let pageIndex = 0

  while (sourceY < totalHeight) {
    const remaining = totalHeight - sourceY
    if (pageIndex > 0 && remaining < Math.min(60, pageSliceHeightPx * 0.06)) {
      break
    }

    if (pageIndex > 0) pdf.addPage()

    const sliceHeight = Math.min(pageSliceHeightPx, remaining)
    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeight
    const ctx = sliceCanvas.getContext("2d")
    if (!ctx) throw new Error("Failed to create PDF slice canvas")

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    )

    const imgData = sliceCanvas.toDataURL("image/jpeg", jpegQuality)
    const sliceImgHeightMm = (sliceHeight * imgWidth) / canvas.width
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, sliceImgHeightMm)

    sourceY += sliceHeight
    pageIndex += 1
  }

  return pdf
}

async function measureExportHeight(element: HTMLElement): Promise<number> {
  const images = Array.from(element.querySelectorAll("img"))
  await Promise.all(
    images.map((img) =>
      img instanceof HTMLImageElement ? waitForImageElement(img) : Promise.resolve(),
    ),
  )
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  element.style.height = "auto"
  element.style.overflow = "hidden"
  return Math.max(1, Math.ceil(element.getBoundingClientRect().height))
}

async function renderCanvas(
  element: HTMLElement,
  scale: number,
  letterBodyText?: string,
  captureHeight?: number,
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default
  const elementId = element.id
  const width = A4_WIDTH_PX
  const height = captureHeight ?? Math.max(1, Math.ceil(element.scrollHeight))
  if (width * scale > MAX_CANVAS_DIMENSION || height * scale > MAX_CANVAS_DIMENSION) {
    throw new Error("Content is too tall to export at this resolution. Try shortening the letter.")
  }

  return html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width,
    height,
    windowWidth: A4_WIDTH_PX,
    onclone: (clonedDoc) => {
      stripUnsupportedStylesFromClone(clonedDoc)
      const clonedRoot =
        (elementId ? clonedDoc.getElementById(elementId) : null) ??
        (clonedDoc.body.firstElementChild instanceof HTMLElement
          ? clonedDoc.body.firstElementChild
          : null)
      if (clonedRoot instanceof HTMLElement) {
        finalizeCoverLetterCloneForPdf(clonedRoot, letterBodyText)
      }
    },
  })
}

/**
 * Rasterize a DOM node to a compressed JPEG-based A4 PDF (typically under 800KB).
 */
export async function downloadDomAsCompressedPdf(options: {
  element: HTMLElement
  filename: string
  maxBytes?: number
  preset?: PdfExportPreset
  /** Raw cover letter body (markdown) — rebuilds paragraphs when exporting a cloned preview. */
  letterBodyText?: string
  /** When true, use `element` as-is (e.g. export template); otherwise clone from live preview. */
  useExportRootDirectly?: boolean
}): Promise<{ sizeBytes: number; withinLimit: boolean }> {
  const preset = options.preset ?? DEFAULT_PDF_EXPORT_PRESET
  const presetConfig = PDF_EXPORT_PRESETS[preset]
  const maxBytes = options.maxBytes ?? coverLetterPdfMaxBytesForPreset(preset)
  const filename = options.filename.endsWith(".pdf")
    ? options.filename
    : `${options.filename}.pdf`

  const jsPDF = (await import("jspdf")).default

  const tempContainer = document.createElement("div")
  tempContainer.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;background:#ffffff;margin:0;padding:0;"
  const clone = options.useExportRootDirectly
    ? options.element
    : (options.element.cloneNode(true) as HTMLElement)
  const layoutSource = options.useExportRootDirectly ? clone : options.element
  applyCoverLetterExportLayout(clone, layoutSource, options.letterBodyText)
  tempContainer.appendChild(clone)
  document.body.appendChild(tempContainer)

  try {
    await flattenImagesForPdfExport(clone, flattenOptionsForPreset(preset))
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready
    }
    const captureHeight = await measureExportHeight(clone)
    clone.style.height = `${captureHeight}px`
    clone.style.overflow = "hidden"
    await new Promise((resolve) => setTimeout(resolve, 80))

    const scales = presetConfig.rasterScales
    const qualities = presetConfig.rasterQualities

    let smallest: { pdf: JsPDFInstance; sizeBytes: number } | null = null

    for (const scale of scales) {
      let canvas: HTMLCanvasElement
      try {
        canvas = await renderCanvas(clone, scale, options.letterBodyText, captureHeight)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (scale === scales[scales.length - 1]) throw err
        console.warn(`[pdf] Skipping scale ${scale}: ${message}`)
        continue
      }

      for (const quality of qualities) {
        const trimmedHeight = getTrimmedCanvasHeight(canvas)
        const pdf = buildPdfFromCanvas(canvas, quality, jsPDF, trimmedHeight)
        const blob = pdf.output("blob")
        const sizeBytes = blob.size

        if (!smallest || sizeBytes < smallest.sizeBytes) {
          smallest = { pdf, sizeBytes }
        }

        if (sizeBytes <= maxBytes) {
          pdf.save(filename)
          console.log(
            `[pdf] Exported ${filename}: ${Math.round(sizeBytes / 1024)}KB (scale ${scale}, quality ${quality})`,
          )
          return { sizeBytes, withinLimit: true }
        }
      }
    }

    if (!smallest) {
      throw new Error("Failed to build PDF")
    }

    smallest.pdf.save(filename)
    const withinLimit = smallest.sizeBytes <= maxBytes
    console.warn(
      `[pdf] Exported ${filename} at minimum compression: ${Math.round(smallest.sizeBytes / 1024)}KB (limit ${Math.round(maxBytes / 1024)}KB)`,
    )
    return { sizeBytes: smallest.sizeBytes, withinLimit }
  } finally {
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer)
    }
  }
}
