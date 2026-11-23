/**
 * Regression: Career Evolution must survive browser Print → Save as PDF.
 * Run: npx tsx scripts/test-ce-print-css.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { renderCareerEvolutionSvgHtml } from "../lib/career-evolution"

const root = path.join(__dirname, "..")
const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8")
const preview = fs.readFileSync(path.join(root, "components/resume-preview.tsx"), "utf8")

const printStart = globals.indexOf("/* ============================================================\n   PRINT")
assert.ok(printStart >= 0, "expected PRINT section in globals.css")
const printCss = globals.slice(printStart, printStart + 4500)

assert.match(printCss, /\.formatter-workspace/)
assert.match(printCss, /overflow:\s*visible\s*!important/)
assert.match(printCss, /\.cv-inner[\s\S]*?transform:\s*none\s*!important/)
assert.match(printCss, /\.career-evolution-figure[\s\S]*?max-height:\s*none\s*!important/)
assert.match(printCss, /\.career-evolution-figure svg[\s\S]*?max-height:\s*none\s*!important/)
assert.match(printCss, /\.app-sidebar/)
assert.doesNotMatch(
  printCss,
  /\.career-evolution-figure svg\s*\{[^}]*height:\s*auto\s*!important/,
  "print must not force SVG height:auto (Chromium collapses to 0)",
)

assert.match(
  preview,
  /data-career-evolution-section="1"[^>]*overflow:visible/,
  "CE section wrapper must not clamp with max-height",
)
assert.doesNotMatch(
  preview,
  /data-career-evolution-section="1"[^>]*break-inside:avoid/,
  "CE section must not use break-inside:avoid (blank band after Evidence)",
)
assert.match(preview, /Career Evolution must print/)

const svg = renderCareerEvolutionSvgHtml(
  {
    visible: true,
    layout: "parallel",
    density: "compact",
    position: "after-profile",
    milestones: [
      {
        id: "m1",
        label: "TrustAudit",
        start: "2022-01",
        end: "Present",
        trackId: "employment",
        approved: true,
      },
      {
        id: "m2",
        label: "Anderson Consulting",
        start: "2020-06",
        end: "2021-12",
        trackId: "independent",
        approved: true,
      },
    ],
    tracks: [
      { id: "employment", label: "Employment" },
      { id: "independent", label: "Independent Work" },
    ],
    connections: [],
    showParallelWork: true,
  },
  { accentColor: "#67906c", width: 680 },
)

assert.match(svg, /aspect-ratio:\s*\d+\s*\/\s*\d+/)
assert.match(svg, /max-height:45mm/)
assert.match(svg, /height="100%"/)
assert.doesNotMatch(svg, /style="[^"]*max-height:45mm[^"]*"\s*data-ce-density/)

console.log("test-ce-print-css: ok")
