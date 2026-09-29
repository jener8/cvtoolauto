import { cvBulletPromptBlock, cvBulletQualityCheckBlock } from "@/lib/cv-bullet-guidance"
import {
  cvCareerOptimisationPromptBlock,
  cvCareerOptimisationQualityCheckBlock,
} from "@/lib/cv-career-optimisation-guidance"
import {
  cvRecruiterStrategyPromptBlock,
  cvRecruiterStrategyQualityCheckBlock,
} from "@/lib/cv-recruiter-strategy-guidance"
import {
  cvRoleAlignmentPromptBlock,
  cvRoleAlignmentQualityCheckBlock,
} from "@/lib/cv-role-alignment-guidance"
import { cvFactualSourceRulesBlock } from "@/lib/cv-factual-guidance"
import { cvResumeFormattingPromptBlock } from "@/lib/cv-resume-formatting-guidance"
import {
  cvResumeWizardWorkflowPromptBlock,
  cvResumeWizardWorkflowQualityCheckBlock,
} from "@/lib/cv-resume-wizard-workflow"
import { formatStrategicProfilePromptBlock } from "@/lib/strategic-profile-prompt"
import type { StrategicProfile } from "@/lib/strategic-profile"

const GERMAN_CV_SECTION_HEADINGS_RULE =
  "Verwende ausschließlich deutsche Abschnittsüberschriften im Lebenslauf, z. B. Profil, Berufserfahrung, Ausbildung, Fähigkeiten, Projekte, Zertifikate und Sprachen."

const COMBINED_PROMPT_STRUCTURE_EN = `STRUCTURE:
PROFILE
- Brief professional summary points

EXPERIENCE
# Senior UX Specialist | AI Adoption & Digital Trust
## Company Name, Location
### Month Year – Month Year
- Enabled cross-functional teams to adopt responsible AI by translating governance requirements into design activities, resulting in clearer delivery decisions across regulated services

EDUCATION
# Degree Name
## University Name
### Year – Year
- Optional achievement

SKILLS
- Skill category or individual skills

LANGUAGES
- Language (Level)`

const COMBINED_PROMPT_STRUCTURE_DE = `STRUKTUR (nur deutsche Abschnittsüberschriften — ALL CAPS wie unten, keine englischen Titel wie Education oder Skills):
PROFIL
- Kurze berufliche Kernpunkte (alternativ: eigener Abschnitt ZUSAMMENFASSUNG)

BERUFSERFAHRUNG
# Berufsbezeichnung
## Unternehmen, Ort
### Monat Jahr – Monat Jahr
- 400+ Usability-Tests in Behörden-Digitaldiensten durchgeführt und evidenzbasierte Produktentscheidungen unterstützt

AUSBILDUNG
# Abschluss / Studiengang
## Hochschule / Institution
### Jahr – Jahr
- Optionaler Hinweis

FÄHIGKEITEN
- Kompetenzen oder Kategorien

PROJEKTE
# Projektname
## Kontext oder Organisation
### Monat Jahr – Monat Jahr
- Ergebnis oder Rolle

ZERTIFIKATE
- Zertifikat (Anbieter, Jahr)

SPRACHEN
- Sprache (Niveau)`

/** Prompt used for tailored CV generation (shared by wizard + server action). */
export const COMBINED_PROMPT = (
  jobDescription: string,
  cvContent: string,
  outputLanguage: "en" | "de",
  strategicProfile?: StrategicProfile | null,
) => `You are an AI career and CV optimisation assistant — an advisor and editor that returns a tailored resume.

Return ONLY the tailored CV in the custom resume-builder syntax below.
Do NOT return explanations, analysis, chat responses, JSON, or commentary before or after the CV.
(Perform vacancy analysis, evidence matching, positioning, and quality checks silently before writing.)

Use the existing CV as the ONLY factual source for employers, roles, dates, achievements, projects, and skills.
Use the job description ONLY for tailoring context and keyword optimization — never as a source of facts.

OUTPUT LANGUAGE (CV + COVER LETTER): ${outputLanguage === "de" ? "GERMAN (Deutsch)" : "ENGLISH"}
- The entire CV content MUST be written in ${outputLanguage === "de" ? "German" : "English"}.
- Section headers must be in ${
  outputLanguage === "de"
    ? "German only. Map common English titles to German: Profile→Profil (PROFIL), Experience / Work Experience→Berufserfahrung (BERUFSERFAHRUNG), Education→Ausbildung (AUSBILDUNG), Skills→Fähigkeiten (FÄHIGKEITEN), Projects→Projekte (PROJEKTE), Certifications→Zertifikate (ZERTIFIKATE), Languages→Sprachen (SPRACHEN), Summary→Zusammenfassung (ZUSAMMENFASSUNG), Contact→Kontakt (KONTAKT). Do not output English section headings such as Education, Experience, Skills, Profile, Projects, Certifications, Languages, Summary, or Contact."
    : "English, for example: PROFILE, EXPERIENCE, EDUCATION, SKILLS, LANGUAGES"
}.
${
  outputLanguage === "de"
    ? `- ${GERMAN_CV_SECTION_HEADINGS_RULE}
`
    : ""
}- All descriptions, bullet points, and content must be in ${outputLanguage === "de" ? "German" : "English"}.

${cvFactualSourceRulesBlock(outputLanguage)}

${cvCareerOptimisationPromptBlock(outputLanguage)}

${cvResumeWizardWorkflowPromptBlock(outputLanguage)}

ADDITIVE ENHANCEMENTS (apply on top of existing wizard logic — do not replace source-CV learning, formatting, or ATS behaviour):
${cvRecruiterStrategyPromptBlock(outputLanguage)}

${cvRoleAlignmentPromptBlock(outputLanguage)}

${cvBulletPromptBlock(outputLanguage)}

LENGTH (2 A4 PAGES):
- The finished CV must fit on exactly 2 A4 pages when rendered in the resume builder — do not make it too long.
- Keep sections tight: fewer bullets per role, shorter profile points, and only the most relevant entries.
- If content is still too long, shorten bullets and remove the least relevant older roles or details.

SKILLS:
- List at most 20 skill items total across the skills section (count each bullet or comma-separated skill as one item).

QUALITY CHECK BEFORE FINAL OUTPUT
${cvCareerOptimisationQualityCheckBlock(outputLanguage)}

${cvResumeWizardWorkflowQualityCheckBlock(outputLanguage)}

${cvRecruiterStrategyQualityCheckBlock(outputLanguage)}

${cvRoleAlignmentQualityCheckBlock(outputLanguage)}

${cvBulletQualityCheckBlock(outputLanguage)}

FORMAT THE OUTPUT
${cvResumeFormattingPromptBlock(outputLanguage)}

${outputLanguage === "de" ? COMBINED_PROMPT_STRUCTURE_DE : COMBINED_PROMPT_STRUCTURE_EN}
${formatStrategicProfilePromptBlock(strategicProfile, outputLanguage)}

---

JOB DESCRIPTION (tailoring context and keywords only — not a factual source):
${jobDescription.trim() || "[PASTE JOB DESCRIPTION HERE]"}

MY CURRENT CV (factual source of truth — all roles, employers, dates, and achievements must come from here):
${cvContent.trim() || "[PASTE YOUR CV CONTENT HERE]"}`
