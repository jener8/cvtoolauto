import assert from "node:assert/strict"
import {
  cvJobTitlePromptBlock,
  cvJobTitleQualityCheckBlock,
} from "../lib/cv-job-title-guidance"
import { cvRecruiterStrategyPromptBlock } from "../lib/cv-recruiter-strategy-guidance"

const en = cvJobTitlePromptBlock("en")
assert.match(en, /Preserve the official job title/i)
assert.match(en, /Senior UX Specialist \| AI Adoption & Digital Trust/i)
assert.match(en, /Associate Level II \(Project Management\)/i)
assert.match(en, /Never invent a title/i)
assert.match(en, /6–8 seconds/i)

const composed = cvRecruiterStrategyPromptBlock("en")
assert.match(composed, /JOB TITLE RULES/i)
assert.match(composed, /Associate Level II \(Project Management\)/i)

const qc = cvJobTitleQualityCheckBlock("en")
assert.match(qc, /pipe suffix or parenthetical clarifier/i)

console.log("test-cv-job-title-guidance: ok")
