/**
 * Run: npx tsx scripts/test-career-evolution-layouts.ts
 */
import assert from "node:assert/strict"
import {
  CAREER_EVOLUTION_LAYOUTS,
  CAREER_EVOLUTION_MAX_HEIGHT_PX,
  CAREER_EVOLUTION_SYNTAX_HELP,
  normalizeCareerEvolutionConfig,
  normalizeCareerEvolutionLayout,
  parseCareerEvolutionText,
  recommendCareerEvolutionLayout,
  renderCareerEvolutionSvgHtml,
  type CareerEvolutionConfig,
  type CareerEvolutionLayout,
} from "../lib/career-evolution"

function height(svg: string): number {
  const m = svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)
  assert.ok(m)
  return Number(m[1])
}

function figures(svg: string): number {
  return (svg.match(/data-ce-layout-root=/g) || []).length
}

const base = parseCareerEvolutionText(CAREER_EVOLUTION_SYNTAX_HELP, {
  visible: true,
  density: "compact",
  showConnectionIcon: true,
  showConnectionLabels: true,
})
assert.equal(base.errors.length, 0)

const withExtras = normalizeCareerEvolutionConfig({
  ...base.config,
  visible: true,
  capabilities: [
    { id: "c1", label: "UX & Product Design" },
    { id: "c2", label: "Strategic Research" },
    { id: "c3", label: "Responsible AI" },
  ],
  convergenceTarget: "Human-Centred AI Transformation",
  alignments: [
    {
      id: "a1",
      evidenceLabel: "Product research",
      requirementLabel: "Research strategy",
      approved: true,
    },
    {
      id: "a2",
      evidenceLabel: "Responsible AI research",
      requirementLabel: "AI-native methods",
      approved: true,
    },
    {
      id: "a3",
      evidenceLabel: "Workshop facilitation",
      requirementLabel: "Cross-team alignment",
      approved: true,
    },
  ],
})

const layouts: CareerEvolutionLayout[] = [
  "progression",
  "parallel",
  "convergence",
  "branching",
  "alignment",
]
assert.equal(CAREER_EVOLUTION_LAYOUTS.length, 5)

for (const layout of layouts) {
  const cfg: CareerEvolutionConfig = { ...withExtras, layout, visible: true }
  const svg = renderCareerEvolutionSvgHtml(cfg, {
    accentColor: "#0f7b6c",
    width: 480,
  })
  assert.ok(svg, `${layout} should render`)
  assert.equal(figures(svg), 1, `${layout} must render exactly one figure`)
  assert.ok(
    height(svg) <= CAREER_EVOLUTION_MAX_HEIGHT_PX,
    `${layout} height ${height(svg)} exceeds max`,
  )
  assert.match(svg, /max-height:45mm/)
  assert.doesNotMatch(svg, /data-pdf-block=/)
}

// Switching layout preserves milestones / sourceText
const a = { ...withExtras, layout: "progression" as const, visible: true }
const b = { ...a, layout: "alignment" as const }

// Layout radio must change the rendered visualisation (not a no-op)
const svgProgression = renderCareerEvolutionSvgHtml(a, { accentColor: "#0f7b6c", width: 480 })
const svgParallel = renderCareerEvolutionSvgHtml(
  { ...withExtras, layout: "parallel", visible: true },
  { accentColor: "#0f7b6c", width: 480 },
)
assert.match(svgProgression, /data-ce-layout="progression"/)
assert.match(svgParallel, /data-ce-layout="parallel"/)
assert.notEqual(svgProgression, svgParallel)
assert.match(svgProgression, /data-ce-card="1"/)
assert.match(svgParallel, /data-ce-track="/)
assert.ok(
  (svgParallel.match(/data-ce-track="/g) || []).length >= 2,
  "parallel must render distinct track rows when two tracks exist",
)
assert.equal(a.milestones.length, b.milestones.length)
assert.equal(a.sourceText, b.sourceText)
const svgA = renderCareerEvolutionSvgHtml(a, { accentColor: "#0f7b6c" })
const svgB = renderCareerEvolutionSvgHtml(b, { accentColor: "#0f7b6c" })
assert.notEqual(svgA, svgB)

// Parallel: one merge icon
const parallelSvg = renderCareerEvolutionSvgHtml(
  { ...withExtras, layout: "parallel", visible: true },
  { accentColor: "#0f7b6c" },
)
assert.equal((parallelSvg.match(/data-ce-merge-icon=/g) || []).length, 1)

// Convergence: capabilities + target, no dates required
const conv = renderCareerEvolutionSvgHtml(
  { ...withExtras, layout: "convergence", visible: true, milestones: [] },
  { accentColor: "#0f7b6c" },
)
assert.match(conv, /data-ce-capability=/)
assert.match(conv, /data-ce-convergence-target=/)
assert.match(conv, /Human-Centred AI/)

// Alignment rows — distinct from progression; never falls back to cards
const alignSvg = renderCareerEvolutionSvgHtml(
  { ...withExtras, layout: "alignment", visible: true },
  { accentColor: "#0f7b6c" },
)
assert.match(alignSvg, /data-ce-layout="alignment"/)
assert.match(alignSvg, /data-ce-alignment=/)
assert.match(alignSvg, /Research strategy/)
assert.doesNotMatch(alignSvg, /data-ce-card="1"/)
assert.doesNotMatch(alignSvg, /data-ce-layout="progression"/)
assert.match(alignSvg, /EVIDENCE|Evidence|→/)

// Alignment without mappings → empty (not Progression Cards)
const alignEmpty = renderCareerEvolutionSvgHtml(
  {
    ...withExtras,
    layout: "alignment",
    visible: true,
    alignments: [],
    milestones: withExtras.milestones.map((m) => ({
      ...m,
      jobRequirementAddressed: undefined,
    })),
  },
  { accentColor: "#0f7b6c" },
)
assert.equal(alignEmpty, "", "alignment without pairs must not render Progression")

// Branching has main path nodes
const branchSvg = renderCareerEvolutionSvgHtml(
  { ...withExtras, layout: "branching", visible: true },
  { accentColor: "#0f7b6c" },
)
assert.match(branchSvg, /<circle /)

// Branching wraps long titles instead of hard-truncating mid-word (e.g. "Product Resea…")
const branchLong = renderCareerEvolutionSvgHtml(
  {
    ...withExtras,
    layout: "branching",
    visible: true,
    showParallelWork: true,
    tracks: [
      { id: "track-employment", label: "Professional Experience" },
      { id: "track-independent", label: "Independent work" },
    ],
    milestones: [
      {
        id: "m1",
        label: "UX Design",
        start: "2016-12",
        end: "2019-08",
        trackId: "track-employment",
        approved: true,
      },
      {
        id: "m2",
        label: "Product Research",
        start: "2021-04",
        end: "2023-11",
        trackId: "track-employment",
        approved: true,
      },
      {
        id: "m3",
        label: "UX Research",
        start: "2023-11",
        end: "present",
        trackId: "track-employment",
        approved: true,
      },
      {
        id: "m4",
        label: "Product & Service Research",
        start: "2021-01",
        end: "2024-02",
        trackId: "track-independent",
        approved: true,
      },
    ],
  },
  { accentColor: "#0f7b6c", width: 480 },
)
assert.match(branchLong, /data-ce-layout="branching"/)
assert.match(branchLong, /Product Research/)
assert.doesNotMatch(branchLong, /Product Resea…/)
assert.match(branchLong, /Product &amp; Service/)
assert.doesNotMatch(branchLong, /Product &amp; Service R…/)
assert.ok(height(branchLong) <= CAREER_EVOLUTION_MAX_HEIGHT_PX)

// Long labels don't explode height
const long = renderCareerEvolutionSvgHtml(
  {
    ...withExtras,
    layout: "progression",
    visible: true,
    milestones: withExtras.milestones.map((m) => ({
      ...m,
      label: `${m.label} and Extended Strategic Leadership Portfolio`,
    })),
  },
  { accentColor: "#0f7b6c" },
)
assert.ok(height(long) <= CAREER_EVOLUTION_MAX_HEIGHT_PX)

// Recommend
assert.equal(
  recommendCareerEvolutionLayout({
    hasParallel: true,
    milestoneCount: 4,
    interpretiveCount: 2,
    themeCount: 2,
    alignmentPairCount: 0,
    capabilityCount: 2,
  }),
  "parallel",
)
assert.equal(
  recommendCareerEvolutionLayout({
    hasParallel: false,
    milestoneCount: 3,
    interpretiveCount: 1,
    themeCount: 3,
    alignmentPairCount: 3,
    capabilityCount: 3,
    isCareerTransition: true,
  }),
  "alignment",
)
assert.equal(
  recommendCareerEvolutionLayout({
    hasParallel: false,
    milestoneCount: 3,
    interpretiveCount: 2,
    themeCount: 2,
    alignmentPairCount: 3,
    capabilityCount: 3,
  }),
  "progression",
)
assert.equal(normalizeCareerEvolutionLayout("skills-convergence"), "convergence")
assert.equal(normalizeCareerEvolutionLayout("parallel-tracks"), "parallel")

console.log("test-career-evolution-layouts: ok", {
  layouts: layouts.length,
  parallelHeight: height(parallelSvg),
})
