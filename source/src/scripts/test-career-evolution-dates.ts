/**
 * Career Evolution date parse + display formatting.
 * Run: npx tsx scripts/test-career-evolution-dates.ts
 */
import assert from "node:assert/strict"
import {
  CAREER_EVOLUTION_SYNTAX_HELP,
  formatCareerEvolutionDateRange,
  isBrokenCareerEvolutionDateDisplay,
  normalizeCareerEvolutionConfig,
  parseCareerEvolutionDateRange,
  parseCareerEvolutionDateToken,
  parseCareerEvolutionText,
  renderCareerEvolutionSvgHtml,
  repairCareerEvolutionStoredDates,
  resolveCareerEvolutionDateDisplay,
  serializeCareerEvolutionText,
  splitCareerEvolutionDateRange,
  type CareerEvolutionConfig,
  type CareerEvolutionLayout,
} from "../lib/career-evolution"
import { splitEmploymentDateRange } from "../lib/employment-duration"

// ─── token parse ─────────────────────────────────────────────────────────────

assert.deepEqual(parseCareerEvolutionDateToken("2016-12"), {
  kind: "month",
  year: 2016,
  month: 12,
})
assert.deepEqual(parseCareerEvolutionDateToken("2021-01-15"), {
  kind: "day",
  year: 2021,
  month: 1,
  day: 15,
})
assert.deepEqual(parseCareerEvolutionDateToken("2023"), { kind: "year", year: 2023 })
assert.deepEqual(parseCareerEvolutionDateToken("Present"), { kind: "present" })
assert.deepEqual(parseCareerEvolutionDateToken("prese"), { kind: "present" })
assert.deepEqual(parseCareerEvolutionDateToken("Dec 2016"), {
  kind: "month",
  year: 2016,
  month: 12,
})
assert.equal(parseCareerEvolutionDateToken("not-a-date"), null)
assert.equal(parseCareerEvolutionDateToken("2016-13"), null)

// ─── range split (must not break YYYY-MM) ────────────────────────────────────

assert.deepEqual(splitCareerEvolutionDateRange("2016-12 – 2019-08"), {
  start: "2016-12",
  end: "2019-08",
})
assert.deepEqual(splitCareerEvolutionDateRange("2016-12-2019-08"), {
  start: "2016-12",
  end: "2019-08",
})
assert.deepEqual(splitCareerEvolutionDateRange("2016-12-2019-"), {
  start: "2016-12",
  end: "2019",
})
assert.deepEqual(splitCareerEvolutionDateRange("2023-11-present"), {
  start: "2023-11",
  end: "present",
})
assert.deepEqual(splitCareerEvolutionDateRange("2023-11-prese"), {
  start: "2023-11",
  end: "present",
})
assert.deepEqual(splitCareerEvolutionDateRange("2021-04 to 2023-11"), {
  start: "2021-04",
  end: "2023-11",
})
assert.deepEqual(splitCareerEvolutionDateRange("2016 - 2019"), {
  start: "2016",
  end: "2019",
})
assert.deepEqual(splitCareerEvolutionDateRange("Dec 2016 – Aug 2019"), {
  start: "Dec 2016",
  end: "Aug 2019",
})

// Employment splitter must match CE-safe behaviour for ISO ranges
assert.deepEqual(splitEmploymentDateRange("2016-12 – 2019-08"), {
  start: "2016-12",
  end: "2019-08",
})
assert.deepEqual(splitEmploymentDateRange("2023-11 – Present"), {
  start: "2023-11",
  end: "Present",
})

const parsedIso = parseCareerEvolutionDateRange("2016-12 – 2019-08")
assert.equal(parsedIso.error, undefined)
assert.equal(parsedIso.start, "2016-12")
assert.equal(parsedIso.end, "2019-08")

const bad = parseCareerEvolutionDateRange("foo – bar")
assert.ok(bad.error)
assert.match(bad.error!, /Unrecognised date/)

// ─── full / compact / auto display (acceptance: full years) ──────────────────

const full = formatCareerEvolutionDateRange("2016-12", "2019-08", { mode: "full" })
assert.equal(full.display, "Dec 2016 – Aug 2019")
assert.equal(full.full, "Dec 2016 – Aug 2019")
assert.equal(full.modeUsed, "full")

const compact = formatCareerEvolutionDateRange("2016-12", "2019-08", {
  mode: "compact",
})
assert.equal(compact.display, "2016–2019")
assert.equal(compact.full, "Dec 2016 – Aug 2019")
assert.equal(compact.modeUsed, "compact")

const compactYearEnd = formatCareerEvolutionDateRange("2021-01", "2024", {
  mode: "compact",
})
assert.equal(compactYearEnd.display, "2021–2024")

const compactMid = formatCareerEvolutionDateRange("2021-04", "2023-11", {
  mode: "compact",
})
assert.equal(compactMid.display, "2021–2023")

const ongoing = formatCareerEvolutionDateRange("2023-11", "present", {
  mode: "full",
})
assert.equal(ongoing.display, "Nov 2023 – Present")
const ongoingC = formatCareerEvolutionDateRange("2023-11", "present", {
  mode: "compact",
})
assert.equal(ongoingC.display, "2023–Present")

const autoWide = formatCareerEvolutionDateRange("2016-12", "2019-08", {
  mode: "auto",
  maxChars: 40,
})
assert.equal(autoWide.modeUsed, "full")
assert.equal(autoWide.display, "Dec 2016 – Aug 2019")

const autoNarrow = formatCareerEvolutionDateRange("2016-12", "2019-08", {
  mode: "auto",
  maxChars: 12,
})
assert.equal(autoNarrow.modeUsed, "compact")
assert.equal(autoNarrow.display, "2016–2019")

assert.equal(resolveCareerEvolutionDateDisplay(undefined, "compact"), "compact")
assert.equal(resolveCareerEvolutionDateDisplay(undefined, "standard"), "full")
assert.equal(resolveCareerEvolutionDateDisplay("compact", "standard"), "compact")

// Never invent months for year-only
const yearOnly = formatCareerEvolutionDateRange("2016", "2019", { mode: "full" })
assert.equal(yearOnly.display, "2016 – 2019")

// Corrupted stored tokens repair for display
assert.equal(
  formatCareerEvolutionDateRange("2016-12-2019-", undefined, { mode: "compact" })
    .display,
  "2016–2019",
)
assert.equal(
  formatCareerEvolutionDateRange("2021-01-2024-", undefined, { mode: "compact" })
    .display,
  "2021–2024",
)
assert.equal(
  formatCareerEvolutionDateRange("2023-11-prese", undefined, { mode: "compact" })
    .display,
  "2023–Present",
)
assert.equal(
  formatCareerEvolutionDateRange("2023-11", "prese", { mode: "full" }).display,
  "Nov 2023 – Present",
)

const repairedPair = repairCareerEvolutionStoredDates("2016-12-2019-08", "")
assert.equal(repairedPair.start, "2016-12")
assert.equal(repairedPair.end, "2019-08")
assert.equal(repairedPair.repaired, true)

assert.equal(isBrokenCareerEvolutionDateDisplay("2016-12-2019-"), true)
assert.equal(isBrokenCareerEvolutionDateDisplay("2023-11-prese"), true)
assert.equal(isBrokenCareerEvolutionDateDisplay("2016–2019"), false)
assert.equal(isBrokenCareerEvolutionDateDisplay("2023–Present"), false)

// Truly unparseable → empty + parseError
const broken = formatCareerEvolutionDateRange("not-a-date", "also-bad", {
  mode: "full",
})
assert.equal(broken.display, "")
assert.ok(broken.parseError)

// ─── editor parse keeps stored ISO; does not rewrite precision ───────────────

const editor = parseCareerEvolutionText(
  `TRACK: Professional Experience
- 2016-12 – 2019-08 | UX Design | SolarWinds
- 2021-04 – 2023-11 | UX Research | Bundesdruckerei
- 2023-11 – Present | UX & AI Strategy | Bundesdruckerei
`,
  { visible: true, layout: "progression", density: "compact", dateDisplay: "auto" },
)
assert.equal(editor.errors.length, 0)
assert.equal(editor.config.milestones[0]!.start, "2016-12")
assert.equal(editor.config.milestones[0]!.end, "2019-08")
assert.equal(editor.config.milestones[2]!.end, "Present")
assert.equal(editor.config.dateDisplay, "auto")

const roundTrip = serializeCareerEvolutionText(editor.config)
assert.match(roundTrip, /2016-12/)
assert.match(roundTrip, /2019-08/)
assert.doesNotMatch(roundTrip, /Dec 2016/) // stored values stay ISO

const invalidEditor = parseCareerEvolutionText(
  `TRACK: Professional Experience
- notadate | Broken Stage | Acme
`,
  { visible: true },
)
assert.ok(invalidEditor.errors.some((e) => /Unrecognised date/i.test(e)))
assert.equal(invalidEditor.config.milestones.length, 0)

// Normalize repairs glued start/end in persisted configs
const normalizedGlued = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "progression",
  milestones: [
    {
      id: "m1",
      label: "Design",
      start: "2016-12-2019-",
      end: "",
      approved: true,
    },
    {
      id: "m2",
      label: "Now",
      start: "2023-11-prese",
      approved: true,
    },
  ],
})
assert.equal(normalizedGlued.milestones[0]!.start, "2016-12")
assert.equal(normalizedGlued.milestones[0]!.end, "2019")
assert.equal(normalizedGlued.milestones[1]!.start, "2023-11")
assert.equal(normalizedGlued.milestones[1]!.end, "present")

// ─── all five layouts: readable dates, no raw concat / truncated fragments ───

const layouts: CareerEvolutionLayout[] = [
  "progression",
  "parallel",
  "convergence",
  "branching",
  "alignment",
]

const datedConfig = normalizeCareerEvolutionConfig({
  ...editor.config,
  visible: true,
  dateDisplay: "compact",
  density: "compact",
  capabilities: [
    { id: "c1", label: "UX Design" },
    { id: "c2", label: "Research" },
  ],
  convergenceTarget: "Product leadership",
  alignments: [
    {
      id: "a1",
      evidenceLabel: "UX research",
      requirementLabel: "Discovery",
      approved: true,
    },
  ],
})

function assertNoBrokenDates(svg: string, layout: string) {
  assert.doesNotMatch(
    svg,
    /2016-12-2019|2021-01-2024|2021-04-2023-|2023-11-prese/,
    `${layout}: must not show raw ISO concatenations or truncated present`,
  )
  assert.doesNotMatch(svg, />\d{4}-\d{2}-[^<]*…</)
  assert.ok(!isBrokenCareerEvolutionDateDisplay(svg))
}

// Progression with 4 cards + Full preference must still ink complete year labels
{
  const fourCardFull = renderCareerEvolutionSvgHtml(
    normalizeCareerEvolutionConfig({
      visible: true,
      layout: "progression",
      density: "standard",
      dateDisplay: "full",
      tracks: [{ id: "t", label: "Professional Experience" }],
      milestones: [
        {
          id: "1",
          label: "Senior UX Designer - Product & Research",
          start: "2016-12",
          end: "2019-08",
          trackId: "t",
          approved: true,
        },
        {
          id: "2",
          label: "Strategy",
          start: "2021-01",
          end: "2024-02",
          trackId: "t",
          approved: true,
        },
        {
          id: "3",
          label: "Product design",
          start: "2021-04",
          end: "2023-11",
          trackId: "t",
          approved: true,
        },
        {
          id: "4",
          label: "Research",
          start: "2023-11",
          end: "present",
          trackId: "t",
          approved: true,
        },
      ],
    }),
    { accentColor: "#7a8f6a", width: 480 },
  )
  assert.match(fourCardFull, /2016–2019/)
  assert.match(fourCardFull, /2023–Present/)
  assert.doesNotMatch(fourCardFull, /2016-12-2019/)
  assert.doesNotMatch(fourCardFull, /2023-11-prese/)
  // Full form retained for accessibility tooltip
  assert.match(fourCardFull, /Dec 2016/)
}

for (const layout of layouts) {
  for (const width of [320, 480] as const) {
    for (const dateDisplay of ["full", "compact", "auto"] as const) {
      for (const density of ["compact", "standard"] as const) {
        const cfg: CareerEvolutionConfig = {
          ...datedConfig,
          layout,
          dateDisplay,
          density,
          visible: true,
        }
        const svg = renderCareerEvolutionSvgHtml(cfg, {
          accentColor: "#0f7b6c",
          width,
        })
        assert.ok(svg.includes("career-evolution-figure"), `${layout} @${width}`)
        assertNoBrokenDates(svg, `${layout}/${dateDisplay}/${density}/${width}`)
      }
    }
  }
}

// Four-card A4 progression — acceptance dates exactly
const fourCard = normalizeCareerEvolutionConfig({
  visible: true,
  layout: "progression",
  density: "compact",
  dateDisplay: "auto",
  tracks: [{ id: "t1", label: "Professional Experience" }],
  milestones: [
    {
      id: "m1",
      label: "UX Design",
      start: "2016-12",
      end: "2019-08",
      trackId: "t1",
      approved: true,
    },
    {
      id: "m2",
      label: "UX Research",
      start: "2021-01",
      end: "2024",
      trackId: "t1",
      approved: true,
    },
    {
      id: "m3",
      label: "UX Research Lead",
      start: "2021-04",
      end: "2023-11",
      trackId: "t1",
      approved: true,
    },
    {
      id: "m4",
      label: "UX & AI Strategy",
      start: "2023-11",
      end: "present",
      trackId: "t1",
      approved: true,
    },
  ],
})

for (const width of [320, 480] as const) {
  const svg = renderCareerEvolutionSvgHtml(fourCard, {
    accentColor: "#C9975B",
    width,
  })
  assertNoBrokenDates(svg, `four-card-${width}`)
  assert.match(svg, /2016–2019/)
  assert.match(svg, /2021–2024/)
  assert.match(svg, /2021–2023/)
  assert.match(svg, /2023–Present/)
  // Full precision preserved in tooltip when compact shortens
  assert.match(svg, /<title>[^<]*Dec 2016[^<]*<\/title>/)
}

// Corrupted persisted values still render acceptance dates
const corruptedFour = normalizeCareerEvolutionConfig({
  ...fourCard,
  milestones: [
    { id: "m1", label: "UX Design", start: "2016-12-2019-", approved: true, trackId: "t1" },
    { id: "m2", label: "UX Research", start: "2021-01-2024-", approved: true, trackId: "t1" },
    { id: "m3", label: "Lead", start: "2021-04-2023-", approved: true, trackId: "t1" },
    { id: "m4", label: "Strategy", start: "2023-11-prese", approved: true, trackId: "t1" },
  ],
})
const repairedSvg = renderCareerEvolutionSvgHtml(corruptedFour, {
  accentColor: "#0f7b6c",
  width: 480,
})
assertNoBrokenDates(repairedSvg, "corrupted-four")
assert.match(repairedSvg, /2016–2019/)
assert.match(repairedSvg, /2021–2024/)
assert.match(repairedSvg, /2021–2023/)
assert.match(repairedSvg, /2023–Present/)

// Help sample still parses cleanly
const help = parseCareerEvolutionText(CAREER_EVOLUTION_SYNTAX_HELP, {
  visible: true,
})
assert.equal(help.errors.length, 0)

console.log("test-career-evolution-dates: ok", {
  layouts: layouts.length,
  modes: ["full", "compact", "auto"],
  densities: ["compact", "standard"],
  widths: [320, 480],
  acceptance: ["2016–2019", "2021–2024", "2021–2023", "2023–Present"],
})
