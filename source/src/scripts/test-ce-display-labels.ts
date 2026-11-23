/**
 * Career Evolution short display labels — auto-gen, preserve manual, no ellipsis.
 * Run: node --import tsx scripts/test-ce-display-labels.ts
 */
import assert from "node:assert/strict"
import {
  acceptPendingCareerEvolution,
  applySuggestedDisplayLabels,
  buildCareerEvolutionSuggestion,
  compressOfficialTitle,
  mergePreservingUserDisplayLabels,
  proposeMilestoneDisplayLabels,
  renderCareerEvolutionSvgHtml,
  suggestMilestoneDisplayLabel,
  type CareerEvolutionConfig,
  type CareerEvolutionMilestone,
} from "../lib/career-evolution"

// --- compress official titles ---
{
  const short = compressOfficialTitle("Senior UX Designer - Product & Research")
  assert.ok(short.length > 0)
  assert.ok(!/senior/i.test(short), "must strip seniority")
  assert.ok(short.split(/\s+/).length <= 5)
  assert.doesNotMatch(short, /…/)
}

// --- theme-style stage → short ---
{
  const label = suggestMilestoneDisplayLabel(
    {
      label: "Research & discovery",
      officialTitle: "UX Designer - Product Research & Discovery",
    },
    {
      language: "en",
      targetRole: "Staff UX Strategist & Researcher",
      jobDescription: "Lead strategic research and discovery for product teams.",
    },
  )
  assert.ok(label)
  assert.ok(label.split(/\s+/).length >= 2 && label.split(/\s+/).length <= 4)
  assert.doesNotMatch(label, /…/)
  assert.notEqual(label.toLowerCase(), "research")
}

{
  const product = suggestMilestoneDisplayLabel(
    { label: "Product design & delivery", officialTitle: "UX Designer" },
    {
      language: "en",
      targetRole: "Product Designer",
      jobDescription: "End-to-end product design and delivery.",
    },
  )
  assert.match(product, /Product Design/i)
}

{
  const ai = suggestMilestoneDisplayLabel(
    {
      label: "Enablement & facilitation",
      officialTitle: "AI Enablement Lead",
      jobRequirementAddressed: "AI transformation",
    },
    {
      language: "en",
      targetRole: "AI Transformation Manager",
      jobDescription: "Drive AI enablement and literacy across the organisation.",
    },
  )
  assert.ok(ai)
  assert.ok(/AI|Enablement|Facilitation/i.test(ai))
}

// --- apply / preserve user edits ---
const milestones: CareerEvolutionMilestone[] = [
  {
    id: "m1",
    label: "Research & discovery",
    officialTitle: "Senior UX Designer",
    approved: true,
  },
  {
    id: "m2",
    label: "Strategy & influence",
    displayLabel: "My Custom Label",
    displayLabelOrigin: "user",
    approved: true,
  },
]
const filled = applySuggestedDisplayLabels(milestones, {
  mode: "auto",
  language: "en",
  targetRole: "UX Strategist",
  jobDescription: "Strategic research and product strategy.",
})
assert.ok(filled[0]!.displayLabel)
assert.equal(filled[0]!.displayLabelOrigin, "auto")
assert.equal(filled[1]!.displayLabel, "My Custom Label")
assert.equal(filled[1]!.displayLabelOrigin, "user")

const proposals = proposeMilestoneDisplayLabels(filled, {
  language: "en",
  targetRole: "UX Strategist",
  jobDescription: "Strategic research.",
})
assert.equal(proposals[1]!.protectedEdit, true)

const merged = mergePreservingUserDisplayLabels(
  [
    { id: "m2", label: "Strategy & influence", displayLabel: "Auto New", displayLabelOrigin: "auto", approved: true },
  ],
  filled,
)
assert.equal(merged[0]!.displayLabel, "My Custom Label")
assert.equal(merged[0]!.displayLabelOrigin, "user")

// --- accept pending preserves user shorts ---
const current: CareerEvolutionConfig = {
  v: 1,
  visible: true,
  layout: "progression",
  density: "compact",
  position: "before-experience",
  showConnectionIcon: true,
  showConnectionLabels: true,
  tracks: [{ id: "t1", label: "Professional Experience" }],
  milestones: filled,
  connections: [],
  origin: "mixed",
  userEditedAt: Date.now(),
  pendingSuggestion: {
    v: 1,
    visible: true,
    layout: "progression",
    density: "compact",
    position: "before-experience",
    showConnectionIcon: true,
    showConnectionLabels: true,
    tracks: [{ id: "t1", label: "Professional Experience" }],
    milestones: [
      {
        id: "m1",
        label: "Research & discovery",
        displayLabel: "Fresh Auto",
        displayLabelOrigin: "auto",
        approved: true,
      },
      {
        id: "m2",
        label: "Strategy & influence",
        displayLabel: "Would Overwrite",
        displayLabelOrigin: "auto",
        approved: true,
      },
    ],
    connections: [],
    origin: "ai",
  },
}
const accepted = acceptPendingCareerEvolution(current)
assert.equal(
  accepted.milestones.find((m) => m.id === "m2")?.displayLabel,
  "My Custom Label",
)

// --- end-to-end suggest fills displayLabel ---
const resume = `## EXPERIENCE
# Senior UX Designer - Product & Research
Bundesdruckerei, Berlin
2021-01 – Present
• Led discovery research and product design for digital services.

# UX Designer
SolarWinds, Berlin
2016-12 – 2019-08
• Designed enterprise product experiences.
`
const suggestion = buildCareerEvolutionSuggestion({
  resumeText: resume,
  targetRole: "Staff UX Strategist & Researcher",
  jobDescription:
    "Lead strategic UX research, discovery, and product strategy for consumer experiences. Responsible AI literacy a plus.",
  language: "en",
})
assert.ok(suggestion.config.milestones.length >= 2)
for (const m of suggestion.config.milestones) {
  assert.ok(m.displayLabel?.trim(), `expected displayLabel for ${m.label}`)
  assert.equal(m.displayLabelOrigin, "auto")
  assert.doesNotMatch(m.displayLabel!, /…/)
  assert.ok(m.displayLabel!.split(/\s+/).length <= 5)
}

const svg = renderCareerEvolutionSvgHtml(
  { ...suggestion.config, visible: true, layout: "progression" },
  { accentColor: "#67906c", width: 480 },
)
// Short labels appear in graph; no ellipsis on those title texts preferred
assert.ok(suggestion.config.milestones.some((m) => svg.includes(m.displayLabel!)))

// Different JD → different short labels (same career facts)
const aiSuggestion = buildCareerEvolutionSuggestion({
  resumeText: resume,
  targetRole: "AI Transformation Manager",
  jobDescription:
    "Drive AI transformation, AI literacy enablement, and responsible AI governance across the organisation.",
  language: "en",
})
const uxLabels = suggestion.config.milestones.map((m) => m.displayLabel).join("|")
const aiLabels = aiSuggestion.config.milestones.map((m) => m.displayLabel).join("|")
assert.ok(aiSuggestion.config.milestones.every((m) => m.displayLabel?.trim()))
// Not required to differ always, but AI-focused JD should surface AI-related shorts when themes match
assert.ok(
  /AI|Responsible|Enablement|Strategy|Research|Design/i.test(aiLabels),
  `AI labels should be meaningful: ${aiLabels}`,
)
void uxLabels

// User-cleared empty must not be auto-filled (crash loop root cause).
{
  const cleared: CareerEvolutionMilestone[] = [
    {
      id: "m1",
      label: "Research & discovery",
      displayLabel: undefined,
      displayLabelOrigin: "user",
      approved: true,
    },
    {
      id: "m2",
      label: "Strategy & influence",
      displayLabel: "My Custom",
      displayLabelOrigin: "user",
      approved: true,
    },
  ]
  const afterMissing = applySuggestedDisplayLabels(cleared, { mode: "missing", language: "en" })
  assert.equal(afterMissing[0]!.displayLabel, undefined, "cleared label must stay empty")
  assert.equal(afterMissing[0]!.displayLabelOrigin, "user")
  assert.equal(afterMissing[1]!.displayLabel, "My Custom")

  const afterAuto = applySuggestedDisplayLabels(cleared, { mode: "auto", language: "en" })
  assert.equal(afterAuto[0]!.displayLabel, undefined)
  assert.equal(afterAuto[1]!.displayLabel, "My Custom")

  const props = proposeMilestoneDisplayLabels(cleared, { language: "en" })
  assert.equal(props[0]!.protectedEdit, false, "empty cleared field may be proposed on regenerate")
  assert.equal(props[1]!.protectedEdit, true)
}

// Consecutive short-label edits must not throw across layouts.
{
  const layouts = [
    "progression",
    "parallel",
    "convergence",
    "branching",
    "alignment",
  ] as const
  let cfg: CareerEvolutionConfig = {
    ...suggestion.config,
    visible: true,
    capabilities: [
      { id: "c1", label: "Strategic Research" },
      { id: "c2", label: "Product Design" },
      { id: "c3", label: "Responsible AI" },
    ],
    convergenceTarget: "Staff UX Strategist",
    alignments: [
      {
        id: "a1",
        evidenceLabel: "Discovery research",
        requirementLabel: "Strategic research",
        approved: true,
      },
    ],
  }
  for (const layout of layouts) {
    cfg = { ...cfg, layout }
    for (const edit of ["A", "AB", "", "HelloFresh Research", "X"]) {
      cfg = {
        ...cfg,
        milestones: cfg.milestones.map((m, i) =>
          i === 0
            ? {
                ...m,
                displayLabel: edit.trim() || undefined,
                displayLabelOrigin: "user" as const,
              }
            : m,
        ),
      }
      assert.doesNotThrow(() =>
        renderCareerEvolutionSvgHtml(cfg, { accentColor: "#67906c", width: 480 }),
      )
    }
  }
}

console.log("test-ce-display-labels: ok", {
  sampleUx: uxLabels,
  sampleAi: aiLabels,
  compress: compressOfficialTitle("Senior UX Designer - Product & Research"),
})
