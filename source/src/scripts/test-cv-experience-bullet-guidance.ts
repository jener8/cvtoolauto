import assert from "node:assert/strict"
import {
  cvExperienceBulletPromptBlock,
  cvExperienceBulletQualityCheckBlock,
} from "../lib/cv-experience-bullet-guidance"
import { cvBulletPromptBlock } from "../lib/cv-bullet-guidance"

const en = cvExperienceBulletPromptBlock("en")
assert.match(en, /problems solved, not tasks performed/i)
assert.match(en, /Problem → Action → Outcome → Transferable Capability/i)
assert.match(en, /Lead with the outcome/i)
assert.match(en, /1–2 lines maximum/i)
assert.match(en, /Operationalised/i)
assert.match(en, /Participated In, Responsible For/i)
assert.match(en, /career progression/i)

const composed = cvBulletPromptBlock("en")
assert.match(composed, /EXPERIENCE & BULLET RULES/i)
assert.match(composed, /METRIC-FIRST EXAMPLES/i)

const qc = cvExperienceBulletQualityCheckBlock("en")
assert.match(qc, /why it matters to the target employer/i)

console.log("test-cv-experience-bullet-guidance: ok")
