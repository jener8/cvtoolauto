import assert from "node:assert/strict"
import { parseYourStoryResponse } from "../lib/your-story-response"

const sample = parseYourStoryResponse(`{
  "story": "I bring a decade of UX and digital transformation experience.",
  "cvEvidence": [
    {
      "id": "e1",
      "storyExcerpt": "UX and digital transformation",
      "cvSection": "Profile",
      "cvReference": "10+ years in UX and service design",
      "supportLevel": "strong"
    }
  ]
}`)

assert.ok(sample)
assert.match(sample!.story, /decade of UX/)
assert.equal(sample!.cvEvidence.length, 1)
assert.equal(sample!.cvEvidence[0].supportLevel, "strong")

console.log("test-your-story-response: ok")
