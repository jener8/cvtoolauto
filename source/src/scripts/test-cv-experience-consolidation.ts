import assert from "node:assert/strict"
import {
  ensureExperienceEntriesHaveBullets,
  isConsolidateExperienceInstruction,
  splitEmployerNames,
} from "../lib/cv-experience-consolidation"

assert.equal(isConsolidateExperienceInstruction("compress these earlier roles"), true)
assert.equal(isConsolidateExperienceInstruction("make it shorter"), false)

assert.deepEqual(splitEmployerNames("## Framestore, Disney & Berliner Film"), [
  "Framestore",
  "Disney",
  "Berliner Film",
])

const source = `EXPERIENCE
# Computer Visual Effects, Digital Operator
## Framestore, London Soho
### February 2001 - August 2002
- Created motion digital artistry for feature films
# On-Set Computer Visual-Effects Production Assistant
## The Walt Disney Company, Berlin Area, Germany
### June 2004 - August 2004
- Assisted with visual effects for Around the World in 80 Days

EDUCATION
# BSc Design`

const hollowMerge = `EXPERIENCE
# Digital Media & Visual Storytelling
## Framestore, The Walt Disney Company & Berliner Film Companie
### 2001–2006

EDUCATION
# BSc Design`

const repaired = ensureExperienceEntriesHaveBullets(hollowMerge, source)
assert.match(repaired, /^- /m, "repaired entry should include bullets")
assert.ok(
  (repaired.match(/^- /gm) ?? []).length >= 2,
  "consolidated entry should have at least 2 bullets",
)

console.log("test-cv-experience-consolidation: ok")
