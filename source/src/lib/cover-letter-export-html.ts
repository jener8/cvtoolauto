import {
  resolveCoverLetterSalutation,
  sanitizeCoverLetterField,
} from "@/lib/cover-letter-contact"
import {
  flattenLogoForPdfExport,
  flattenProfilePhotoForPdfExport,
} from "@/lib/compress-image"
import { formattedLetterContentToHtml } from "@/lib/formatted-letter-content"
import { escapeHtmlText } from "@/lib/resume-inline-links"

export type CoverLetterExportData = {
  applicantName: string
  applicantAddress: string
  applicantEmail: string
  applicantPhone: string
  profileImage: string | null
  companyLogo: string | null
  recipientCompany: string
  hiringManager: string
  language: "en" | "de"
  dateLabel: string
  bodyText: string
  /** Pre-rasterized logo dimensions (html2canvas needs explicit px sizes). */
  companyLogoWidth?: number
  companyLogoHeight?: number
}

const FONT = "Georgia, 'Times New Roman', serif"
const TEXT = "#171717"
const MUTED = "#262626"
const BORDER = "#e5e5e5"

/** On-screen / print display size (CSS px). */
export const COVER_LETTER_PROFILE_DISPLAY_PX = 72
export const COVER_LETTER_EXPORT_LOGO_MAX_W = 200
export const COVER_LETTER_EXPORT_LOGO_MAX_H = 48

/** Raster images at 3× then display at 1× so PDF capture stays sharp without excess height. */
export const PDF_EXPORT_IMAGE_DPR = 3
export const PDF_EXPORT_IMAGE_JPEG_QUALITY = 0.92

/** Body ~10.5–11pt; compact line-height for single-page A4. */
const BODY_FONT = "11pt"
const BODY_LINE = "1.35"
const META_FONT = "10.5pt"

function escapePlain(text: string): string {
  return escapeHtmlText(text)
}

function closingLine(data: CoverLetterExportData): string {
  return data.language === "en" ? "Sincerely," : "Mit freundlichen Grüßen,"
}

/** HTML for cover letter PDF — block/table layout only (no Tailwind/flex). */
export function buildCoverLetterExportHtml(data: CoverLetterExportData): string {
  const applicantName = sanitizeCoverLetterField(data.applicantName)
  const applicantEmail = sanitizeCoverLetterField(data.applicantEmail)
  const applicantPhone = sanitizeCoverLetterField(data.applicantPhone)
  const dateLabel = sanitizeCoverLetterField(data.dateLabel)

  const addressLines = data.applicantAddress
    .split("\n")
    .map((line) => sanitizeCoverLetterField(line))
    .filter(Boolean)
    .map(
      (line) =>
        `<div style="margin:0;padding:0;color:${MUTED};font-size:${META_FONT};line-height:1.35;">${escapePlain(line)}</div>`,
    )
    .join("")

  const leftSenderLines = [
    applicantName
      ? `<div style="margin:0 0 2px 0;font-weight:600;font-size:12pt;line-height:1.3;color:${TEXT};">${escapePlain(applicantName)}</div>`
      : "",
    addressLines,
    applicantEmail
      ? `<div style="margin:0;padding:0;color:${MUTED};font-size:${META_FONT};line-height:1.35;">${escapePlain(applicantEmail)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("")

  /** Right column must fit 72px photo + phone without overflowing A4 content box. */
  const SENDER_RIGHT_COL_PX = Math.max(COVER_LETTER_PROFILE_DISPLAY_PX + 8, 112)

  const phoneBlock = applicantPhone
    ? `<div class="cover-letter-sender-phone" style="margin:0;padding:0;color:${MUTED};font-size:${META_FONT};line-height:1.3;text-align:right;text-align-last:right;white-space:normal;overflow-wrap:anywhere;word-break:break-word;max-width:100%;">${escapePlain(applicantPhone)}</div>`
    : ""

  const photoBlock = data.profileImage
    ? `<img
          alt=""
          class="cover-letter-profile-photo"
          width="${COVER_LETTER_PROFILE_DISPLAY_PX}"
          height="${COVER_LETTER_PROFILE_DISPLAY_PX}"
          style="display:block;width:${COVER_LETTER_PROFILE_DISPLAY_PX}px;height:${COVER_LETTER_PROFILE_DISPLAY_PX}px;max-width:${COVER_LETTER_PROFILE_DISPLAY_PX}px;border-radius:50%;border:1px solid ${BORDER};margin:0 0 0 auto;padding:0;box-sizing:border-box;"
        />`
    : ""

  const rightSenderCell =
    phoneBlock || photoBlock
      ? `<table role="presentation" class="cover-letter-sender-right-inner" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:100%;margin:0;table-layout:fixed;">
          ${
            phoneBlock
              ? `<tr><td style="padding:0 0 ${photoBlock ? "8px" : "0"} 0;text-align:right;text-align-last:right;vertical-align:top;width:100%;">${phoneBlock}</td></tr>`
              : ""
          }
          ${
            photoBlock
              ? `<tr><td style="padding:0;text-align:right;text-align-last:right;vertical-align:top;width:100%;">${photoBlock}</td></tr>`
              : ""
          }
        </table>`
      : ""

  const hasSenderHeader = leftSenderLines.trim().length > 0 || Boolean(rightSenderCell)

  const senderSection = hasSenderHeader
    ? `<table role="presentation" class="cover-letter-sender-header" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 12px 0;border-bottom:1px solid ${BORDER};">
    <tr>
      <td class="cover-letter-sender-left" style="vertical-align:top;padding:0 0 10px 0;text-align:left;overflow-wrap:anywhere;word-break:break-word;">
        ${leftSenderLines}
      </td>
      ${
        rightSenderCell
          ? `<td class="cover-letter-sender-right" style="vertical-align:top;width:${SENDER_RIGHT_COL_PX}px;max-width:${SENDER_RIGHT_COL_PX}px;padding:0 0 10px 12px;text-align:right;text-align-last:right;overflow:visible;">
        ${rightSenderCell}
      </td>`
          : ""
      }
    </tr>
  </table>`
      : ""

  const recipientParts: string[] = []
  if (data.companyLogo && data.companyLogoWidth && data.companyLogoHeight) {
    const lw = data.companyLogoWidth
    const lh = data.companyLogoHeight
    recipientParts.push(
      `<div class="cover-letter-logo-frame" style="display:block;background:#ffffff;border:1px solid ${BORDER};border-radius:6px;padding:6px;margin:0 0 6px 0;width:${lw + 12}px;">
        <img alt="" class="cover-letter-company-logo" data-pdf-prepared="1" width="${lw}" height="${lh}" style="display:block;width:${lw}px;height:${lh}px;background:#ffffff;border:0;" />
      </div>`,
    )
  }
  if (data.recipientCompany.trim()) {
    recipientParts.push(
      `<div style="margin:0 0 2px 0;font-weight:600;font-size:11pt;line-height:1.3;color:${TEXT};">${escapePlain(data.recipientCompany.trim())}</div>`,
    )
  }
  if (data.hiringManager.trim()) {
    recipientParts.push(
      `<div style="margin:0;color:${MUTED};font-size:${META_FONT};line-height:1.35;">${escapePlain(data.hiringManager.trim())}</div>`,
    )
  }

  const recipientBlock =
    recipientParts.length > 0
      ? `<div style="display:block;margin:0 0 10px 0;text-align:left;">${recipientParts.join("")}</div>`
      : ""

  const bodyHtml = data.bodyText.trim()
    ? formattedLetterContentToHtml(data.bodyText, {
        linkColor: "#0369a1",
        underline: true,
        pdfSafe: true,
      })
    : `<p style="margin:0.35em 0;line-height:${BODY_LINE};color:#6b7280;font-size:${BODY_FONT};">&nbsp;</p>`

  const dateBlock = dateLabel
    ? `<div style="display:block;margin:0 0 10px 0;font-size:${META_FONT};line-height:1.35;color:${MUTED};text-align:left;">${escapePlain(dateLabel)}</div>`
    : ""

  const templateSalutation = resolveCoverLetterSalutation({
    hiringManager: data.hiringManager,
    language: data.language,
    bodyText: data.bodyText,
  })
  const salutationBlock = templateSalutation
    ? `<div style="display:block;margin:0 0 10px 0;font-size:${BODY_FONT};line-height:${BODY_LINE};text-align:left;">${escapePlain(templateSalutation)}</div>`
    : ""

  const closingName = applicantName
    ? `<div style="margin:0;font-weight:400;">${escapePlain(applicantName)}</div>`
    : ""

  return `<div id="cover-letter-preview" style="display:block;box-sizing:border-box;width:100%;margin:0;padding:0;background:#ffffff;color:${TEXT};font-family:${FONT};font-size:${BODY_FONT};line-height:${BODY_LINE};text-align:left;text-align-last:left;">
  ${senderSection}

  ${dateBlock}

  ${recipientBlock}

  ${salutationBlock}

  <div class="formatted-letter-content" style="display:block;width:100%;margin:0 0 12px 0;font-size:${BODY_FONT};line-height:${BODY_LINE};text-align:left;text-align-last:left;">
    ${bodyHtml}
  </div>

  <div class="cover-letter-closing" style="display:block;margin:0;font-size:${BODY_FONT};line-height:${BODY_LINE};text-align:left;page-break-inside:avoid;break-inside:avoid;">
    <div style="margin:0 0 16px 0;">${escapePlain(closingLine(data))}</div>
    ${closingName}
  </div>
</div>`
}

/** Assign large data URLs via DOM — avoids innerHTML truncation on long base64 strings. */
function attachExportImageSources(root: HTMLElement, data: CoverLetterExportData): void {
  if (data.profileImage) {
    const photo = root.querySelector("img.cover-letter-profile-photo")
    if (photo instanceof HTMLImageElement) {
      photo.src = data.profileImage
      photo.dataset.pdfPrepared = "1"
    }
  }
  if (data.companyLogo) {
    const logo = root.querySelector("img.cover-letter-company-logo")
    if (logo instanceof HTMLImageElement) {
      logo.src = data.companyLogo
      logo.dataset.pdfPrepared = "1"
      if (data.companyLogoWidth && data.companyLogoHeight) {
        logo.width = data.companyLogoWidth
        logo.height = data.companyLogoHeight
        logo.style.width = `${data.companyLogoWidth}px`
        logo.style.height = `${data.companyLogoHeight}px`
        logo.style.maxWidth = "none"
        logo.style.maxHeight = "none"
        logo.style.objectFit = "none"
      }
    }
  }
}

/** Rasterize images before export so html2canvas / Playwright get JPEGs with explicit dimensions. */
export async function prepareCoverLetterExportData(
  data: CoverLetterExportData,
): Promise<CoverLetterExportData> {
  let profileImage = data.profileImage
  let companyLogo = data.companyLogo
  let companyLogoWidth = data.companyLogoWidth
  let companyLogoHeight = data.companyLogoHeight

  if (profileImage?.trim()) {
    try {
      profileImage = await flattenProfilePhotoForPdfExport(
        profileImage.trim(),
        COVER_LETTER_PROFILE_DISPLAY_PX * PDF_EXPORT_IMAGE_DPR,
        "#ffffff",
        PDF_EXPORT_IMAGE_JPEG_QUALITY,
      )
    } catch (err) {
      console.warn("[cover-letter] Profile photo prepare failed:", err)
    }
  }

  if (companyLogo?.trim()) {
    try {
      const flat = await flattenLogoForPdfExport(
        companyLogo.trim(),
        COVER_LETTER_EXPORT_LOGO_MAX_W * PDF_EXPORT_IMAGE_DPR,
        COVER_LETTER_EXPORT_LOGO_MAX_H * PDF_EXPORT_IMAGE_DPR,
        "#ffffff",
        PDF_EXPORT_IMAGE_JPEG_QUALITY,
      )
      companyLogo = flat.dataUrl
      companyLogoWidth = Math.max(1, Math.round(flat.width / PDF_EXPORT_IMAGE_DPR))
      companyLogoHeight = Math.max(1, Math.round(flat.height / PDF_EXPORT_IMAGE_DPR))
    } catch (err) {
      console.warn("[cover-letter] Logo prepare failed:", err)
    }
  }

  return {
    ...data,
    profileImage,
    companyLogo,
    companyLogoWidth,
    companyLogoHeight,
  }
}

/** Build a detached DOM node for PDF export (do not clone from on-screen preview). */
export async function buildCoverLetterExportElement(
  data: CoverLetterExportData,
): Promise<HTMLElement> {
  const prepared = await prepareCoverLetterExportData(data)
  const wrapper = document.createElement("div")
  wrapper.innerHTML = buildCoverLetterExportHtml(prepared)
  const root = wrapper.firstElementChild
  if (!(root instanceof HTMLElement)) {
    throw new Error("Failed to build cover letter export DOM")
  }
  attachExportImageSources(root, prepared)
  return root
}

/** Full HTML document for Playwright text PDF (selectable/searchable). */
export function buildCoverLetterPrintDocument(letterHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 16mm 18mm 16mm 18mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #171717;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    *, *::before, *::after { box-sizing: border-box; }
    #cover-letter-preview {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: visible;
    }
    .cover-letter-sender-header {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .cover-letter-sender-left {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .cover-letter-sender-right {
      width: 112px !important;
      max-width: 112px !important;
      text-align: right !important;
      text-align-last: right !important;
      overflow: visible !important;
    }
    .cover-letter-sender-right-inner {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
    }
    .cover-letter-sender-phone {
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      max-width: 100% !important;
      text-align: right !important;
      text-align-last: right !important;
    }
    .cover-letter-closing { page-break-inside: avoid; break-inside: avoid; }
    img { max-width: 100%; }
    img.cover-letter-profile-photo {
      width: 72px !important;
      height: 72px !important;
      max-width: 72px !important;
      max-height: 72px !important;
    }
  </style>
</head>
<body>${letterHtml}</body>
</html>`
}
