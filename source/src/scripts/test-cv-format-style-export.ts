/**
 * CV style (Appearance → CV style) must be the single source of truth for
 * editor preview and Standard PDF export — not an ephemeral default.
 * Run: npx tsx scripts/test-cv-format-style-export.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  DEFAULT_CV_FORMAT_STYLE,
  normalizeCvFormatStyle,
} from "../lib/ai-transparency"
import { normalizeContactInfo } from "../lib/contact-info"

const root = path.join(__dirname, "..")
const preview = fs.readFileSync(path.join(root, "components/resume-preview.tsx"), "utf8")
const exportPage = fs.readFileSync(
  path.join(root, "app/export/resume/[id]/page.tsx"),
  "utf8",
)
const pdfRoute = fs.readFileSync(
  path.join(root, "app/api/pdf/resume/[id]/route.ts"),
  "utf8",
)
const types = fs.readFileSync(path.join(root, "lib/types.ts"), "utf8")
const localStorage = fs.readFileSync(
  path.join(root, "lib/resume-local-storage.ts"),
  "utf8",
)

// --- normalize helpers ---
assert.equal(DEFAULT_CV_FORMAT_STYLE, "executive-compact")
assert.equal(normalizeCvFormatStyle("current"), "current")
assert.equal(normalizeCvFormatStyle("executive-compact"), "executive-compact")
assert.equal(normalizeCvFormatStyle("modern-spacious"), "modern-spacious")
assert.equal(normalizeCvFormatStyle("profile-enhanced"), "current")
assert.equal(normalizeCvFormatStyle("bogus"), DEFAULT_CV_FORMAT_STYLE)

assert.equal(normalizeContactInfo({ formatStyle: "current" }).formatStyle, "current")
assert.equal(
  normalizeContactInfo({ formatStyle: "modern-spacious" }).formatStyle,
  "modern-spacious",
)
assert.equal(normalizeContactInfo({}).formatStyle, DEFAULT_CV_FORMAT_STYLE)
assert.equal(
  normalizeContactInfo({ format_style: "current" } as Record<string, unknown>).formatStyle,
  "current",
)

// --- persistence surface ---
assert.match(types, /formatStyle\?:/)
assert.match(localStorage, /out\.fs = c\.formatStyle/)
assert.match(localStorage, /formatStyle: raw\.fs/)

// --- preview must NOT keep a hardcoded useState default that ignores contactInfo ---
assert.doesNotMatch(
  preview,
  /useState<\s*HumanFormatStyle\s*>\(\s*"executive-compact"\s*\)/,
)
assert.match(preview, /normalizeCvFormatStyle\(\s*displayVersion\.contactInfo\.formatStyle/)
assert.match(preview, /formatStyle:\s*nextStyle/)
assert.match(preview, /params\.set\("formatStyle",\s*options\.formatStyle\)/)

// Distinct header markers for each template (export HTML fingerprint)
assert.match(preview, /data-cv-header="profile-enhanced"/)
assert.match(preview, /data-cv-header="executive-compact"/)
assert.match(preview, /data-cv-header="modern-spacious"/)

// --- export / API wire formatStyle through ---
assert.match(pdfRoute, /formatStyle/)
assert.match(pdfRoute, /exportQuery\.set\("formatStyle"/)
assert.match(exportPage, /query\.formatStyle/)
assert.match(exportPage, /contactInfo\.formatStyle = normalizeCvFormatStyle/)
assert.match(exportPage, /variant="export"/)

console.log("test-cv-format-style-export: ok")
