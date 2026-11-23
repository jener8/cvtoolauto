/**
 * Formatter Export must expose PDF quality presets so Standard can keep
 * Career Evolution (ATS remains the omit path).
 * Run: npx tsx scripts/test-ce-export-preset-ui.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  emptyCareerEvolutionConfig,
  placeCareerEvolutionInSections,
  shouldRenderCareerEvolutionInPdf,
} from "../lib/career-evolution"

const root = path.join(__dirname, "..")
const exportPanel = fs.readFileSync(
  path.join(root, "components/formatter-export-panel.tsx"),
  "utf8",
)
const preview = fs.readFileSync(path.join(root, "components/resume-preview.tsx"), "utf8")
const exportPage = fs.readFileSync(
  path.join(root, "app/export/resume/[id]/page.tsx"),
  "utf8",
)

assert.match(exportPanel, /PdfExportControls/)
assert.match(exportPanel, /pdfExportPreset/)
assert.match(exportPanel, /onPdfExportPresetChange/)
assert.match(preview, /pdfExportPreset=\{pdfExportPreset\}/)
assert.match(preview, /onPdfExportPresetChange=\{setPdfExportPreset\}/)

// Client ATS strip must stay gated on preset === "ats" only
assert.match(preview, /if \(preset === "ats"\)/)
assert.doesNotMatch(
  preview,
  /if \(preset === "ats" \|\| preset === "standard"\)/,
)

// Next.js 16: export page must await Promise searchParams/params or PDF tokens 404
assert.match(exportPage, /params:\s*Promise</)
assert.match(exportPage, /searchParams:\s*Promise</)
assert.match(exportPage, /await params/)
assert.match(exportPage, /await searchParams/)
// PDF export page must use authenticated service client (anon hits RLS → 404)
assert.match(exportPage, /createServerServiceSupabaseClient/)
assert.doesNotMatch(exportPage, /getServerSupabaseClient/)

const convergence = emptyCareerEvolutionConfig({
  visible: true,
  layout: "convergence",
  capabilities: [
    { id: "c1", label: "Research & discovery" },
    { id: "c2", label: "Product design & delivery" },
  ],
  convergenceTarget: "Staff UX Strategist",
})

assert.equal(shouldRenderCareerEvolutionInPdf("standard", convergence), true)
assert.equal(shouldRenderCareerEvolutionInPdf("high", convergence), true)
assert.equal(shouldRenderCareerEvolutionInPdf("ats", convergence), false)

const placed = placeCareerEvolutionInSections(
  [
    { title: "PROFILE", content: [] },
    { title: "SELECTED EVIDENCE", content: [] },
    { title: "EXPERIENCE", content: [] },
  ],
  convergence,
  () => ({ title: "CAREER EVOLUTION", content: [] }),
)
assert.deepEqual(
  placed.map((s) => s.title),
  ["PROFILE", "SELECTED EVIDENCE", "CAREER EVOLUTION", "EXPERIENCE"],
)

const atsPlaced = placeCareerEvolutionInSections(
  placed,
  { ...convergence, visible: false },
  () => ({ title: "CAREER EVOLUTION", content: [] }),
)
assert.deepEqual(
  atsPlaced.map((s) => s.title),
  ["PROFILE", "SELECTED EVIDENCE", "EXPERIENCE"],
)

console.log("test-ce-export-preset-ui: ok")
