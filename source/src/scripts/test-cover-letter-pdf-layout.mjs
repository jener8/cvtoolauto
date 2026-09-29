/**
 * Cover-letter PDF: single A4 page, one salutation, selectable text.
 * Run: node scripts/test-cover-letter-pdf-layout.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "../../out")

function letterBodyStartsWithSalutation(body) {
  const firstLine =
    body
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  if (!firstLine) return false
  return /^(dear|hello|hi|to\s+the|sehr\s+geehrte|hallo|guten\s+tag)\b/i.test(firstLine)
}

function resolveCoverLetterSalutation({ hiringManager, language, bodyText }) {
  if (letterBodyStartsWithSalutation(bodyText ?? "")) return null
  const manager = (hiringManager ?? "").trim()
  if (manager) {
    return language === "en" ? `Dear ${manager},` : `Sehr geehrte/r ${manager},`
  }
  return language === "en" ? "Dear Sir or Madam," : "Sehr geehrte Damen und Herren,"
}

const BODY = `Dear Bending Spoons team,

I am a product designer, researcher and increasingly a builder who believes the strongest product work starts with clear problem framing — then uses AI and research to move from insight to shipped experience without losing craft.

That is what attracted me to this role. Your description of a designer who starts by thinking through the problem with an LLM, then validates with users and iterates in the product, matches how I already work across research, UX and UI.

At Bundesdruckerei and through EquitAI I have led discovery, designed end-to-end flows, and partnered with engineering to ship. I am comfortable writing concise prompts, shaping evaluation criteria, and translating research into interface decisions that stay accountable to users.

I would be excited to bring this perspective to WeTransfer and the wider Bending Spoons team.`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function paragraphsToHtml(body) {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((p) => {
      const lines = p
        .split("\n")
        .map((l) => escapeHtml(l.trim()))
        .filter(Boolean)
        .join("<br/>")
      return `<p style="margin:0 0 0.55em 0;line-height:1.35;font-size:11pt;">${lines}</p>`
    })
    .join("\n")
}

/** Mirrors source/src/lib/cover-letter-export-html.ts spacing. */
function buildLetterHtml() {
  const salutation = resolveCoverLetterSalutation({
    hiringManager: "",
    language: "en",
    bodyText: BODY,
  })
  const salutationBlock = salutation
    ? `<div style="margin:0 0 10px 0;font-size:11pt;">${escapeHtml(salutation)}</div>`
    : ""

  return `<div id="cover-letter-preview" style="font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.35;color:#171717;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;border-bottom:1px solid #e5e5e5;">
    <tr>
      <td style="vertical-align:top;padding:0 0 10px 0;">
        <div style="margin:0 0 2px 0;font-weight:600;font-size:12pt;">Jennifer Simonds-Spellmann</div>
        <div style="margin:0;font-size:10.5pt;line-height:1.35;">Berlin - Germany</div>
        <div style="margin:0;font-size:10.5pt;line-height:1.35;">East Croydon - England</div>
        <div style="margin:0;font-size:10.5pt;line-height:1.35;">info@jennifersimonds.com</div>
      </td>
      <td style="vertical-align:top;width:1%;padding:0 0 10px 16px;text-align:right;">
        <div style="font-size:10.5pt;white-space:nowrap;">+4917623800000</div>
        <div style="margin-top:8px;width:72px;height:72px;border-radius:50%;border:1px solid #e5e5e5;background:#f5f5f5;margin-left:auto;"></div>
      </td>
    </tr>
  </table>
  <div style="margin:0 0 10px 0;font-size:10.5pt;">September 28, 2026</div>
  <div style="margin:0 0 10px 0;font-weight:600;font-size:11pt;">Bending Spoons</div>
  ${salutationBlock}
  <div class="formatted-letter-content" style="margin:0 0 12px 0;">
    ${paragraphsToHtml(BODY)}
  </div>
  <div class="cover-letter-closing" style="page-break-inside:avoid;break-inside:avoid;">
    <div style="margin:0 0 16px 0;">Sincerely,</div>
    <div>Jennifer Simonds-Spellmann</div>
  </div>
</div>`
}

function buildPrintDocument(letterHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 16mm 18mm 16mm 18mm; }
    html, body {
      margin: 0; padding: 0; background: #ffffff; color: #171717;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 11pt; line-height: 1.35;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    #cover-letter-preview { width: 100%; box-sizing: border-box; }
    .cover-letter-closing { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>${letterHtml}</body>
</html>`
}

async function main() {
  assert(letterBodyStartsWithSalutation(BODY) === true, "body should start with salutation")
  assert(
    resolveCoverLetterSalutation({ hiringManager: "", language: "en", bodyText: BODY }) === null,
    "template salutation must be suppressed",
  )
  assert(
    resolveCoverLetterSalutation({
      hiringManager: "",
      language: "en",
      bodyText: "I am a product designer…",
    }) === "Dear Sir or Madam,",
    "template salutation should appear when body has no greeting",
  )
  console.log("✓ salutation unit tests")

  const letterHtml = buildLetterHtml()
  assert(!letterHtml.includes("Dear Sir or Madam"), "HTML must not include default salutation")
  assert(
    (letterHtml.match(/Dear Bending Spoons team/g) ?? []).length === 1,
    "user salutation exactly once",
  )

  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    browser = await chromium.launch({ headless: true, channel: "chrome" })
  }
  try {
    const page = await browser.newPage()
    await page.setContent(buildPrintDocument(letterHtml), {
      waitUntil: "load",
      timeout: 60000,
    })
    await page.evaluate(() => document.fonts.ready)

    const metrics = await page.evaluate(() => {
      const root = document.getElementById("cover-letter-preview")
      const height = root ? root.getBoundingClientRect().height : document.body.scrollHeight
      const a4ContentPx = (265 * 96) / 25.4
      return { height, a4ContentPx, fits: height <= a4ContentPx + 8 }
    })
    console.log(
      `  measured letter height: ${metrics.height.toFixed(1)}px / A4 content ~${metrics.a4ContentPx.toFixed(1)}px`,
    )
    assert(metrics.fits, `letter overflows one A4 (${metrics.height}px > ${metrics.a4ContentPx}px)`)

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })

    mkdirSync(outDir, { recursive: true })
    const pdfPath = join(outDir, "test-bending-spoons-cover-letter.pdf")
    writeFileSync(pdfPath, pdf)
    console.log(`  wrote ${pdfPath} (${pdf.length} bytes)`)

    const asText = pdf.toString("latin1")
    const pageCount = (asText.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length
    console.log(`  PDF page objects: ${pageCount}`)
    assert(pageCount === 1, `expected 1 PDF page, got ${pageCount}`)
    // Chrome embeds glyph IDs; confirm text architecture (fonts + Tj), not a full-page image raster.
    assert(/\/Font\b/.test(asText) && /\/ToUnicode\b/.test(asText), "PDF should include fonts/ToUnicode")
    assert((asText.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length === 1, "single page object")
    const contentMatch = asText.match(/\d+ 0 obj[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/)
    assert(Boolean(contentMatch), "PDF should have a content stream")
    let tjCount = 0
    try {
      const { inflateSync } = await import("node:zlib")
      const inflated = inflateSync(Buffer.from(contentMatch[1], "binary")).toString("latin1")
      tjCount = (inflated.match(/Tj/g) ?? []).length
    } catch {
      /* stream may not be the text content; Font+ToUnicode is enough */
    }
    console.log(`  Tj operators in first stream (best-effort): ${tjCount}`)
    assert(!asText.includes("Dear Sir or Madam"), "PDF must not contain default salutation")
    console.log("✓ PDF layout + selectable text architecture")
  } finally {
    await browser.close()
  }

  console.log("All cover-letter PDF layout checks passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
