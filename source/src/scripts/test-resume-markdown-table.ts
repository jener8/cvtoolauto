/**
 * Run: npx tsx scripts/test-resume-markdown-table.ts
 */
import assert from "node:assert/strict"
import {
  buildMarkdownTablePdfChunks,
  countWords,
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

console.log("test-resume-markdown-table: ok")
