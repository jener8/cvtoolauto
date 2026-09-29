import sharp from "sharp"
import {
  DEFAULT_PDF_EXPORT_PRESET,
  PDF_EXPORT_PRESETS,
  type PdfExportPreset,
} from "@/lib/pdf-export-presets"
import type { ResumeVersion } from "@/lib/types"

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) return null
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") }
}

async function compressDataUrl(
  dataUrl: string | null | undefined,
  preset: PdfExportPreset,
  kind: "profile" | "logo",
): Promise<string | null | undefined> {
  if (!dataUrl?.trim().startsWith("data:image/")) return dataUrl

  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return dataUrl

  const config = PDF_EXPORT_PRESETS[preset]
  const maxWidth = kind === "profile" ? config.profilePhotoSizePx : config.logoMaxWidth
  const maxHeight = kind === "logo" ? config.logoMaxHeight : config.profilePhotoSizePx
  const quality = Math.round(
    (kind === "profile" ? config.profileQuality : config.logoQuality) * 100,
  )

  try {
    const pipeline = sharp(parsed.buffer).rotate().flatten({ background: "#ffffff" })
    const resized =
      kind === "profile"
        ? pipeline.resize(maxWidth, maxWidth, { fit: "cover", position: "centre" })
        : pipeline.resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })

    const output = await resized.jpeg({ quality, mozjpeg: true }).toBuffer()
    return `data:image/jpeg;base64,${output.toString("base64")}`
  } catch (err) {
    console.warn("[pdf] Server image optimization skipped:", err)
    return dataUrl
  }
}

/** Compress embedded resume images before headless PDF export. */
export async function optimizeResumeVersionForPdfExport(
  version: ResumeVersion,
  preset: PdfExportPreset = DEFAULT_PDF_EXPORT_PRESET,
): Promise<ResumeVersion> {
  const [profileImage, companyLogo] = await Promise.all([
    compressDataUrl(version.profileImage, preset, "profile"),
    compressDataUrl(version.companyLogo, preset, "logo"),
  ])

  if (profileImage === version.profileImage && companyLogo === version.companyLogo) {
    return version
  }

  return { ...version, profileImage: profileImage ?? null, companyLogo: companyLogo ?? null }
}
