/**
 * Shared ExperienceRole rail must wrap every role — not only multi-role employers.
 * Run: npx tsx scripts/test-experience-role-rail.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = path.join(__dirname, "..")
const preview = fs.readFileSync(path.join(root, "components/resume-preview.tsx"), "utf8")
const pagination = fs.readFileSync(path.join(root, "lib/pdf-auto-pagination.ts"), "utf8")

assert.match(preview, /wrapExperienceRoleRail/)
assert.match(preview, /pushExperienceRolePdfChunks/)
assert.match(preview, /pushEmployerGroupPdfChunks/)
assert.match(preview, /hasEmployerHeading/)
assert.match(preview, /buildEmployerGroupRoleBlocks/)
// Employer heading always above/outside the rail for every company (single + multi)
assert.match(preview, /ABOVE and\s*\n\s*\*\s*OUTSIDE the green role rail|OUTSIDE the green role rail/)
assert.doesNotMatch(
  preview,
  /shouldGroupExperienceByEmployer\(groups\)/,
  "must not gate rails on multi-role-only check",
)
// Always organise Experience so singles share employer-first hierarchy
assert.match(preview, /Always organise when enabled/)

// Short roles stay intact; longer roles keep title+dates+first bullet only
assert.match(pagination, /≤3 bullets/)
assert.match(pagination, /first bullet only/)

console.log("test-experience-role-rail: ok")
