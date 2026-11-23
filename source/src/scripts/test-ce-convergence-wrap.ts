/**
 * Skills Convergence must wrap labels — never ellipsis-truncate pills or target.
 * Short display labels from milestones must appear on capability pills.
 * Run: node --import tsx scripts/test-ce-convergence-wrap.ts
 */
import assert from "node:assert/strict"
import {
  capabilityLabelForRender,
  normalizeCareerEvolutionConfig,
  renderCareerEvolutionSvgHtml,
} from "../lib/career-evolution"

const config = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "convergence",
  density: "compact",
  convergenceTarget: "Staff UX Strategist & Researcher (f/m/x)",
  capabilities: [
    { id: "c1", label: "Research & discovery" },
    { id: "c2", label: "Strategy & influence" },
    { id: "c3", label: "Product design & delivery" },
    { id: "c4", label: "Senior UX Designer - Product Research & Strategy" },
  ],
  milestones: [],
  tracks: [],
})

const svg = renderCareerEvolutionSvgHtml(config, {
  accentColor: "#67906c",
  width: 480,
})

assert.match(svg, /data-ce-layout="convergence"/)
assert.match(svg, /data-ce-capability="c4"/)
assert.match(svg, /data-ce-convergence-target/)

const textNodes = [...svg.matchAll(/xml:space="preserve">([^<]*)<\/text>/g)].map(
  (m) => m[1]!,
)
assert.ok(textNodes.length >= 4, "expected wrapped text nodes")
assert.ok(
  !textNodes.some((t) => /…|\.\.\./.test(t)),
  `ellipsis in convergence labels: ${textNodes.join(" | ")}`,
)
assert.ok(
  textNodes.some((t) => /Senior UX Designer/.test(t)),
  "left pill must show Senior UX Designer",
)
assert.ok(
  textNodes.some((t) => /Product Research|Strategy/.test(t)),
  "left pill must keep Product Research / Strategy words",
)
assert.ok(
  textNodes.some((t) => /Staff UX Strategist/.test(t)),
  "target must show Staff UX Strategist",
)
assert.ok(
  textNodes.some((t) => /Researcher/.test(t)),
  "target must show Researcher (not cut off)",
)

// Standard density also wraps without ellipsis — and bold lines must fit the pill.
const standardSvg = renderCareerEvolutionSvgHtml(
  { ...config, density: "standard" },
  { accentColor: "#67906c", width: 480 },
)
const standardTexts = [
  ...standardSvg.matchAll(/xml:space="preserve">([^<]*)<\/text>/g),
].map((m) => m[1]!)
assert.ok(!standardTexts.some((t) => /…|\.\.\./.test(t)))

// Target box: each <text> line must stay inside the green rect (bold glyph budget).
const targetBlock =
  standardSvg.match(/data-ce-convergence-target="1"[\s\S]*?<\/g>/)?.[0] || ""
const targetRect = targetBlock.match(
  /<rect[^>]*width="([^"]+)"[^>]*height="([^"]+)"/,
)
assert.ok(targetRect, "target rect missing")
const targetW = Number(targetRect![1])
const targetPadX = 12
const targetInner = targetW - targetPadX * 2
const targetLines = [
  ...targetBlock.matchAll(/font-size="([^"]+)"[^>]*xml:space="preserve">([^<]*)<\/text>/g),
].map((m) => ({ font: Number(m[1]), text: m[2]!.replace(/&amp;/g, "&") }))
assert.ok(targetLines.length >= 2, "standard target must wrap to 2+ lines")
for (const line of targetLines) {
  const est = line.text.length * line.font * 0.62
  assert.ok(
    est <= targetInner + 1,
    `standard target line overflows: “${line.text}” est=${est.toFixed(1)}px inner=${targetInner}`,
  )
}

// Long left capability must wrap (not single overflowing line)
const cap4 =
  standardSvg.match(/data-ce-capability="c4"[\s\S]*?<\/g>/)?.[0] || ""
const cap4Lines = [
  ...cap4.matchAll(/xml:space="preserve">([^<]*)<\/text>/g),
].map((m) => m[1]!)
assert.ok(cap4Lines.length >= 2, "long capability must wrap in standard")
assert.ok(!cap4Lines.some((t) => /…|\.\.\./.test(t)))

// Stored capability labels are authoritative — milestone displayLabel must not remap them.
const withCaps = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "convergence",
  density: "compact",
  convergenceTarget: "Research-led UX strategy",
  capabilities: [
    { id: "cap-1", label: "Strategic Research" },
    { id: "cap-2", label: "Product Strategy" },
    { id: "cap-3", label: "Product Design" },
    { id: "cap-4", label: "UX Research" },
  ],
  milestones: [
    {
      id: "m1",
      label: "Research & discovery",
      displayLabel: "Should Not Appear On Caps",
      displayLabelOrigin: "auto",
      approved: true,
    },
  ],
  tracks: [],
})

const resolved = capabilityLabelForRender(withCaps, {
  id: "cap-1",
  label: "Strategic Research",
})
assert.equal(resolved.label, "Strategic Research")
assert.equal(resolved.fullLabel, "Strategic Research")

const authoredSvg = renderCareerEvolutionSvgHtml(withCaps, {
  accentColor: "#67906c",
  width: 480,
})
const authoredTexts = [
  ...authoredSvg.matchAll(/xml:space="preserve">([^<]*)<\/text>/g),
].map((m) => m[1]!)
assert.ok(authoredTexts.some((t) => t.includes("Strategic Research")))
assert.ok(authoredTexts.some((t) => t.includes("Product Strategy")))
assert.ok(authoredTexts.some((t) => t.includes("Product Design")))
assert.ok(authoredTexts.some((t) => t.includes("UX Research")))
assert.ok(
  !authoredTexts.some((t) => t.includes("Should Not Appear On Caps")),
  "milestone displayLabel must not override capability pills",
)

console.log("test-ce-convergence-wrap: ok", {
  compactLines: textNodes.length,
  standardLines: standardTexts.length,
  authoredCaps: true,
})
