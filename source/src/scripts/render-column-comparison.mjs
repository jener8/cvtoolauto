import { writeFileSync } from "node:fs"
import { parseResumeText } from "../lib/parse-resume-text.ts"
import { parseTwoColumnSectionItems, renderCVColumnListHtml } from "../lib/cv-two-column-section.ts"
import { formattedTextToHtml } from "../lib/resume-inline-links.ts"

const bullets = [
  "- AI Adoption & Enablement",
  "- AI Literacy & Training",
  "- Workshop Facilitation",
  "- Learning & Development",
  "- Change Management",
  "- Stakeholder Engagement",
  "- Business Process Improvement",
  "- Human-Centred AI",
  "- Responsible AI",
  "- AI Governance",
  "- Prompt Engineering",
  "- Digital Transformation",
  "- User Research",
  "- Data Analysis",
  "- ChatGPT",
  "- Claude",
  "- Microsoft Copilot",
  "- Excel",
  "- PowerPoint",
  "- Communication & Storytelling",
]

const singleColText = `KI- & FACHLICHE KENNTNISSE\n${bullets.join("\n")}`
const multiColText = `KI- & FACHLICHE KENNTNISSE [columns=2]\n${bullets.join("\n")}`

function renderSingle(lines) {
  return lines
    .map((line) => {
      const text = line.replace(/^-\s*/, "")
      return `<li style="margin:4px 0;padding-left:16px;position:relative;list-style:none;"><span style="position:absolute;left:0;">•</span>${formattedTextToHtml(text)}</li>`
    })
    .join("")
}

const singleSection = parseResumeText(singleColText)[0]
const multiSection = parseResumeText(multiColText)[0]
const items = parseTwoColumnSectionItems(multiSection.content)
const multiHtml = renderCVColumnListHtml(items, 2, {
  symbol: "•",
  color: "#000",
  size: "1em",
  bulletMargin: 4,
  bulletIndent: 16,
  lineHeight: 1.5,
  fontSize: 13,
  linkColor: "#2e5f5f",
})

const css = `
body { font-family: Inter, sans-serif; background:#efefeb; padding:24px; display:flex; gap:24px; }
.panel { background:#fff; width:380px; padding:24px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
h3 { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#666; margin:0 0 8px; }
h2 { font-size:14px; font-weight:bold; text-transform:uppercase; border-bottom:2px solid #2e5f5f; padding-bottom:6px; margin:0 0 12px; }
.cv-column-list { column-count:1; column-gap:16px; padding:0; margin:0; }
.cv-column-list--cols-2 { column-count:2; }
.cv-column-list__item { break-inside:avoid; }
`

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Column layout comparison</title><style>${css}</style></head><body>
<div class="panel"><h3>Before — single column</h3><h2>${singleSection.title}</h2><ul style="padding:0;margin:0;">${renderSingle(singleSection.content)}</ul></div>
<div class="panel"><h3>After — [columns=2]</h3><h2>${multiSection.title}</h2><p style="font-size:11px;color:#888;margin:-8px 0 12px;">Heading syntax: KI- &amp; FACHLICHE KENNTNISSE [columns=2]</p>${multiHtml}</div>
</body></html>`

const out = "/tmp/cv-column-comparison.html"
writeFileSync(out, html)
console.log(out)
