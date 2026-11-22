/**
 * Run: npx tsx scripts/test-live-discovery-search-query.ts
 */
import assert from "node:assert/strict"
import { buildLiveDiscoverySearchQuery } from "../lib/live-discovery/build-search-query"

const query = buildLiveDiscoverySearchQuery({
  careerPrefs: {
    rolesOfInterest: "AI Design Lead, Product Designer",
    industriesOfInterest: "Public sector",
    preferredLocations: "Berlin, Remote",
    remotePreference: "hybrid",
    useForRecommendations: { preferences: true, story: true, roleStrategy: true },
  },
  strategicProfile: {
    careerDirection: "Responsible AI enablement",
  },
  savedRoleMatches: [
    {
      id: "1",
      title: "AI Adoption Specialist",
      matchingSkills: ["workshops"],
      fitLevel: "strong",
      savedAt: 1,
    },
  ],
})

assert.ok(query.keywords.includes("AI Design Lead"))
assert.ok(query.keywords.includes("AI Adoption Specialist"))
assert.ok(query.keywords.some((k) => /Responsible AI/i.test(k)))
assert.equal(query.location, "Berlin")
assert.equal(query.remote, true)
assert.ok(query.sourcesUsed.includes("Career Profile"))
assert.ok(query.sourcesUsed.includes("Role Strategy"))

const empty = buildLiveDiscoverySearchQuery({})
assert.equal(empty.keywords.length, 0)
assert.equal(empty.location, "Berlin")
assert.deepEqual(empty.sourcesUsed, ["Defaults"])

console.log("test-live-discovery-search-query: ok")
