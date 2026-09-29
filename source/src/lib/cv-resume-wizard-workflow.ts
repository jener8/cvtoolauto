const WIZARD_WORKFLOW_EN = `RESUME WIZARD GENERATION WORKFLOW (ADDITIVE LAYER)

IMPORTANT:
This workflow is an enhancement layer. It must NOT replace or weaken existing Resume Wizard behaviour.
These rules are additive. Apply them on top of — not instead of — the existing generation logic below.

PRESERVE EXISTING WIZARD BEHAVIOUR (continue to do all of this):
- Learn from the Example CV / source CV provided in this prompt.
- Preserve the user's preferred formatting style and resume-builder syntax.
- Preserve resume structure when appropriate.
- Preserve successful patterns from the source CV and prior versions.
- Use the target job description to tailor content and keywords.
- Continue generating ATS-friendly, role-specific resumes.
- Do not discard existing resume generation, formatting, or ATS logic configured in this prompt.

The following rule sets are already provided — apply at the enhancement steps below. Do not restate, rewrite, or duplicate those rules:
- Job Title Rules
- Experience & Bullet Rules (including metric-first bullet guidance)
- Skills & ATS Rules
- Recruiter-First Resume Strategy
- Role Alignment Rules
- Resume Formatting Rules

ENHANCEMENT 1: EMPLOYER PROBLEM ANALYSIS
In addition to extracting keywords and requirements from the job description, identify:
- Problems the employer is trying to solve
- Desired outcomes
- Required capabilities
- Indicators of success

Example — Role: AI Adoption Specialist
Employer problems: low adoption, change resistance, lack of AI literacy, poor process integration
Required capabilities: training, enablement, communication, stakeholder alignment

ENHANCEMENT 2: EVIDENCE MAPPING
Before generating content, map for each employer need:
Employer Need → User Evidence → Resume Content
Only use evidence supported by the source CV and career history. Do not invent responsibilities, outcomes, titles, metrics, or achievements.

Example:
Employer Need: Stakeholder Alignment
User Evidence: 50+ workshops
Resume Bullet: Aligned government, engineering and business stakeholders through 50+ workshops, accelerating decision-making and reducing delivery uncertainty.

Focus on proving capability rather than listing activities.

ENHANCEMENT 3: ROLE TRANSLATION
Apply the Job Title Rules.
Create recruiter-friendly displayed titles on the # line only when official titles are vague or do not clearly communicate responsibilities — and only when the displayed title remains truthful and defensible.
Never invent experience or claim a title the candidate did not hold.

Examples:
Official: Senior UX Specialist → Displayed: Senior UX Specialist | AI Adoption & Digital Trust
Official: Associate Level II → Displayed: Associate Level II (Project Management)

ENHANCEMENT 4: PROBLEM-SOLVING EXPERIENCE GENERATION
Apply the Experience & Bullet Rules and Role Alignment Rules.
Generate bullets from: Problem → Action → Outcome → Transferable Capability.
Do not simply describe tasks.
Each bullet should help answer: "Why should this employer believe this candidate can solve our problem?"
Prioritize relevance within each role while preserving chronological employer ordering.

ENHANCEMENT 5: EVIDENCE-BASED SKILLS
Apply the Skills & ATS Rules.
Skills are not independent keywords. Derive skills from experience, projects, education, publications, and certifications.
Every skill must be traceable to evidence. If evidence does not exist, do not include the skill.

ENHANCEMENT 6: RECRUITER SCAN OPTIMIZATION
Apply the Recruiter-First Resume Strategy and Resume Formatting Rules.
Ensure the first 6–8 seconds clearly communicate: who the candidate is, target role alignment, current/recent role, career progression, contact details, and location.
Avoid: functional resumes, objective statements, hidden dates, long paragraphs, keyword stuffing.

FINAL GENERATION PRINCIPLE:
The Resume Wizard continues learning from:
Example CV + Target Job Description + Resume database / strategic profile + existing resume templates and formatting rules.

The enhancements above are additional intelligence layers that improve relevance, evidence quality, recruiter comprehension, ATS performance, and hiring manager confidence.

The goal is not to replace the existing wizard.
The goal is to make the existing wizard produce stronger, more targeted, more evidence-backed resumes while preserving the user's preferred resume style and successful generation behaviour.`

const WIZARD_WORKFLOW_DE = `LEBENLAUF-WIZARD GENERIERUNGS-WORKFLOW (ZUSÄTZLICHE EBENE)

WICHTIG:
Dieser Workflow ist eine Ergänzungsschicht. Er darf das bestehende Wizard-Verhalten NICHT ersetzen oder abschwächen.
Diese Regeln sind additiv — auf die bestehende Generierungslogik anwenden, nicht an ihre Stelle.

BESTEHENDES WIZARD-VERHALTEN BEIBEHALTEN:
- Aus dem Beispiel-/Quell-Lebenslauf in diesem Prompt lernen.
- Bevorzugten Formatierungsstil und Resume-Builder-Syntax bewahren.
- Lebenslauf-Struktur wo angemessen erhalten.
- Erfolgreiche Muster aus Quell-CV und früheren Versionen bewahren.
- Stellenbeschreibung für Anpassung und ATS nutzen.
- ATS-freundliche, rollenspezifische Lebensläufe weiter erzeugen.
- Bestehende Generierungs-, Formatierungs- und ATS-Logik in diesem Prompt nicht verwerfen.

Bereits konfigurierte Regelwerke (in den Schritten anwenden, nicht duplizieren):
- Berufsbezeichnungs-Regeln
- Erfahrungs- & Stichpunkt-Regeln
- Skills & ATS-Regeln
- Recruiter-First Strategie
- Rollen-Ausrichtung
- Formatierungsregeln

ERGÄNZUNG 1: ARBEITGEBER-PROBLEMANALYSE
Zusätzlich zu Keywords und Anforderungen identifizieren:
- Probleme, die der Arbeitgeber lösen will
- Gewünschte Ergebnisse
- Geforderte Fähigkeiten
- Erfolgsindikatoren

ERGÄNZUNG 2: EVIDENZ-MAPPING
Vor der Inhaltsgenerierung pro Bedarf:
Arbeitgeber-Bedarf → Nutzer-Evidenz → Lebenslauf-Inhalt
Nur belegbare Evidenz aus dem Quell-Lebenslauf. Nichts erfinden.
Fähigkeit beweisen statt Aktivitäten auflisten.

ERGÄNZUNG 3: ROLLEN-ÜBERSETZUNG
Berufsbezeichnungs-Regeln anwenden. Recruiter-freundliche # Titel nur bei vagen offiziellen Titeln — wahr und vertretbar.
Nie erfundene Titel oder Erfahrung.

ERGÄNZUNG 4: PROBLEM-LÖSENDE ERFAHRUNG
Erfahrungs- & Stichpunkt-Regeln und Rollen-Ausrichtung anwenden.
Problem → Handlung → Ergebnis → übertragbare Kompetenz. Keine reinen Aufgabenlisten.
Jeder Stichpunkt: „Warum sollte dieser Arbeitgeber glauben, dass die Kandidatin unser Problem lösen kann?"

ERGÄNZUNG 5: EVIDENZBASIERTE SKILLS
Skills & ATS-Regeln anwenden. Skills aus Erfahrung, Projekten, Ausbildung, Publikationen, Zertifikaten ableiten.
Jeder Skill belegbar — sonst weglassen.

ERGÄNZUNG 6: RECRUITER-SCAN
Recruiter-First Strategie und Formatierungsregeln anwenden.
Erste 6–8 Sekunden: Wer, Rollenpassung, aktuelle Rolle, Karriereentwicklung, Kontakt, Ort.
Vermeiden: funktionaler Lebenslauf, Objective, versteckte Daten, Textwände, Keyword-Stuffing.

ABSCHLIESSENDES PRINZIP:
Der Wizard lernt weiter aus: Beispiel-CV + Stellenbeschreibung + Lebenslauf-Datenbank/Profil + Templates und Formatierung.
Ziel: stärkere, zielgerichtete, evidenzbasierte Lebensläufe — ohne den bestehenden Wizard zu ersetzen.`

const WIZARD_WORKFLOW_QUALITY_CHECK_EN = `WIZARD ADDITIVE LAYER CHECK (before final output):
1. Was the source Example CV used as the factual base — existing wizard behaviour preserved?
2. Were formatting style and resume-builder structure preserved where appropriate?
3. Was employer problem analysis performed beyond keyword extraction?
4. Was evidence mapped (Employer Need → User Evidence → Resume Content) without invention?
5. Were Job Title Rules applied only for displayed titles — history unchanged?
6. Do bullets prove capability (Problem → Action → Outcome) and answer the employer's problem?
7. Are skills evidence-based and traceable — no unsupported keywords?
8. Does page 1 support a 6–8 second recruiter scan without functional layout or keyword stuffing?
9. Is the output stronger and more targeted while still recognisably grounded in the source CV?`

const WIZARD_WORKFLOW_QUALITY_CHECK_DE = `WIZARD-ERGÄNZUNGSSCHICHT PRÜFUNG (vor Ausgabe):
1. Quell-/Beispiel-CV als Faktenbasis — bestehendes Wizard-Verhalten erhalten?
2. Formatierung und Struktur wo angemessen bewahrt?
3. Arbeitgeber-Problemanalyse über Keywords hinaus?
4. Evidenz gemappt ohne Erfindung?
5. Berufsbezeichnungs-Regeln nur für angezeigte Titel?
6. Stichpunkte belegen Fähigkeit und beantworten das Arbeitgeberproblem?
7. Skills evidenzbasiert und nachvollziehbar?
8. Erste Seite in 6–8 Sekunden scanbar?
9. Stärker und zielgerichteter — aber im Quell-CV verankert?`

/** Additive enhancement workflow for resume wizard — preserves existing generation; references configured rule sets. */
export function cvResumeWizardWorkflowPromptBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? WIZARD_WORKFLOW_DE : WIZARD_WORKFLOW_EN
}

/** Pre-output additive wizard layer validation checklist. */
export function cvResumeWizardWorkflowQualityCheckBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? WIZARD_WORKFLOW_QUALITY_CHECK_DE : WIZARD_WORKFLOW_QUALITY_CHECK_EN
}
