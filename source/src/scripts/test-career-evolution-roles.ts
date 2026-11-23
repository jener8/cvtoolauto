/**
 * Acceptance: same candidate facts → meaningfully different graphs per target role.
 * Run: npx tsx scripts/test-career-evolution-roles.ts
 */
import assert from "node:assert/strict"
import {
  buildCareerEvolutionSuggestion,
  extractJobCapabilityThemes,
  mergeCareerEvolutionOnRegenerate,
  normalizeCareerEvolutionConfig,
} from "../lib/career-evolution"

/** Shared verified career facts — not a hardcoded product narrative, only test fixtures. */
const CANDIDATE_CV = `PROFILE
Product designer with research and responsible-AI practice.

EXPERIENCE
# UX & AI Strategy Lead
## Example Org A
### January 2023 – Present
- Led discovery for AI-assisted workflows with researchers and engineers
- Facilitated responsible AI literacy workshops for product teams

# UX Research & Product Design
## Example Org B
### March 2021 – December 2022
- Ran generative and evaluative research with 40+ participants
- Shipped design system components adopted across three product lines

# UX Designer
## Example Org C
### June 2016 – February 2019
- Designed accessible interfaces against WCAG criteria
- Partnered with engineers on end-to-end product delivery

PARALLEL INDEPENDENT WORK
# Independent researcher
## Trust tooling project
### January 2024 – Present
- Published open research on responsible AI evaluation methods
- Built audit tooling for evidence-backed AI governance discussions
`

const LINEAR_CV = `PROFILE
Designer with a linear employment history.

EXPERIENCE
# Product Designer
## Linear Co
### January 2022 – Present
- Delivered product discovery and UI for B2B workflows

# Junior Product Designer
## Linear Co
### March 2019 – December 2021
- Supported design system documentation and accessibility reviews
`

function labelsOf(config: { milestones: { label: string }[] }): string[] {
  return config.milestones.map((m) => m.label)
}

function assertDifferentEmphasis(
  a: string[],
  b: string[],
  message: string,
) {
  const overlap = a.filter((x) => b.includes(x))
  assert.ok(
    a.join("|") !== b.join("|") || overlap.length < Math.min(a.length, b.length),
    message,
  )
}

const researchJd = `
UX Researcher
We need someone who leads user research, discovery methods, usability testing,
qualitative interviews, and turns insights into strategic influence with stakeholders.
`

const aiJd = `
AI Transformation Lead
Drive responsible AI, AI governance, AI literacy enablement, and human-centred design
for generative AI product initiatives across the organisation.
`

const productJd = `
Product Designer
Own product discovery, design systems, accessibility (WCAG), and end-to-end delivery
with engineers on a multi-product design team.
`

const research = buildCareerEvolutionSuggestion({
  resumeText: CANDIDATE_CV,
  targetRole: "UX Researcher",
  jobDescription: researchJd,
  language: "en",
})
const ai = buildCareerEvolutionSuggestion({
  resumeText: CANDIDATE_CV,
  targetRole: "AI Transformation Lead",
  jobDescription: aiJd,
  language: "en",
})
const product = buildCareerEvolutionSuggestion({
  resumeText: CANDIDATE_CV,
  targetRole: "Product Designer",
  jobDescription: productJd,
  language: "en",
})

assert.ok(research.config.milestones.length >= 2)
assert.ok(ai.config.milestones.length >= 2)
assert.ok(product.config.milestones.length >= 2)

// Underlying facts preserved (official titles / employers from CV)
for (const result of [research, ai, product]) {
  for (const m of result.config.milestones) {
    assert.ok(m.officialTitle || m.description, "milestone must cite verified role evidence")
    assert.ok(
      !/promotion|invented|fictional/i.test(m.label),
      "must not invent promotions",
    )
  }
}

const researchThemes = extractJobCapabilityThemes(researchJd, "UX Researcher")
const aiThemes = extractJobCapabilityThemes(aiJd, "AI Transformation Lead")
const productThemes = extractJobCapabilityThemes(productJd, "Product Designer")
assert.ok(researchThemes.some((t) => t.id === "research"))
assert.ok(aiThemes.some((t) => t.id === "ai-responsible"))
assert.ok(productThemes.some((t) => t.id === "product-design" || t.id === "design-systems" || t.id === "accessibility"))

assertDifferentEmphasis(
  labelsOf(research.config),
  labelsOf(ai.config),
  "Research vs AI graphs should emphasise different stage labels",
)
assertDifferentEmphasis(
  labelsOf(product.config),
  labelsOf(ai.config),
  "Product vs AI graphs should emphasise different stage labels",
)

// Parallel career → parallel layout + auto-enable likely
assert.equal(research.config.layout, "parallel")
assert.ok(research.autoEnabled, "parallel concurrent work should auto-enable when valuable")

// Linear career still generates from facts; may omit if it only repeats Experience
const linear = buildCareerEvolutionSuggestion({
  resumeText: LINEAR_CV,
  targetRole: "Product Designer",
  jobDescription: productJd,
  language: "en",
})
assert.ok(linear.config.milestones.length >= 1)
assert.equal(linear.config.layout, "progression")
// Official titles preserved from linear CV
assert.ok(
  linear.config.milestones.every(
    (m) =>
      m.officialTitle?.includes("Product Designer") ||
      m.description?.includes("Linear Co"),
  ),
)

// Regeneration safeguards
const edited = normalizeCareerEvolutionConfig({
  ...research.config,
  origin: "user",
  userEditedAt: Date.now(),
  visible: true,
  sourceText: "TRACK: Custom\n- 2020–2021 | Custom stage | Example Org B\n",
})
const mergedKeep = mergeCareerEvolutionOnRegenerate(edited, ai.config)
assert.ok(mergedKeep.pendingSuggestion, "manual edits must not be overwritten silently")
assert.equal(mergedKeep.sourceText, edited.sourceText)

// Empty / presentation-only "user" state must apply immediately (no accept step)
const emptyMarkedUser = normalizeCareerEvolutionConfig({
  visible: false,
  origin: "user",
  userEditedAt: Date.now(),
  sourceText: "",
  milestones: [],
})
const mergedEmpty = mergeCareerEvolutionOnRegenerate(emptyMarkedUser, ai.config)
assert.equal(mergedEmpty.pendingSuggestion, undefined)
assert.ok(mergedEmpty.milestones.length > 0)
assert.ok((mergedEmpty.sourceText || "").includes("TRACK:"))

const disabled = normalizeCareerEvolutionConfig({
  ...research.config,
  visible: false,
  userDisabled: true,
  origin: "ai",
  userEditedAt: undefined,
})
const mergedDisabled = mergeCareerEvolutionOnRegenerate(disabled, ai.config)
assert.equal(mergedDisabled.visible, false)
assert.equal(mergedDisabled.userDisabled, true)

// Existing empty contact → Off
assert.equal(normalizeCareerEvolutionConfig({}).visible, false)

console.log("test-career-evolution-roles: ok", {
  researchLabels: labelsOf(research.config),
  aiLabels: labelsOf(ai.config),
  productLabels: labelsOf(product.config),
  researchVisible: research.config.visible,
  linearVisible: linear.config.visible,
  linearOmit: linear.omitReason?.slice(0, 60),
})
