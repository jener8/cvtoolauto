import assert from "node:assert/strict"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { resolveResumeForJob } from "@/lib/resolve-application-resume"

function makeJob(id: string, resumeVersionId: string): JobApplication {
  return {
    id,
    resumeVersionId,
    jobTitle: "Associate Responsible AI Specialist",
    company: "CGI",
    location: "",
    folderId: "folder-1",
    appliedDate: "",
    lastModified: 0,
    pipeline: { stage: "applied", outcome: null },
  }
}

function makeResume(
  id: string,
  applicationId: string | undefined,
  name: string,
): ResumeVersion {
  return {
    id,
    name,
    applicationId,
    resumeText: `# ${name}\n\n## EXPERIENCE\n- Role`,
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
      targetCompany: "",
      targetRole: "",
      jobAdvertSource: "",
    },
  }
}

const cgiJob = makeJob("job-cgi", "resume-neuro")
const neuroResume = makeResume(
  "resume-neuro",
  "job-neuro",
  "Neuroscience, HCI & Cognitive Research Lead",
)
const cgiResume = makeResume(
  "resume-cgi",
  "job-cgi",
  "Associate Responsible AI Specialist @ CGI",
)

const resolved = resolveResumeForJob(cgiJob, [neuroResume, cgiResume])
assert.equal(resolved?.id, "resume-cgi", "prefers resume owned by applicationId")

const linkedOnly = resolveResumeForJob(
  makeJob("job-x", "resume-neuro"),
  [neuroResume],
)
assert.equal(linkedOnly?.id, undefined, "rejects resume owned by another application")

console.log("resolve-application-resume tests passed")
