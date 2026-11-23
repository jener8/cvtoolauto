/**
 * Cover letter can hide company logo without clearing the resume logo.
 * Run: npx tsx scripts/test-cover-letter-omit-logo.ts
 */
import assert from "node:assert/strict"
import {
  coverLetterHeaderFields,
  resolveCoverLetterCompanyLogo,
} from "../lib/resume-cover-letter"

const resumeLogo = "data:image/jpeg;base64,RESUMELOGO"

assert.equal(
  resolveCoverLetterCompanyLogo({ companyLogo: null }, resumeLogo),
  resumeLogo,
  "missing letter logo should inherit resume logo",
)

assert.equal(
  resolveCoverLetterCompanyLogo(
    { companyLogo: null, omitCompanyLogo: true },
    resumeLogo,
  ),
  null,
  "omitCompanyLogo must hide resume fallback",
)

assert.equal(
  resolveCoverLetterCompanyLogo(
    { companyLogo: "data:image/jpeg;base64,LETTER", omitCompanyLogo: false },
    resumeLogo,
  ),
  "data:image/jpeg;base64,LETTER",
  "letter-owned logo wins when not omitted",
)

const removed = coverLetterHeaderFields({
  recipientCompany: "HelloFresh",
  companyLogo: null,
  omitCompanyLogo: true,
})
assert.equal(removed.companyLogo, null)
assert.equal(removed.omitCompanyLogo, true)
assert.equal(
  resolveCoverLetterCompanyLogo(removed, resumeLogo),
  null,
  "persisted omit must keep letter logo-free",
)

const restored = coverLetterHeaderFields({
  recipientCompany: "HelloFresh",
  companyLogo: "data:image/jpeg;base64,NEW",
  omitCompanyLogo: false,
})
assert.equal(restored.omitCompanyLogo, undefined)
assert.equal(
  resolveCoverLetterCompanyLogo(restored, resumeLogo),
  "data:image/jpeg;base64,NEW",
)

console.log("test-cover-letter-omit-logo: ok")
