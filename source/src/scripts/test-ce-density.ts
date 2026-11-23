/**
 * Compact vs Standard density must produce visibly different CE graphs
 * for every layout — without changing milestone content.
 * Run: node --import tsx scripts/test-ce-density.ts
 */
import assert from "node:assert/strict"
import {
  CAREER_EVOLUTION_LAYOUTS,
  careerEvolutionDensityMetrics,
  normalizeCareerEvolutionConfig,
  renderCareerEvolutionSvgHtml,
  type CareerEvolutionConfig,
  type CareerEvolutionLayout,
} from "../lib/career-evolution"

function viewBoxHeight(svg: string): number {
  const m = svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)
  assert.ok(m, "missing viewBox")
  return Number(m[1])
}

function largestTitleFont(svg: string): number {
  const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]))
  assert.ok(sizes.length > 0, "no font-size in svg")
  return Math.max(...sizes)
}

function milestoneIds(svg: string): string[] {
  return [...svg.matchAll(/data-ce-milestone="([^"]+)"/g)].map((m) => m[1]!)
}

const base: CareerEvolutionConfig = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "progression",
  density: "compact",
  showParallelWork: true,
  showConnectionIcon: true,
  showConnectionLabels: true,
  tracks: [
    { id: "emp", label: "Professional Experience" },
    { id: "ind", label: "Independent work" },
  ],
  milestones: [
    {
      id: "m1",
      label: "Research & discovery",
      displayLabel: "Strategic Research",
      displayLabelOrigin: "auto",
      officialTitle: "Senior UX Designer",
      start: "2016-12",
      end: "2019-08",
      trackId: "emp",
      approved: true,
    },
    {
      id: "m2",
      label: "Product design & delivery",
      displayLabel: "Product Design",
      displayLabelOrigin: "auto",
      start: "2021-01",
      end: "2023-11",
      trackId: "emp",
      approved: true,
    },
    {
      id: "m3",
      label: "Strategy & influence",
      displayLabel: "UX Strategy",
      displayLabelOrigin: "auto",
      start: "2023-11",
      end: "present",
      trackId: "emp",
      approved: true,
    },
    {
      id: "p1",
      label: "Responsible AI",
      displayLabel: "Responsible AI",
      displayLabelOrigin: "auto",
      start: "2024",
      end: "present",
      trackId: "ind",
      approved: true,
    },
  ],
  connections: [
    {
      id: "c1",
      fromMilestoneId: "p1",
      toMilestoneId: "m3",
      label: "Independent research alongside employment",
      approved: true,
    },
  ],
  capabilities: [
    { id: "c-research", label: "Research & discovery" },
    { id: "c-design", label: "Product design & delivery" },
    { id: "c-ai", label: "Responsible AI & governance" },
  ],
  convergenceTarget: "Staff UX Strategist",
  alignments: [
    {
      id: "a1",
      evidenceLabel: "Paths of AI Enablement discovery pilot",
      requirementLabel: "Set the research agenda",
      matchType: "direct",
      approved: true,
    },
    {
      id: "a2",
      evidenceLabel: "Accessibility work on digital vehicle documents",
      requirementLabel: "Shape the wider experience",
      matchType: "transferable",
      approved: true,
    },
  ],
})

// Metrics themselves differ
const compactM = careerEvolutionDensityMetrics("compact")
const standardM = careerEvolutionDensityMetrics("standard")
assert.ok(standardM.titleSize > compactM.titleSize)
assert.ok(standardM.gap > compactM.gap)
assert.ok(standardM.padY > compactM.padY)
assert.ok(standardM.capsuleH > compactM.capsuleH)
assert.ok(standardM.alignFontSize > compactM.alignFontSize)
assert.ok(standardM.maxHeightPx > compactM.maxHeightPx)
assert.equal(compactM.titleSize, 9)
assert.equal(standardM.titleSize, 10)
assert.equal(compactM.dateSize, 8)
assert.equal(standardM.dateSize, 8.5)
assert.equal(compactM.trackLabelSize, 8.5)
assert.equal(standardM.trackLabelSize, 9)
assert.equal(compactM.connectionLabelSize, 7.5)
assert.equal(standardM.connectionLabelSize, 8)
assert.ok(compactM.titleSize < 13, "CE titles must stay subordinate to Experience (~13–14px)")
assert.ok(standardM.titleSize < 13, "CE titles must stay subordinate to Experience (~13–14px)")

const layouts = CAREER_EVOLUTION_LAYOUTS.map((l) => l.id)
assert.deepEqual(
  layouts.sort(),
  (["progression", "parallel", "convergence", "branching", "alignment"] as CareerEvolutionLayout[]).sort(),
)

for (const layout of layouts) {
  const compactSvg = renderCareerEvolutionSvgHtml(
    { ...base, layout, density: "compact" },
    { accentColor: "#67906c", width: 480 },
  )
  const standardSvg = renderCareerEvolutionSvgHtml(
    { ...base, layout, density: "standard" },
    { accentColor: "#67906c", width: 480 },
  )
  assert.ok(compactSvg.includes(`data-ce-layout="${layout}"`), layout)
  assert.ok(compactSvg.includes('data-ce-density="compact"'), `${layout} compact attr`)
  assert.ok(standardSvg.includes('data-ce-density="standard"'), `${layout} standard attr`)
  assert.match(compactSvg, /max-height:45mm/)
  assert.match(standardSvg, /max-height:52mm/)

  const cH = viewBoxHeight(compactSvg)
  const sH = viewBoxHeight(standardSvg)
  const cFont = largestTitleFont(compactSvg)
  const sFont = largestTitleFont(standardSvg)

  // Visibly different: taller and/or larger type in Standard
  assert.ok(
    sH > cH || sFont > cFont,
    `${layout}: expected standard taller or larger type (h ${cH}->${sH}, font ${cFont}->${sFont})`,
  )
  assert.ok(sFont >= cFont, `${layout}: standard font should be >= compact`)

  // Content preserved — same milestone set when layout uses milestones
  if (layout === "progression" || layout === "parallel" || layout === "branching") {
    assert.deepEqual(
      milestoneIds(compactSvg).sort(),
      milestoneIds(standardSvg).sort(),
      `${layout}: density must not drop milestones`,
    )
  }
  if (layout === "alignment") {
    assert.equal(
      (compactSvg.match(/data-ce-alignment="/g) || []).length,
      (standardSvg.match(/data-ce-alignment="/g) || []).length,
    )
  }
  if (layout === "convergence") {
    assert.equal(
      (compactSvg.match(/data-ce-capability="/g) || []).length,
      (standardSvg.match(/data-ce-capability="/g) || []).length,
    )
  }

  // Short career labels appear on milestone layouts; alignment uses evidence pairs only
  if (layout === "progression" || layout === "parallel" || layout === "branching") {
    assert.match(compactSvg, /Strategic Research|Product Design|UX Strategy/)
    assert.match(standardSvg, /Strategic Research|Product Design|UX Strategy/)
  }
  if (layout === "alignment") {
    assert.match(compactSvg, /research agenda/i)
    assert.match(standardSvg, /research agenda/i)
  }
}

console.log("test-ce-density: ok", {
  compactTitle: compactM.titleSize,
  standardTitle: standardM.titleSize,
  layouts: layouts.length,
})
