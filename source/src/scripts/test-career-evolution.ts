/**
 * Run: npx tsx scripts/test-career-evolution.ts
 */
import assert from "node:assert/strict"
import { normalizeCvSectionKey } from "../lib/import-cv-structure"
import { normalizeContactInfo } from "../lib/contact-info"
import {
  extractCareerEvolution,
  upsertCareerEvolutionSection,
  suggestCareerEvolutionFromEvidence,
  renderCareerEvolutionSvgHtml,
  normalizeCareerEvolutionConfig,
  parseCareerEvolutionText,
  serializeCareerEvolutionText,
  CAREER_EVOLUTION_SYNTAX_HELP,
  resolveCareerEvolutionConfig,
  placeCareerEvolutionInSections,
  emptyCareerEvolutionConfig,
} from "../lib/career-evolution"

assert.equal(normalizeCvSectionKey("CAREER EVOLUTION"), "CAREER_EVOLUTION")

// Existing CVs: no careerEvolution → Off
assert.equal(normalizeContactInfo(null).careerEvolution, undefined)
assert.equal(normalizeCareerEvolutionConfig({}).visible, false)
assert.equal(emptyCareerEvolutionConfig().visible, false)

const sampleCv = `PROFILE
Designer focused on accessible product systems.

EXPERIENCE
# Senior Designer
## Acme Corp
### January 2022 – Present
- Led research with 40 participants

# Designer
## Acme Corp
### March 2019 – December 2021
- Shipped design system adopted by 3 teams

PARALLEL INDEPENDENT WORK
# Founder
## SideTools
### June 2023 – Present
- Built open tooling for trust audits
`

const suggested = suggestCareerEvolutionFromEvidence({
  resumeText: sampleCv,
  targetRole: "Lead Product Designer",
  jobDescription: "We need someone who leads research and design systems.",
  language: "en",
})

assert.ok(suggested.milestones.length >= 3 && suggested.milestones.length <= 5)
assert.ok(suggested.milestones.every((m) => m.approved === false))
// Growth links stay unapproved; evidence-backed convergence may be approved
assert.ok(suggested.connections.some((c) => c.approved === false) || suggested.connections.length === 0)
assert.equal(suggested.generatedForRole, "Lead Product Designer")
assert.ok(suggested.sourceText?.includes("TRACK:"))
// Parallel independent work may auto-enable; empty/linear CVs stay Off by default
assert.equal(typeof suggested.visible, "boolean")
assert.equal(normalizeCareerEvolutionConfig({}).visible, false)

// Human-readable TRACK syntax
const syntax = `TRACK: Professional Experience
- 2016–2019 | UX Design | SolarWinds
- 2021–2023 | UX Research & Product Design | Bundesdruckerei
- 2023–Present | UX & AI Strategy | Bundesdruckerei

TRACK: Independent Research
- 2024–Present | Responsible AI | TrustBridge / TrustAudit.tools

CONNECTION:
- Independent Research -> UX & AI Strategy | Informed strategic AI discussions
`
const parsed = parseCareerEvolutionText(syntax, { visible: true })
assert.equal(parsed.errors.length, 0)
assert.ok(parsed.config.tracks.length >= 2)
assert.equal(parsed.config.milestones.length, 4)
assert.ok(parsed.config.connections.length >= 1)

const roundTrip = parseCareerEvolutionText(serializeCareerEvolutionText(parsed.config), {
  visible: true,
})
assert.equal(roundTrip.errors.length, 0)
assert.equal(roundTrip.config.milestones.length, 4)

const freeConn = parseCareerEvolutionText(
  `TRACK: Professional Experience
- 2023–Present | UX & AI Strategy | Bundesdruckerei

CONNECTION:
Independent research informed strategic AI discussions at Bundesdruckerei.
`,
  { visible: true },
)
assert.equal(freeConn.errors.length, 0)
assert.ok(freeConn.config.connections.some((c) => c.label?.includes("Independent research")))

const malformed = parseCareerEvolutionText("- not a valid milestone line\n")
assert.ok(malformed.errors.length > 0)
assert.equal(malformed.config.sourceText, "- not a valid milestone line\n")

// Help / Generate examples must parse
const helpParsed = parseCareerEvolutionText(CAREER_EVOLUTION_SYNTAX_HELP, { visible: true })
assert.equal(helpParsed.errors.length, 0, helpParsed.errors.join("; "))
assert.equal(helpParsed.config.milestones.length, 4)
assert.ok(helpParsed.config.sourceText?.includes("TRACK:"))

// Optional leading hyphen + 2-field milestones
const noBullet = parseCareerEvolutionText(
  `TRACK: Professional Experience
2016–2019 | UX Design | SolarWinds
2021–2023 | UX Research

TRACK: Independent Research
• 2024–Present | Responsible AI | TrustBridge
`,
  { visible: true },
)
assert.equal(noBullet.errors.length, 0, noBullet.errors.join("; "))
assert.equal(noBullet.config.milestones.length, 3)
assert.equal(noBullet.config.milestones[1]?.description, undefined)

// Serialize output must re-parse
const genRound = parseCareerEvolutionText(serializeCareerEvolutionText(helpParsed.config), {
  visible: true,
})
assert.equal(genRound.errors.length, 0)
assert.equal(genRound.config.milestones.length, 4)

// contactInfo is primary store; hide preserves content
const stored = normalizeCareerEvolutionConfig({
  ...parsed.config,
  visible: false,
  sourceText: syntax,
})
assert.equal(stored.visible, false)
assert.equal(stored.milestones.length, 4)
assert.ok(stored.sourceText?.includes("TRACK:"))

const resolved = resolveCareerEvolutionConfig(stored, sampleCv)
assert.equal(resolved.visible, false)
assert.equal(resolved.milestones.length, 4)

const shown = { ...stored, visible: true as const }
const sections = placeCareerEvolutionInSections(
  [
    { title: "PROFILE", content: ["x"] },
    { title: "EXPERIENCE", content: ["y"] },
    { title: "EDUCATION", content: ["z"] },
  ],
  shown,
  () => ({ title: "CAREER EVOLUTION", content: [] as string[] }),
)
assert.deepEqual(
  sections.map((s) => s.title),
  ["PROFILE", "CAREER EVOLUTION", "EXPERIENCE", "EDUCATION"],
)

const after = placeCareerEvolutionInSections(
  [
    { title: "PROFILE", content: ["x"] },
    { title: "EXPERIENCE", content: ["y"] },
  ],
  { ...shown, position: "after-experience" },
  () => ({ title: "CAREER EVOLUTION", content: [] as string[] }),
)
assert.deepEqual(
  after.map((s) => s.title),
  ["PROFILE", "EXPERIENCE", "CAREER EVOLUTION"],
)

// Off → no injection
const hiddenSections = placeCareerEvolutionInSections(
  [{ title: "EXPERIENCE", content: ["y"] }],
  stored,
  () => ({ title: "CAREER EVOLUTION", content: [] as string[] }),
)
assert.deepEqual(
  hiddenSections.map((s) => s.title),
  ["EXPERIENCE"],
)

// Legacy fence still parseable / migratable
suggested.connections = suggested.connections.map((c, i) =>
  i === 0 ? { ...c, approved: true } : c,
)
suggested.milestones = suggested.milestones.map((m) => ({ ...m, approved: true }))
suggested.visible = true

const withBlock = upsertCareerEvolutionSection(sampleCv, suggested)
assert.match(withBlock, /CAREER EVOLUTION/)
assert.match(withBlock, /```career-evolution/)

const extracted = extractCareerEvolution(withBlock)
assert.ok(extracted.config)
assert.equal(extracted.config!.milestones.length, suggested.milestones.length)
assert.doesNotMatch(extracted.resumeWithoutBlock, /career-evolution/)

const fromLegacy = resolveCareerEvolutionConfig(undefined, withBlock)
assert.ok(fromLegacy.milestones.length > 0)

const svg = renderCareerEvolutionSvgHtml(
  normalizeCareerEvolutionConfig({ ...extracted.config, visible: true }),
  {
    accentColor: "#0f7b6c",
    language: "en",
  },
)
assert.match(svg, /<svg /)
assert.match(svg, /#0f7b6c/)
assert.match(svg, /aria-hidden="true"/)
assert.match(svg, /<figcaption/)

// Existing CVs without the block remain unchanged
const plain = extractCareerEvolution(sampleCv)
assert.equal(plain.config, null)
assert.equal(plain.resumeWithoutBlock, sampleCv)
assert.equal(resolveCareerEvolutionConfig(undefined, sampleCv).visible, false)

console.log("test-career-evolution: ok", {
  milestones: suggested.milestones.length,
  layout: suggested.layout,
  syntaxMilestones: parsed.config.milestones.length,
})
