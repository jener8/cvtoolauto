import {
  flattenImagesForPdfExport,
  type FlattenImagesForPdfOptions,
} from "@/lib/compress-image"
import { PDF_EXPORT_PRESETS, type PdfExportPreset } from "@/lib/pdf-export-presets"

export function flattenOptionsForPreset(preset: PdfExportPreset): FlattenImagesForPdfOptions {
  const config = PDF_EXPORT_PRESETS[preset]
  return {
    backgroundColor: "#ffffff",
    maxImageWidth: config.maxImageWidth,
    profilePhotoSizePx: config.profilePhotoSizePx,
    logoMaxWidth: config.logoMaxWidth,
    logoMaxHeight: config.logoMaxHeight,
    quality: config.imageQuality,
    profileQuality: config.profileQuality,
    logoQuality: config.logoQuality,
  }
}

/** Remove hidden / decorative nodes that inflate PDF size without adding content. */
export function stripHiddenExportNodes(root: HTMLElement): void {
  root.querySelectorAll(".page-label, .page-break-label, [data-pdf-debug]").forEach((el) => {
    el.remove()
  })

  root.querySelectorAll("img").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return
    const style = window.getComputedStyle(img)
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      img.remove()
      return
    }
    if (img.hasAttribute("hidden")) img.remove()
  })
}

/** Resize / recompress inline images and drop unused assets before export. */
export async function optimizeDomForPdfExport(
  root: HTMLElement,
  preset: PdfExportPreset,
): Promise<void> {
  stripHiddenExportNodes(root)
  await flattenImagesForPdfExport(root, flattenOptionsForPreset(preset))
}
