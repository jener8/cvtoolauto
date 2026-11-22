/**
 * Guards for EquitAI nav cleanup flags.
 * Run: node scripts/test-workspace-nav-flags.mjs
 */
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Load via tsx-registered path isn't available in plain node — duplicate the
// pure logic checks against the source file instead.
import { readFileSync } from "node:fs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const flagsSrc = readFileSync(join(root, "lib/workspace-nav-flags.ts"), "utf8")
const navSrc = readFileSync(join(root, "lib/workspace-navigation.ts"), "utf8")

assert.match(flagsSrc, /ENABLED_WORKSPACE_NAV_IDS/)
assert.match(flagsSrc, /"applications"/)
assert.match(flagsSrc, /"careerBrain"/)
assert.match(flagsSrc, /DEFAULT_WORKSPACE_LANDING_VIEW:\s*AppSectionView\s*=\s*"dashboard"/)
assert.match(flagsSrc, /"careerHome"/) // still listed as retired, recoverable
assert.match(navSrc, /isWorkspaceNavIdEnabled/)
assert.match(navSrc, /return "dashboard"/)

// Enabled set must not include removed items (ignore commented restore hints).
const enabledBlock =
  flagsSrc.match(/ENABLED_WORKSPACE_NAV_IDS[\s\S]*?\]\)/)?.[0] ?? ""
const enabledActiveLines = enabledBlock
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n")
assert.match(
  enabledActiveLines,
  /"roleMatches"/,
  "roleMatches (Role Strategy) must be enabled",
)
assert.match(
  enabledActiveLines,
  /"careerProfile"/,
  "careerProfile (Career Profile) must be enabled",
)

for (const id of [
  "careerHome",
  "recognitionPathways",
  "workplaceGerman",
  "bureaucracyNavigator",
  "mentoringSupport",
  "progress",
  "scenarioLab",
  "aiCoach",
  "agents",
]) {
  assert.doesNotMatch(
    enabledActiveLines,
    new RegExp(`"${id}"`),
    `${id} must not be in ENABLED_WORKSPACE_NAV_IDS`,
  )
}

assert.doesNotMatch(
  flagsSrc.match(/RETIRED_SIDEBAR_VIEWS[\s\S]*?\]\)/)?.[0] ?? "",
  /"roleMatches"/,
  "roleMatches must not be in RETIRED_SIDEBAR_VIEWS",
)

console.log("test-workspace-nav-flags: ok")
void createRequire
