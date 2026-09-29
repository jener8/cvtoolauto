/** Shared prompt rules: job description = context; candidate CV = facts. */
export const CV_FACTUAL_SOURCE_RULES_EN = `FACTUAL SOURCE RULES (mandatory):
- Job description = tailoring context and keyword source ONLY.
- Candidate CV/profile below = the ONLY factual source of truth for roles, employers, dates, and achievements.

CORRECT:
- Use relevant keywords from the job description in natural phrasing.
- Adapt wording to match the role and employer language.
- Emphasize and reorder EXISTING experience that genuinely fits the job.
- Reframe real achievements using terminology from the job description.
- Classify evidence honestly (strong / transferable / partial / gap) and never inflate weaker evidence.

INCORRECT (never do this):
- Copy job description sentences or bullet lists directly into the CV.
- Add responsibilities from the job description that the candidate has not done.
- Invent employers, job titles, dates, projects, metrics, technologies, or achievements.
- Turn familiarity into expertise, or contribution into ownership/implementation without evidence.
- Insert job-description text as a new role, employer, or experience entry.

Before each experience bullet, verify it can be traced to something in the candidate CV. If not, omit that bullet.`

export const CV_FACTUAL_SOURCE_RULES_DE = `FAKTENREGELN (verbindlich):
- Stellenbeschreibung = nur Kontext und Keyword-Quelle.
- Kandidaten-Lebenslauf unten = einzige faktenbasierte Quelle für Rollen, Arbeitgeber, Daten und Erfolge.

ERLAUBT:
- Relevante Keywords aus der Stellenbeschreibung natürlich einbauen.
- Formulierungen an Rolle und Arbeitgebersprache anpassen.
- BESTEHENDE passende Erfahrung betonen und umsortieren.
- Echte Erfolge mit Begriffen aus der Stellenbeschreibung umformulieren.
- Belege ehrlich einstufen (stark / transferierbar / teilweise / Lücke) — schwache Belege nicht aufblasen.

VERBOTEN:
- Sätze oder Aufzählungen aus der Stellenbeschreibung wörtlich übernehmen.
- Aufgaben hinzufügen, die der Kandidat nicht ausgeübt hat.
- Arbeitgeber, Titel, Daten, Projekte, Kennzahlen, Technologien oder Erfolge erfinden.
- Vertrautheit als Expertise oder Mitwirkung als Ownership/Implementierung ohne Beleg darstellen.
- Text aus der Stellenbeschreibung als neue Rolle oder Arbeitgeber einfügen.

Prüfe jede Erfahrungs-Bullet: Nur ausgeben, wenn sie auf dem Kandidaten-CV basiert.`

export function cvFactualSourceRulesBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? CV_FACTUAL_SOURCE_RULES_DE : CV_FACTUAL_SOURCE_RULES_EN
}
