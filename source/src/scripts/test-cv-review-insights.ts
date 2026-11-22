/**
 * Run: npx tsx scripts/test-cv-review-insights.ts
 *
 * Regression: HelloFresh-style CV with WHAT I CAN SOLVE FOR YOU,
 * Selected Evidence (3-col), SKILLS [columns=3], delivered vs proposed.
 */
import assert from "node:assert/strict"
import { buildCvReviewInsights } from "../lib/cv-review-insights"
import { normalizeCvSectionKey } from "../lib/import-cv-structure"
import { parseResumeText } from "../lib/parse-resume-text"

assert.equal(normalizeCvSectionKey("WHAT I CAN SOLVE FOR YOU"), "PROFILE")
assert.equal(normalizeCvSectionKey("PROFESSIONAL SUMMARY"), "PROFILE")
assert.equal(normalizeCvSectionKey("VALUE PROPOSITION"), "PROFILE")
assert.equal(normalizeCvSectionKey("SKILLS [columns=3]"), "SKILLS")

const helloFreshCv = `# WHAT I CAN SOLVE FOR YOU
I help product teams clarify messy research problems and ship accessible learning experiences that people actually adopt.
I connect stakeholder needs with evidence so HelloFresh can scale design decisions without losing trust.

SELECTED EVIDENCE
| Role criterion | Strongest evidence | Outcome / Status |
| --- | --- | --- |
| Lead strategic research | Led multi-market research with 120 participants across 4 countries | Delivered |
| Shape accessibility | Drove BITV-certified redesign of the learner portal | BITV certified |
| Build reusable frameworks | Created research ops playbook adopted by 3 product squads | Adopted |
| Scale engineering (proposed) | Would propose a cross-team AI learning pathway | Pilot proposed |

# EXPERIENCE
# Senior Product Designer
## HelloFresh
### January 2021 – Present
- Delivered learning flows used by 1M+ downloads across EU markets
- Informed roadmap decisions with research findings reviewed by leadership
- Shipped accessibility improvements later certified under BITV

# SKILLS [columns=3]
- Service design
- Mixed-methods research
- Accessibility (WCAG / BITV)
- Facilitation
- Figma
- Design systems
- Research ops
- Stakeholder workshops
- Prototyping

# EDUCATION
# M.A. Design
## University
### 2015 – 2017
`

const sections = parseResumeText(helloFreshCv)
assert.ok(
  sections.some((s) => normalizeCvSectionKey(s.title) === "PROFILE"),
  "WHAT I CAN SOLVE FOR YOU must parse as PROFILE",
)
assert.ok(
  sections.some((s) => /SELECTED EVIDENCE/i.test(s.title)),
  "Selected Evidence section must parse",
)
assert.ok(
  sections.some((s) => normalizeCvSectionKey(s.title) === "SKILLS"),
  "SKILLS [columns=3] must parse as SKILLS",
)

const insights = buildCvReviewInsights({
  resumeText: helloFreshCv,
  contactInfo: {
    name: "Alex Example",
    email: "alex@example.com",
    phone: "+49 170 0000000",
    linkedin: "",
    portfolio: "",
    portfolios: [],
    address: "Berlin",
    citizenship: "",
    showPortfolio: false,
    professionalTitle: "Senior Product Designer",
    language: "en",
    targetCompany: "HelloFresh",
    targetRole: "Senior Product Designer",
    jobAdvertSource: "",
  },
  jobDescription: "HelloFresh is hiring a Senior Product Designer to lead research…",
})

const byLabel = Object.fromEntries(insights.factors.map((f) => [f.label, f]))

assert.equal(
  byLabel["Professional summary"]?.points,
  8,
  `summary expected 8/8, got ${byLabel["Professional summary"]?.points}: ${byLabel["Professional summary"]?.detail}`,
)
assert.match(
  byLabel["Professional summary"]?.detail ?? "",
  /WHAT I CAN SOLVE FOR YOU/i,
)

assert.equal(
  byLabel["Skills section"]?.points,
  10,
  `skills expected 10/10, got ${byLabel["Skills section"]?.points}: ${byLabel["Skills section"]?.detail}`,
)
assert.match(byLabel["Skills section"]?.detail ?? "", /columns|items/i)

assert.ok(
  (byLabel["Measurable achievements"]?.points ?? 0) >= 8,
  `achievements expected ≥8/12, got ${byLabel["Measurable achievements"]?.points}: ${byLabel["Measurable achievements"]?.detail}`,
)
assert.match(
  byLabel["Measurable achievements"]?.detail ?? "",
  /Selected Evidence|quantitative|delivered/i,
)
assert.match(
  byLabel["Measurable achievements"]?.detail ?? "",
  /proposed|in-progress/i,
)

assert.ok(insights.jobAlignment?.linked, "job alignment note should reflect linked JD")
assert.doesNotMatch(
  insights.factors.map((f) => f.detail).join(" "),
  /interview success|ATS pass/i,
)

// Empty heading must not score
const emptyProfile = buildCvReviewInsights({
  resumeText: `WHAT I CAN SOLVE FOR YOU

EXPERIENCE
# Role
## Co
### 2020 – Present
- Did things
`,
  contactInfo: {
    name: "A",
    email: "a@b.c",
    phone: "",
    linkedin: "",
    portfolio: "",
    portfolios: [],
    address: "",
    citizenship: "",
    showPortfolio: false,
    professionalTitle: "",
    language: "en",
    targetCompany: "",
    targetRole: "",
    jobAdvertSource: "",
  },
})
const emptySummary = emptyProfile.factors.find((f) => f.label === "Professional summary")
assert.equal(emptySummary?.points, 0, "empty summary heading must not award points")

// Deterministic: same input → same score
const again = buildCvReviewInsights({
  resumeText: helloFreshCv,
  contactInfo: insights.factors && {
    name: "Alex Example",
    email: "alex@example.com",
    phone: "+49 170 0000000",
    linkedin: "",
    portfolio: "",
    portfolios: [],
    address: "Berlin",
    citizenship: "",
    showPortfolio: false,
    professionalTitle: "Senior Product Designer",
    language: "en",
    targetCompany: "HelloFresh",
    targetRole: "Senior Product Designer",
    jobAdvertSource: "",
  },
  jobDescription: "HelloFresh is hiring a Senior Product Designer to lead research…",
})
assert.equal(again.score, insights.score)

// Live edit: removing intro drops summary points
const withoutIntro = helloFreshCv.replace(
  /# WHAT I CAN SOLVE FOR YOU[\s\S]*?(?=SELECTED EVIDENCE)/,
  "",
)
const edited = buildCvReviewInsights({
  resumeText: withoutIntro,
  contactInfo: {
    name: "Alex Example",
    email: "alex@example.com",
    phone: "+49 170 0000000",
    linkedin: "",
    portfolio: "",
    portfolios: [],
    address: "Berlin",
    citizenship: "",
    showPortfolio: false,
    professionalTitle: "Senior Product Designer",
    language: "en",
    targetCompany: "HelloFresh",
    targetRole: "Senior Product Designer",
    jobAdvertSource: "",
  },
})
const editedSummary = edited.factors.find((f) => f.label === "Professional summary")
assert.equal(editedSummary?.points, 0, "removing intro must drop summary credit immediately")

console.log("test-cv-review-insights: ok", {
  score: insights.score,
  summary: byLabel["Professional summary"]?.points,
  skills: byLabel["Skills section"]?.points,
  achievements: byLabel["Measurable achievements"]?.points,
})
