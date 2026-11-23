/**
 * Evidence-to-Role ALIGNMENT text format — parse, validate, render exclusivity.
 * Run: npx tsx scripts/test-career-evolution-alignment-text.ts
 */
import assert from "node:assert/strict"
import {
  buildCareerEvolutionSuggestion,
  normalizeCareerEvolutionConfig,
  parseCareerEvolutionAlignmentText,
  renderCareerEvolutionSvgHtml,
  serializeCareerEvolutionAlignmentText,
  type CareerEvolutionConfig,
} from "../lib/career-evolution"

const SAMPLE = `ALIGNMENT: Evidence-to-Role

- Mixed-methods discovery at Bundesdruckerei | Strategic UX research
- Responsible AI workshops | AI-native research practice
`

const parsed = parseCareerEvolutionAlignmentText(SAMPLE)
assert.equal(parsed.errors.length, 0, parsed.errors.join("; "))
assert.equal(parsed.alignments.length, 2)
assert.equal(parsed.alignments[0]!.evidenceLabel, "Mixed-methods discovery at Bundesdruckerei")
assert.equal(parsed.alignments[0]!.requirementLabel, "Strategic UX research")

const roundTrip = serializeCareerEvolutionAlignmentText(parsed.alignments)
assert.match(roundTrip, /ALIGNMENT:\s*Evidence-to-Role/i)
assert.match(roundTrip, /Mixed-methods discovery at Bundesdruckerei \| Strategic UX research/)

// Unsupported TRACK syntax in alignment editor
const bad = parseCareerEvolutionAlignmentText(`ALIGNMENT: Evidence-to-Role
TRACK: Professional Experience
- 2021–2023 | Research | Acme
`)
assert.ok(bad.errors.some((e) => /TRACK/i.test(e)))

// Missing pipe
const noPipe = parseCareerEvolutionAlignmentText(`ALIGNMENT: Evidence-to-Role
- evidence without requirement
`)
assert.ok(noPipe.errors.some((e) => /pipe/i.test(e)))

// Renderer uses ALIGNMENT dataset only — editing text changes the SVG row
const cfg: CareerEvolutionConfig = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "alignment",
  alignmentSourceText: SAMPLE,
  alignments: parsed.alignments,
  milestones: [
    {
      id: "m1",
      label: "Should not appear as stage",
      approved: true,
    },
  ],
  sourceText: `TRACK: Professional Experience
- 2020–2021 | Should not appear as stage | Acme
`,
})
const svg1 = renderCareerEvolutionSvgHtml(cfg, { accentColor: "#2563eb", width: 480 })
assert.match(svg1, /data-ce-layout="alignment"/)
assert.match(svg1, /Mixed-methods discovery/)
assert.match(svg1, /Strategic UX research/)
assert.doesNotMatch(svg1, /Should not appear as stage/)

const edited = parseCareerEvolutionAlignmentText(`ALIGNMENT: Evidence-to-Role

- HelloFresh discovery research | Staff-level research strategy
- Responsible AI workshops | AI-native research practice
`)
assert.equal(edited.errors.length, 0)
const cfg2: CareerEvolutionConfig = {
  ...cfg,
  alignmentSourceText: edited.alignmentSourceText,
  alignments: edited.alignments,
}
const svg2 = renderCareerEvolutionSvgHtml(cfg2, { accentColor: "#2563eb", width: 480 })
assert.match(svg2, /HelloFresh discovery research/)
assert.match(svg2, /Staff-level research strategy/)
assert.doesNotMatch(svg2, /Mixed-methods discovery/)

// Switching layouts preserves both datasets
const asProgression: CareerEvolutionConfig = {
  ...cfg2,
  layout: "progression",
}
assert.ok(asProgression.alignmentSourceText?.includes("HelloFresh"))
assert.ok(asProgression.sourceText?.includes("TRACK:"))
const backToAlign: CareerEvolutionConfig = { ...asProgression, layout: "alignment" }
const svg3 = renderCareerEvolutionSvgHtml(backToAlign, { accentColor: "#2563eb", width: 480 })
assert.match(svg3, /HelloFresh discovery research/)

// Generate from JD + CV uses verified evidence refs, not empty alignments
const suggestion = buildCareerEvolutionSuggestion({
  resumeText: `PROFILE
UX researcher.

EXPERIENCE
# Senior UX Specialist
## Bundesdruckerei
### 2023 - Present
- Led mixed-methods discovery for digital identity
- Ran responsible AI assessment workshops
`,
  targetRole: "Staff UX Strategist & Researcher",
  jobDescription:
    "Staff UX Strategist needing strategic research, mixed-methods discovery, responsible AI, stakeholder alignment.",
  language: "en",
})
assert.ok((suggestion.config.alignments?.length || 0) >= 1)
assert.ok(suggestion.config.alignmentSourceText?.includes("ALIGNMENT:"))
assert.ok(
  suggestion.config.alignments!.every(
    (a) => a.evidenceLabel.trim() && a.requirementLabel.trim(),
  ),
)

console.log("test-career-evolution-alignment-text: ok", {
  pairs: parsed.alignments.length,
  generated: suggestion.config.alignments?.length,
})
