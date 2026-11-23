/**
 * Run: npx tsx scripts/test-experience-organization.ts
 *
 * Bundesdruckerei + TrustAudit.tools regression:
 * - Group consecutive Bundesdruckerei roles under one employer with union tenure
 * - Do not merge same employer across an intervening company
 * - Detect TrustAudit overlap (hint only — no auto-move)
 * - rebuildExperienceMarkdown can move TrustAudit into parallel lines when confirmed
 */
import assert from "node:assert/strict"
import { normalizeCvSectionKey } from "../lib/import-cv-structure"
import {
  buildEmployerGroupDisplayBlocks,
  buildEmployerGroupRoleBlocks,
  findOverlappingEmployerPairs,
  formatEmployerDisplayName,
  groupExperienceByEmployer,
  hasEmployerHeading,
  isMultiRoleEmployerGroup,
  orderExperienceRoleDisplayLines,
  organizeExperienceLines,
  overallEmploymentDateLabel,
  rebuildExperienceMarkdown,
  shouldGroupExperienceByEmployer,
  splitExperienceJobEntries,
  unionTenureMonths,
} from "../lib/experience-organization"

assert.equal(normalizeCvSectionKey("PARALLEL INDEPENDENT WORK"), "PARALLEL_WORK")
assert.equal(normalizeCvSectionKey("NEBENBERUFLICHE TÄTIGKEIT"), "PARALLEL_WORK")

const now = new Date(2026, 10, 1) // Nov 2026

// Union: Jan 2020–Dec 2022 + Jan 2022–Present Nov 2026 = Jan 2020–Nov 2026 (82 months), not sum
assert.equal(
  unionTenureMonths([
    { start: { year: 2020, month: 1 }, end: { year: 2022, month: 12 } },
    { start: { year: 2022, month: 1 }, end: { year: 2026, month: 11 } },
  ]),
  (2026 - 2020) * 12 + (11 - 1),
)

assert.equal(
  formatEmployerDisplayName("Bundesdruckerei-Gruppe, Berlin, Germany"),
  "Bundesdruckerei-Gruppe · Berlin, Germany",
)
assert.equal(formatEmployerDisplayName("TrustAudit.tools"), "TrustAudit.tools")

// Consecutive same-employer roles group; TrustAudit stays separate after them
const experienceLines = `
# Senior UX Designer
## Bundesdruckerei GmbH
### January 2023 – Present
- Led product design for citizen services

# UX Designer
## Bundesdruckerei GmbH
### November 2020 – December 2022
- Designed accessible public-sector interfaces

# Founder
## TrustAudit.tools
### January 2024 – Present
- Built independent AI trust tooling
`
  .trim()
  .split("\n")

const jobs = splitExperienceJobEntries(experienceLines, now)
assert.equal(jobs.length, 3)

const groups = organizeExperienceLines(experienceLines, { language: "en", now })
assert.equal(shouldGroupExperienceByEmployer(groups), true)

const bd = groups.find((g) => /bundesdruckerei/i.test(g.company))
assert.ok(bd, "Bundesdruckerei group")
assert.equal(bd!.jobs.length, 2, "both consecutive Bundesdruckerei roles grouped")
assert.ok(isMultiRoleEmployerGroup(bd!))
assert.ok(bd!.tenureMonths != null && bd!.tenureMonths >= 70)
assert.match(bd!.tenureDateLabel ?? "", /November 2020/)
assert.match(bd!.tenureDateLabel ?? "", /Present/)
assert.ok((bd!.tenureMonths ?? 0) < 100, "union tenure, not summed")

const overall = overallEmploymentDateLabel(bd!, "en")
assert.equal(overall, "November 2020 – Present")
assert.doesNotMatch(overall ?? "", /Overall employment/i)
assert.doesNotMatch(overall ?? "", /\(/)

const trust = groups.find((g) => /trustaudit/i.test(g.company))
assert.ok(trust)
assert.equal(trust!.jobs.length, 1)

// Non-consecutive same employer must NOT merge across an intervening company
const interleaved = `
# Senior UX Designer
## Bundesdruckerei GmbH
### January 2023 – Present
- Later role

# Founder
## TrustAudit.tools
### January 2024 – Present
- Independent

# UX Designer
## Bundesdruckerei GmbH
### November 2020 – December 2022
- Earlier role
`
  .trim()
  .split("\n")
const interleavedGroups = organizeExperienceLines(interleaved, { language: "en", now })
const bdGroups = interleavedGroups.filter((g) => /bundesdruckerei/i.test(g.company))
assert.equal(bdGroups.length, 2, "non-consecutive Bundesdruckerei stays as two groups")
assert.ok(bdGroups.every((g) => g.jobs.length === 1))

// Overlap detected for hint — TrustAudit concurrent with Bundesdruckerei
const overlaps = findOverlappingEmployerPairs(jobs, now)
assert.ok(
  overlaps.some(
    (p) =>
      (/bundesdruckerei/i.test(p.a) && /trustaudit/i.test(p.b)) ||
      (/trustaudit/i.test(p.a) && /bundesdruckerei/i.test(p.b)),
  ),
)

// Confirmed move into Parallel Independent Work
const rebuilt = rebuildExperienceMarkdown({
  experienceLines,
  parallelCompanyKeys: ["TrustAudit.tools"],
  language: "en",
  now,
})
assert.equal(rebuilt.movedCompanies.length, 1)
assert.match(rebuilt.movedCompanies[0]!, /TrustAudit/i)
assert.ok(
  rebuilt.experienceLines.some((l) => /Bundesdruckerei/i.test(l)),
  "primary keeps Bundesdruckerei",
)
assert.ok(
  !rebuilt.experienceLines.some((l) => /TrustAudit/i.test(l)),
  "TrustAudit removed from EXPERIENCE when confirmed",
)
assert.ok(rebuilt.parallelLines.some((l) => /TrustAudit/i.test(l)))

// After move: EXPERIENCE groups only Bundesdruckerei
const after = groupExperienceByEmployer(
  splitExperienceJobEntries(rebuilt.experienceLines, now),
  { now },
)
assert.equal(after.length, 1)
assert.equal(after[0]!.jobs.length, 2)

// Display order: title → employer → dates (even when source is company-first)
const companyFirst = orderExperienceRoleDisplayLines([
  "## Anderson Eye Care, United Kingdom",
  "### January 2021 - February 2024",
  "# Product Research Consultant [work=parallel-consulting]",
  "- Framed research questions",
])
assert.equal(companyFirst[0]!.trim().startsWith("# "), true, "title first")
assert.equal(companyFirst[1]!.trim().startsWith("## "), true, "employer second")
assert.equal(companyFirst[2]!.trim().startsWith("### "), true, "dates third")
assert.match(companyFirst[0]!, /Product Research Consultant/)
assert.match(companyFirst[0]!, /\[work=parallel-consulting\]/)

// Multi-role group: employer omitted from role blocks (heading is separate);
// each role is title → dates → bullets
const bdBlocks = buildEmployerGroupDisplayBlocks(bd!)
assert.equal(bdBlocks.length, 2)
assert.match(bdBlocks[0]![0]!, /^# /)
assert.match(bdBlocks[0]![1]!, /^### /)
assert.match(bdBlocks[1]![0]!, /^# /)
assert.match(bdBlocks[1]![1]!, /^### /)
assert.ok(
  !bdBlocks.flat().some((l) => l.trim().startsWith("## ")),
  "employer heading is separate — no ## company lines in role blocks",
)
assert.ok(
  !bdBlocks.flat().some((l) => /Overall employment/i.test(l)),
  "no Overall employment copy in role blocks",
)
assert.ok(
  bdBlocks.flat().some((l) => /Led product design/.test(l)),
  "preserve achievement bullets",
)

// Single-role employer: same employer-first role blocks (no ## inside rail)
assert.ok(hasEmployerHeading(trust!))
assert.equal(isMultiRoleEmployerGroup(trust!), false)
const trustBlocks = buildEmployerGroupRoleBlocks(trust!)
assert.equal(trustBlocks.length, 1)
assert.match(trustBlocks[0]![0]!, /^# /)
assert.match(trustBlocks[0]![1]!, /^### /)
assert.ok(
  !trustBlocks[0]!.some((l) => l.trim().startsWith("## ")),
  "single-role company is outside the rail — no ## in role block",
)
assert.match(trustBlocks[0]![0]!, /Founder/)
assert.ok(trustBlocks[0]!.some((l) => /Built independent AI trust tooling/.test(l)))

console.log("test-experience-organization: ok", {
  bundesdruckereiMonths: bd!.tenureMonths,
  overall,
  tenureLabel: bd!.tenureDateLabel,
})
