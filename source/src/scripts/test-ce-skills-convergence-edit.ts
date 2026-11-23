/**
 * Skills Convergence editability: labels, reorder, 2–6 boxes, central outcome.
 * Run: npx tsx scripts/test-ce-skills-convergence-edit.ts
 */
import {
  CAREER_EVOLUTION_CAPABILITY_MAX,
  CAREER_EVOLUTION_CAPABILITY_MIN,
  buildCareerEvolutionSuggestion,
  capabilitiesForRender,
  isUserProtectedConvergenceTarget,
  normalizeCareerEvolutionConfig,
  renderCareerEvolutionSvgHtml,
  suggestCentralOutcomeLabel,
  type CareerEvolutionCapability,
  type CareerEvolutionConfig,
} from "../lib/career-evolution"

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function baseConfig(caps: CareerEvolutionCapability[], target: string): CareerEvolutionConfig {
  return normalizeCareerEvolutionConfig({
    visible: true,
    layout: "convergence",
    tracks: [{ id: "t1", label: "Experience" }],
    milestones: [
      {
        id: "m1",
        label: "Should Not Appear As Cap",
        displayLabel: "Milestone Display",
        start: "2021-01",
        end: "Present",
        trackId: "t1",
      },
    ],
    capabilities: caps,
    convergenceTarget: target,
  })
}

const caps: CareerEvolutionCapability[] = [
  { id: "cap-a", label: "Strategic Research" },
  { id: "cap-b", label: "Product Strategy" },
  { id: "cap-c", label: "Product Design" },
  { id: "cap-d", label: "UX Research" },
]

let failed = false

try {
  const cfg = baseConfig(caps, "HelloFresh Design Lead")
  const rendered = capabilitiesForRender(cfg)
  assert(rendered.length === 4, `expected 4 caps, got ${rendered.length}`)
  assert(
    rendered.every((c, i) => c.id === caps[i]!.id && c.label === caps[i]!.label),
    "stored capability labels/ids must be authoritative",
  )

  const html = renderCareerEvolutionSvgHtml(cfg, {
    accentColor: "#67906c",
    language: "en",
  })
  assert(html.includes("Strategic Research"), "missing Strategic Research")
  assert(html.includes("HelloFresh Design Lead"), "missing central outcome")
  assert(html.includes('data-ce-capability="cap-a"'), "stable capability id missing")
  // Capability boxes must use authored labels, not milestone displayLabel remapping.
  assert(
    !html.includes('data-ce-capability="m1"'),
    "must not bind capability nodes to milestone ids",
  )
  const capBlock = html.match(/data-ce-capability="cap-a"[\s\S]*?<\/g>/)?.[0] || ""
  assert(capBlock.includes("Strategic Research"), "cap-a box missing authored label")
  assert(!capBlock.includes("Milestone Display"), "cap remapped to milestone displayLabel")
  console.log("ok authored-labels-and-outcome")
} catch (e) {
  failed = true
  console.error("FAIL authored-labels-and-outcome", e)
}

try {
  const edited = caps.map((c) =>
    c.id === "cap-a" ? { ...c, label: "My Custom Research" } : c,
  )
  const html = renderCareerEvolutionSvgHtml(baseConfig(edited, "Custom Outcome"), {
    accentColor: "#67906c",
  })
  assert(html.includes("My Custom Research"), "edited label missing")
  assert(html.includes("Custom Outcome"), "edited outcome missing")
  assert(!html.includes("Strategic Research"), "old label still present")
  console.log("ok edit-label-and-outcome")
} catch (e) {
  failed = true
  console.error("FAIL edit-label-and-outcome", e)
}

try {
  const reordered = [caps[3]!, caps[0]!, caps[1]!, caps[2]!]
  const html = renderCareerEvolutionSvgHtml(baseConfig(reordered, "Outcome"), {
    accentColor: "#67906c",
  })
  const iUx = html.indexOf("UX Research")
  const iStrat = html.indexOf("Strategic Research")
  assert(iUx >= 0 && iStrat >= 0 && iUx < iStrat, "reorder not reflected in SVG")
  console.log("ok reorder")
} catch (e) {
  failed = true
  console.error("FAIL reorder", e)
}

try {
  for (const n of [2, 3, 4, 5, 6]) {
    const list = Array.from({ length: n }, (_, i) => ({
      id: `cap-${i}`,
      label: `Cap ${i + 1}`,
    }))
    const html = renderCareerEvolutionSvgHtml(baseConfig(list, "Outcome"), {
      accentColor: "#67906c",
    })
    assert(html.includes('data-ce-layout="convergence"'), `layout missing for n=${n}`)
    for (const c of list) {
      assert(html.includes(c.label), `missing ${c.label} for n=${n}`)
    }
    const capMarks = (html.match(/data-ce-capability="/g) || []).length
    assert(capMarks === n, `expected ${n} capability nodes, got ${capMarks}`)
  }
  console.log("ok counts-2-to-6")
} catch (e) {
  failed = true
  console.error("FAIL counts-2-to-6", e)
}

try {
  const tooMany = Array.from({ length: CAREER_EVOLUTION_CAPABILITY_MAX + 2 }, (_, i) => ({
    id: `cap-${i}`,
    label: `Extra ${i + 1}`,
  }))
  const rendered = capabilitiesForRender(baseConfig(tooMany, "Outcome"))
  assert(
    rendered.length === CAREER_EVOLUTION_CAPABILITY_MAX,
    `expected max ${CAREER_EVOLUTION_CAPABILITY_MAX}, got ${rendered.length}`,
  )
  console.log("ok max-cap")
} catch (e) {
  failed = true
  console.error("FAIL max-cap", e)
}

try {
  const one = baseConfig([{ id: "cap-1", label: "Only One" }], "Outcome")
  const html = renderCareerEvolutionSvgHtml(one, { accentColor: "#67906c" })
  assert(html === "" || !html.includes("data-ce-capability="), "1 cap must not render graph")
  assert(CAREER_EVOLUTION_CAPABILITY_MIN === 2, "min must be 2")
  console.log("ok min-guard")
} catch (e) {
  failed = true
  console.error("FAIL min-guard", e)
}

try {
  // No convergenceTarget → placeholder, never target role from generatedForRole
  const cfg = normalizeCareerEvolutionConfig({
    visible: true,
    layout: "convergence",
    generatedForRole: "Senior Product Designer HelloFresh",
    capabilities: [
      { id: "cap-1", label: "A" },
      { id: "cap-2", label: "B" },
    ],
  })
  const html = renderCareerEvolutionSvgHtml(cfg, { accentColor: "#67906c" })
  assert(html.includes("Central outcome"), "expected placeholder outcome")
  assert(
    !html.includes("Senior Product Designer HelloFresh"),
    "must not auto-use target job title",
  )
  console.log("ok no-auto-job-title")
} catch (e) {
  failed = true
  console.error("FAIL no-auto-job-title", e)
}

try {
  const role = "Staff UX Strategist & Researcher (f/m/x)"
  const outcome = suggestCentralOutcomeLabel({
    language: "en",
    targetRole: role,
    jobDescription:
      "Lead strategic UX research, discovery, and product strategy for consumer experiences.",
    capabilities: [
      { label: "Strategic Research" },
      { label: "Product Design" },
      { label: "Responsible AI" },
    ],
  })
  assert(outcome.length > 0, "expected suggested outcome")
  assert(!/\(f\/m\/x\)/i.test(outcome), "must strip gender markers")
  assert(outcome !== role, "must not equal raw vacancy title")
  assert(outcome.split(/\s+/).length <= 6, `outcome too long: ${outcome}`)
  console.log("ok suggest-central-outcome", outcome)

  assert(
    isUserProtectedConvergenceTarget(
      { convergenceTarget: "My Custom Value", convergenceTargetOrigin: "user" },
      role,
    ),
    "user origin must be protected",
  )
  assert(
    !isUserProtectedConvergenceTarget(
      { convergenceTarget: role, convergenceTargetOrigin: "auto" },
      role,
    ),
    "auto origin must not be protected",
  )
  assert(
    !isUserProtectedConvergenceTarget(
      { convergenceTarget: role, generatedForRole: role },
      role,
    ),
    "legacy dumped job title must not be protected",
  )
  assert(
    isUserProtectedConvergenceTarget(
      { convergenceTarget: "Research-led UX value" },
      role,
    ),
    "legacy custom text without origin must be protected",
  )
  console.log("ok protect-central-outcome")
} catch (e) {
  failed = true
  console.error("FAIL suggest/protect-central-outcome", e)
}

try {
  const resume = `## EXPERIENCE
# Senior UX Specialist - Product Research & Strategy
Bundesdruckerei, Berlin
2023-11 – Present
• Led discovery research and product strategy.

# UX Designer - Product Research & Discovery
Bundesdruckerei, Berlin
2021-04 – 2023-11
• Designed product experiences.
`
  const suggestion = buildCareerEvolutionSuggestion({
    resumeText: resume,
    targetRole: "Staff UX Strategist & Researcher (f/m/x)",
    jobDescription:
      "Lead strategic UX research and product strategy for consumer experiences. Responsible AI a plus.",
    language: "en",
  })
  const target = suggestion.config.convergenceTarget || ""
  assert(target.length > 0, "suggestion must set convergenceTarget")
  assert(
    !/\(f\/m\/x\)/i.test(target),
    `generated outcome must not be raw vacancy title: ${target}`,
  )
  assert(
    suggestion.config.convergenceTargetOrigin === "auto",
    "generated outcome origin must be auto",
  )
  const html = renderCareerEvolutionSvgHtml(
    {
      ...suggestion.config,
      visible: true,
      layout: "convergence",
      capabilities: suggestion.config.capabilities?.length
        ? suggestion.config.capabilities
        : [
            { id: "c1", label: "Strategic Research" },
            { id: "c2", label: "Product Design" },
          ],
    },
    { accentColor: "#67906c", width: 480 },
  )
  // Outcome may wrap across SVG <text> nodes — check meaningful tokens.
  const tokens = target.split(/\s+/).filter((w) => w.length > 2 && w !== "&")
  assert(
    tokens.some((t) => html.includes(t)),
    `preview/PDF path must show outcome tokens from “${target}”`,
  )
  assert(
    !html.includes("Staff UX Strategist &amp; Researcher (f/m/x)") &&
      !html.includes("Staff UX Strategist & Researcher (f/m/x)"),
    "SVG must not dump vacancy title",
  )
  console.log("ok generate-and-render-outcome", target)
} catch (e) {
  failed = true
  console.error("FAIL generate-and-render-outcome", e)
}

if (failed) {
  console.error("test-ce-skills-convergence-edit: FAILED")
  process.exit(1)
}
console.log("test-ce-skills-convergence-edit: ok")
