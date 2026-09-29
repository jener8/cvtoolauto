import assert from "node:assert/strict"
import {
  cvRoleAlignmentPromptBlock,
  cvRoleAlignmentQualityCheckBlock,
} from "../lib/cv-role-alignment-guidance"

const en = cvRoleAlignmentPromptBlock("en")
assert.match(en, /hiring company's needs/i)
assert.match(en, /Maximum 7 bullets per role/i)
assert.match(en, /Maximum 4 profile bullets/i)
assert.match(en, /Why would this company hire/i)

const de = cvRoleAlignmentPromptBlock("de")
assert.match(de, /einstellenden Unternehmens/i)

const qc = cvRoleAlignmentQualityCheckBlock("en")
assert.match(qc, /ROLE ALIGNMENT QUALITY CHECK/i)

console.log("test-cv-role-alignment-guidance: ok")
