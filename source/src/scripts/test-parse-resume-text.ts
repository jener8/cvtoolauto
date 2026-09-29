import assert from "node:assert/strict"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { parseResumeText } from "@/lib/parse-resume-text"

const pastedFreeform = `AI Adoption | Responsible AI | Knowledge Enablement
Berlin, Germany
PROFILE - AI adoption and enablement specialist with 10+ years of experience in human-centered design.
- Led workshops across product and engineering teams`

const sections = parseResumeText(pastedFreeform)
assert.equal(sections.length, 1, "inline PROFILE header should create one section")
assert.match(sections[0].title, /PROFILE/i)
assert.ok(
  sections[0].content.some((line) => line.includes("AI adoption")),
  "profile summary should be kept",
)
assert.ok(
  sections[0].content.some((line) => line.includes("AI Adoption")),
  "keyword preamble should be kept in profile",
)

const structured = `PROFILE
- Summary bullet one

EXPERIENCE
# Product Manager
## Acme Corp
### 2020 - 2024
- Delivered outcomes`

const structuredSections = parseResumeText(structured)
assert.ok(
  structuredSections.some((s) => s.title.toUpperCase() === "EXPERIENCE"),
  "EXPERIENCE should be its own section even near the top",
)
assert.ok(
  structuredSections
    .find((s) => s.title.toUpperCase() === "EXPERIENCE")
    ?.content.some((l) => l.startsWith("# Product Manager")),
  "experience jobs should render under EXPERIENCE",
)

const customCapsSections = `PROJECTS
AI LITERACY AND ENABLEMENT ACTIVITIES
- Ran workshops for product teams

COMMUNITY BUILDING AND FACILITATION
SELECTED AI PROJECTS
# Trust by Design
## Master's Final Project
### 2024
- Researched responsible AI adoption`

const customSections = parseResumeText(customCapsSections)
assert.ok(
  customSections.some((s) => s.title === "AI LITERACY AND ENABLEMENT ACTIVITIES"),
  "custom ALL CAPS section should split from parent",
)
assert.ok(
  customSections.some((s) => s.title === "SELECTED AI PROJECTS"),
  "nested custom ALL CAPS section should become its own heading",
)
const selected = customSections.find((s) => s.title === "SELECTED AI PROJECTS")
assert.ok(
  selected?.content.some((l) => l.startsWith("# Trust by Design")),
  "project entry should live under SELECTED AI PROJECTS",
)

const pastedMarkdownHeader = `PROFILE
Summary paragraph about my work.

**EXPERIENCE**
# Product Manager
## Acme Corp
### 2020 - 2024
- Delivered outcomes`

const markdownSections = parseResumeText(pastedMarkdownHeader)
assert.ok(
  markdownSections.some((s) => s.title === "EXPERIENCE"),
  "markdown-wrapped EXPERIENCE header should still split sections",
)

const columnModifier = `KI- & FACHLICHE KENNTNISSE [columns=2]
- AI Adoption & Enablement
- AI Literacy & Training

SPRACHEN [columns=2]
- English (Native)
- German (Full Professional Proficiency)

SKILLS
- One
- Two
- Three
- Four
- Five
- Six`

const columnSections = parseResumeText(columnModifier)
const skillsSection = columnSections.find((s) => s.title === "KI- & FACHLICHE KENNTNISSE")
assert.ok(skillsSection, "custom section with column modifier should parse")
assert.equal(skillsSection?.columns, 2)
assert.ok(!skillsSection?.title.includes("[columns="), "modifier stripped from title")

const languagesSection = columnSections.find((s) => s.title === "SPRACHEN")
assert.equal(languagesSection?.columns, 2)

const legacySkills = columnSections.find((s) => s.title === "SKILLS")
assert.equal(legacySkills?.columns, undefined, "legacy sections default to single column metadata")

const jobFirstPaste = `# Digital Product & AI Adoption
## Bundesdruckerei
### April 2024 - Present
- Entwickelt AI adoption programmes

# Senior Consultant
## Bitgrip
### 2020 - 2024
- Led product discovery

EDUCATION
# M.A. Design
## University
### 2015
- Thesis`

const jobFirstSections = parseResumeText(jobFirstPaste)
assert.ok(
  jobFirstSections.some((s) => s.title === "EXPERIENCE"),
  "job-first paste should create EXPERIENCE (not one giant PROFILE)",
)
assert.ok(
  !jobFirstSections.some(
    (s) =>
      /PROFILE|PROFIL/i.test(s.title) &&
      s.content.some((line) => line.startsWith("# Digital Product")),
  ),
  "jobs must not remain nested under PROFILE",
)
assert.ok(
  jobFirstSections
    .find((s) => s.title === "EXPERIENCE")
    ?.content.some((l) => l.startsWith("# Digital Product")),
  "first job should live under EXPERIENCE",
)

const leadingBreak = `---PAGE BREAK---

PROFILE
- Summary bullet

EXPERIENCE
# Role
## Co
### 2024
- Did things`

const leadingBreakSections = parseResumeText(leadingBreak)
assert.ok(
  leadingBreakSections.some((s) => /PROFILE/i.test(s.title)),
  "leading page break should be stripped so PROFILE still parses",
)
assert.ok(
  !leadingBreakSections[0]?.content.some((l) => /PAGE BREAK/i.test(l)),
  "leading page break must not stay in the first section",
)

const proseWithExperience = `# PROFILE
Designer with 10 years of experience building products.
I have experience in human-centered design and AI enablement.

# EXPERIENCE
# Product Designer
### Acme - 2020-2024
- Led redesign`

const proseSections = parseResumeText(proseWithExperience)
const proseProfile = proseSections.find((s) => /PROFILE/i.test(s.title))
assert.ok(proseProfile, "PROFILE section should exist")
assert.ok(
  proseProfile?.content.some((line) => /years of experience building/i.test(line)),
  "profile prose containing 'experience' must stay in PROFILE, not become a section header",
)
assert.ok(
  proseProfile?.content.some((line) => /I have experience in/i.test(line)),
  "second profile sentence with 'experience' must stay in PROFILE",
)
assert.equal(
  proseSections.filter((s) => normalizeCvSectionKey(s.title) === "EXPERIENCE").length,
  1,
  "prose must not create extra EXPERIENCE sections",
)

const hashSkills = `# FÄHIGKEITEN [COLUMNS=2]
- UX Strategy
- Product Strategy
- Experience Strategy
- User Research
- Figma
- Miro
- One
- Two`

const hashSkillsSections = parseResumeText(hashSkills)
assert.ok(
  hashSkillsSections.some((s) => s.title === "FÄHIGKEITEN" && s.columns === 2),
  "# FÄHIGKEITEN [COLUMNS=2] must become a skills section with columns=2",
)
assert.ok(
  !hashSkillsSections.some((s) =>
    s.content.some((line) => /FÄHIGKEITEN/i.test(line) && /columns/i.test(line)),
  ),
  "skills heading must not remain as a job-title content line",
)

const methodenTools = `# METHODEN & TOOLS [columns=3]
- ChatGPT
- Claude
- Microsoft Copilot
- Figma
- FigJam
- Jira
- Confluence
- Miro
- Prompt Engineering`

const methodenSections = parseResumeText(methodenTools)
const methodenSection = methodenSections.find((s) => /METHODEN/i.test(s.title))
assert.ok(methodenSection, "# METHODEN & TOOLS must parse as its own section")
assert.equal(methodenSection?.columns, 3, "[columns=3] must set section.columns")
assert.ok(
  methodenSection?.content.some((line) => /ChatGPT/i.test(line)),
  "tool bullets must live under METHODEN & TOOLS",
)
assert.ok(
  !methodenSections.some((s) =>
    s.content.some((line) => /METHODEN\s*&\s*TOOLS/i.test(line) && /columns/i.test(line)),
  ),
  "METHODEN heading must not remain as a job-title content line",
)

const nestedMethoden = `# EXPERIENCE
# Role
### Co - 2024
- Did things
# METHODEN & TOOLS [columns=3]
- ChatGPT
- Claude
- Figma
- Miro
- Jira
- Confluence`

const nestedMethodenSections = parseResumeText(nestedMethoden)
assert.ok(
  nestedMethodenSections.some((s) => /METHODEN/i.test(s.title) && s.columns === 3),
  "METHODEN & TOOLS nested after a job must still become a column section",
)

console.log("parse-resume-text tests passed")
