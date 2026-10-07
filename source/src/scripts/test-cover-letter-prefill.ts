/**
 * Cover letter applicant prefill from CV contact.
 * Run: npx tsx scripts/test-cover-letter-prefill.ts
 */
import assert from "node:assert/strict"
import {
  buildNewCoverLetterApplicantPrefill,
  coverLetterHasSavedApplicantDetails,
  resolveCoverLetterApplicantContact,
  resolvePrefillResumeContact,
} from "../lib/cover-letter-contact"

const cvContact = {
  name: "Ada Example",
  email: "ada@example.com",
  phone: "",
  address: "Berlin",
  linkedin: "linkedin.com/in/ada",
  citizenship: "",
  portfolio: "",
  portfolios: [] as string[],
  showPortfolio: false,
  professionalTitle: "Engineer",
  language: "en" as const,
  targetCompany: "",
  targetRole: "",
  jobAdvertSource: "",
}

const prefill = buildNewCoverLetterApplicantPrefill({ resumeContact: cvContact, language: "en" })
assert.equal(prefill.applicantName, "Ada Example")
assert.equal(prefill.applicantEmail, "ada@example.com")
assert.equal(prefill.applicantAddress, "Berlin")
assert.equal(prefill.applicantPhone, "", "missing phone stays empty")
assert.ok(prefill.letterDate.length > 0)

assert.equal(coverLetterHasSavedApplicantDetails({ applicantName: "" }), false)
assert.equal(coverLetterHasSavedApplicantDetails({ applicantName: "Ada" }), true)

const older = {
  id: "old",
  contactInfo: { ...cvContact, name: "Old Name", phone: "111" },
  updatedAt: 100,
  timestamp: 100,
}
const newer = {
  id: "new",
  contactInfo: { ...cvContact, name: "New Name", phone: "222" },
  updatedAt: 200,
  timestamp: 200,
}
const linked = resolvePrefillResumeContact({
  linkedResumeId: "old",
  resumeVersions: [older, newer],
})
assert.equal(linked?.name, "Old Name", "linked CV wins")

const fallback = resolvePrefillResumeContact({
  linkedResumeId: "missing",
  resumeVersions: [older, newer],
})
assert.equal(fallback?.name, "New Name", "most recently edited when none linked")

// Existing letter with empty phone must not be refilled from CV via pickSavedOrFallback
const existing = resolveCoverLetterApplicantContact({
  coverLetter: {
    applicantName: "Saved Name",
    applicantEmail: "saved@example.com",
    applicantAddress: "Munich",
    applicantPhone: "",
    letterDate: "1 January 2020",
  },
  resumeContact: cvContact,
  language: "en",
})
assert.equal(existing.applicantPhone, "", "existing empty phone not overwritten")
assert.equal(existing.applicantName, "Saved Name")

console.log("test-cover-letter-prefill: ok")
