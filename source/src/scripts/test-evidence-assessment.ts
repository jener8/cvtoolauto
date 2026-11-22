/**
 * Run: npx tsx scripts/test-evidence-assessment.ts
 */
import assert from "node:assert/strict"
import {
  approvedEvidenceRows,
  buildEvidenceTableMarkdown,
  ensureEvidenceTableInCv,
  parseEvidenceAssessmentResponse,
  shouldRecommendTwoColumnLayout,
} from "../lib/evidence-assessment"
import { renderMarkdownTableHtml, tryParseMarkdownTableAt } from "../lib/resume-markdown-table"
import { COMBINED_PROMPT } from "../lib/tailored-cv-prompt"

const sampleJson = `{
  "employerProblemSummary": "Need someone who can lead research and accessibility.",
  "rows": [
    {
      "requirementPhrase": "Lead strategic research",
      "evidenceText": "**Conducted research** and developed responsible-AI design approaches.",
      "evidenceSource": "research",
      "fit": "direct",
      "fitRationale": "Same research leadership demonstrated on Paths of AI.",
      "maturity": "delivered",
      "outcomeLabel": "Design patterns developed",
      "confidence": "high"
    },
    {
      "requirementPhrase": "Shape the wider experience",
      "evidenceText": "Led design and accessibility work on a digital public-service app.",
      "evidenceSource": "experience",
      "fit": "transferable",
      "fitRationale": "Accessibility leadership in a related public digital product.",
      "maturity": "delivered",
      "outcomeLabel": "BITV certified",
      "confidence": "high"
    },
    {
      "requirementPhrase": "Challenge assumptions before investment",
      "evidenceText": "Proposed workflow research before defining AI learning pathways.",
      "evidenceSource": "project",
      "fit": "partial",
      "fitRationale": "Shows challenge of assumptions via proposal, not a full programme.",
      "maturity": "proposed",
      "outcomeLabel": "Pilot proposed",
      "confidence": "medium"
    },
    {
      "requirementPhrase": "Manage a large engineering team",
      "evidenceText": "",
      "evidenceSource": "other",
      "fit": "not_evidenced",
      "fitRationale": "No team leadership evidence in the CV.",
      "maturity": "proposed",
      "confidence": "high"
    }
  ]
}`

const plan = parseEvidenceAssessmentResponse(sampleJson)
assert.ok(plan)
assert.equal(plan!.rows.length, 4)
assert.equal(plan!.rows[0].fit, "direct")
assert.equal(plan!.rows[1].fit, "transferable")
assert.equal(plan!.rows[2].maturity, "proposed")
assert.equal(plan!.rows[3].fit, "not_evidenced")
assert.equal(plan!.rows[3].approved, false)
assert.equal(plan!.rows[0].approved, true)

// Reject percentage outcomes
const withPct = parseEvidenceAssessmentResponse(`{
  "rows": [
    {
      "requirementPhrase": "Lead research",
      "evidenceText": "Led research programme.",
      "fit": "strong",
      "maturity": "completed",
      "outcomeLabel": "95% match",
      "fitRationale": "ok"
    },
    {
      "requirementPhrase": "Accessibility",
      "evidenceText": "BITV work.",
      "fit": "direct",
      "maturity": "delivered",
      "outcomeLabel": "BITV certified",
      "fitRationale": "ok"
    }
  ]
}`)
assert.ok(withPct)
assert.equal(withPct!.rows[0].outcomeLabel, undefined)
assert.equal(withPct!.rows[0].fit, "direct") // strong → direct
assert.equal(withPct!.rows[0].maturity, "delivered") // completed → delivered
assert.equal(withPct!.rows[1].outcomeLabel, "BITV certified")

const twoCol = buildEvidenceTableMarkdown(plan!.rows, { layout: "two_column" })
assert.match(twoCol, /SELECTED EVIDENCE/)
assert.match(twoCol, /Role criterion/)
assert.match(twoCol, /Strongest evidence/)
assert.doesNotMatch(twoCol, /Outcome \/ Status/)
assert.doesNotMatch(twoCol, /Manage a large engineering team/) // not approved

const threeCol = buildEvidenceTableMarkdown(plan!.rows, { layout: "three_column" })
assert.match(threeCol, /Outcome \/ Status/)
assert.match(threeCol, /BITV certified/)
assert.match(threeCol, /Pilot proposed/)

const lines = threeCol.split("\n")
const tableStart = lines.findIndex((l) => l.startsWith("| Role"))
const parsed = tryParseMarkdownTableAt(lines, tableStart)
assert.ok(parsed)
assert.equal(parsed!.table.headers.length, 3)
const html = renderMarkdownTableHtml(parsed!.table, {
  fontSize: 14,
  lineHeight: 1.45,
  linkColor: "#0f7b6c",
  accentColor: "#0f7b6c",
})
assert.match(html, /cv-md-table--cols-3/)
assert.match(html, /cv-md-col--2/)

const cvWithout = `PROFILE
- Designer

EXPERIENCE
# Role
## Co
### 2020 – Present
- Did things
`
const withTable = ensureEvidenceTableInCv(cvWithout, twoCol)
assert.match(withTable, /SELECTED EVIDENCE/)
assert.match(withTable, /Lead strategic research/)
assert.ok(withTable.indexOf("SELECTED EVIDENCE") < withTable.indexOf("EXPERIENCE"))

const replaced = ensureEvidenceTableInCv(
  withTable,
  buildEvidenceTableMarkdown(plan!.rows, { layout: "two_column" }),
)
assert.equal(
  replaced.split("SELECTED EVIDENCE").length - 1,
  1,
  "should replace existing evidence section once",
)

const approved = approvedEvidenceRows(plan!.rows)
assert.equal(approved.length, 3)

assert.equal(shouldRecommendTwoColumnLayout(twoCol), false)

const prompt = COMBINED_PROMPT("JD", "CV content here", "en", {
  approvedEvidence: approved,
  evidenceTableLayout: "two_column",
})
assert.match(prompt, /APPROVED EVIDENCE ASSESSMENT/)
assert.match(prompt, /SELECTED EVIDENCE/)
assert.match(prompt, /Lead strategic research/)

console.log("evidence-assessment tests passed")
