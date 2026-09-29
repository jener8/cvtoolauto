import assert from "node:assert/strict"
import { finalizeTailoredCv, mergePartialCvEdit } from "@/lib/cv-tailor-sections"
import { isUsableCvMarkdown } from "@/lib/ai-cv-response"

const sourceCv = `PROFILE
- AI governance specialist

EXPERIENCE
# AI Specialist
## CGI
### 2020 – Present
- Led responsible AI assessments

EDUCATION
Bachelor of Science in Computer Science
University of Example
- Focus on machine learning`

const generatedMissingBullets = `PROFILE
- Tailored profile

EXPERIENCE
# AI Specialist
## CGI
### 2020 – Present
- Led responsible AI assessments

EDUCATION
# Bachelor of Science in Computer Science
## University of Example
### 2014 – 2018`

const finalized = finalizeTailoredCv({
  sourceCv,
  generatedCv: generatedMissingBullets,
})

assert.equal(finalized.restoredSections.includes("education"), true)
assert.equal(finalized.validation.missingEducation, false)
assert.ok(finalized.resumeText.includes("- Focus on machine learning"))

const generatedEmptyEducation = `PROFILE
- Tailored profile

EXPERIENCE
# AI Specialist
## CGI
- Led responsible AI assessments

EDUCATION`

const finalizedEmpty = finalizeTailoredCv({
  sourceCv,
  generatedCv: generatedEmptyEducation,
})

assert.equal(finalizedEmpty.validation.missingEducation, false)
assert.ok(finalizedEmpty.resumeText.includes("University of Example"))

const experienceOnly = `# Product Design Lead
## Example Co
### 2020 – Present
- Achieved 30% faster discovery cycles by leading cross-functional workshops with design and engineering`

const partialMerged = mergePartialCvEdit(sourceCv, experienceOnly)
assert.ok(partialMerged?.includes("Achieved 30% faster discovery"), "partial experience merge")
assert.ok(partialMerged?.includes("EDUCATION"), "partial merge keeps other sections")
assert.ok(isUsableCvMarkdown(partialMerged ?? ""), "partial merge stays usable")

const markdownOnlyGenerated = `# Jennifer Simonds
Berlin, Germany | British & German Citizen

# Associate Responsible AI Specialist
## CGI
### 2020 – Present
- Led responsible AI assessments for enterprise clients
- Built governance frameworks across product teams

# Bachelor of Science
## University of Example
### 2014 – 2018
- Focus on machine learning`

const markdownOnlyFinalized = finalizeTailoredCv({
  sourceCv: markdownOnlyGenerated,
  generatedCv: markdownOnlyGenerated,
})

assert.ok(
  markdownOnlyFinalized.resumeText.includes("Led responsible AI assessments"),
  "markdown-only CV without section headers is preserved",
)
assert.ok(
  markdownOnlyFinalized.resumeText.length > 200,
  "markdown-only CV is not emptied by section parser",
)

console.log("cv-tailor-sections tests passed")
