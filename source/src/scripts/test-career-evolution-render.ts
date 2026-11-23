/**
 * Run: npx tsx scripts/test-career-evolution-render.ts
 */
import assert from "node:assert/strict"
import {
  CAREER_EVOLUTION_COMPACT_TWO_TRACK_HEIGHT_PX,
  CAREER_EVOLUTION_MAX_HEIGHT_PX,
  CAREER_EVOLUTION_SYNTAX_HELP,
  abbreviateStageLabel,
  normalizeCareerEvolutionConfig,
  parseCareerEvolutionText,
  placeCareerEvolutionInSections,
  renderCareerEvolutionSvgHtml,
  uniqueTracksForRender,
  wrapLabelLines,
} from "../lib/career-evolution"

function viewBoxHeight(svg: string): number {
  const m = svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)
  assert.ok(m, "missing viewBox")
  return Number(m[1])
}

function countRenderedTracks(svg: string): number {
  return (svg.match(/data-ce-track="/g) || []).length
}

function countMergeIcons(svg: string): number {
  return (svg.match(/data-ce-merge-icon="/g) || []).length
}

function countFigures(svg: string): number {
  return (svg.match(/data-ce-layout-root=/g) || []).length
}

// --- 1. One track with three milestones ---
const oneTrack = parseCareerEvolutionText(
  `TRACK: Professional Experience
- 2016–2019 | UX Design | SolarWinds
- 2021–2023 | UX Research | Bundesdruckerei
- 2023–Present | UX & AI Strategy | Bundesdruckerei
`,
  { visible: true, layout: "progression", density: "compact" },
)
assert.equal(oneTrack.errors.length, 0)
assert.equal(oneTrack.config.tracks.length, 1)
const svg1 = renderCareerEvolutionSvgHtml(
  { ...oneTrack.config, visible: true },
  { accentColor: "#0f7b6c", width: 480 },
)
assert.equal(countFigures(svg1), 1)
assert.equal(countMergeIcons(svg1), 0) // linear progression → no merge icon
assert.equal((svg1.match(/data-ce-milestone="/g) || []).length, 3)
assert.ok(viewBoxHeight(svg1) <= CAREER_EVOLUTION_MAX_HEIGHT_PX)

// --- 2. Two tracks, four milestones ---
const twoTrack = parseCareerEvolutionText(CAREER_EVOLUTION_SYNTAX_HELP, {
  visible: true,
  layout: "parallel",
  density: "compact",
  showConnectionIcon: true,
  showConnectionLabels: true,
})
assert.equal(twoTrack.config.tracks.length, 2)
const prepared = uniqueTracksForRender(twoTrack.config)
assert.equal(prepared.tracks.length, 2)

const svg2 = renderCareerEvolutionSvgHtml(
  { ...twoTrack.config, visible: true, layout: "parallel", density: "compact" },
  { accentColor: "#0f7b6c", width: 480 },
)
assert.equal(countFigures(svg2), 1)
assert.equal(countRenderedTracks(svg2), 2)
assert.equal((svg2.match(/data-ce-milestone="/g) || []).length, 4)
assert.ok(viewBoxHeight(svg2) <= CAREER_EVOLUTION_COMPACT_TWO_TRACK_HEIGHT_PX)
assert.ok(viewBoxHeight(svg2) <= CAREER_EVOLUTION_MAX_HEIGHT_PX)

// --- 3. Exactly one merge icon for the relationship ---
assert.equal(countMergeIcons(svg2), 1)
assert.doesNotMatch(svg2, /Q \d+ \d+ \d+ \d+/) // no long diagonal arcs
assert.match(svg2, /data-ce-relationship="1"/)
// Capsule rects inside milestone groups (not per-milestone merge icons)
assert.match(svg2, /data-ce-milestone="[^"]*"><rect /)

// Parallel capsules wrap titles onto two lines instead of mid-word ellipsis
const parallelWrap = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "parallel",
  density: "compact",
  showParallelWork: true,
  showConnectionIcon: true,
  showConnectionLabels: true,
  tracks: [
    { id: "emp", label: "Professional Experience" },
    { id: "ind", label: "Unabhängige Arbeit" },
  ],
  milestones: [
    {
      id: "e1",
      label: "Senior UX Designer - Product Research & Strategy",
      start: "2021",
      end: "present",
      trackId: "emp",
      approved: true,
    },
    {
      id: "e2",
      label: "Product design & delivery",
      start: "2019",
      end: "2021",
      trackId: "emp",
      approved: true,
    },
    {
      id: "e3",
      label: "Research & discovery",
      start: "2016",
      end: "2019",
      trackId: "emp",
      approved: true,
    },
    {
      id: "p1",
      label: "Strategy & innovation",
      start: "2021",
      end: "present",
      trackId: "ind",
      approved: true,
    },
    {
      id: "p2",
      label: "Founder - Research",
      start: "2024",
      end: "present",
      trackId: "ind",
      approved: true,
    },
  ],
  connections: [],
})
const svgParallelWrap = renderCareerEvolutionSvgHtml(parallelWrap, {
  accentColor: "#67906c",
  width: 480,
})
assert.match(svgParallelWrap, /Strategy/)
assert.match(svgParallelWrap, /innovation/)
assert.match(svgParallelWrap, /Founder/)
assert.match(svgParallelWrap, /Research/)
assert.doesNotMatch(svgParallelWrap, /Strategy &amp; in…|Strategy & in…/)
assert.doesNotMatch(svgParallelWrap, /Founder - Res…/)
// Employment title should keep words beyond the first line (not "Senior UX Designer -" alone)
assert.match(svgParallelWrap, /Senior UX Designer/)
assert.ok(
  /Product Research|Strategy/.test(svgParallelWrap),
  "employment title must wrap remaining words onto a second line",
)
assert.ok(viewBoxHeight(svgParallelWrap) <= CAREER_EVOLUTION_COMPACT_TWO_TRACK_HEIGHT_PX)

// --- 4. Progression cards: short / medium / long labels + four-up row ---
const shortLabel = "UX Design"
const mediumLabel = "Strategic Research"
const longLabel = "Senior UX & AI Strategy Specialist"
assert.ok(wrapLabelLines(longLabel, 14, 2, { allowEllipsis: false }).length <= 2)
assert.ok(
  wrapLabelLines(longLabel, 14, 2, { allowEllipsis: false }).join(" ").includes("AI") ||
    wrapLabelLines(longLabel, 14, 2, { allowEllipsis: false }).some((l) => l.includes("Strategy")),
  "must not rewrite long titles by dropping & segments",
)
assert.equal(abbreviateStageLabel(shortLabel, 22), shortLabel)

const fourUp = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "progression",
  density: "compact",
  tracks: [{ id: "t1", label: "Professional Experience" }],
  milestones: [
    { id: "m1", label: shortLabel, start: "2016", end: "2019", trackId: "t1", approved: true },
    { id: "m2", label: mediumLabel, start: "2019", end: "2021", trackId: "t1", approved: true },
    {
      id: "m3",
      label: longLabel,
      start: "2021",
      end: "2023",
      trackId: "t1",
      approved: true,
    },
    {
      id: "m4",
      label: "Lead Product Designer for Enterprise Platforms",
      displayLabel: "Product Design",
      start: "2023",
      end: "present",
      trackId: "t1",
      approved: true,
    },
  ],
  connections: [],
})
const svgFour = renderCareerEvolutionSvgHtml(fourUp, {
  accentColor: "#0f7b6c",
  width: 480,
})
assert.equal((svgFour.match(/data-ce-card="1"/g) || []).length, 4)
assert.match(svgFour, /UX Design/)
assert.match(svgFour, /Strategic Research/)
assert.match(svgFour, /Product Design/)
assert.match(svgFour, /font-size="10\.5"|font-size="10"|font-size="9\.5"|font-size="9"/)
assert.match(svgFour, /font-size="8"|font-size="7\.5"/) // dates (may shrink to fit)
assert.match(svgFour, /font-family="'Inter'/)
assert.ok(viewBoxHeight(svgFour) <= CAREER_EVOLUTION_MAX_HEIGHT_PX)
// Equal-height cards share one rect height
const cardHeights = [...svgFour.matchAll(/data-ce-card="1">[\s\S]*?height="([\d.]+)"/g)].map(
  (m) => m[1],
)
assert.equal(cardHeights.length, 4)
assert.ok(cardHeights.every((h) => h === cardHeights[0]))
assert.ok(Number(cardHeights[0]) >= 36, "min card height for compact dens (~10mm)")

// --- 5. Graph placed once between CV sections ---
const sections = placeCareerEvolutionInSections(
  [
    { title: "PROFILE", content: ["Hello"] },
    { title: "CAREER EVOLUTION", content: ["TRACK: stale"] },
    { title: "EXPERIENCE", content: ["Job"] },
    { title: "CAREER EVOLUTION", content: ["duplicate"] },
    { title: "EDUCATION", content: ["Uni"] },
  ],
  { ...twoTrack.config, visible: true, position: "before-experience" },
  () => ({ title: "CAREER EVOLUTION", content: [] as string[] }),
)
const ceCount = sections.filter((s) => s.title === "CAREER EVOLUTION").length
assert.equal(ceCount, 1, "must inject exactly one CAREER EVOLUTION section")
assert.deepEqual(
  sections.map((s) => s.title),
  ["PROFILE", "CAREER EVOLUTION", "EXPERIENCE", "EDUCATION"],
)

// --- 6. Duplicate tracks in stored config collapse ---
const duped = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "parallel",
  density: "compact",
  showConnectionIcon: true,
  tracks: [
    { id: "a", label: "Professional Experience" },
    { id: "b", label: "Independent Research" },
    { id: "c", label: "Professional Experience" },
    { id: "d", label: "Professional Experience" },
    { id: "e", label: "Independent Research" },
  ],
  milestones: twoTrack.config.milestones.map((m, i) => ({
    ...m,
    trackId: i < 3 ? "a" : "b",
  })),
  connections: twoTrack.config.connections,
})
assert.equal(duped.tracks.length, 2)
const svgDup = renderCareerEvolutionSvgHtml(duped, {
  accentColor: "#0f7b6c",
  width: 480,
})
assert.equal(countFigures(svgDup), 1)
assert.equal(countRenderedTracks(svgDup), 2)
assert.equal(countMergeIcons(svgDup), 1)
assert.ok(viewBoxHeight(svgDup) <= CAREER_EVOLUTION_MAX_HEIGHT_PX)

// Print / PDF shape
assert.match(svgDup, /preserveAspectRatio="xMidYMid meet"/)
assert.match(svgDup, /max-height:45mm/)
assert.doesNotMatch(svgDup, /data-pdf-block=/) // wrapper owns the pdf block

console.log("test-career-evolution-render: ok", {
  oneTrackHeight: viewBoxHeight(svg1),
  twoTrackHeight: viewBoxHeight(svg2),
  mergeIcons: countMergeIcons(svg2),
  maxHeight: CAREER_EVOLUTION_MAX_HEIGHT_PX,
})
