import assert from "node:assert/strict"
import {
  parseTwoColumnSectionItems,
  renderCVColumnBlocksHtml,
  renderCVColumnListHtml,
  resolveSectionColumnCount,
  sectionHasStructuredEntries,
  splitSectionIntoEntryBlocks,
} from "@/lib/cv-two-column-section"
import { parseSectionColumnModifier } from "@/lib/section-column-modifier"

assert.deepEqual(parseSectionColumnModifier("SPRACHEN [columns=2]"), {
  title: "SPRACHEN",
  columns: 2,
})

assert.deepEqual(parseSectionColumnModifier("TOOLS [columns=3]"), {
  title: "TOOLS",
  columns: 3,
})

assert.equal(
  resolveSectionColumnCount({
    title: "SPRACHEN",
    content: ["- English", "- German"],
    columns: 2,
  }),
  2,
)

assert.equal(
  resolveSectionColumnCount({
    title: "SPRACHEN",
    content: ["- English", "- German"],
    columns: 1,
  }),
  1,
)

const legacySkillsItems = [
  "- One",
  "- Two",
  "- Three",
  "- Four",
  "- Five",
  "- Six",
]
assert.equal(
  resolveSectionColumnCount({
    title: "SKILLS",
    content: legacySkillsItems,
  }),
  2,
  "legacy SKILLS auto two-column when six or more items",
)

const html = renderCVColumnListHtml(parseTwoColumnSectionItems(legacySkillsItems), 2, {
  symbol: "•",
  color: "#000000",
  size: "1em",
  bulletMargin: 4,
  bulletIndent: 16,
  lineHeight: 1.5,
  fontSize: 14,
  linkColor: "#000000",
})

assert.match(html, /cv-column-list--cols-2/)
assert.match(html, /<table class="cv-column-list/)
assert.match(html, /cv-column-list__item/)
assert.match(html, /One/)
assert.match(html, /Six/)

const certLines = [
  "## Design Coach Certificate",
  "### Deutsche Bank Innovation Labs",
  "#### 2019",
  "- Design Thinking",
  "- Workshop Facilitation",
  "## Design Sprint Facilitator",
  "### Design Sprint Academy",
  "#### 2018",
  "- Design Sprint Facilitation",
]
const blocks = splitSectionIntoEntryBlocks(certLines)
assert.equal(blocks.length, 2, "certificate ## entries should split into blocks")
assert.ok(sectionHasStructuredEntries(certLines))
const blockHtml = renderCVColumnBlocksHtml(["<p>A</p>", "<p>B</p>", "<p>C</p>"], 2)
assert.match(blockHtml, /cv-column-list--cols-2/)
assert.match(blockHtml, /<p>A<\/p>/)
assert.match(blockHtml, /<p>B<\/p>/)

console.log("cv-column-section tests passed")
