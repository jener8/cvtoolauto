/**
 * Show parallel work in graph — independent of layout template.
 * Progression Cards vs Parallel Tracks must render differently.
 * Run: npx tsx scripts/test-career-evolution-parallel-visibility.ts
 */
import assert from "node:assert/strict"
import {
  applyExperienceRoleSettings,
  listExperienceRolesForEditor,
} from "../lib/experience-work-modifier"
import {
  hasParallelTrackContent,
  normalizeCareerEvolutionConfig,
  prepareCareerEvolutionParallelVisibility,
  renderCareerEvolutionSvgHtml,
  type CareerEvolutionConfig,
} from "../lib/career-evolution"

const RESUME = `EXPERIENCE
# Senior UX & AI Strategy Specialist
## Bundesdruckerei-Gruppe, Berlin, Germany
### November 2023 – Present
- Led AI strategy

# Founder – Responsible AI Research & Design
## TrustAudit.tools
### 2024 – Present
- Independent responsible AI research

# UX Designer – Product Research & Discovery
## Bundesdruckerei-Gruppe, Berlin, Germany
### April 2021 – November 2023
- Research
`

const marked = applyExperienceRoleSettings(
  RESUME,
  {
    sectionKey: "EXPERIENCE",
    title: "Founder – Responsible AI Research & Design",
    company: "TrustAudit.tools",
    jobIndex: listExperienceRolesForEditor(RESUME).find((r) =>
      /trustaudit/i.test(r.company),
    )!.jobIndex,
  },
  {
    workRelationship: "parallel-independent",
    presentation: "within-experience",
  },
)
assert.match(marked, /\[work=parallel-independent\]/)

const baseConfig: CareerEvolutionConfig = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "parallel",
  showParallelWork: true,
  density: "compact",
  tracks: [{ id: "track-employment", label: "Professional Experience" }],
  milestones: [
    {
      id: "m1",
      label: "UX Design",
      description: "SolarWinds",
      start: "2016-12",
      end: "2019-08",
      trackId: "track-employment",
      approved: true,
    },
    {
      id: "m2",
      label: "UX Research",
      description: "Bundesdruckerei-Gruppe",
      start: "2021-04",
      end: "2023-11",
      trackId: "track-employment",
      approved: true,
    },
    {
      id: "m3",
      label: "UX & AI Strategy",
      description: "Bundesdruckerei-Gruppe",
      start: "2023-11",
      end: "present",
      trackId: "track-employment",
      approved: true,
    },
    {
      id: "m4",
      label: "Responsible AI Research",
      description: "TrustAudit.tools",
      start: "2024",
      end: "present",
      trackId: "track-employment", // wrongly on employment — enrich should move
      approved: true,
    },
  ],
  connections: [],
})

assert.equal(hasParallelTrackContent(baseConfig), false)

const enriched = prepareCareerEvolutionParallelVisibility(baseConfig, marked)
assert.ok(hasParallelTrackContent(enriched), "enrich moves TrustAudit to independent track")
assert.ok(
  enriched.milestones.some(
    (m) =>
      /trustaudit/i.test(m.description || "") &&
      m.trackId === "track-independent",
  ),
)

const withParallel = renderCareerEvolutionSvgHtml(
  { ...baseConfig, layout: "parallel" },
  {
    accentColor: "#0f7b6c",
    width: 480,
    resumeText: marked,
  },
)
assert.match(withParallel, /data-ce-layout="parallel"/)
assert.match(withParallel, /data-ce-parallel-track="1"/)
assert.match(withParallel, /data-ce-parallel-primary="1"/)
assert.match(withParallel, /data-ce-parallel-link="1"|data-ce-relationship="1"/)
assert.match(withParallel, /data-ce-merge-icon=/)
assert.match(withParallel, /INDEPENDENT|Independent|TrustAudit/i)
assert.doesNotMatch(withParallel, /data-ce-layout="progression"/)
assert.doesNotMatch(withParallel, /data-ce-card="1"/) // never Progression cards
assert.doesNotMatch(withParallel, /2023-11-prese/)
assert.match(withParallel, /2024–Present|2024/)

// Progression: one card row, no second track row
const progression = renderCareerEvolutionSvgHtml(
  { ...baseConfig, layout: "progression", showParallelWork: true },
  { accentColor: "#0f7b6c", width: 480, resumeText: marked },
)
assert.match(progression, /data-ce-layout="progression"/)
assert.match(progression, /data-ce-card="1"/)
assert.doesNotMatch(progression, /data-ce-parallel-track="1"/)
assert.doesNotMatch(progression, /data-ce-parallel-primary="1"/)

// Layouts must be unmistakably different
assert.notEqual(progression, withParallel)
assert.ok(
  (withParallel.match(/data-ce-track="/g) || []).length >= 2,
  "parallel must render two track rows",
)
assert.ok(
  (progression.match(/data-ce-card=/g) || []).length >= 1,
  "progression uses cards",
)

// Switching layout preserves milestone count in source config
assert.equal(baseConfig.milestones.length, 4)
const asProg = { ...baseConfig, layout: "progression" as const }
const asPar = { ...baseConfig, layout: "parallel" as const }
assert.equal(asProg.milestones.length, asPar.milestones.length)
assert.equal(asProg.showParallelWork, asPar.showParallelWork)

// Disable show parallel work → independent track hidden on Parallel layout
const hidden = renderCareerEvolutionSvgHtml(
  { ...baseConfig, layout: "parallel", showParallelWork: false },
  { accentColor: "#0f7b6c", width: 480, resumeText: marked },
)
assert.match(hidden, /data-ce-layout="parallel"/)
assert.doesNotMatch(hidden, /data-ce-parallel-track="1"/)

// Re-enable
const shownAgain = renderCareerEvolutionSvgHtml(
  { ...baseConfig, layout: "parallel", showParallelWork: true },
  { accentColor: "#0f7b6c", width: 480, resumeText: marked },
)
assert.match(shownAgain, /data-ce-parallel-track="1"/)

// No parallel classification → employment row only (never editor instructions on the CV)
const noMark = renderCareerEvolutionSvgHtml(
  {
    ...baseConfig,
    milestones: baseConfig.milestones.filter(
      (m) => !/trustaudit/i.test(m.description || ""),
    ),
    showParallelWork: true,
    layout: "parallel",
  },
  { accentColor: "#0f7b6c", width: 480, resumeText: RESUME },
)
assert.match(noMark, /data-ce-layout="parallel"/)
assert.doesNotMatch(noMark, /data-ce-parallel-track="1"/)
assert.doesNotMatch(noMark, /data-ce-parallel-empty="1"|No parallel role|Mark a role under Edit/)
assert.doesNotMatch(noMark, /data-ce-layout="progression"/)
assert.doesNotMatch(noMark, /data-ce-card="1"/)

// TrustAudit only in experience (not in milestones) still surfaces on Parallel
const withoutTaMilestone = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "parallel",
  showParallelWork: true,
  tracks: [{ id: "track-employment", label: "Professional Experience" }],
  milestones: [
    {
      id: "m3",
      label: "UX & AI Strategy",
      description: "Bundesdruckerei-Gruppe",
      start: "2023-11",
      end: "present",
      trackId: "track-employment",
      approved: true,
    },
  ],
})
const fromClassOnly = renderCareerEvolutionSvgHtml(withoutTaMilestone, {
  accentColor: "#0f7b6c",
  width: 480,
  resumeText: marked,
})
assert.match(fromClassOnly, /data-ce-parallel-track="1"/)
assert.match(fromClassOnly, /TrustAudit|Independent|Founder|Responsible/i)

// HelloFresh regression: Education track must not steal the Independent Work slot
const withEducation = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "parallel",
  showParallelWork: true,
  tracks: [
    { id: "track-employment", label: "Professional Experience" },
    { id: "track-independent", label: "Independent Work" },
    { id: "track-education", label: "Education" },
  ],
  milestones: [
    {
      id: "m-emp",
      label: "UX Research & AI Strategy",
      description: "Bundesdruckerei-Gruppe",
      start: "2023-11",
      end: "present",
      trackId: "track-employment",
      approved: true,
    },
    {
      id: "m-ind",
      label: "Human–AI Interaction & Responsible AI",
      description: "TrustAudit.tools",
      start: "2024",
      end: "present",
      trackId: "track-independent",
      approved: true,
    },
    {
      id: "m-edu",
      label: "MA Design for Responsible AI",
      description: "Elisava",
      start: "2024",
      end: "2025",
      trackId: "track-education",
      approved: true,
    },
  ],
  connections: [],
})
const helloFreshParallel = renderCareerEvolutionSvgHtml(withEducation, {
  accentColor: "#67906c",
  width: 480,
})
assert.match(helloFreshParallel, /data-ce-parallel-track="1"/)
assert.match(helloFreshParallel, /TrustAudit|Human|Responsible/i)
assert.doesNotMatch(helloFreshParallel, /data-ce-parallel-empty=/)
assert.doesNotMatch(helloFreshParallel, /No parallel role|Mark a role under Edit/)
// Education must not appear as the independent row
const trackLabels = [
  ...helloFreshParallel.matchAll(/data-ce-track-label="([^"]+)"/g),
].map((m) => m[1]!)
assert.ok(
  trackLabels.some((l) => /independent/i.test(l)),
  `expected Independent track, got ${trackLabels.join(", ")}`,
)
assert.ok(
  !trackLabels.some((l) => /^education$/i.test(l)),
  "Education must not replace Independent Work on Parallel Tracks",
)

console.log("test-career-evolution-parallel-visibility: ok")
