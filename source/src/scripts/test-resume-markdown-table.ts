/**
 * Run: npx tsx scripts/test-resume-markdown-table.ts
 */
import assert from "node:assert/strict"
import {
  accessibleTableAccentTextColor,
  contrastRatio,
  meetsWcagAaContrast,
  parseHexColor,
} from "../lib/accessible-accent-text"
import {
  buildMarkdownTablePdfChunks,
  countWords,
  CV_MARKDOWN_TABLE_CSS,
  isMarkdownTableSeparatorLine,
  renderMarkdownTableHtml,
  splitLinesByMarkdownTables,
  tableHasDenseCells,
  tryParseMarkdownTableAt,
} from "../lib/resume-markdown-table"

const sample = [
  "SELECTED EVIDENCE",
  "",
  "| Role criterion | Strongest evidence |",
  "| --- | --- |",
  "| Set the research agenda | Co-developed Paths of AI Enablement. |",
  "| Lead strategic research | Combined interviews and surveys. |",
  "| Shape the wider experience | Led accessibility work on the app. |",
]

const parsed = tryParseMarkdownTableAt(sample, 2)
assert.ok(parsed, "table should parse at header index")
assert.equal(parsed!.table.headers[0], "Role criterion")
assert.equal(parsed!.table.headers[1], "Strongest evidence")
assert.equal(parsed!.table.rows.length, 3)
assert.equal(parsed!.endIndex, 7)

assert.equal(isMarkdownTableSeparatorLine("| --- | --- |"), true)
assert.equal(isMarkdownTableSeparatorLine("| :--- | ---: |"), true)
assert.equal(isMarkdownTableSeparatorLine("| not a sep | row |"), false)

const segments = splitLinesByMarkdownTables(sample)
assert.equal(segments[0]?.type, "lines")
assert.equal(segments[1]?.type, "table")
if (segments[1]?.type === "table") {
  assert.equal(segments[1].table.rows.length, 3)
}

const html = renderMarkdownTableHtml(parsed!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#0f7b6c",
  accentColor: "#0f7b6c",
})
assert.match(html, /<table class="cv-md-table cv-md-table--cols-2"/)
assert.match(html, /<thead[\s>]/)
assert.match(html, /<th[\s>]/)
assert.match(html, /<td[\s>]/)
assert.match(html, /Set the research agenda/)
assert.match(html, /cv-md-col--0/)
assert.match(html, /cv-md-cell--criterion/)
assert.match(html, /font-weight:600/)
assert.match(html, /#0f7b6c20/) // accent-tinted header like section titles

const boldTable = tryParseMarkdownTableAt(
  [
    "| Role criterion | Strongest evidence |",
    "| --- | --- |",
    "| Shape the wider experience | **Led early product design** for Germany's digital vehicle document app. |",
  ],
  0,
)
assert.ok(boldTable)
const boldHtml = renderMarkdownTableHtml(boldTable!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#0f7b6c",
  accentColor: "#0f7b6c",
})
assert.match(boldHtml, /<strong>Led early product design<\/strong>/)

const threeColSample = [
  "| Role criterion | Strongest evidence | Outcome / Status |",
  "| --- | --- | --- |",
  "| Shape the wider experience | Led accessibility work on the app. | BITV certified |",
]
const threeCol = tryParseMarkdownTableAt(threeColSample, 0)
assert.ok(threeCol)
assert.equal(threeCol!.table.headers.length, 3)
const threeHtml = renderMarkdownTableHtml(threeCol!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#0f7b6c",
  accentColor: "#0f7b6c",
})
assert.match(threeHtml, /cv-md-table--cols-3/)
assert.match(threeHtml, /width:28%|cv-md-col--0/)
assert.match(threeHtml, /BITV certified/)

const chunks = buildMarkdownTablePdfChunks(parsed!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#0f7b6c",
  accentColor: "#0f7b6c",
})
assert.equal(chunks.length, 4) // header-only + 3 body rows
assert.equal(chunks[0]?.kind, "table-head")
assert.equal(chunks[0]?.continuation, false)
assert.match(chunks[0]!.html, /cv-md-table--header-only/)
assert.equal(chunks[1]?.kind, "table-row")
assert.equal(chunks[1]?.continuation, true)
assert.match(chunks[1]!.html, /cv-md-table--continuation/)
assert.match(chunks[1]!.html, /display:none/)
assert.match(chunks[0]!.html, /border-bottom:1px solid/)
assert.doesNotMatch(chunks[1]!.html, /Set the research agenda[\s\S]*Lead strategic/)

assert.equal(countWords("one two three"), 3)
assert.equal(
  tableHasDenseCells({
    headers: ["a", "b"],
    alignments: ["none", "none"],
    rows: [["short", Array.from({ length: 45 }, (_, i) => `w${i}`).join(" ")]],
  }),
  true,
)

// Existing markup still present as plain lines when no table
const mixed = splitLinesByMarkdownTables([
  "# Product Lead",
  "## Acme",
  "### 2020 — 2024",
  "- Shipped X",
  "SKILLS [columns=2]",
  "- Facilitation",
])
assert.equal(mixed.length, 1)
assert.equal(mixed[0]?.type, "lines")

// --- Table accent styling (Off / Subtle / Strong) + WCAG AA ---

const ACCENT_SAMPLES = [
  "#C9975B", // light warm (common CV accent)
  "#2563eb", // saturated blue
  "#059669", // green
  "#000000", // already dark
  "#f5d76e", // very light / saturated yellow
  "#ffffff", // near-white (must darken heavily)
  "#7c3aed", // saturated purple
]

for (const accent of ACCENT_SAMPLES) {
  const subtle = accessibleTableAccentTextColor(accent, "subtle")
  const strong = accessibleTableAccentTextColor(accent, "strong")
  assert.ok(subtle, `subtle colour for ${accent}`)
  assert.ok(strong, `strong colour for ${accent}`)
  assert.equal(accessibleTableAccentTextColor(accent, "off"), null)
  assert.ok(
    meetsWcagAaContrast(subtle!, "#ffffff"),
    `subtle AA fail for ${accent} → ${subtle}`,
  )
  assert.ok(
    meetsWcagAaContrast(strong!, "#ffffff"),
    `strong AA fail for ${accent} → ${strong}`,
  )
  const subtleLuminance = relativeLum(subtle!)
  const strongLuminance = relativeLum(strong!)
  assert.ok(
    strongLuminance <= subtleLuminance + 0.0001,
    `strong should be darker or equal for ${accent}`,
  )
}

function relativeLum(hex: string): number {
  const rgb = parseHexColor(hex)!
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b)
}

const threeAccent = renderMarkdownTableHtml(threeCol!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#C9975B",
  accentColor: "#C9975B",
  tableAccentStyle: "subtle",
})
assert.match(threeAccent, /data-table-accent="subtle"/)
assert.match(threeAccent, /cv-md-cell--criterion/)
assert.match(threeAccent, /cv-md-cell--outcome/)
assert.match(threeAccent, /cv-md-cell--evidence/)
assert.match(threeAccent, /cv-md-cell--accent/)
// Evidence middle column stays black
assert.match(
  threeAccent,
  /cv-md-cell--evidence[^>]*style="[^"]*color:#000000/,
)
const subtleHex = accessibleTableAccentTextColor("#C9975B", "subtle")!
assert.match(threeAccent, new RegExp(`color:${subtleHex}`))

const offHtml = renderMarkdownTableHtml(threeCol!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#C9975B",
  accentColor: "#C9975B",
  tableAccentStyle: "off",
})
assert.match(offHtml, /data-table-accent="off"/)
assert.doesNotMatch(offHtml, /cv-md-cell--accent/)
assert.doesNotMatch(offHtml, new RegExp(`color:${subtleHex}`))

const strongHtml = renderMarkdownTableHtml(threeCol!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#C9975B",
  accentColor: "#C9975B",
  tableAccentStyle: "strong",
})
assert.match(strongHtml, /data-table-accent="strong"/)
assert.match(strongHtml, /cv-md-cell--strong/)
assert.match(strongHtml, /font-weight:700/)
const strongHex = accessibleTableAccentTextColor("#C9975B", "strong")!
assert.match(strongHtml, new RegExp(`color:${strongHex}`))

// ATS path: off style keeps plain black body text
const atsHtml = renderMarkdownTableHtml(threeCol!.table, {
  fontSize: 13,
  lineHeight: 1.45,
  linkColor: "#C9975B",
  accentColor: "#C9975B",
  tableAccentStyle: "off",
})
assert.match(atsHtml, /color:#000000/)
assert.doesNotMatch(atsHtml, /cv-md-cell--accent/)

// Greyscale print: weight emphasis remains for criterion/outcome
assert.match(CV_MARKDOWN_TABLE_CSS, /@media print/)
assert.match(CV_MARKDOWN_TABLE_CSS, /cv-md-cell--criterion/)
assert.match(CV_MARKDOWN_TABLE_CSS, /cv-md-cell--outcome/)
// Outcome/criterion cells must not hyphenate mid-word
assert.match(CV_MARKDOWN_TABLE_CSS, /hyphens:\s*none/)
assert.doesNotMatch(CV_MARKDOWN_TABLE_CSS, /hyphens:\s*auto/)
assert.doesNotMatch(CV_MARKDOWN_TABLE_CSS, /overflow-wrap:\s*anywhere/)

// Sanity: light accent is not used raw when it fails AA
const rawLight = parseHexColor("#f5d76e")!
assert.ok(contrastRatio(rawLight, { r: 255, g: 255, b: 255 }) < 4.5)
const fixedLight = accessibleTableAccentTextColor("#f5d76e", "subtle")!
assert.ok(meetsWcagAaContrast(fixedLight))

console.log("test-resume-markdown-table: ok")
