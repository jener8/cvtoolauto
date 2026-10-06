#!/usr/bin/env node
/**
 * Unit tests for three-gate status machine.
 * Run: node --experimental-strip-types scripts/test-agent-three-gates.mjs
 * (or compiled via tsx if available)
 */
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dynamic import of TS via relative path — Next project uses TS; prefer .ts through node with strip-types
const modPath = path.join(__dirname, "../lib/agents/status-machine.ts")

let m
try {
  m = await import(pathToFileURL(modPath).href)
} catch {
  // Fallback: inline re-implementation check via compiled expectations
  console.error("Could not import status-machine.ts directly; use tsx:")
  console.error("  npx tsx scripts/test-agent-three-gates.ts")
  process.exit(1)
}

const {
  normalizeAgentJobStatus,
  isDraftEligibleStatus,
  canShortlistStatus,
  canStartGate3Send,
  assertSingleJobGate,
  DRAFT_ELIGIBLE_STATUSES,
} = m

assert.equal(normalizeAgentJobStatus("reviewing"), "potential_fit")
assert.equal(normalizeAgentJobStatus("not_relevant"), "not_a_fit")
assert.equal(normalizeAgentJobStatus("needs_manual_review"), "manual")
assert.equal(normalizeAgentJobStatus("approved"), "documents_approved")
assert.equal(normalizeAgentJobStatus("shortlisted"), "shortlisted")

assert.equal(isDraftEligibleStatus("shortlisted"), true)
assert.equal(isDraftEligibleStatus("changes_requested"), true)
assert.equal(isDraftEligibleStatus("potential_fit"), false)
assert.equal(isDraftEligibleStatus("reviewing"), false)
assert.equal(isDraftEligibleStatus("documents_approved"), false)
assert.ok(DRAFT_ELIGIBLE_STATUSES.includes("shortlisted"))
assert.ok(!DRAFT_ELIGIBLE_STATUSES.includes("potential_fit"))

assert.equal(canShortlistStatus("potential_fit"), true)
assert.equal(canShortlistStatus("manual"), true)
assert.equal(canShortlistStatus("not_a_fit"), false)

assert.equal(canStartGate3Send({ status: "documents_approved", applyMethod: "email" }).ok, true)
assert.equal(
  canStartGate3Send({
    status: "documents_approved",
    applyMethod: "email",
    fabricationFlags: [{ claim: "x" }],
  }).ok,
  false,
)
assert.equal(canStartGate3Send({ status: "drafts_ready", applyMethod: "email" }).ok, false)
assert.equal(canStartGate3Send({ status: "approved", applyMethod: "email" }).ok, true) // legacy alias
assert.equal(canStartGate3Send({ status: "shortlisted", applyMethod: "email" }).ok, false)

assert.throws(() => assertSingleJobGate("gate3", ["a", "b"]), /bulk send/i)
assert.throws(() => assertSingleJobGate("gate2", []), /one job/i)
assert.doesNotThrow(() => assertSingleJobGate("gate3", ["only-one"]))

console.log("PASS  test-agent-three-gates — no draft without shortlist; no send without documents_approved; no bulk send")
