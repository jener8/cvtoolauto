/**
 * Show LinkedIn on CV toggle helpers.
 * Run: npx tsx scripts/test-show-linkedin-on-cv.ts
 */
import assert from "node:assert/strict"
import {
  normalizeContactInfo,
  resolveShowLinkedInOnCv,
  shouldShowLinkedInOnResume,
  visibleLinkedInUrl,
} from "../lib/contact-info"

assert.equal(resolveShowLinkedInOnCv({}), true, "undefined = ON")
assert.equal(resolveShowLinkedInOnCv({ showLinkedInOnCv: true }), true)
assert.equal(resolveShowLinkedInOnCv({ showLinkedInOnCv: false }), false)

const withUrl = normalizeContactInfo({
  linkedin: "linkedin.com/in/ada",
})
assert.equal(withUrl.showLinkedInOnCv, true)
assert.equal(shouldShowLinkedInOnResume(withUrl), true)
assert.equal(visibleLinkedInUrl(withUrl), "linkedin.com/in/ada")

const hidden = normalizeContactInfo({
  linkedin: "linkedin.com/in/ada",
  showLinkedInOnCv: false,
})
assert.equal(shouldShowLinkedInOnResume(hidden), false)
assert.equal(visibleLinkedInUrl(hidden), "", "hidden leaves no URL for header")

const empty = normalizeContactInfo({ linkedin: "", showLinkedInOnCv: true })
assert.equal(shouldShowLinkedInOnResume(empty), false, "empty URL never shows")

const legacy = normalizeContactInfo({ linkedin: "linkedin.com/in/legacy" })
assert.equal(legacy.showLinkedInOnCv !== false, true, "legacy CVs keep showing")

console.log("test-show-linkedin-on-cv: ok")
