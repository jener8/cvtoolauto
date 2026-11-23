/**
 * Reproduce Career Evolution GraphText crash candidates.
 * Run: npx tsx scripts/test-ce-graphtext-crash.ts
 */
import {
  normalizeCareerEvolutionConfig,
  parseCareerEvolutionText,
  renderCareerEvolutionSvgHtml,
  serializeCareerEvolutionText,
  type CareerEvolutionConfig,
  type CareerEvolutionLayout,
} from "../lib/career-evolution"

const LAYOUTS: CareerEvolutionLayout[] = [
  "progression",
  "parallel",
  "convergence",
  "branching",
  "alignment",
]

const BASE_TEXT = `TRACK: Professional Experience
2021-04 – 2023-11 | UX Research & Product Design | Bundesdruckerei
2023-11 – Present | UX & AI Strategy | Bundesdruckerei

TRACK: Independent work
2024 – Present | Founder — Responsible AI | TrustAudit.tools

CONNECTION:
UX Research & Product Design → UX & AI Strategy | Career growth
Founder — Responsible AI → UX & AI Strategy | Parallel research informs strategy
`

const MUTATIONS: Array<{ name: string; text: string }> = [
  { name: "baseline", text: BASE_TEXT },
  {
    name: "remove-milestone-keep-connection",
    text: `TRACK: Professional Experience
2023-11 – Present | UX & AI Strategy | Bundesdruckerei

TRACK: Independent work
2024 – Present | Founder — Responsible AI | TrustAudit.tools

CONNECTION:
UX Research & Product Design → UX & AI Strategy | Career growth
Founder — Responsible AI → UX & AI Strategy | Parallel research informs strategy
`,
  },
  {
    name: "rename-milestone-stale-connection",
    text: `TRACK: Professional Experience
2021-04 – 2023-11 | UX Research | Bundesdruckerei
2023-11 – Present | Staff UX Strategy | Bundesdruckerei

TRACK: Independent work
2024 – Present | Founder — Responsible AI | TrustAudit.tools

CONNECTION:
UX Research & Product Design → UX & AI Strategy | Career growth
`,
  },
  {
    name: "duplicate-labels",
    text: `TRACK: Professional Experience
2021 – 2022 | UX Designer | A
2022 – 2023 | UX Designer | B

CONNECTION:
UX Designer → UX Designer | Same label
`,
  },
  {
    name: "unicode-dates-and-labels",
    text: `TRACK: Berufserfahrung
April 2021 – Heute | UX‑Forschung & Produktgestaltung | Bundesdruckerei‑Gruppe
Nov 2023 – Present | UX & KI‑Strategie | Bundesdruckerei‑Gruppe

CONNECTION:
UX‑Forschung & Produktgestaltung → UX & KI‑Strategie | Wachstum
`,
  },
  {
    name: "bad-date-format",
    text: `TRACK: Professional Experience
sometime last year | Broken Date Role | Acme
2021-04 – 2023-11 | Good Role | Acme
`,
  },
  {
    name: "connection-only-no-milestones",
    text: `CONNECTION:
A → B | Link without stages
`,
  },
  {
    name: "empty-track",
    text: `TRACK: 

2021 – 2022 | Role | Co
`,
  },
  {
    name: "milestone-without-track",
    text: `2021 – 2022 | Orphan Role | Co
CONNECTION:
Orphan Role → Orphan Role
`,
  },
]

const resumeSnippet = `
# Senior UX Specialist
## Bundesdruckerei-Gruppe, Berlin, Germany
### November 2023 - Present
- Lead discovery

# Founder - Responsible AI Research & Design [work=parallel-independent]
## TrustAudit.tools
### 2024 - Present
- Built framework
`

function renderAll(config: CareerEvolutionConfig, label: string) {
  const crashes: string[] = []
  for (const layout of LAYOUTS) {
    try {
      const html = renderCareerEvolutionSvgHtml(
        { ...config, layout, visible: true },
        { accentColor: "#67906c", language: "en", resumeText: resumeSnippet },
      )
      if (html.includes("undefined") && html.includes("TypeError")) {
        crashes.push(`${layout}: html contains TypeError`)
      }
    } catch (err) {
      crashes.push(
        `${layout}: ${err instanceof Error ? err.stack || err.message : String(err)}`,
      )
    }
  }
  if (crashes.length) {
    console.error(`FAIL ${label}`)
    for (const c of crashes) console.error("  ", c)
    return false
  }
  console.log(`ok ${label}`)
  return true
}

let failed = false
for (const mut of MUTATIONS) {
  try {
    const parsed = parseCareerEvolutionText(mut.text)
    const config = normalizeCareerEvolutionConfig({
      ...parsed.config,
      visible: true,
      sourceText: mut.text,
    })
    if (!renderAll(config, `parse:${mut.name}`)) failed = true
  } catch (err) {
    failed = true
    console.error(
      `FAIL parse:${mut.name}`,
      err instanceof Error ? err.stack || err.message : err,
    )
  }
}

// Corrupt structured config that bypasses normalize (simulate bad in-memory state)
const corruptCases: Array<{ name: string; config: CareerEvolutionConfig }> = [
  {
    name: "undefined-milestone-label",
    config: normalizeCareerEvolutionConfig({
      visible: true,
      tracks: [{ id: "t1", label: "Experience" }],
      milestones: [
        {
          id: "m1",
          label: "Valid",
          start: "2021-01",
          end: "2022-01",
          trackId: "t1",
        },
      ],
    }),
  },
]

// Inject undefined label after normalize
{
  const cfg = normalizeCareerEvolutionConfig({
    visible: true,
    tracks: [{ id: "t1", label: "Experience" }],
    milestones: [
      {
        id: "m1",
        label: "Valid",
        start: "2021-01",
        end: "Present",
        trackId: "t1",
      },
    ],
  })
  ;(cfg.milestones[0] as { label?: string }).label = undefined as unknown as string
  corruptCases.push({ name: "forced-undefined-label", config: cfg })
}

{
  const cfg = normalizeCareerEvolutionConfig({
    visible: true,
    tracks: [{ id: "t1", label: "Experience" }],
    milestones: [
      {
        id: "m1",
        label: "Role",
        start: "2021-01",
        end: "Present",
        trackId: "t1",
      },
    ],
    connections: [
      {
        id: "c1",
        fromMilestoneId: "missing-a",
        toMilestoneId: "missing-b",
        label: "Dangling",
        approved: true,
      },
    ],
  })
  corruptCases.push({ name: "dangling-connection-ids", config: cfg })
}

{
  const cfg = normalizeCareerEvolutionConfig({
    visible: true,
    tracks: [{ id: "t1", label: undefined as unknown as string }],
    milestones: [
      {
        id: "m1",
        label: "Role",
        start: "2021-01",
        end: "Present",
        trackId: "t1",
      },
    ],
  })
  corruptCases.push({ name: "undefined-track-label", config: cfg })
}

for (const c of corruptCases) {
  if (!renderAll(c.config, `corrupt:${c.name}`)) failed = true
}

// Round-trip serialize → mutate connection target → parse → render
{
  const base = parseCareerEvolutionText(BASE_TEXT).config
  const text = serializeCareerEvolutionText(base)
  const renamed = text.replace("UX & AI Strategy", "Staff UX Strategy")
  const parsed = parseCareerEvolutionText(renamed, base)
  if (!renderAll(normalizeCareerEvolutionConfig({ ...parsed.config, visible: true }), "roundtrip-rename")) {
    failed = true
  }
}

if (failed) {
  console.error("test-ce-graphtext-crash: FAILED")
  process.exit(1)
}
console.log("test-ce-graphtext-crash: ok")
