/**
 * ATS compatibility for Career Evolution.
 * Run: npx tsx scripts/test-career-evolution-ats.ts
 */
import assert from "node:assert/strict"
import { buildCvReviewInsights } from "../lib/cv-review-insights"
import {
  buildCareerEvolutionSuggestion,
  experienceTextContainsCareerEvolutionNoise,
  extractPlainTextOrderFromResumeHtml,
  placeCareerEvolutionInSections,
  renderCareerEvolutionSvgHtml,
  shouldRenderCareerEvolutionInPdf,
  stripCareerEvolutionFromHtml,
} from "../lib/career-evolution"
import { PDF_EXPORT_PRESETS } from "../lib/pdf-export-presets"

const RESUME = `PROFILE
Designer focused on research and accessible product systems.

SELECTED EVIDENCE
| Criterion | Evidence |
| --- | --- |
| Research | Led discovery with 40 participants |
| Accessibility | Shipped WCAG-aligned components |

EXPERIENCE
# Senior Product Designer
## Acme Corp
### January 2022 – Present
- Led research with 40 participants
- Shipped design system adopted by 3 teams

# Product Designer
## Acme Corp
### March 2019 – December 2021
- Delivered accessible UI for B2B workflows

SKILLS
- UX research
- Design systems
- Accessibility
`

const suggestion = buildCareerEvolutionSuggestion({
  resumeText: RESUME,
  targetRole: "Product Designer",
  jobDescription:
    "Product Designer for product discovery, design systems, accessibility and delivery.",
  language: "en",
})

const visibleConfig = {
  ...suggestion.config,
  visible: true as const,
}

// 1) Graph must not live inside EXPERIENCE Markdown
assert.equal(experienceTextContainsCareerEvolutionNoise(RESUME), false)

// 2) Placement is its own section — not between job entries inside Experience
const sections = placeCareerEvolutionInSections(
  [
    { title: "PROFILE", content: ["x"] },
    { title: "EXPERIENCE", content: ["# Senior", "## Acme", "### 2022", "- led"] },
    { title: "SKILLS", content: ["- research"] },
  ],
  visibleConfig,
  () => ({ title: "CAREER EVOLUTION", content: [] as string[] }),
)
assert.deepEqual(
  sections.map((s) => s.title),
  ["PROFILE", "CAREER EVOLUTION", "EXPERIENCE", "SKILLS"],
)
const experienceBody = sections.find((s) => s.title === "EXPERIENCE")!.content.join("\n")
assert.doesNotMatch(experienceBody, /CAREER EVOLUTION|TRACK:/i)

// 3) ATS preset excludes graph; Standard/High include when visible
assert.equal(shouldRenderCareerEvolutionInPdf("ats", visibleConfig), false)
assert.equal(shouldRenderCareerEvolutionInPdf("standard", visibleConfig), true)
assert.equal(shouldRenderCareerEvolutionInPdf("high", visibleConfig), true)
assert.equal(
  shouldRenderCareerEvolutionInPdf("standard", { ...visibleConfig, visible: false }),
  false,
)
assert.equal(
  shouldRenderCareerEvolutionInPdf("standard", {
    ...visibleConfig,
    milestones: [],
    layout: "convergence",
    capabilities: [
      { id: "c1", label: "Research" },
      { id: "c2", label: "Design systems" },
    ],
  }),
  true,
  "Skills Convergence with capabilities must print in Standard PDF",
)
assert.equal(
  shouldRenderCareerEvolutionInPdf("ats", {
    ...visibleConfig,
    milestones: [],
    layout: "convergence",
    capabilities: [
      { id: "c1", label: "Research" },
      { id: "c2", label: "Design systems" },
    ],
  }),
  false,
  "ATS Optimized must still omit Skills Convergence",
)

assert.match(PDF_EXPORT_PRESETS.ats.description, /Career Evolution|graph/i)
assert.match(PDF_EXPORT_PRESETS.standard.description, /Career Evolution|graph/i)

// 4) Simulated human vs ATS HTML text extraction
const svg = renderCareerEvolutionSvgHtml(visibleConfig, {
  accentColor: "#0f7b6c",
  language: "en",
})
assert.ok(svg.includes("career-evolution-figure"))
assert.ok(svg.includes("aria-hidden=\"true\""))

const humanHtml = `
  <h1>Alex Example</h1>
  <h2>PROFILE</h2><p>Designer focused on research</p>
  <div class="resume-section-block" data-career-evolution-section="1">
    <h2>CAREER EVOLUTION</h2>
    ${svg}
  </div>
  <h2>EXPERIENCE</h2>
  <p>Senior Product Designer</p>
  <p>Acme Corp</p>
  <p>January 2022 – Present</p>
  <p>Led research with 40 participants</p>
  <p>Product Designer</p>
  <p>March 2019 – December 2021</p>
  <h2>SKILLS</h2>
  <p>UX research</p>
  <p>Design systems</p>
  <p>Accessibility</p>
`

const humanText = extractPlainTextOrderFromResumeHtml(humanHtml)
assert.match(humanText, /Senior Product Designer/)
assert.match(humanText, /Acme Corp/)
assert.match(humanText, /January 2022/)
assert.match(humanText, /Led research with 40 participants/)
assert.match(humanText, /UX research/)
assert.match(humanText, /Design systems/)
// Experience order preserved: Senior before earlier Product Designer role
assert.ok(
  humanText.indexOf("Senior Product Designer") < humanText.indexOf("March 2019"),
  "experience chronology must stay ordered",
)

const atsHtml = stripCareerEvolutionFromHtml(humanHtml)
const atsText = extractPlainTextOrderFromResumeHtml(atsHtml)
assert.doesNotMatch(atsText, /CAREER EVOLUTION/i)
assert.doesNotMatch(atsHtml, /career-evolution-figure/)
assert.match(atsText, /Senior Product Designer/)
assert.match(atsText, /Acme Corp/)
assert.match(atsText, /January 2022/)
assert.match(atsText, /Led research with 40 participants/)
assert.match(atsText, /UX research/)
assert.match(atsText, /Accessibility/)
assert.match(atsText, /Designer focused on research/)
assert.match(atsText, /SKILLS/)
// Full CV content still present without the graph
assert.ok(atsText.includes("Product Designer"))
assert.ok(atsText.indexOf("Senior Product Designer") < atsText.indexOf("March 2019"))

// 5) Toggling the graph must not change CV / job-match readiness score
const baseResume = {
  resumeText: RESUME,
  jobDescription: "Product Designer — discovery, design systems, accessibility.",
  contactInfo: {
    email: "a@example.com",
    linkedin: "",
    phone: "",
    address: "",
    citizenship: "",
    portfolio: "",
    portfolios: [] as string[],
    showPortfolio: false,
    professionalTitle: "Product Designer",
    name: "Alex Example",
    language: "en" as const,
    targetCompany: "Acme",
    targetRole: "Product Designer",
    jobAdvertSource: "",
    careerEvolution: { ...visibleConfig, visible: false },
  },
}

const scoreOff = buildCvReviewInsights(baseResume).score
const scoreOn = buildCvReviewInsights({
  ...baseResume,
  contactInfo: {
    ...baseResume.contactInfo,
    careerEvolution: { ...visibleConfig, visible: true },
  },
}).score
assert.equal(
  scoreOn,
  scoreOff,
  "Career Evolution visibility must not change the CV job-match / readiness score",
)

console.log("test-career-evolution-ats: ok", {
  score: scoreOn,
  atsOmitsGraph: !/CAREER EVOLUTION/i.test(atsText),
  humanKeepsExperienceOrder: true,
})
