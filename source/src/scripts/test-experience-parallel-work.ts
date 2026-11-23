/**
 * Run: npx tsx scripts/test-experience-parallel-work.ts
 */
import assert from "node:assert/strict"
import { parseResumeMarkupLine } from "../lib/resume-markup-line"
import { splitExperienceJobEntries } from "../lib/experience-organization"
import {
  applyExperienceRoleSettings,
  formatParallelWorkAtsSuffix,
  listExperienceRolesForEditor,
  parseExperienceWorkModifier,
  renderParallelWorkBadgeHtml,
  resolveExperienceWorkType,
  setExperienceWorkTypeInResumeText,
  stripExperienceWorkModifier,
} from "../lib/experience-work-modifier"

const marked =
  "# Founder - Responsible AI Research & Design [work=parallel-independent]\n## TrustAudit.tools\n### 2024 - Present\n- Built TrustAudit.tools\n"

const parsedLine = parseResumeMarkupLine(
  "# Founder - Responsible AI Research & Design [work=parallel-independent]",
)
assert.equal(parsedLine.kind, "job-title")
if (parsedLine.kind === "job-title") {
  assert.equal(parsedLine.text, "Founder - Responsible AI Research & Design")
  assert.equal(parsedLine.workType, "parallel-independent")
}

const jobs = splitExperienceJobEntries(marked.split("\n"))
assert.equal(jobs.length, 1)
assert.equal(jobs[0]!.title, "Founder - Responsible AI Research & Design")
assert.equal(jobs[0]!.workType, "parallel-independent")
assert.equal(jobs[0]!.company, "TrustAudit.tools")

const badge = renderParallelWorkBadgeHtml({
  workType: "parallel-independent",
  accentColor: "#0f7b6c",
  language: "en",
  fontSizePx: 16,
})
assert.match(badge, /cv-parallel-work-badge/)
assert.match(badge, /Parallel independent work/)
assert.match(badge, /<svg /)
assert.doesNotMatch(badge, /\[work=/)

const ats = formatParallelWorkAtsSuffix("parallel-independent", "en")
assert.equal(ats, " (Parallel independent work)")
assert.doesNotMatch(ats, /svg/i)

const resume = `PROFILE
Hello.

EXPERIENCE
# UX & AI Strategy
## Bundesdruckerei
### 2023 - Present
- Strategy

# Founder - Responsible AI Research & Design
## TrustAudit.tools
### 2024 - Present
- Research

EDUCATION
# MSc
## Uni
### 2015
`

const roles = listExperienceRolesForEditor(resume)
assert.equal(roles.length, 2)
const founder = roles.find((r) => r.company === "TrustAudit.tools")
const primary = roles.find((r) => r.company === "Bundesdruckerei")
assert.ok(founder)
assert.ok(primary)
assert.equal(founder!.workRelationship, "standard")
assert.equal(founder!.workType, "standard")
assert.equal(founder!.presentation, "within-experience")
assert.equal(founder!.overlapSuggested, true)
// Do not nudge the primary employment role solely because a side project overlaps
assert.equal(primary!.overlapSuggested, false)

const updated = setExperienceWorkTypeInResumeText(
  resume,
  {
    sectionKey: "EXPERIENCE",
    title: founder!.title,
    company: founder!.company,
    jobIndex: founder!.jobIndex,
  },
  "parallel-independent",
)
assert.match(
  updated,
  /# Founder - Responsible AI Research & Design \[work=parallel-independent\]/,
)
assert.match(updated, /### 2024 - Present/)
assert.match(updated, /## TrustAudit.tools/)
assert.match(updated, /- Research/)

const roles2 = listExperienceRolesForEditor(updated)
const founder2 = roles2.find((r) => r.company === "TrustAudit.tools")
assert.equal(founder2!.workRelationship, "parallel-independent")
assert.equal(founder2!.presentation, "within-experience")
assert.equal(founder2!.overlapSuggested, false)

// Presentation: move to separate Independent Work section (confirmed editor action)
const moved = applyExperienceRoleSettings(
  updated,
  {
    sectionKey: "EXPERIENCE",
    title: founder2!.title,
    company: founder2!.company,
    jobIndex: founder2!.jobIndex,
  },
  {
    workRelationship: "parallel-independent",
    presentation: "separate-section",
  },
)
assert.match(moved, /PARALLEL INDEPENDENT WORK/)
assert.match(
  moved,
  /# Founder - Responsible AI Research & Design \[work=parallel-independent\]/,
)
assert.equal(
  (moved.match(/# Founder - Responsible AI Research & Design/g) || []).length,
  1,
  "role must appear exactly once",
)
assert.doesNotMatch(
  moved.split("PARALLEL INDEPENDENT WORK")[0]!,
  /TrustAudit\.tools/,
)

const rolesMoved = listExperienceRolesForEditor(moved)
const founderMoved = rolesMoved.find((r) => r.company === "TrustAudit.tools")
assert.ok(founderMoved)
assert.equal(founderMoved!.presentation, "separate-section")
assert.equal(founderMoved!.workRelationship, "parallel-independent")

// Move back within Experience — still one entry, marker preserved
const back = applyExperienceRoleSettings(
  moved,
  {
    sectionKey: "PARALLEL_WORK",
    title: founderMoved!.title,
    company: founderMoved!.company,
    jobIndex: founderMoved!.jobIndex,
  },
  {
    workRelationship: "parallel-independent",
    presentation: "within-experience",
  },
)
assert.doesNotMatch(back, /PARALLEL INDEPENDENT WORK/)
assert.match(
  back,
  /# Founder - Responsible AI Research & Design \[work=parallel-independent\]/,
)
assert.equal(
  (back.match(/TrustAudit\.tools/g) || []).length,
  1,
)

// Standard clears marker and keeps within Experience
const standardized = applyExperienceRoleSettings(
  back,
  {
    sectionKey: "EXPERIENCE",
    title: founderMoved!.title,
    company: founderMoved!.company,
    jobIndex: listExperienceRolesForEditor(back).find(
      (r) => r.company === "TrustAudit.tools",
    )!.jobIndex,
  },
  {
    workRelationship: "standard",
    presentation: "separate-section", // ignored — standard forces within-experience
  },
)
assert.doesNotMatch(
  standardized,
  /\[work=parallel-independent\]/,
)
assert.doesNotMatch(standardized, /PARALLEL INDEPENDENT WORK/)

// PARALLEL_WORK section implies label without marker (legacy compat)
assert.equal(
  resolveExperienceWorkType({
    lineWorkType: "standard",
    sectionIsParallelWork: true,
  }),
  "parallel-independent",
)

assert.equal(
  stripExperienceWorkModifier("Role [work=parallel-consulting]"),
  "Role",
)
assert.equal(
  parseExperienceWorkModifier("Consultant [work=freelance]").workRelationship,
  "parallel-consulting",
)
assert.equal(
  parseExperienceWorkModifier("Consultant [work=freelance]").workType,
  "parallel-consulting",
)

// En-dash titles in source must still accept [work=…] (parser normalises dashes)
const enDashResume = `EXPERIENCE
# Founder – Responsible AI Research & Design
## TrustAudit.tools
### 2024 – Present
- Research
`
const enDashRoles = listExperienceRolesForEditor(enDashResume)
const enDashFounder = enDashRoles.find((r) => /trustaudit/i.test(r.company))
assert.ok(enDashFounder)
const enDashUpdated = applyExperienceRoleSettings(
  enDashResume,
  {
    sectionKey: enDashFounder!.sectionKey,
    title: enDashFounder!.title,
    company: enDashFounder!.company,
    jobIndex: enDashFounder!.jobIndex,
  },
  {
    workRelationship: "parallel-independent",
    presentation: "within-experience",
  },
)
assert.notEqual(enDashUpdated, enDashResume)
assert.match(enDashUpdated, /\[work=parallel-independent\]/)
assert.match(enDashUpdated, /Founder/)
const enDashRoles2 = listExperienceRolesForEditor(enDashUpdated)
assert.equal(
  enDashRoles2.find((r) => /trustaudit/i.test(r.company))!.workRelationship,
  "parallel-independent",
)

// Multi-role CV: every role must accept a radio change (not only the first)
const multiRole = `EXPERIENCE
# Senior UX & AI Strategy Specialist
## Bundesdruckerei-Gruppe, Berlin, Germany
### November 2023 – Present
- Strategy

# Founder – Responsible AI Research & Design
## TrustAudit.tools
### 2024 – Present
- Research

# UX Designer – Product Research & Discovery
## Bundesdruckerei-Gruppe, Berlin, Germany
### April 2021 – November 2023
- Design

# Product Research Consultant
## Anderson Eye Care, United Kingdom
### January 2021 – February 2024
- Consulting
`
let multiText = multiRole
const multiRoles = listExperienceRolesForEditor(multiText)
assert.equal(multiRoles.length, 4)
for (const role of multiRoles) {
  const next = applyExperienceRoleSettings(
    multiText,
    {
      sectionKey: role.sectionKey,
      title: role.title,
      company: role.company,
      jobIndex: role.jobIndex,
    },
    {
      workRelationship: "parallel-independent",
      presentation: "within-experience",
    },
  )
  assert.notEqual(
    next,
    multiText,
    `must apply parallel marker for “${role.title}”`,
  )
  multiText = next
  const confirmed = listExperienceRolesForEditor(multiText).find(
    (r) =>
      r.title === role.title &&
      r.company === role.company,
  )
  assert.ok(confirmed, `role still listed after apply: ${role.title}`)
  assert.equal(
    confirmed!.workRelationship,
    "parallel-independent",
    `selection must stick for “${role.title}”`,
  )
}
assert.equal(
  (multiText.match(/\[work=parallel-independent\]/g) || []).length,
  4,
)

console.log("test-experience-parallel-work: ok")
