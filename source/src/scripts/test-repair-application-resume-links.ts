import assert from "node:assert/strict"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { repairApplicationResumeLinks } from "@/lib/repair-application-resume-links"

function makeJob(id: string, resumeVersionId = ""): JobApplication {
  return {
    id,
    resumeVersionId,
    jobTitle: "Consultant",
    company: "Porsche Consulting",
    location: "Berlin",
    folderId: "folder-1",
    appliedDate: Date.now(),
    lastModified: Date.now(),
    pipeline: [{ stage: "applied", outcome: "pending", date: Date.now() }],
  }
}

function makeResume(id: string, applicationId?: string): ResumeVersion {
  return {
    id,
    name: "Porsche Consulting CV",
    applicationId,
    resumeText: "# CV\n\n## EXPERIENCE\n- Built tailored resume",
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
      name: "Test User",
      language: "en",
      targetCompany: "Porsche Consulting",
      targetRole: "Consultant",
      jobAdvertSource: "",
    },
  }
}

const job = makeJob("job-porsche")
const resume = makeResume("resume-porsche", "job-porsche")

const repairedFromOwned = repairApplicationResumeLinks([job], [resume], "folder-1")
assert.equal(repairedFromOwned.changed, true)
assert.equal(repairedFromOwned.applications[0]?.resumeVersionId, "resume-porsche")

const linkedJob = makeJob("job-porsche", "resume-porsche")
const untaggedResume = makeResume("resume-porsche")
const repairedFromLink = repairApplicationResumeLinks([linkedJob], [untaggedResume], "folder-1")
assert.equal(repairedFromLink.changed, true)
assert.equal(repairedFromLink.versions[0]?.applicationId, "job-porsche")

console.log("repair-application-resume-links tests passed")
