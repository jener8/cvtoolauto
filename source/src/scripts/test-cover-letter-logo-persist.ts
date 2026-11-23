/**
 * Cover-letter logos must survive local compact→expand (no mid-base64 truncation).
 * Run: npx tsx scripts/test-cover-letter-logo-persist.ts
 */
import assert from "node:assert/strict"
import {
  compactResumeForLocal,
  expandCompactResume,
} from "../lib/resume-local-storage"
import {
  coverLetterHeaderFields,
  resolveCoverLetterCompanyLogo,
} from "../lib/resume-cover-letter"
import type { ResumeVersion } from "../lib/types"

/** ~40KB JPEG data URL — formerly corrupted by the 12k cover-letter image cap. */
const LETTER_LOGO = `data:image/jpeg;base64,${"A".repeat(40_000)}`
const RESUME_LOGO = "data:image/jpeg;base64,RESUMELOGO"

const baseResume = {
  id: "r1",
  name: "Test Resume",
  resumeText: "Hello",
  profileImage: null,
  companyLogo: RESUME_LOGO,
  timestamp: 1,
  createdAt: 1,
  updatedAt: 1,
  contactInfo: {},
} as ResumeVersion

const withLogo: ResumeVersion = {
  ...baseResume,
  coverLetter: {
    id: "cl1",
    name: "Cover Letter - Test Resume",
    contentEn: "Dear hiring team",
    contentDe: "",
    contactPersonName: "",
    hiringManager: "",
    ...coverLetterHeaderFields({
      recipientCompany: "HelloFresh",
      companyLogo: LETTER_LOGO,
      omitCompanyLogo: false,
    }),
    applicantName: "Alex",
    applicantAddress: "",
    applicantEmail: "",
    applicantPhone: "",
    letterDate: "",
    createdAt: 1,
    updatedAt: 2,
  },
}

const compact = compactResumeForLocal(withLogo)
assert.equal(
  compact.coverLetterMeta?.companyLogo,
  LETTER_LOGO,
  "local compact must keep the full letter logo",
)
assert.notEqual(
  compact.coverLetterMeta?.companyLogo?.length,
  12_000,
  "must not slice logos to the old 12k cap",
)

const expanded = expandCompactResume(compact)
assert.equal(expanded.coverLetter?.companyLogo, LETTER_LOGO)
assert.equal(
  resolveCoverLetterCompanyLogo(expanded.coverLetter, RESUME_LOGO),
  LETTER_LOGO,
)

const removed: ResumeVersion = {
  ...withLogo,
  coverLetter: {
    ...withLogo.coverLetter!,
    ...coverLetterHeaderFields({
      recipientCompany: "HelloFresh",
      companyLogo: null,
      omitCompanyLogo: true,
    }),
  },
}
const removedExpanded = expandCompactResume(compactResumeForLocal(removed))
assert.equal(removedExpanded.coverLetter?.omitCompanyLogo, true)
assert.equal(removedExpanded.coverLetter?.companyLogo, null)
assert.equal(
  resolveCoverLetterCompanyLogo(removedExpanded.coverLetter, RESUME_LOGO),
  null,
  "Remove must hide letter logo while resume logo stays on the resume",
)
assert.equal(removedExpanded.companyLogo, RESUME_LOGO)

console.log("test-cover-letter-logo-persist: ok")
