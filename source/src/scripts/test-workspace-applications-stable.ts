import assert from "node:assert/strict"
import {
  jobApplicationListSignature,
  pickStableJobApplications,
  shouldSkipApplicationsUiUpdate,
} from "../lib/workspace-applications-stable"
import type { JobApplication } from "../lib/types"

const app = (id: string, folderId = "f1"): JobApplication =>
  ({
    id,
    folderId,
    jobTitle: "Role",
    company: "Co",
    jobDescription: "",
    resumeVersionId: "r1",
    companyInfo: { website: "", researchNotes: "", linkedInContacts: [], lastModified: 0 },
    contacts: [],
    interviewPrep: {
      questions: [],
      possibleAnswers: [],
      personalDescription: "",
      interviewers: [],
      generalNotes: "",
      lastModified: 0,
    },
    appliedDate: 1,
    lastModified: 1,
  }) as JobApplication

const previous = [app("a"), app("b")]
const local = previous
const empty: JobApplication[] = []

const stable = pickStableJobApplications(empty, {
  previous,
  localFallback: local,
  remoteFailed: true,
  folderId: "f1",
})
assert.equal(stable.length, 2)
assert.equal(jobApplicationListSignature(stable), "a|b")

const incoming = [app("a"), app("b"), app("c")]
const merged = pickStableJobApplications(incoming, {
  previous,
  localFallback: local,
  remoteFailed: true,
  folderId: "f1",
})
assert.equal(merged.length, 3)

assert.equal(shouldSkipApplicationsUiUpdate(previous, previous), true)
assert.equal(shouldSkipApplicationsUiUpdate(previous, merged), false)

console.log("test-workspace-applications-stable: ok")
