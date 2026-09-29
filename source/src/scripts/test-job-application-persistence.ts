import assert from "node:assert/strict"
import type { JobApplication } from "@/lib/types"
import { mergeNewerJobApplication } from "@/lib/job-application-link-guard"
import { haveJobApplicationsChanged } from "@/lib/application-reconcile"
import { hasUploadDetailsContent } from "@/lib/upload-details"

function makeJob(overrides: Partial<JobApplication> & Pick<JobApplication, "id">): JobApplication {
  return {
    id: overrides.id,
    jobTitle: overrides.jobTitle ?? "Consultant",
    company: overrides.company ?? "Porsche Consulting",
    location: overrides.location ?? "Berlin",
    folderId: overrides.folderId ?? "folder-1",
    resumeVersionId: overrides.resumeVersionId ?? "",
    coverLetterId: overrides.coverLetterId ?? "",
    jobDescription: overrides.jobDescription ?? "",
    jobDescriptionSummary: "",
    jobDescriptionUrl: "",
    companyInfo: overrides.companyInfo ?? {
      website: "",
      researchNotes: "",
      linkedInContacts: [],
      lastModified: Date.now(),
    },
    contacts: overrides.contacts ?? [],
    coverLetter: overrides.coverLetter ?? { content: "", lastModified: Date.now() },
    interviewPrep: overrides.interviewPrep ?? {
      questions: [],
      personalDescription: "",
      interviewers: [],
      generalNotes: "",
      lastModified: Date.now(),
    },
    pipeline: overrides.pipeline ?? [{ stage: "applied", outcome: "pending", date: Date.now() }],
    appliedDate: overrides.appliedDate ?? Date.now(),
    additionalInterviewDates: [],
    lastModified: overrides.lastModified ?? Date.now(),
    salaryExpectation: "",
    employmentType: "full-time",
    why: "",
    status: overrides.status,
    uploadDetails: overrides.uploadDetails,
  }
}

const remote = makeJob({
  id: "job-cgi",
  company: "CGI",
  jobTitle: "Associate Responsible AI Specialist",
  lastModified: 1000,
  pipeline: [{ stage: "applied", outcome: "pending", date: 1000 }],
})

const localRejected = makeJob({
  ...remote,
  lastModified: 2000,
  pipeline: [{ stage: "applied", outcome: "rejected", date: 2000 }],
  status: "rejected",
})

const merged = mergeNewerJobApplication(remote, localRejected)
assert.equal(merged.pipeline?.[0]?.outcome, "rejected", "prefers newer local pipeline")

assert.equal(
  haveJobApplicationsChanged([remote], [localRejected]),
  true,
  "detects pipeline outcome changes",
)

const withUploadDetails = makeJob({
  ...remote,
  uploadDetails: {
    salaryExpectation: "€85,000–€100,000",
    availability: "Available after standard notice period.",
    outputLanguage: "en",
    updatedAt: Date.now(),
  },
})

assert.equal(
  haveJobApplicationsChanged([remote], [withUploadDetails]),
  true,
  "detects upload details changes",
)

assert.ok(
  hasUploadDetailsContent(withUploadDetails.uploadDetails),
  "fixture upload details should have content",
)

console.log("job-application-persistence tests passed")
