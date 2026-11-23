/**
 * Evidence-to-Role Alignment must be distinct from Progression Cards.
 * Run: npx tsx scripts/test-career-evolution-alignment.ts
 */
import assert from "node:assert/strict"
import {
  alignmentsForRender,
  buildCareerEvolutionSuggestion,
  deriveAlignmentsFromMilestones,
  hasCareerEvolutionAlignmentContent,
  normalizeCareerEvolutionConfig,
  renderCareerEvolutionSvgHtml,
  type CareerEvolutionConfig,
} from "../lib/career-evolution"

const SAMPLE_CV = `PROFILE
Product designer with research and responsible-AI practice.

EXPERIENCE
# UX & AI Strategy Lead
## Bundesdruckerei
### January 2023 – Present
- Led mixed-methods research for digital identity products
- Facilitated cross-functional workshops with product and compliance
- Conducted responsible AI assessment workshops for design teams

# UX Research & Product Design
## Example Org B
### March 2021 – December 2022
- Ran generative and evaluative research with 40+ participants
- Shipped design system components adopted across three product lines

# UX Designer
## SolarWinds
### June 2016 – February 2019
- Delivered end-to-end product design for enterprise tooling
`

const SAMPLE_JD = `
Strategic UX Researcher
We need strategic research, mixed-methods discovery, AI-native research practice,
responsible AI assessment, stakeholder alignment, and cross-functional facilitation.
`

// Auto-gen always attaches alignment payloads (not only when layout=alignment)
const suggestion = buildCareerEvolutionSuggestion({
  resumeText: SAMPLE_CV,
  targetRole: "Strategic UX Researcher",
  jobDescription: SAMPLE_JD,
  language: "en",
})
assert.ok(suggestion.config.milestones.length >= 2, "milestones from CV")
assert.ok(
  (suggestion.config.alignments?.length || 0) >= 1,
  "alignments always generated alongside progression data",
)
assert.ok(
  (suggestion.config.capabilities?.length || 0) >= 1,
  "capabilities always generated for template switching",
)

// Force progression layout but keep alignments — switching should render alignment
const asProgression: CareerEvolutionConfig = normalizeCareerEvolutionConfig({
  ...suggestion.config,
  layout: "progression",
  visible: true,
})
const progSvg = renderCareerEvolutionSvgHtml(asProgression, {
  accentColor: "#0f7b6c",
  width: 480,
})
assert.match(progSvg, /data-ce-layout="progression"/)
assert.match(progSvg, /data-ce-card="1"/)

const asAlignment: CareerEvolutionConfig = {
  ...asProgression,
  layout: "alignment",
}
const alignSvg = renderCareerEvolutionSvgHtml(asAlignment, {
  accentColor: "#0f7b6c",
  width: 480,
})
assert.ok(alignSvg, "alignment renders when mappings exist")
assert.match(alignSvg, /data-ce-layout="alignment"/)
assert.match(alignSvg, /data-ce-alignment=/)
assert.doesNotMatch(alignSvg, /data-ce-card="1"/)
assert.doesNotMatch(alignSvg, /data-ce-layout="progression"/)
assert.notEqual(progSvg, alignSvg)

// Two-column markers
assert.match(alignSvg, /→/)
assert.match(alignSvg, /EVIDENCE/)
assert.match(alignSvg, /REQUIREMENT/)

// Match type preserved when present
const withMatch = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "alignment",
  alignments: [
    {
      id: "al-1",
      evidenceLabel: "Mixed-methods research",
      requirementLabel: "Strategic research",
      evidenceRef: "Bundesdruckerei",
      matchType: "direct",
      approved: true,
    },
    {
      id: "al-2",
      evidenceLabel: "Responsible AI assessment",
      requirementLabel: "AI-native research practice",
      matchType: "transferable",
      approved: true,
    },
    {
      id: "al-3",
      evidenceLabel: "Cross-functional facilitation",
      requirementLabel: "Stakeholder alignment",
      matchType: "direct",
      approved: true,
    },
  ],
  milestones: [],
})
assert.ok(hasCareerEvolutionAlignmentContent(withMatch))
const mapSvg = renderCareerEvolutionSvgHtml(withMatch, {
  accentColor: "#0f7b6c",
  width: 480,
})
assert.match(mapSvg, /Mixed-methods research/)
assert.match(mapSvg, /Strategic research/)
assert.match(mapSvg, /data-ce-match="direct"/)
assert.doesNotMatch(mapSvg, /\d{4}-\d{2}/) // no dates on alignment graph

// Seed helper may still derive from milestone requirement fields for migration tools
const fromMs = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "alignment",
  alignments: [],
  tracks: [{ id: "t1", label: "Professional Experience" }],
  milestones: [
    {
      id: "m1",
      label: "Mixed-methods research",
      jobRequirementAddressed: "Strategic research",
      evidenceRef: "CV · Bundesdruckerei",
      evidenceFit: "direct",
      trackId: "t1",
      approved: true,
    },
  ],
})
const derived = deriveAlignmentsFromMilestones(fromMs)
assert.equal(derived.length, 1)
assert.equal(derived[0]!.matchType, "direct")
// Renderer must NOT soft-fall back to TRACK stage labels — ALIGNMENT dataset only
assert.equal(alignmentsForRender(fromMs).length, 0)

// Empty mappings → no wrong template
const emptyAlign = renderCareerEvolutionSvgHtml(
  { ...fromMs, milestones: [], alignments: [], alignmentSourceText: "" },
  { accentColor: "#0f7b6c" },
)
assert.equal(emptyAlign, "")

// alignmentSourceText drives the graph
const fromText = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "alignment",
  alignmentSourceText: `ALIGNMENT: Evidence-to-Role

- Mixed-methods research | Strategic research
`,
  alignments: [],
  milestones: [],
})
assert.equal(alignmentsForRender(fromText).length, 1)
assert.match(
  renderCareerEvolutionSvgHtml(fromText, { accentColor: "#0f7b6c" }),
  /Mixed-methods research/,
)

console.log("test-career-evolution-alignment: ok", {
  alignmentPairs: suggestion.config.alignments?.length,
  layout: suggestion.config.layout,
})
