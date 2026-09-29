import {
  cvJobTitlePromptBlock,
  cvJobTitleQualityCheckBlock,
} from "@/lib/cv-job-title-guidance"
import {
  cvSkillsAtsPromptBlock,
  cvSkillsAtsQualityCheckBlock,
} from "@/lib/cv-skills-ats-guidance"

const RECRUITER_STRATEGY_EN = `RECRUITER-FIRST RESUME STRATEGY

CORE PRINCIPLE:
The resume must show what problems the candidate solved, how they solved them, and why that proves they can solve the target employer's problems — not merely list experience, skills, or keywords.

RESUME STRUCTURE:
- Use chronological format only (reverse-chronological experience). Never generate a functional resume.
- Never include an objective statement.
- Optimize the first page for a 6–8 second recruiter scan.
- Page 1 must clearly show: name, location, contact details, target-aligned headline, current/recent job title, company, and dates.
- Dates must never be hidden or buried — always use ### date lines under each role.
- Relevant experience must appear early (trim weak bullets in older roles; do not reorder employers out of chronology).
- Avoid walls of text. Bullets: maximum 1–2 lines where possible.
- Use clean ATS-friendly formatting (resume-builder syntax only).

OUTPUT GOAL:
Make recruiters slow down because they immediately see: who the candidate is, what role they fit, where they are located, what problems they solve, what evidence proves it, and why prior experience is relevant to this specific job.`

const RECRUITER_STRATEGY_DE = `RECRUITER-FIRST LEBENLAUF-STRATEGIE

KERNPRINZIP:
Der Lebenslauf muss zeigen, welche Probleme die Kandidatin gelöst hat, wie sie das getan hat und warum das beweist, dass sie die Probleme des Zielarbeitgebers lösen kann — nicht nur Erfahrung, Skills oder Keywords auflisten.

STRUKTUR:
- Nur chronologisches Format (Berufserfahrung reverse-chronologisch). Kein funktionaler Lebenslauf.
- Keine Objective-/Zielstatement-Abschnitte.
- Erste Seite für 6–8 Sekunden Recruiter-Scan optimieren.
- Seite 1: Name, Ort, Kontakt, zielausgerichtete Headline, aktuelle/letzte Rolle, Unternehmen, Daten.
- Daten nie verstecken — immer ### Datumszeile pro Rolle.
- Relevante Erfahrung früh sichtbar (schwache Stichpunkte in älteren Rollen kürzen; Arbeitgeber nicht aus Chronologie reißen).
- Keine Textwände. Stichpunkte: maximal 1–2 Zeilen.
- Sauberes ATS-Format (nur Resume-Builder-Syntax).

ZIEL:
Recruiter sehen sofort: Wer, welche Rolle, wo, welche Probleme gelöst, welche Belege, warum relevant für diese Stelle.`

const RECRUITER_QUALITY_CHECK_EN = `RECRUITER STRATEGY VALIDATION (before final output):
1. Are all job titles truthful and defensible (official title preserved; displayed titles accurate)?
2. Is the resume strictly chronological (no functional format)?
3. Is there no objective statement?
4. Are dates visible on every role (### lines)?
5. Does page 1 support a 6–8 second scan (name, location, contact, headline, recent role)?
6. Are all skills proven in experience, projects, certs, or education?
7. Are bullets short (1–2 lines), outcome-focused, and problem-solving oriented?
8. Does every target keyword have evidence in the resume?
9. Is there clear career progression?
10. Is the resume specific to this job — not generic?
11. Would a recruiter immediately see what problems this candidate solves?
Rewrite any section that fails.`

const RECRUITER_QUALITY_CHECK_DE = `RECRUITER-STRATEGIE VALIDIERUNG (vor Ausgabe):
1. Alle Berufsbezeichnungen wahr und vertretbar?
2. Strikt chronologisch (kein funktionaler Lebenslauf)?
3. Kein Objective-Abschnitt?
4. Daten bei jeder Rolle sichtbar?
5. Erste Seite scanbar in 6–8 Sekunden?
6. Alle Skills in Erfahrung/Ausbildung belegt?
7. Stichpunkte kurz, ergebnis- und problemorientiert?
8. Jedes Ziel-Keyword mit Beleg?
9. Klare Karriereentwicklung?
10. Spezifisch für diese Stelle?
11. Sofort erkennbar, welche Probleme gelöst werden?
Nicht erfüllte Abschnitte überarbeiten.`

/** Recruiter-first structure, titles, skills, and evidence strategy for CV generation. */
export function cvRecruiterStrategyPromptBlock(outputLanguage: "en" | "de"): string {
  const base = outputLanguage === "de" ? RECRUITER_STRATEGY_DE : RECRUITER_STRATEGY_EN
  return [
    base,
    cvJobTitlePromptBlock(outputLanguage),
    cvSkillsAtsPromptBlock(outputLanguage),
  ].join("\n\n")
}

/** Pre-output recruiter strategy validation checklist. */
export function cvRecruiterStrategyQualityCheckBlock(outputLanguage: "en" | "de"): string {
  const base = outputLanguage === "de" ? RECRUITER_QUALITY_CHECK_DE : RECRUITER_QUALITY_CHECK_EN
  return [
    base,
    cvJobTitleQualityCheckBlock(outputLanguage),
    cvSkillsAtsQualityCheckBlock(outputLanguage),
  ].join("\n\n")
}
