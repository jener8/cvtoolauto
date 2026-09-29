/**
 * Regression tests for imported CV structure repair.
 * Run: npx tsx scripts/test-import-cv-structure.ts
 */

import {
  isPlausibleJobTitle,
  validateAndRepairImportedCv,
} from "../lib/import-cv-structure"

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message)
    process.exitCode = 1
    throw new Error(message)
  }
  console.log("OK:", message)
}

const CGI_MISPARSED = `John Doe
john@example.com

EXPERIENCE
# Experienced in establishing governance frameworks for responsible AI
# Experienced in cross-functional stakeholder management
# Associate Responsible AI Specialist
## CGI, Frankfurt
### Jan 2022 – Present
- Built governance playbooks for ML systems
- Partnered with legal and compliance teams

EDUCATION
# Master of Science in Computer Science
## Technical University
### 2016 – 2018

SKILLS
- Python
- Responsible AI

LANGUAGES
- English (Native)
- German (B2)`

const repaired = validateAndRepairImportedCv(CGI_MISPARSED)

assert(repaired.text.includes("PROFILE"), "creates or keeps PROFILE section")
assert(
  repaired.text.includes("- Experienced in establishing governance frameworks"),
  "profile sentence becomes a bullet under PROFILE",
)
assert(
  !repaired.text.includes("# Experienced in establishing governance"),
  "profile sentence is not a # job title",
)
assert(
  repaired.text.includes("# Associate Responsible AI Specialist"),
  "real job title stays in EXPERIENCE",
)
assert(repaired.text.includes("EDUCATION"), "education section preserved")
assert(repaired.text.includes("SKILLS"), "skills section preserved")
assert(repaired.text.includes("LANGUAGES"), "languages section preserved")

const profileSection = repaired.text
  .split(/\n\n+/)
  .find((block) => block.trim().startsWith("PROFILE"))
assert(Boolean(profileSection), "PROFILE block exists")
assert(
  profileSection!.includes("Experienced in establishing governance"),
  "governance text is under PROFILE",
)

const experienceSection = repaired.text
  .split(/\n\n+/)
  .find((block) => block.trim().startsWith("EXPERIENCE"))
assert(Boolean(experienceSection), "EXPERIENCE block exists")
assert(
  !experienceSection!.includes("# Experienced in establishing"),
  "EXPERIENCE does not contain profile headings",
)

assert(
  !isPlausibleJobTitle(
    "# Experienced in establishing governance frameworks for responsible AI",
    [],
    0,
  ),
  "governance sentence is not a plausible job title",
)
assert(
  isPlausibleJobTitle(
    "# Associate Responsible AI Specialist",
    ["# Associate Responsible AI Specialist", "## CGI, Frankfurt", "### Jan 2022 – Present"],
    0,
  ),
  "Associate role is a plausible job title",
)

const CGI_TARGET_AS_EXPERIENCE = `PROFILE
- Experienced in establishing governance frameworks

EXPERIENCE
# Associate Responsible AI Specialist
## CGI
### Present
- Supporting the development and implementation of Responsible AI governance processes

# Senior UX Specialist
## Bundesdruckerei - Gruppe, Berlin, Germany
### Jan 2019 – Dec 2021
- Led design systems`

const targetRepaired = validateAndRepairImportedCv(CGI_TARGET_AS_EXPERIENCE, {
  applicationContext: {
    targetRole: "Associate Responsible AI Specialist",
    targetCompany: "CGI",
  },
})

assert(
  !targetRepaired.text.includes("# Associate Responsible AI Specialist"),
  "target role is removed from EXPERIENCE body",
)
assert(
  !targetRepaired.text.includes("## CGI"),
  "target company is removed from EXPERIENCE body",
)
assert(
  targetRepaired.text.includes("# Senior UX Specialist"),
  "real jobs remain in EXPERIENCE",
)
assert(
  targetRepaired.text.includes("Supporting the development"),
  "target block bullets move to PROFILE",
)

console.log("\nAll import structure tests passed.")
