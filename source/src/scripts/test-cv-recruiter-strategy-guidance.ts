import assert from "node:assert/strict"
import {
  cvRecruiterStrategyPromptBlock,
  cvRecruiterStrategyQualityCheckBlock,
} from "../lib/cv-recruiter-strategy-guidance"

const en = cvRecruiterStrategyPromptBlock("en")
assert.match(en, /JOB TITLE RULES/i)
assert.match(en, /SKILLS & ATS RULES/i)
assert.match(en, /chronological format only/i)

const qc = cvRecruiterStrategyQualityCheckBlock("en")
assert.match(qc, /6–8 second/i)
assert.match(qc, /chronological/i)

console.log("test-cv-recruiter-strategy-guidance: ok")
