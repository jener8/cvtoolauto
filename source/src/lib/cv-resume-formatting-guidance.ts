import {
  CHATGPT_INLINE_LINK_RULES_DE,
  CHATGPT_INLINE_LINK_RULES_EN,
} from "@/lib/resume-inline-links"
import {
  CHATGPT_PAGE_BREAK_RULES_DE,
  CHATGPT_PAGE_BREAK_RULES_EN,
} from "@/lib/resume-page-breaks"

const RESUME_FORMATTING_RULES_EN = `RESUME FORMATTING RULES

FORMATTING SYNTAX:
# Text = Job Title or Degree Name
## Text = Company or Institution Name
### Text = Date Range / Duration
- Text = Bullet Point Item
[Link Text](https://example.com) = Inline hyperlink (http://, https://, or mailto: only)

${CHATGPT_INLINE_LINK_RULES_EN}

${CHATGPT_PAGE_BREAK_RULES_EN}

RULES:
- Section headers in ALL CAPS without markdown prefixes (e.g. PROFILE, EXPERIENCE, EDUCATION).
- Each job/education entry: # title, ## company, ### dates, then - bullets.
- Every experience entry MUST include at least 2 bullet points (- lines). Never output a job with only title, company, and dates.
- Keep ALL experience and education entries from the source CV — reword bullets for relevance but never delete entire roles, degrees, employers, institutions, or date lines.
- If the source CV uses plain text instead of # / ## markers, preserve every role and education entry using proper resume-builder syntax.
- When compressing or merging multiple roles into one entry: use one # title, ## combined employers, ### spanning dates, then 2–4 bullets synthesizing facts from all merged roles.
- No bold markdown or other markdown. Use only #, ##, ###, -, ---PAGE BREAK---, and inline links [Label](url).
- Output the entire CV in a single markdown code block (triple backticks) with resume-builder syntax only — no intro text, analysis, or JSON outside the block.`

const RESUME_FORMATTING_RULES_DE = `LEBENLAUF-FORMATIERUNGSREGELN

SYNTAX:
# Text = Berufsbezeichnung oder Abschluss
## Text = Unternehmen oder Institution
### Text = Datumsbereich
- Text = Stichpunkt
[Linktext](https://example.com) = Inline-Link (nur http://, https://, mailto:)

${CHATGPT_INLINE_LINK_RULES_DE}

${CHATGPT_PAGE_BREAK_RULES_DE}

REGELN:
- Abschnittsüberschriften in GROSSBUCHSTABEN ohne Markdown-Präfix (z. B. PROFIL, BERUFSERFAHRUNG, AUSBILDUNG).
- Jede Rolle/Ausbildung: # Titel, ## Unternehmen, ### Daten, dann - Stichpunkte.
- Jede Berufserfahrung mindestens 2 Stichpunkte (- Zeilen).
- Alle Rollen und Ausbildungen aus dem Quell-Lebenslauf behalten — Stichpunkte umformulieren, aber keine Einträge löschen.
- Bei Zusammenführung mehrerer Rollen: ein # Titel, ## kombinierte Arbeitgeber, ### Datumsbereich, 2–4 Stichpunkte.
- Kein Fettdruck oder anderes Markdown. Nur #, ##, ###, -, ---PAGE BREAK--- und [Label](url).
- Gesamten Lebenslauf in einem Markdown-Codeblock (drei Backticks) ausgeben — nur Resume-Builder-Syntax, kein Begleittext.`

/** Resume-builder syntax and output formatting rules for CV generation. */
export function cvResumeFormattingPromptBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? RESUME_FORMATTING_RULES_DE : RESUME_FORMATTING_RULES_EN
}
