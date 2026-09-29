export type PdfExportPreset = "ats" | "standard" | "high"

export type PdfExportPresetConfig = {
  id: PdfExportPreset
  label: string
  shortLabel: string
  description: string
  tooltip: string
  /** Target max bytes for CV-only exports (guidance / compression loop). */
  targetCvOnlyBytes: number
  /** Target max bytes when a cover letter is included. */
  targetWithCoverLetterBytes: number
  /** Client raster export (cover letter) — html2canvas scale candidates. */
  rasterScales: number[]
  /** Client raster export — JPEG quality candidates. */
  rasterQualities: number[]
  /** Max width for inline images during export. */
  maxImageWidth: number
  profilePhotoSizePx: number
  logoMaxWidth: number
  logoMaxHeight: number
  imageQuality: number
  profileQuality: number
  logoQuality: number
  /** Strip optional HTML metadata in print exports. */
  stripHtmlMetadata: boolean
  /** Subset Google Fonts link (smaller than full variable font). */
  googleFontsHref: string
  /** Playwright PDF scale. */
  playwrightScale: number
  /** Heuristic multiplier applied to raw image bytes when estimating size. */
  imageSizeFactor: number
  /** Estimated per-page text/vector overhead in bytes. */
  perPageOverheadBytes: number
  /** Estimated font embedding overhead in bytes. */
  fontOverheadBytes: number
}

export const PDF_EXPORT_PRESETS: Record<PdfExportPreset, PdfExportPresetConfig> = {
  ats: {
    id: "ats",
    label: "ATS Optimized (Recommended)",
    shortLabel: "ATS Optimized",
    description: "Designed for online job applications. Produces smaller PDFs while maintaining readability and accessibility.",
    tooltip:
      "Designed for online job applications. Produces smaller PDFs while maintaining readability and accessibility.",
    targetCvOnlyBytes: 2 * 1024 * 1024,
    targetWithCoverLetterBytes: 3 * 1024 * 1024,
    rasterScales: [2, 1.75, 1.5, 1.25, 1],
    rasterQualities: [0.82, 0.75, 0.68, 0.6, 0.52],
    maxImageWidth: 320,
    profilePhotoSizePx: 200,
    logoMaxWidth: 400,
    logoMaxHeight: 120,
    imageQuality: 0.72,
    profileQuality: 0.78,
    logoQuality: 0.78,
    stripHtmlMetadata: true,
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    playwrightScale: 1,
    imageSizeFactor: 0.55,
    perPageOverheadBytes: 38_000,
    fontOverheadBytes: 70_000,
  },
  standard: {
    id: "standard",
    label: "Standard Quality",
    shortLabel: "Standard",
    description: "Balanced quality and file size for general sharing.",
    tooltip: "Balanced quality and file size for general sharing and email attachments.",
    targetCvOnlyBytes: 4 * 1024 * 1024,
    targetWithCoverLetterBytes: 5 * 1024 * 1024,
    rasterScales: [2.5, 2, 1.75, 1.5],
    rasterQualities: [0.9, 0.85, 0.78, 0.72, 0.65],
    maxImageWidth: 480,
    profilePhotoSizePx: 264,
    logoMaxWidth: 500,
    logoMaxHeight: 150,
    imageQuality: 0.82,
    profileQuality: 0.85,
    logoQuality: 0.85,
    stripHtmlMetadata: false,
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    playwrightScale: 1,
    imageSizeFactor: 0.75,
    perPageOverheadBytes: 52_000,
    fontOverheadBytes: 120_000,
  },
  high: {
    id: "high",
    label: "High Quality",
    shortLabel: "High Quality",
    description: "Maximum visual fidelity. Larger files — best for print or portfolio use.",
    tooltip: "Maximum visual fidelity with minimal compression. Best for print or portfolio use.",
    targetCvOnlyBytes: 8 * 1024 * 1024,
    targetWithCoverLetterBytes: 10 * 1024 * 1024,
    rasterScales: [3, 2.5, 2],
    rasterQualities: [0.94, 0.92, 0.88, 0.82],
    maxImageWidth: 800,
    profilePhotoSizePx: 320,
    logoMaxWidth: 600,
    logoMaxHeight: 168,
    imageQuality: 0.92,
    profileQuality: 0.92,
    logoQuality: 0.92,
    stripHtmlMetadata: false,
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,300..800&display=swap",
    playwrightScale: 1,
    imageSizeFactor: 0.95,
    perPageOverheadBytes: 68_000,
    fontOverheadBytes: 200_000,
  },
}

export const DEFAULT_PDF_EXPORT_PRESET: PdfExportPreset = "ats"

export const PDF_SIZE_WARNING_BYTES = 5 * 1024 * 1024
export const PDF_SIZE_STRONG_WARNING_BYTES = 10 * 1024 * 1024

export function parsePdfExportPreset(value: string | null | undefined): PdfExportPreset {
  if (value === "standard" || value === "high" || value === "ats") return value
  return DEFAULT_PDF_EXPORT_PRESET
}

export function formatPdfSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isSavedResumeId(id: string | undefined | null): boolean {
  if (!id || id === "temp" || id.startsWith("local-")) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}
