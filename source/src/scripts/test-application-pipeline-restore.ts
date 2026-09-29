import assert from "node:assert/strict"
import type { JobApplication } from "@/lib/types"
import {
  getCurrentOutcome,
  getCurrentStage,
  inferPipelineFromLegacyHints,
  isShallowAppliedPipeline,
  normalizePipeline,
} from "@/lib/application-pipeline"
import { mapJobApplicationRow } from "@/lib/job-application-map"
import { finalizeWorkspaceApplications } from "@/lib/job-application-enrich"
import { reconcileWorkspaceApplications } from "@/lib/application-reconcile"

const interviewInvitedRow = {
  id: "job-1",
  role: "Consultant",
  company: "Porsche Consulting",
  status: "interview_invited",
  applied_date: "2024-03-15T10:00:00.000Z",
  updated_at: "2026-06-01T10:00:00.000Z",
  job_description: {
    pipeline: [{ stage: "applied", outcome: "pending", date: "2026-06-01T10:00:00.000Z" }],
    firstInterviewDate: "2024-04-01T10:00:00.000Z",
  },
}

const mappedInterview = mapJobApplicationRow(interviewInvitedRow)
assert.equal(getCurrentStage(mappedInterview), "hr_screening")
assert.equal(getCurrentOutcome(mappedInterview), "pending")
assert.equal(
  new Date(mappedInterview.appliedDate).toISOString().slice(0, 10),
  "2024-03-15",
)

const rejectedFromDates: JobApplication = {
  id: "job-2",
  jobTitle: "Analyst",
  company: "CGI",
  status: "applied",
  appliedDate: Date.parse("2026-06-01T10:00:00.000Z"),
  rejectionDate: Date.parse("2024-05-01T10:00:00.000Z"),
  pipeline: [{ stage: "applied", outcome: "pending", date: Date.parse("2026-06-01T10:00:00.000Z") }],
  lastModified: Date.now(),
}

const inferredRejected = inferPipelineFromLegacyHints(rejectedFromDates)
assert.ok(inferredRejected)
assert.equal(inferredRejected!.at(-1)?.outcome, "rejected")

const normalizedRejected = normalizePipeline(rejectedFromDates.pipeline, rejectedFromDates)
assert.equal(getCurrentOutcome({ ...rejectedFromDates, pipeline: normalizedRejected }), "rejected")

assert.ok(isShallowAppliedPipeline([{ stage: "applied", outcome: "pending" }]))
assert.ok(!isShallowAppliedPipeline([{ stage: "applied", outcome: "rejected" }]))

const labeledApp: JobApplication = {
  id: "app-real",
  jobTitle: "Consultant",
  company: "Porsche Consulting",
  resumeVersionId: "resume-1",
  appliedDate: Date.parse("2024-03-01T00:00:00.000Z"),
  lastModified: Date.now(),
  pipeline: [{ stage: "applied", outcome: "passed", date: Date.parse("2024-03-01T00:00:00.000Z") }],
}

const shellApp: JobApplication = {
  id: "app-shell",
  jobTitle: "",
  company: "",
  resumeVersionId: "resume-1",
  appliedDate: Date.now(),
  lastModified: Date.now(),
  pipeline: [{ stage: "applied", outcome: "pending", date: Date.now() }],
}

const finalized = finalizeWorkspaceApplications(
  [labeledApp, shellApp],
  [
    {
      id: "resume-1",
      name: "Porsche CV",
      applicationId: "app-real",
      resumeText: "# CV",
      profileImage: null,
      companyLogo: null,
      timestamp: Date.parse("2024-03-01T00:00:00.000Z"),
      createdAt: Date.parse("2024-03-01T00:00:00.000Z"),
      contactInfo: {
        email: "",
        linkedin: "",
        phone: "",
        address: "",
        citizenship: "",
        portfolio: "",
        portfolios: [],
        showPortfolio: false,
        professionalTitle: "",
        name: "Test",
        language: "en",
        targetCompany: "Porsche Consulting",
        targetRole: "Consultant",
        jobAdvertSource: "",
      },
    },
  ],
)

assert.equal(finalized.length, 1)
assert.equal(finalized[0]?.id, "app-real")

const reconcileResult = reconcileWorkspaceApplications(
  [
    {
      id: "resume-1",
      name: "Porsche CV",
      applicationId: "app-real",
      resumeText: "# CV",
      profileImage: null,
      companyLogo: null,
      timestamp: Date.now(),
      contactInfo: {
        email: "",
        linkedin: "",
        phone: "",
        address: "",
        citizenship: "",
        portfolio: "",
        portfolios: [],
        showPortfolio: false,
        professionalTitle: "",
        name: "Test",
        language: "en",
        targetCompany: "Porsche Consulting",
        targetRole: "Consultant",
        jobAdvertSource: "",
      },
    },
  ],
  [labeledApp],
  "folder-1",
)

assert.equal(reconcileResult.newApplicationCount, 0)

import { mergeAllDuplicateApplications } from "@/lib/job-applications-dedupe"

const data4lifeFull: JobApplication = {
  id: "app-full",
  jobTitle: "Product Designer - Electronic Data Capture and Participant Experience",
  company: "Data4Life",
  location: "Berlin",
  folderId: "folder-1",
  resumeVersionId: "cv-data4life",
  appliedDate: Date.parse("2026-07-01T00:00:00.000Z"),
  lastModified: Date.parse("2026-06-17T00:00:00.000Z"),
  pipeline: [{ stage: "applied", outcome: "pending", date: Date.parse("2026-07-01T00:00:00.000Z") }],
}

const data4lifeShell: JobApplication = {
  id: "app-shell-data4life",
  jobTitle: "Product Designer - Electronic Data Capture and Participant Experience",
  company: "Data4Life",
  location: "Berlin",
  folderId: "folder-1",
  resumeVersionId: "",
  appliedDate: Date.parse("2026-06-30T00:00:00.000Z"),
  lastModified: Date.parse("2026-06-17T00:00:00.000Z"),
  pipeline: [{ stage: "applied", outcome: "pending", date: Date.parse("2026-06-30T00:00:00.000Z") }],
}

const data4lifeVersions: ResumeVersion[] = [
  {
    id: "cv-data4life",
    name: "Data4Life CV",
    applicationId: "app-full",
    resumeText: "# CV",
    profileImage: null,
    companyLogo: null,
    timestamp: Date.parse("2026-06-30T00:00:00.000Z"),
    contactInfo: {
      email: "",
      linkedin: "",
      phone: "",
      address: "",
      citizenship: "",
      portfolio: "",
      portfolios: [],
      showPortfolio: false,
      professionalTitle: "",
      name: "Test",
      language: "en",
      targetCompany: "Data4Life",
      targetRole: "Product Designer",
      jobAdvertSource: "",
    },
  },
]

const mergedData4life = mergeAllDuplicateApplications(
  [data4lifeFull, data4lifeShell],
  data4lifeVersions,
  "folder-1",
)

assert.equal(mergedData4life.applications.length, 1)
assert.equal(mergedData4life.applications[0]?.id, "app-full")
assert.equal(mergedData4life.applications[0]?.resumeVersionId, "cv-data4life")
assert.equal(mergedData4life.removedApplications.length, 1)

console.log("application-pipeline-restore tests passed")
