const JOB_TITLE_RULES_EN = `JOB TITLE RULES

- Preserve the official job title for truthfulness and verification (from source CV — never invent or replace it).
- Allow a recruiter-friendly displayed title on the # line in EXPERIENCE when it accurately reflects the work performed.
- Never invent a title the candidate did not hold.
- Displayed titles must be supported by responsibilities and evidence in that role's bullets.
- If the official title is generic or vague, translate it into a clear functional title using one of these patterns:
  • Official Title | Functional Clarifier
  • Official Title (Functional Clarification)

EXAMPLES:
Official Title: Senior UX Specialist
Displayed Title (# line): Senior UX Specialist | AI Adoption & Digital Trust

Official Title: Associate Level II
Displayed Title (# line): Associate Level II (Project Management)

NOT ALLOWED:
- Replacing the official title with a target job title the candidate never held (e.g. displaying only "AI Adoption Specialist" when the official title was "Senior UX Specialist").
- Pipe suffixes or clarifiers that are not supported by bullets under that role.

HEADLINE (professional title in contact header):
- May be more target-aligned than individual job titles, but must still be truthful and backed by experience bullets.
- Recruiters should understand the candidate's relevance within 6–8 seconds from page 1 (name, location, headline, recent # title, company, dates).`

const JOB_TITLE_RULES_DE = `BERUFSBEZEICHNUNGS-REGELN

- Offizielle Berufsbezeichnung aus dem Quell-Lebenslauf bewahren (Wahrheit und Verifizierung).
- Recruiter-freundliche angezeigte Bezeichnung in der # Zeile erlauben, wenn sie die tatsächliche Arbeit korrekt widerspiegelt.
- Nie eine Bezeichnung erfinden, die die Kandidatin nicht geführt hat.
- Angezeigte Bezeichnungen müssen durch Verantwortlichkeiten und Belege in den Stichpunkten dieser Rolle gestützt sein.
- Bei generischer offizieller Bezeichnung in eine klare Funktionsbezeichnung übersetzen:
  • Offizielle Bezeichnung | Funktionale Präzisierung
  • Offizielle Bezeichnung (Funktionale Präzisierung)

BEISPIELE:
Offiziell: Senior UX Specialist
Angezeigt (# Zeile): Senior UX Specialist | AI Adoption & Digital Trust

Offiziell: Associate Level II
Angezeigt (# Zeile): Associate Level II (Project Management)

NICHT ERLAUBT:
- Offizielle Bezeichnung durch Ziel-Stellentitel ersetzen, den die Kandidatin nie hatte.
- Pipe-Zusätze oder Klarstellungen ohne Stützung in den Stichpunkten der Rolle.

HEADLINE:
- Darf zielorientierter sein als Einzelrollen, muss aber durch Erfahrungsbelege gestützt sein.
- Relevanz für Recruiter in 6–8 Sekunden erkennbar (Name, Ort, Headline, aktuelle # Bezeichnung, Unternehmen, Daten).`

const JOB_TITLE_QUALITY_CHECK_EN = `JOB TITLE CHECK (before final output):
1. Is every official title preserved and truthful?
2. Does every displayed # title accurately reflect work performed — not a invented target title?
3. Is every pipe suffix or parenthetical clarifier supported by that role's bullets?
4. Are generic official titles clarified functionally where needed?
5. Can a recruiter grasp relevance within 6–8 seconds from page 1?`

const JOB_TITLE_QUALITY_CHECK_DE = `BERUFSBEZEICHNUNGS-PRÜFUNG (vor Ausgabe):
1. Ist jede offizielle Bezeichnung erhalten und wahr?
2. Spiegelt jede angezeigte # Bezeichnung die geleistete Arbeit wider — kein erfundener Zieltitel?
3. Ist jeder Pipe-Zusatz oder Klarstellung in den Stichpunkten der Rolle belegt?
4. Sind generische offizielle Bezeichnungen funktional präzisiert?
5. Ist die Relevanz auf Seite 1 in 6–8 Sekunden erkennbar?`

/** Job title truthfulness and displayed-title rules for CV generation. */
export function cvJobTitlePromptBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? JOB_TITLE_RULES_DE : JOB_TITLE_RULES_EN
}

/** Pre-output job title validation checklist. */
export function cvJobTitleQualityCheckBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? JOB_TITLE_QUALITY_CHECK_DE : JOB_TITLE_QUALITY_CHECK_EN
}
