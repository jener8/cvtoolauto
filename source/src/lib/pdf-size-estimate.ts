import {
  DEFAULT_PDF_EXPORT_PRESET,
  PDF_EXPORT_PRESETS,
  type PdfExportPreset,
} from "@/lib/pdf-export-presets"

export type PdfSizeEstimateOptions = {
  preset?: PdfExportPreset
  pageCount?: number
  includeCoverLetter?: boolean
  includeTransparencyPage?: boolean
  /** Extra image data URLs not yet in the DOM (e.g. resume version fields). */
  extraImageDataUrls?: Array<string | null | undefined>
  /** Plain text length fallback when root is unavailable. */
  textLength?: number
}

function decodeDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return 0
  const payload = dataUrl.slice(comma + 1).trim()
  if (!payload) return 0
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

function collectImageBytes(root: HTMLElement | null, extra: string[]): number {
  const seen = new Set<string>()
  let total = 0

  const addSrc = (src: string) => {
    const trimmed = src.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    if (trimmed.startsWith("data:image/")) {
      total += decodeDataUrlBytes(trimmed)
    } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("blob:")) {
      total += 80_000
    }
  }

  if (root) {
    root.querySelectorAll("img").forEach((img) => {
      const style = window.getComputedStyle(img)
      if (style.display === "none" || style.visibility === "hidden") return
      addSrc(img.currentSrc || img.src || img.getAttribute("src") || "")
    })
  }

  extra.forEach(addSrc)
  return total
}

/**
 * Heuristic PDF size estimate for pre-export UI. Not a guarantee — actual PDF
 * size depends on the browser / Playwright engine and user print settings.
 */
export function estimatePdfSizeBytes(
  root: HTMLElement | null,
  options: PdfSizeEstimateOptions = {},
): number {
  const preset = options.preset ?? DEFAULT_PDF_EXPORT_PRESET
  const config = PDF_EXPORT_PRESETS[preset]

  const pageCount =
    options.pageCount ??
    (root ? Math.max(1, root.querySelectorAll(".pdf-page").length) : 1)

  const rawImageBytes = collectImageBytes(root, (options.extraImageDataUrls ?? []).filter(Boolean) as string[])
  const compressedImageBytes = Math.round(rawImageBytes * config.imageSizeFactor)

  const textLength =
    options.textLength ??
    (root?.textContent?.replace(/\s+/g, " ").trim().length ?? 0)
  const textBytes = Math.round(textLength * 0.45)

  let total =
    pageCount * config.perPageOverheadBytes +
    config.fontOverheadBytes +
    compressedImageBytes +
    textBytes

  if (options.includeTransparencyPage) {
    total += 45_000
  }

  if (options.includeCoverLetter) {
    const coverTarget = Math.round(config.targetWithCoverLetterBytes * 0.35)
    total += Math.max(280_000, coverTarget)
  }

  // Small metadata / structure overhead
  total += config.stripHtmlMetadata ? 4_000 : 12_000

  return Math.max(120_000, Math.round(total))
}

export type PdfSizeWarningLevel = "none" | "warning" | "strong"

export function pdfSizeWarningLevel(bytes: number): PdfSizeWarningLevel {
  if (bytes >= 10 * 1024 * 1024) return "strong"
  if (bytes >= 5 * 1024 * 1024) return "warning"
  return "none"
}

export function pdfSizeWarningMessage(level: PdfSizeWarningLevel): string | null {
  if (level === "strong") {
    return "This file may exceed upload limits used by many applicant tracking systems. Consider using ATS Optimized export."
  }
  if (level === "warning") {
    return "This file may exceed upload limits used by some applicant tracking systems. Consider using ATS Optimized export."
  }
  return null
}
