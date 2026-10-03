/**
 * Unit tests: three-gate status machine.
 * Run: npx tsx scripts/test-agent-three-gates.ts
 */
import assert from "node:assert/strict"
import {
  assertSingleJobGate,
  canShortlistStatus,
  canStartGate3Send,
  DRAFT_ELIGIBLE_STATUSES,
  isDraftEligibleStatus,
  normalizeAgentJobStatus,
} from "../lib/agents/status-machine"

assert.equal(normalizeAgentJobStatus("reviewing"), "potential_fit")
assert.equal(normalizeAgentJobStatus("not_relevant"), "not_a_fit")
assert.equal(normalizeAgentJobStatus("needs_manual_review"), "manual")
assert.equal(normalizeAgentJobStatus("approved"), "documents_approved")

assert.equal(isDraftEligibleStatus("shortlisted"), true)
assert.equal(isDraftEligibleStatus("changes_requested"), true)
assert.equal(isDraftEligibleStatus("potential_fit"), false)
assert.equal(isDraftEligibleStatus("reviewing"), false)
assert.ok(!DRAFT_ELIGIBLE_STATUSES.includes("potential_fit" as never))

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
assert.equal(canStartGate3Send({ status: "shortlisted", applyMethod: "email" }).ok, false)

assert.throws(() => assertSingleJobGate("gate3", ["a", "b"]), /bulk send/i)
assert.throws(() => assertSingleJobGate("gate2", []), /one job/i)
assert.doesNotThrow(() => assertSingleJobGate("gate3", ["only-one"]))

console.log(
  "PASS  test-agent-three-gates — no drafting without shortlist; no send without documents_approved; no bulk send",
)
