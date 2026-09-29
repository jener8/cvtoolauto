/**
 * Regression tests for resume-builder syntax extraction (no API calls).
 * Run: node scripts/test-cv-parser.mjs
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Load compiled TS via tsx alternative: inline the test by importing built module won't work.
// Use dynamic import of the source through a minimal inline copy for CI-free testing.

const SAMPLE_CV = `PROFILE
- Senior product designer with 10+ years experience

EXPERIENCE
# Product Designer
## Acme Corp, Berlin
### Jan 2020 – Present
- Led redesign increasing conversion by 25%
- Collaborated with engineering on design system

EDUCATION
# B.A. Design
## State University
### 2010 – 2014
- Graduated with honours

SKILLS
- Figma
- UX Research
- Design Systems`

const SAMPLE_WITH_FENCE = `Here is your tailored CV:

\`\`\`markdown
${SAMPLE_CV}
\`\`\`

Let me know if you'd like any changes!`

const SAMPLE_JSON_TRAP = `\`\`\`json
{"summary":"test","whatWorked":[]}
\`\`\`

\`\`\`markdown
${SAMPLE_CV}
\`\`\``

const SAMPLE_CHAT_ONLY = `Here is your tailored CV based on the job description. I've highlighted your relevant experience and incorporated keywords naturally.`

// Minimal inline implementations mirroring lib/ai-cv-response.ts for standalone test
function looksLikeJson(text) {
  const t = text.trim()
  if (!t.startsWith("{") && !t.startsWith("[")) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return t.includes('"whatWorked"')
  }
}

function cleanupCvMarkdown(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim()
}

function extractCodeFenceBlocks(raw) {
  const blocks = []
  const re = /```(?:markdown|md|text|txt)?\s*\n?([\s\S]*?)```/gi
  let match
  while ((match = re.exec(raw)) !== null) {
    const body = match[1]?.trim()
    if (body) blocks.push(body)
  }
  return blocks
}

function scoreCvCandidate(text) {
  const t = cleanupCvMarkdown(text)
  if (!t || looksLikeJson(t)) return -100
  let score = 0
  if (/^#\s+.+/m.test(t)) score += 3
  if (/^##\s+.+/m.test(t)) score += 3
  if (/^-\s/m.test(t)) score += Math.min((t.match(/^-\s/gm) ?? []).length, 10)
  return score
}

function extractBest(raw) {
  const fences = extractCodeFenceBlocks(raw)
  const candidates = fences.filter((b) => !looksLikeJson(b))
  if (candidates.length === 0) candidates.push(raw)
  let best = ""
  let bestScore = -Infinity
  for (const c of candidates) {
    const s = scoreCvCandidate(c)
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return cleanupCvMarkdown(best)
}

function isUsable(text) {
  const t = cleanupCvMarkdown(text)
  if (!t || looksLikeJson(t) || t.length < 60) return false
  const hasHeading = /^#\s+.+/m.test(t)
  const hasCompany = /^##\s+.+/m.test(t)
  const hasSection = /^(PROFILE|EXPERIENCE)/m.test(t)
  const bullets = (t.match(/^-\s/gm) ?? []).length
  return (hasHeading && (hasCompany || hasSection) && bullets >= 1) || (hasSection && bullets >= 2)
}

const cases = [
  { name: "raw resume syntax", input: SAMPLE_CV, expectUsable: true },
  { name: "fenced with chat wrapper", input: SAMPLE_WITH_FENCE, expectUsable: true },
  { name: "json fence then resume fence", input: SAMPLE_JSON_TRAP, expectUsable: true },
  { name: "chat only (no resume)", input: SAMPLE_CHAT_ONLY, expectUsable: false },
]

let passed = 0
let failed = 0

for (const c of cases) {
  const extracted = extractBest(c.input)
  const usable = isUsable(extracted)
  const ok = usable === c.expectUsable
  if (ok) {
    passed++
    console.log(`✓ ${c.name}`)
  } else {
    failed++
    console.error(`✗ ${c.name} — expected usable=${c.expectUsable}, got ${usable}`)
    console.error(`  preview: ${extracted.slice(0, 80)}...`)
  }
}

// Verify prompt file contains resume-only instructions
const promptPath = join(__dirname, "../lib/tailored-cv-prompt.ts")
const promptSrc = readFileSync(promptPath, "utf8")
if (promptSrc.includes("NOT a chat assistant") && promptSrc.includes("JSON")) {
  console.log("✓ tailored-cv-prompt has resume-only output rules")
  passed++
} else {
  console.error("✗ tailored-cv-prompt missing resume-only output rules")
  failed++
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
