import assert from "node:assert/strict"
import { COMBINED_PROMPT } from "../lib/tailored-cv-prompt"
import {
  cvResumeWizardWorkflowPromptBlock,
  cvResumeWizardWorkflowQualityCheckBlock,
} from "../lib/cv-resume-wizard-workflow"
import { cvResumeFormattingPromptBlock } from "../lib/cv-resume-formatting-guidance"

const workflow = cvResumeWizardWorkflowPromptBlock("en")
assert.match(workflow, /ADDITIVE LAYER/i)
assert.match(workflow, /must NOT replace or weaken existing Resume Wizard behaviour/i)
assert.match(workflow, /PRESERVE EXISTING WIZARD BEHAVIOUR/i)
assert.match(workflow, /Do not discard existing resume generation/i)
assert.match(workflow, /ENHANCEMENT 1: EMPLOYER PROBLEM ANALYSIS/i)
assert.match(workflow, /Employer Need → User Evidence → Resume Content/i)
assert.match(workflow, /ENHANCEMENT 3: ROLE TRANSLATION/i)
assert.match(workflow, /Apply the Job Title Rules/i)
assert.match(workflow, /ENHANCEMENT 5: EVIDENCE-BASED SKILLS/i)
assert.match(workflow, /goal is not to replace the existing wizard/i)

const prompt = COMBINED_PROMPT("Product Manager role", "Jane Doe\nEXPERIENCE\n# Analyst", "en")
assert.match(prompt, /RESUME WIZARD GENERATION WORKFLOW \(ADDITIVE LAYER\)/i)
assert.match(prompt, /ADDITIVE ENHANCEMENTS/i)
assert.match(prompt, /JOB TITLE RULES/i)
assert.match(prompt, /EXPERIENCE & BULLET RULES/i)
assert.match(prompt, /SKILLS & ATS RULES/i)
assert.match(prompt, /RESUME FORMATTING RULES/i)
assert.doesNotMatch(prompt, /STEP 1: TAILOR MY CV/i)

const qc = cvResumeWizardWorkflowQualityCheckBlock("en")
assert.match(qc, /ADDITIVE LAYER CHECK/i)
assert.match(qc, /existing wizard behaviour preserved/i)

const formatting = cvResumeFormattingPromptBlock("en")
assert.match(formatting, /FORMATTING SYNTAX/i)

console.log("test-cv-resume-wizard-workflow: ok")
