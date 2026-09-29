import assert from "node:assert/strict"
import {
  isTwoColumnSectionTitle,
  parseTwoColumnSectionItems,
  pairTwoColumnItems,
  shouldUseTwoColumnLayout,
  TWO_COLUMN_MIN_ITEMS,
} from "../lib/cv-two-column-section"

assert.equal(isTwoColumnSectionTitle("SKILLS"), true)
assert.equal(isTwoColumnSectionTitle("Tools"), true)
assert.equal(isTwoColumnSectionTitle("FÄHIGKEITEN"), true)
assert.equal(isTwoColumnSectionTitle("EXPERIENCE"), false)

const pairedLineItems = parseTwoColumnSectionItems([
  "AI Adoption & Enablement          Human-Centered AI",
  "AI Literacy & Training           Responsible AI",
  "- Workshop Facilitation",
  "Stakeholder Management",
])
assert.equal(pairedLineItems.length, 6)
assert.equal(pairedLineItems[0], "AI Adoption & Enablement")
assert.equal(pairedLineItems[1], "Human-Centered AI")

const bulletItems = parseTwoColumnSectionItems([
  "- ChatGPT",
  "- Claude",
  "- Microsoft Copilot",
  "- Gemini",
  "- Perplexity",
  "- Cursor AI",
])
assert.equal(bulletItems.length, 6)
assert.equal(shouldUseTwoColumnLayout(bulletItems), true)
assert.equal(shouldUseTwoColumnLayout(bulletItems.slice(0, TWO_COLUMN_MIN_ITEMS - 1)), false)

const rows = pairTwoColumnItems(bulletItems)
assert.equal(rows.length, 3)
assert.deepEqual(rows[0], { left: "ChatGPT", right: "Claude" })

console.log("test-cv-two-column-section: ok")
