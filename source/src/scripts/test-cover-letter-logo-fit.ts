/**
 * Cover letter logo must fit with contain — never crop to a square.
 * Run: npx tsx scripts/test-cover-letter-logo-fit.ts
 */
import assert from "node:assert/strict"
import {
  COVER_LETTER_LOGO_MAX_H,
  COVER_LETTER_LOGO_MAX_W,
  COVER_LETTER_LOGO_PAD_PX,
  buildCoverLetterExportHtml,
  coverLetterLogoFrameStyle,
  coverLetterLogoImageStyle,
  type CoverLetterExportData,
} from "../lib/cover-letter-export-html"
import { flattenLogoForPdfExport } from "../lib/compress-image"

assert.equal(COVER_LETTER_LOGO_MAX_W, 120)
assert.equal(COVER_LETTER_LOGO_MAX_H, 60)
assert.equal(COVER_LETTER_LOGO_PAD_PX, 4)

const frame = coverLetterLogoFrameStyle()
assert.match(frame, /object-fit|max-width:120px/)
assert.match(frame, /overflow:visible/)
assert.doesNotMatch(frame, /border:1px/)
assert.match(frame, /inline-flex/)

const imgStyle = coverLetterLogoImageStyle()
assert.match(imgStyle, /object-fit:contain/)
assert.match(imgStyle, /object-position:center/)
assert.match(imgStyle, /max-width:112px/)
assert.match(imgStyle, /max-height:52px/)
assert.doesNotMatch(imgStyle, /object-fit:\s*cover/)

const base: CoverLetterExportData = {
  applicantName: "Test",
  applicantAddress: "",
  applicantEmail: "",
  applicantPhone: "",
  profileImage: null,
  companyLogo: "data:image/jpeg;base64,/9j/4AAQ",
  recipientCompany: "HelloFresh",
  hiringManager: "",
  language: "en",
  dateLabel: "1 Jan 2026",
  bodyText: "Hello.",
  companyLogoWidth: 112,
  companyLogoHeight: 40,
}

const html = buildCoverLetterExportHtml(base)
assert.match(html, /cover-letter-company-logo/)
assert.match(html, /object-fit:contain/)
assert.doesNotMatch(html, /object-fit:\s*cover/)
assert.doesNotMatch(html, /border:1px solid/)

// Fit math for wide / square / tall (mirrors flattenLogoForPdfExport scale)
function fit(w: number, h: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / w, maxH / h, 1)
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}
const innerW = COVER_LETTER_LOGO_MAX_W - COVER_LETTER_LOGO_PAD_PX * 2
const innerH = COVER_LETTER_LOGO_MAX_H - COVER_LETTER_LOGO_PAD_PX * 2

const wide = fit(400, 100, innerW, innerH)
assert.ok(wide.w <= innerW && wide.h <= innerH)
assert.equal(wide.w / wide.h, 4)

const square = fit(200, 200, innerW, innerH)
assert.ok(square.w <= innerW && square.h <= innerH)
assert.equal(square.w, square.h)

const tall = fit(80, 200, innerW, innerH)
assert.ok(tall.w <= innerW && tall.h <= innerH)
assert.ok(Math.abs(tall.w / tall.h - 0.4) < 0.02)

void flattenLogoForPdfExport

console.log("test-cover-letter-logo-fit: ok")
