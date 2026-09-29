import {
  CHATGPT_INLINE_LINK_RULES_DE,
  CHATGPT_INLINE_LINK_RULES_EN,
} from "@/lib/resume-inline-links"

const STRUCTURE_EN = `PROFILE
- Brief professional summary points

EXPERIENCE
# Job Title
## Company Name, Location
### Month Year – Month Year
- Achievement or responsibility

EDUCATION
# Degree Name
## University Name
### Year – Year
- Optional achievement

SKILLS
- Skill category or individual skills

LANGUAGES
- Language (Level)`

const STRUCTURE_DE = `PROFIL
- Kurze berufliche Kernpunkte

BERUFSERFAHRUNG
# Berufsbezeichnung
## Unternehmen, Ort
### Monat Jahr – Monat Jahr
- Erfolg oder Aufgabe

AUSBILDUNG
# Abschluss / Studiengang
## Hochschule / Institution
### Jahr – Jahr
- Optionaler Hinweis

FÄHIGKEITEN
- Kompetenzen oder Kategorien

SPRACHEN
- Sprache (Niveau)`

/** Prompt to convert plain/PDF-extracted CV text into resume-builder syntax without changing facts. */
export function buildFormatImportedCvPrompt(
  rawCvText: string,
  outputLanguage: "en" | "de",
  applicationContext?: {
    targetRole?: string
    targetCompany?: string
    professionalTitle?: string
  },
): string {
  const structure = outputLanguage === "de" ? STRUCTURE_DE : STRUCTURE_EN
  const linkRules =
    outputLanguage === "de" ? CHATGPT_INLINE_LINK_RULES_DE : CHATGPT_INLINE_LINK_RULES_EN

  const applicationRules =
    applicationContext?.targetRole || applicationContext?.targetCompany
      ? `
APPLICATION CONTEXT (this CV is being imported for a specific job application):
- Target role: ${applicationContext.targetRole || "(not set)"}
- Target company: ${applicationContext.targetCompany || "(not set)"}
${applicationContext.professionalTitle ? `- Professional title (header only): ${applicationContext.professionalTitle}` : ""}
- The target role and target company are NOT work experience — do NOT put them under EXPERIENCE.
- Do NOT create a job entry for the target company with "Present" unless it is clearly past employment at that employer.
- Professional title / target role lines belong in PROFILE as - bullets or in the contact/header area, never as # job titles under EXPERIENCE.
`
      : ""

  return `You are a CV formatting assistant. Your ONLY job is to restructure imported CV text into the resume-builder syntax shown below.

CRITICAL RULES:
- Do NOT change, invent, or omit any facts, dates, employers, job titles, skills, or achievements.
- Do NOT tailor or rewrite content for a job — preserve the original wording as much as possible.
- Only fix structure: add # ## ### prefixes, section headers, and bullet markers where appropriate.
- Section headers must be ALL CAPS without a # prefix (e.g. PROFILE, EXPERIENCE, EDUCATION).
- Job titles use # prefix; company + location use ##; date ranges use ###.
- Achievement and list lines use - prefix.
- ${linkRules}

PDF / IMPORT ORDER (very important):
- Keep the canonical section order: PROFILE → EXPERIENCE → EDUCATION → SKILLS → LANGUAGES (and other sections after).
- PROFILE must contain the professional summary bullets/text — do NOT leave PROFILE empty while placing that content under EXPERIENCE.
- PROFILE content must use - bullet lines only. Never use # for profile summary sentences.
- Sentences like "Experienced in…", "Skilled in…", "Proven track record…" belong in PROFILE as - bullets, NOT as # job titles under EXPERIENCE.
- Each EXPERIENCE role must be grouped: # title, then ## company/location, then ### dates, then - bullets for that role only.
- Only real job titles use # — short role names like "Associate Specialist" or "Senior Engineer", followed by company and dates.
- EDUCATION entries belong under EDUCATION, not EXPERIENCE. Use # degree, ## institution, ### dates.
- SKILLS and LANGUAGES must be in their own sections — never mixed into experience bullets.
- Do not output a section heading unless content for that section immediately follows.
- If PDF text order is jumbled, reorder content into the correct section using meaning — not visual order.
${applicationRules}

Return ONLY the formatted CV inside ONE markdown code block (triple backticks).
No commentary, JSON, or chat text outside the code block.

TARGET SYNTAX (example structure):
${structure}

IMPORTED CV TEXT (restructure this — do not change facts):
${rawCvText.trim()}`
}

export const FORMAT_IMPORTED_CV_RETRY_SUFFIX = `

CRITICAL OUTPUT RULES (override everything above):
- Return ONLY the formatted CV inside ONE markdown code block (triple backticks).
- Do NOT return JSON, analysis, chat text, or commentary outside the code block.
- Use # for job titles, ## for companies, ### for dates, - for bullets.
- Section headers in ALL CAPS without # prefix (e.g. PROFILE, EXPERIENCE).
- Preserve all original facts — formatting only, no rewriting.`
