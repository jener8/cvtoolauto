import {
  cvExperienceBulletPromptBlock,
  cvExperienceBulletQualityCheckBlock,
} from "@/lib/cv-experience-bullet-guidance"

const BULLET_EXAMPLE_TASK_BASED =
  "Facilitated workshops and alignment sessions across product, engineering, accessibility, legal, compliance and business stakeholders."

const BULLET_EXAMPLE_ACTION_LED =
  "Facilitated cross-functional workshops across product, engineering, accessibility and compliance teams, aligning delivery decisions in a regulated public-sector environment."

const METRIC_FIRST_EXAMPLES_EN = [
  "400+ usability tests conducted across government digital services, generating evidence-based insights that informed product decisions.",
  "40+ accessibility findings addressed across Android and iOS applications during certification and compliance activities.",
  "11 expert interviews conducted to investigate trust, transparency and responsible AI implementation.",
  "3 major governance frameworks applied, including NIST AI RMF, OECD AI Principles and EU AI Act concepts.",
]

const METRIC_FIRST_EXAMPLES_DE = [
  "400+ Usability-Tests in Behörden-Digitaldiensten durchgeführt und evidenzbasierte Erkenntnisse für Produktentscheidungen geliefert.",
  "40+ Barrierefreiheitsbefunde in Android- und iOS-Anwendungen im Rahmen von Zertifizierung und Compliance behoben.",
  "11 Experteninterviews zu Vertrauen, Transparenz und verantwortungsvoller KI-Implementierung durchgeführt.",
  "3 zentrale Governance-Frameworks angewendet, darunter NIST AI RMF, OECD AI Principles und EU AI Act-Konzepte.",
]

const CONFIRMED_METRICS_EN = [
  "10+ years experience in UX, digital strategy, service design and technology adoption",
  "4+ years at Bundesdruckerei Group",
  "400+ usability tests",
  "Government digital services supporting millions of citizens",
  "40+ accessibility findings addressed across Android and iOS",
  "11 expert interviews for Trust by Design",
  "3 major AI governance frameworks applied: NIST AI RMF, OECD AI Principles and EU AI Act concepts",
  "2 enterprise platforms enabled at EL PATO: Microsoft Office 365 and HR cloud solutions",
  "AI governance workshop involving approximately 40+ stakeholders",
  "Experience across government, healthcare, cybersecurity, enterprise software and regulated digital environments",
]

const CONFIRMED_METRICS_DE = [
  "10+ Jahre Erfahrung in UX, Digitalstrategie, Service Design und Technologieeinführung",
  "4+ Jahre bei der Bundesdruckerei Gruppe",
  "400+ Usability-Tests",
  "Behörden-Digitaldienste mit Millionen von Bürgerinnen und Bürgern",
  "40+ Barrierefreiheitsbefunde in Android und iOS behoben",
  "11 Experteninterviews für Trust by Design",
  "3 zentrale KI-Governance-Frameworks angewendet: NIST AI RMF, OECD AI Principles und EU AI Act-Konzepte",
  "2 Enterprise-Plattformen bei EL PATO eingeführt: Microsoft Office 365 und HR-Cloud-Lösungen",
  "KI-Governance-Workshop mit ca. 40+ Stakeholdern",
  "Erfahrung in Behörden, Gesundheitswesen, Cybersicherheit, Enterprise Software und regulierten digitalen Umgebungen",
]

const ESTIMATED_METRICS_EN = [
  "100+ stakeholder workshops",
  "10+ business and technical disciplines reached through AI literacy and knowledge-sharing",
  "20+ reusable prompts or AI workflows developed",
]

const ESTIMATED_METRICS_DE = [
  "100+ Stakeholder-Workshops",
  "10+ Fach- und Technikdisziplinen durch KI-Literacy und Wissensaustausch erreicht",
  "20+ wiederverwendbare Prompts oder KI-Workflows entwickelt",
]

const BULLET_RULES_EN = `BULLET POINT WRITING (experience, education, projects, profile):
CV bullets must be concise, impact-focused and evidence-based.

PRIMARY FORMAT — metric-first (when a credible metric exists):
Metric + action/context + impact/result

METRIC-FIRST EXAMPLES:
${METRIC_FIRST_EXAMPLES_EN.map((e) => `- ${e}`).join("\n")}

FALLBACK FORMAT — when no credible metric exists:
Action verb + context/task + outcome/impact

ACTION-LED EXAMPLE:
Task-based: "${BULLET_EXAMPLE_TASK_BASED}"
Accomplishment-driven: "${BULLET_EXAMPLE_ACTION_LED}"

RULES:
- Use metric-first bullets only when a credible metric exists in the user profile, uploaded CV, job application data, confirmed metrics bank, or confirmed user input.
- Do not invent numbers, percentages, savings, adoption rates, revenue impact or efficiency gains.
- If no credible metric exists, use the standard accomplishment format (action verb + context + impact).
- Prefer real numbers over vague claims.
- Use metrics such as: number of tests, interviews, workshops, stakeholders, departments, platforms/tools; years of experience; scale of users/citizens/customers; findings/issues addressed; frameworks applied.
- Keep each bullet concise, ideally 20–25 words.
- Avoid passive task descriptions such as "responsible for", "worked on", "helped with", "participated in", or "involved in".
- Use sentence fragments, not full paragraphs.
- Do not make every bullet metric-first. Aim for roughly 25–40% of bullets to start with metrics where the user has enough evidence.
- Maintain a natural rhythm: mix metric-first bullets with strong action-led bullets.
- Place the strongest metrics near the top of relevant sections.
- Always preserve truthfulness and never exaggerate beyond the user's confirmed experience.
- Make bullets ATS-friendly and easy to scan.`

const BULLET_RULES_DE = `STICHPUNKTE (Berufserfahrung, Ausbildung, Projekte, Profil):
Stichpunkte müssen knapp, wirkungsorientiert und evidenzbasiert sein.

HAUPTFORMAT — Kennzahl zuerst (wenn eine glaubwürdige Kennzahl vorliegt):
Kennzahl + Handlung/Kontext + Wirkung/Ergebnis

BEISPIELE KENNZAHL ZUERST:
${METRIC_FIRST_EXAMPLES_DE.map((e) => `- ${e}`).join("\n")}

AUSWEICHFORMAT — ohne glaubwürdige Kennzahl:
Aktionsverb + Kontext/Aufgabe + Ergebnis/Wirkung

BEISPIEL AKTIONSVERFÜHRT:
Aufgabenorientiert: „${BULLET_EXAMPLE_TASK_BASED}"
Ergebnisorientiert: „${BULLET_EXAMPLE_ACTION_LED}"

REGELN:
- Kennzahl-zuerst nur bei glaubwürdigen Kennzahlen aus Profil, Lebenslauf, Bewerbungsdaten, Metrik-Bank oder bestätigter Nutzereingabe.
- Keine erfundenen Zahlen, Prozente, Einsparungen, Adoptionsraten, Umsatz- oder Effizienzgewinne.
- Ohne Kennzahl: Aktionsverb + Kontext + Wirkung.
- Echte Zahlen vor vagen Behauptungen.
- Kennzahlen z. B.: Anzahl Tests, Interviews, Workshops, Stakeholder, Abteilungen, Plattformen/Tools; Jahre Erfahrung; Nutzer/Bürger/Kunden-Skala; behobene Befunde; angewandte Frameworks.
- Pro Stichpunkt idealerweise 20–25 Wörter.
- Passive Formulierungen vermeiden: „Verantwortlich für", „Mitarbeit bei", „Arbeit an", „Unterstützung bei", „Teilnahme an".
- Satzfragmente, keine Absätze.
- Nicht jeder Stichpunkt mit Kennzahl — ca. 25–40 % Kennzahl-zuerst, wo Evidenz vorliegt.
- Natürlicher Mix aus Kennzahl-zuerst und starken aktionsgeführten Stichpunkten.
- Stärkste Kennzahlen oben in relevanten Abschnitten platzieren.
- Wahrheit bewahren, nicht über bestätigte Erfahrung hinaus übertreiben.
- ATS-freundlich und schnell erfassbar formulieren.`

const METRIC_BANK_EN = `CONFIRMED METRICS BANK (Jennifer — use only when supported by CV, profile, or application data):
${CONFIRMED_METRICS_EN.map((m) => `- ${m}`).join("\n")}

POSSIBLE ESTIMATED METRICS — use only if the user confirms or the source CV supports them:
${ESTIMATED_METRICS_EN.map((m) => `- ${m}`).join("\n")}`

const METRIC_BANK_DE = `BESTÄTIGTE METRIK-BANK (Jennifer — nur nutzen, wenn Lebenslauf, Profil oder Bewerbungsdaten es stützen):
${CONFIRMED_METRICS_DE.map((m) => `- ${m}`).join("\n")}

MÖGLICHE GESCHÄTZTE METRIKEN — nur bei Nutzerbestätigung oder Stützung im Quell-Lebenslauf:
${ESTIMATED_METRICS_DE.map((m) => `- ${m}`).join("\n")}`

const BULLET_QUALITY_CHECK_EN = `BULLET QUALITY CHECK (before final output):
Review every experience, project, education, and profile bullet and ensure:
1. At least some bullets use metric-first wording where credible metrics exist.
2. No invented or unsupported numbers are added.
3. Each bullet shows context and impact.
4. Bullets remain concise and readable (ideally ≤25 words).
5. The CV does not become robotic by starting every bullet with a number.
6. The strongest metrics are placed near the top of relevant sections.
7. Passive task descriptions are avoided.
Rewrite any bullet that fails this check.`

const BULLET_QUALITY_CHECK_DE = `STICHPUNKT-QUALITÄTSPRÜFUNG (vor der endgültigen Ausgabe):
Jeden Stichpunkt in Berufserfahrung, Projekten, Ausbildung und Profil prüfen:
1. Mindestens einige Stichpunkte mit Kennzahl-zuerst, wo glaubwürdige Kennzahlen existieren.
2. Keine erfundenen oder unbelegten Zahlen.
3. Jeder Stichpunkt zeigt Kontext und Wirkung.
4. Knapp und lesbar (idealerweise ≤25 Wörter).
5. Nicht jeder Stichpunkt beginnt mit einer Zahl.
6. Stärkste Kennzahlen oben in relevanten Abschnitten.
7. Keine passiven Aufgabenbeschreibungen.
Nicht erfüllte Stichpunkte umschreiben.`

/** Shared metric-first bullet rules for CV generation and editing prompts. */
export function cvBulletWritingRulesBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? BULLET_RULES_DE : BULLET_RULES_EN
}

/** Confirmed and estimated metrics for Jennifer's CV context. */
export function cvMetricBankBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? METRIC_BANK_DE : METRIC_BANK_EN
}

/** Bullet rules plus Jennifer metric bank — use in generation, tailoring, and rewrite prompts. */
export function cvBulletPromptBlock(outputLanguage: "en" | "de"): string {
  return [
    cvExperienceBulletPromptBlock(outputLanguage),
    cvBulletWritingRulesBlock(outputLanguage),
    cvMetricBankBlock(outputLanguage),
  ].join("\n\n")
}

/** Pre-output bullet review checklist for CV generation and editing prompts. */
export function cvBulletQualityCheckBlock(outputLanguage: "en" | "de"): string {
  return [
    cvExperienceBulletQualityCheckBlock(outputLanguage),
    outputLanguage === "de" ? BULLET_QUALITY_CHECK_DE : BULLET_QUALITY_CHECK_EN,
  ].join("\n\n")
}
