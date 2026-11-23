/**
 * Live check: export HTML + Standard PDF for all three CV styles.
 * Uses a saved resume id and the running next start server.
 * Run: npx tsx scripts/test-cv-format-style-live-export.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generatePdfToken } from "../lib/pdf-token"

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000"
const RESUME_ID =
  process.env.TEST_RESUME_ID || "dd51b905-d7ce-4bb1-bb48-a08a5dd84e64"

const STYLES = [
  { id: "current" as const, header: "profile-enhanced", label: "Profile-enhanced Design" },
  {
    id: "executive-compact" as const,
    header: "executive-compact",
    label: "Executive Compact",
  },
  { id: "modern-spacious" as const, header: "modern-spacious", label: "Modern Spacious" },
]

const outDir = path.join("/tmp", "cv-format-style-pdfs")
fs.mkdirSync(outDir, { recursive: true })

async function fetchExportHtml(formatStyle: string): Promise<string> {
  const token = await generatePdfToken(RESUME_ID, "authenticated-user")
  const q = new URLSearchParams({
    token,
    preset: "standard",
    metadata: "0",
    formatStyle,
  })
  const url = `${BASE}/export/resume/${RESUME_ID}?${q}`
  const res = await fetch(url)
  const text = await res.text()
  assert.equal(res.status, 200, `export HTML ${formatStyle}: ${res.status}\n${text.slice(0, 400)}`)
  assert.match(text, /id="resume-root"/, `missing #resume-root for ${formatStyle}`)
  return text
}

async function fetchStandardPdf(formatStyle: string): Promise<Buffer> {
  const q = new URLSearchParams({
    preset: "standard",
    metadata: "0",
    formatStyle,
  })
  const url = `${BASE}/api/pdf/resume/${RESUME_ID}?${q}`
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  assert.equal(res.status, 200, `PDF ${formatStyle}: ${res.status}`)
  assert.ok(buf.slice(0, 5).toString() === "%PDF-", `not a PDF for ${formatStyle}`)
  assert.ok(buf.length > 20_000, `PDF too small for ${formatStyle}: ${buf.length}`)
  return buf
}

async function main() {
  for (const style of STYLES) {
    const html = await fetchExportHtml(style.id)
    assert.match(
      html,
      new RegExp(`data-cv-header="${style.header}"`),
      `${style.label}: expected data-cv-header="${style.header}" in export HTML`,
    )
    for (const other of STYLES) {
      if (other.header === style.header) continue
      assert.doesNotMatch(
        html,
        new RegExp(`data-cv-header="${other.header}"`),
        `${style.label}: must not also render ${other.header}`,
      )
    }
    // Career Evolution should remain available on Standard when present in CV
    // (soft check — only if the section exists in this resume)
    if (html.includes("CAREER EVOLUTION") || html.includes("data-career-evolution")) {
      assert.match(html, /career-evolution|CAREER EVOLUTION/i)
    }

    const pdf = await fetchStandardPdf(style.id)
    const pdfPath = path.join(outDir, `${style.id}.pdf`)
    fs.writeFileSync(pdfPath, pdf)
    console.log(`ok ${style.label} → header=${style.header} pdf=${pdf.length}B ${pdfPath}`)
  }

  // ATS must still succeed (intentionally simplified; style query optional)
  const atsQ = new URLSearchParams({ preset: "ats", metadata: "0", formatStyle: "current" })
  const atsRes = await fetch(`${BASE}/api/pdf/resume/${RESUME_ID}?${atsQ}`)
  const atsBuf = Buffer.from(await atsRes.arrayBuffer())
  assert.equal(atsRes.status, 200)
  assert.ok(atsBuf.slice(0, 5).toString() === "%PDF-")
  fs.writeFileSync(path.join(outDir, "ats.pdf"), atsBuf)
  console.log(`ok ATS Optimized PDF → ${atsBuf.length}B`)

  // Persisted path: no formatStyle query → uses contactInfo (defaults executive-compact if unset)
  const token = await generatePdfToken(RESUME_ID, "authenticated-user")
  const persisted = await fetch(
    `${BASE}/export/resume/${RESUME_ID}?${new URLSearchParams({
      token,
      preset: "standard",
      metadata: "0",
    })}`,
  )
  const persistedHtml = await persisted.text()
  assert.equal(persisted.status, 200)
  assert.match(persistedHtml, /data-cv-header="(profile-enhanced|executive-compact|modern-spacious)"/)
  console.log("ok persisted contactInfo.formatStyle export path")

  console.log("test-cv-format-style-live-export: ok")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
