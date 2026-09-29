const EXPERIENCE_BULLET_RULES_EN = `EXPERIENCE & BULLET RULES

- Generate bullets from problems solved, not tasks performed.
- Every bullet should demonstrate: Problem → Action → Outcome → Transferable Capability.
- Lead with the outcome whenever possible.
- Keep bullets to 1–2 lines maximum.
- Use strong verbs: Identified, Improved, Reduced, Enabled, Facilitated, Aligned, Accelerated, Simplified, Strengthened, Implemented, Operationalised.
- Avoid weak verbs: Helped, Worked On, Assisted, Participated In, Responsible For.
- Every bullet should answer:
  • What problem was solved?
  • How was it solved?
  • Why does this matter to the target employer?
- Focus on evidence of capability rather than activities.
- Highlight business impact, adoption, governance, transformation, accessibility, research, leadership, or enablement where relevant.
- Demonstrate career progression through increasing responsibility, scope, influence, or complexity.

PREFERRED PATTERNS:
- Outcome-led: [Outcome] by [action/method], [context or transferable capability].
- Problem-led: Solved [problem] by [action], resulting in [outcome].

TASK-BASED (avoid): "Facilitated workshops and alignment sessions across stakeholders."
CAPABILITY-BASED (prefer): "Aligned cross-functional delivery decisions across product, engineering, accessibility and compliance teams in a regulated public-sector environment."`

const EXPERIENCE_BULLET_RULES_DE = `ERFAHRUNG & STICHPUNKT-REGELN

- Stichpunkte aus gelösten Problemen ableiten, nicht aus Aufgaben.
- Jeder Stichpunkt: Problem → Handlung → Ergebnis → übertragbare Kompetenz.
- Wenn möglich mit dem Ergebnis beginnen.
- Maximal 1–2 Zeilen pro Stichpunkt.
- Starke Verben: identifiziert, verbessert, reduziert, ermöglicht, moderiert, ausgerichtet, beschleunigt, vereinfacht, gestärkt, implementiert, operationalisiert.
- Schwache Verben vermeiden: half bei, arbeitete an, unterstützte, nahm teil an, verantwortlich für.
- Jeder Stichpunkt beantwortet:
  • Welches Problem wurde gelöst?
  • Wie wurde es gelöst?
  • Warum ist das für den Zielarbeitgeber relevant?
- Evidenz von Fähigkeiten statt Aktivitäten.
- Business Impact, Adoption, Governance, Transformation, Barrierefreiheit, Forschung, Führung oder Enablement hervorheben, wo relevant.
- Karriereentwicklung durch wachsende Verantwortung, Reichweite, Einfluss oder Komplexität zeigen.

MUSTER:
- Ergebnisgeführt: [Ergebnis] durch [Handlung/Methode], [Kontext oder Kompetenz].
- Problemgeführt: [Problem] gelöst durch [Handlung], Ergebnis: [Outcome].`

const EXPERIENCE_BULLET_QUALITY_CHECK_EN = `EXPERIENCE & BULLET CHECK (before final output):
1. Is every bullet problem- or outcome-driven — not a task list?
2. Does each bullet show Problem → Action → Outcome → Transferable Capability?
3. Are bullets 1–2 lines and free of weak verbs (Helped, Worked On, Assisted, Participated In, Responsible For)?
4. Does each bullet answer what problem was solved, how, and why it matters to the target employer?
5. Is capability evidenced rather than activities described?
6. Does the experience section show career progression in responsibility, scope, or influence?`

const EXPERIENCE_BULLET_QUALITY_CHECK_DE = `ERFAHRUNG & STICHPUNKT-PRÜFUNG (vor Ausgabe):
1. Ist jeder Stichpunkt problem- oder ergebnisorientiert — keine Aufgabenliste?
2. Zeigt jeder Stichpunkt Problem → Handlung → Ergebnis → übertragbare Kompetenz?
3. Sind Stichpunkte 1–2 Zeilen und frei von schwachen Verben?
4. Beantwortet jeder Stichpunkt Problem, Lösung und Relevanz für den Zielarbeitgeber?
5. Wird Fähigkeit belegt statt Aktivität beschrieben?
6. Zeigt die Berufserfahrung Karriereentwicklung in Verantwortung, Reichweite oder Einfluss?`

/** Problem-solving experience and bullet rules for CV generation. */
export function cvExperienceBulletPromptBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? EXPERIENCE_BULLET_RULES_DE : EXPERIENCE_BULLET_RULES_EN
}

/** Pre-output experience bullet validation checklist. */
export function cvExperienceBulletQualityCheckBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de"
    ? EXPERIENCE_BULLET_QUALITY_CHECK_DE
    : EXPERIENCE_BULLET_QUALITY_CHECK_EN
}
