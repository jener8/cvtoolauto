/**
 * Run: node scripts/test-cv-tailor-sections.mjs
 */

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const EXPERIENCE_SECTION_MARKERS = new Set([
  "experience",
  "work experience",
  "professional experience",
  "employment",
])

const STOPWORDS = new Set(["with", "and", "the", "for", "from", "that", "this"])

function significantTokens(text) {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  )
}

function tokenOverlapRatio(a, b) {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / Math.min(a.size, b.size)
}

function isSectionHeader(line) {
  const t = line.trim()
  if (!t || /^#{1,3}\s/.test(t) || /^-\s/.test(t)) return false
  return /^[A-Z][A-Z0-9\s/&-]{2,}$/.test(t)
}

function experienceSectionKey(line) {
  const key = normalizeText(line)
  for (const marker of EXPERIENCE_SECTION_MARKERS) {
    if (key === marker || key.startsWith(`${marker} `)) return true
  }
  return false
}

function validateAndSanitize(sourceCv, generatedCv) {
  const sourceCompanies = sourceCv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim())

  const sourceBullets = sourceCv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())

  const sourceHasStructuredCompanies = sourceCompanies.length > 0
  const sourceHasStructuredBullets = sourceBullets.length > 0

  const generatedCompanies = generatedCv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim())

  const unknownEmployers = sourceHasStructuredCompanies
    ? generatedCompanies.filter(
        (g) => !sourceCompanies.some((s) => g.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(g.toLowerCase())),
      )
    : []

  let activeSection = "none"
  const output = []

  for (const raw of generatedCv.split("\n")) {
    const trimmed = raw.trim()
    if (trimmed && isSectionHeader(trimmed)) {
      activeSection = experienceSectionKey(trimmed) ? "experience" : "other"
      output.push(raw)
      continue
    }
    if (activeSection === "experience" && trimmed.startsWith("- ") && sourceHasStructuredBullets) {
      const bullet = trimmed.slice(2).trim()
      const bulletTokens = significantTokens(bullet)
      let maxOverlap = 0
      for (const sourceBullet of sourceBullets) {
        maxOverlap = Math.max(maxOverlap, tokenOverlapRatio(bulletTokens, significantTokens(sourceBullet)))
      }
      if (maxOverlap < 0.22) continue
    }
    output.push(raw)
  }

  return {
    sanitized: output.join("\n"),
    unknownEmployers,
    keptBullets: output.filter((l) => l.trim().startsWith("- ")).length,
  }
}

const linkedInSource = `PROFILE
- AI governance specialist with 10 years experience

EXPERIENCE
AI Specialist at CGI
- Led responsible AI assessments for enterprise clients
- Built governance frameworks across teams

EDUCATION
Bachelor of Science in Computer Science
University of Example
- Focus on machine learning`

const aiGenerated = `PROFILE
- Responsible AI leader with governance expertise

EXPERIENCE

# AI Specialist
## CGI UK
### 2020 – Present
- Led responsible AI assessments for enterprise clients
- Built governance frameworks across teams

EDUCATION

# Bachelor of Science in Computer Science
## University of Example
### 2014 – 2018
- Focus on machine learning

SKILLS
- AI Governance
- Responsible AI

LANGUAGES
- English (Fluent)`

const result = validateAndSanitize(linkedInSource, aiGenerated)
const pass = result.keptBullets >= 2 && result.unknownEmployers.length === 0

console.log(pass ? "✓ unstructured source keeps generated bullets" : "✗ bullets were stripped")
console.log(" kept bullets:", result.keptBullets)
console.log(" unknown employers:", result.unknownEmployers)
process.exit(pass ? 0 : 1)
