import assert from "node:assert/strict"
import {
  cvSkillsAtsPromptBlock,
  cvSkillsAtsQualityCheckBlock,
} from "../lib/cv-skills-ats-guidance"
import { cvRecruiterStrategyPromptBlock } from "../lib/cv-recruiter-strategy-guidance"

const en = cvSkillsAtsPromptBlock("en")
assert.match(en, /derived from evidence/i)
assert.match(en, /unsupported keyword list/i)
assert.match(en, /Job Requirement → Candidate Evidence → Skill/i)
assert.match(en, /Do not keyword-stuff/i)
assert.match(en, /What problems they solve/i)
assert.match(en, /Where they have already demonstrated/i)

const composed = cvRecruiterStrategyPromptBlock("en")
assert.match(composed, /SKILLS & ATS RULES/i)
assert.match(composed, /JOB TITLE RULES/i)

const qc = cvSkillsAtsQualityCheckBlock("en")
assert.match(qc, /traced to a specific example/i)

console.log("test-cv-skills-ats-guidance: ok")
