import assert from "node:assert/strict"
import {
  extractRefineAiResponse,
  mergeBulletFragmentIntoCv,
} from "@/lib/ai-refine-response"
import { isUsableCvMarkdown } from "@/lib/ai-cv-response"

const baseline = `PROFILE
- AI governance specialist

EXPERIENCE
# AI Specialist
## CGI
### 2020 – Present
- Led responsible AI assessments

EDUCATION
# BSc Computer Science
## Example University
- Focus on machine learning`

const jsonOnly = `\`\`\`json
{
  "mode": "edit_cv",
  "summary": "Added leadership bullet",
  "changes": [],
  "updatedResume": ${JSON.stringify(baseline + "\n- Led discovery phases for responsible AI initiatives")}
}
\`\`\``

const extracted = extractRefineAiResponse(jsonOnly)
assert.ok(isUsableCvMarkdown(extracted.cvText), "structured updatedResume should parse as usable CV")

const bulletOnly = "- Led discovery phases as a leader across early discovery work"
const merged = mergeBulletFragmentIntoCv(baseline, bulletOnly)
assert.ok(merged?.includes("Led discovery phases"), "bullet fragment should merge into experience")
assert.ok(isUsableCvMarkdown(merged ?? ""), "merged CV should remain usable")

console.log("ai-refine-response tests passed")
