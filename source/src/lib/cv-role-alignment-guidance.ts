const ROLE_ALIGNMENT_RULES_EN = `ROLE ALIGNMENT RULES

Do not optimize the CV around the candidate's current or past job title.
Optimize around the hiring company's needs and the target role in the job description.

BEFORE WRITING:
1. Extract the top 10 capabilities requested by the job description.
2. Rank all candidate evidence by relevance to those capabilities.
3. Surface the strongest evidence first within each role (reorder bullets, not employers). Keep experience in reverse-chronological order.
4. Minimize experience, bullets, and skills that do not support the target role.

BULLET WRITING (role-fit lens):
- Every bullet must answer: "Why does this make the candidate suitable for this role?"
- Prefer outcomes over responsibilities.
- Prefer evidence over claims.
- Prefer numbers over adjectives.
- Prefer business impact over activities.

WEAK: "Conducted user research."
BETTER: "Conducted 400+ usability studies that informed service decisions across citizen-facing digital services."

WEAK: "Facilitated workshops."
BETTER: "Facilitated 50+ workshops aligning government stakeholders, engineers, accessibility experts, and product teams."

STRONG: "Delivered AI literacy workshops helping multidisciplinary teams adopt AI tools responsibly within a regulated environment."

DENSITY LIMITS:
- Maximum 7 bullets per role.
- Maximum 4 profile bullets.

REDUNDANCY:
- Avoid repeating the same capability in Profile, Skills, Achievements, and Experience.
- If a capability already appears strongly in Experience, do not repeat it elsewhere unless it is a key differentiator for this application.

FINAL TEST:
The CV must answer: "Why would this company hire this person instead of another qualified candidate?"`

const ROLE_ALIGNMENT_RULES_DE = `ROLLEN-AUSRICHTUNG

Den Lebenslauf nicht um die bisherige Berufsbezeichnung der Kandidatin optimieren.
Stattdessen um die Bedürfnisse des einstellenden Unternehmens und die Zielrolle in der Stellenbeschreibung ausrichten.

VOR DEM SCHREIBEN:
1. Die 10 wichtigsten geforderten Kompetenzen aus der Stellenbeschreibung extrahieren.
2. Alle Belege der Kandidatin nach Relevanz zu diesen Kompetenzen ordnen.
3. Stärkste Belege zuerst innerhalb jeder Rolle (Stichpunkte umsortieren, nicht Arbeitgeber). Berufserfahrung reverse-chronologisch belassen.
4. Erfahrung, Stichpunkte und Fähigkeiten minimieren, die die Zielrolle nicht stützen.

STICHPUNKTE (Rollen-Fit):
- Jeder Stichpunkt muss beantworten: „Warum macht das die Kandidatin für diese Rolle geeignet?"
- Ergebnisse vor Aufgaben.
- Belege vor Behauptungen.
- Zahlen vor Adjektiven.
- Geschäftswirkung vor Aktivitäten.

SCHWACH: „Nutzerforschung durchgeführt."
BESSER: „400+ Usability-Studien durchgeführt, die Service-Entscheidungen in behördlichen Digitaldiensten informierten."

SCHWACH: „Workshops moderiert."
BESSER: „50+ Workshops mit Behörden-Stakeholdern, Ingenieurteams, Accessibility-Expertinnen und Produktteams durchgeführt."

STARK: „KI-Literacy-Workshops für multidisziplinäre Teams in regulierten Umgebungen durchgeführt."

DICHTE:
- Maximal 7 Stichpunkte pro Rolle.
- Maximal 4 Stichpunkte im Profil.

REDUNDANZ:
- Dieselbe Kompetenz nicht in Profil, Fähigkeiten, Erfolgen und Berufserfahrung wiederholen.
- Erscheint eine Kompetenz bereits stark in der Berufserfahrung, woanders nur wiederholen, wenn sie ein zentrales Alleinstellungsmerkmal ist.

ABSCHLUSSPRÜFUNG:
Der Lebenslauf muss beantworten: „Warum würde dieses Unternehmen diese Person statt einer anderen qualifizierten Kandidatin einstellen?"`

const ROLE_ALIGNMENT_QUALITY_CHECK_EN = `ROLE ALIGNMENT QUALITY CHECK (before final output):
1. Is the CV optimized for the employer's top capabilities — not the candidate's job title?
2. Are the strongest, most relevant evidence bullets placed first within each role?
3. Is weaker or irrelevant experience minimized or shortened?
4. Does every bullet show suitability for the target role (outcome/evidence/impact)?
5. Are there ≤7 bullets per role and ≤4 profile bullets?
6. Are capabilities not duplicated across Profile, Skills, Achievements, and Experience without reason?
7. Would a hiring manager clearly see why this candidate over another qualified applicant?
Rewrite any section that fails this check.`

const ROLE_ALIGNMENT_QUALITY_CHECK_DE = `ROLLEN-AUSRICHTUNG QUALITÄTSPRÜFUNG (vor der endgültigen Ausgabe):
1. Ist der Lebenslauf auf die Top-Kompetenzen des Arbeitgebers ausgerichtet — nicht auf die bisherige Berufsbezeichnung?
2. Stehen die stärksten, relevantesten Belege in jeder Rolle oben?
3. Ist schwächere oder irrelevante Erfahrung gekürzt oder minimiert?
4. Zeigt jeder Stichpunkt Eignung für die Zielrolle (Ergebnis/Beleg/Wirkung)?
5. ≤7 Stichpunkte pro Rolle und ≤4 Profil-Stichpunkte?
6. Werden Kompetenzen nicht sinnlos zwischen Profil, Fähigkeiten, Erfolgen und Berufserfahrung wiederholt?
7. Erkennt ein Hiring Manager klar, warum diese Kandidatin statt einer anderen qualifizierten Person?
Nicht erfüllte Abschnitte überarbeiten.`

/** Role-alignment rules for CV tailoring and generation prompts. */
export function cvRoleAlignmentPromptBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? ROLE_ALIGNMENT_RULES_DE : ROLE_ALIGNMENT_RULES_EN
}

/** Pre-output role-alignment review checklist. */
export function cvRoleAlignmentQualityCheckBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? ROLE_ALIGNMENT_QUALITY_CHECK_DE : ROLE_ALIGNMENT_QUALITY_CHECK_EN
}
