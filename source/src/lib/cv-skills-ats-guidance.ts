const SKILLS_ATS_RULES_EN = `SKILLS & ATS RULES

- Skills must be derived from evidence in experience, projects, education, certifications, or publications.
- Never generate skills as an unsupported keyword list.
- Every major skill must appear in at least one experience bullet.
- If a skill cannot be verified by evidence, do not include it.
- Match job requirements to proven evidence before adding skills.
- Do not keyword-stuff.
- Generate skills using: Job Requirement → Candidate Evidence → Skill.
- Prioritize skills that are both:
  1. Required by the target role.
  2. Demonstrated in the candidate's history.
- Validate that every skill can be traced back to a specific example.
- Optimize for recruiter scan and ATS ranking through relevance and evidence, not keyword repetition.

RESUME MUST CLEARLY SHOW:
- Who the candidate is
- What problems they solve
- Why they are relevant to this role
- Where they have already demonstrated those capabilities

EXAMPLE MAPPING:
Job Requirement: Stakeholder workshop facilitation
Candidate Evidence: Facilitated 50+ cross-functional workshops across government, business and engineering teams
Skill: Workshop Facilitation

Job Requirement: AI governance
Candidate Evidence: Applied NIST AI RMF, OECD AI Principles and EU AI Act concepts in responsible AI delivery
Skill: AI Governance`

const SKILLS_ATS_RULES_DE = `SKILLS & ATS-REGELN

- Skills aus Belegen in Erfahrung, Projekten, Ausbildung, Zertifikaten oder Publikationen ableiten.
- Nie Skills als unbelegte Keyword-Liste erzeugen.
- Jede zentrale Fähigkeit muss in mindestens einem Erfahrungs-Stichpunkt vorkommen.
- Skill ohne verifizierbare Evidenz weglassen.
- Stellenanforderungen mit belegter Evidenz abgleichen, bevor Skills ergänzt werden.
- Kein Keyword-Stuffing.
- Skills ableiten: Stellenanforderung → Kandidaten-Evidenz → Skill.
- Priorisieren, was gleichzeitig gilt:
  1. Von der Zielrolle gefordert.
  2. In der Historie der Kandidatin nachweisbar.
- Jeden Skill auf ein konkretes Beispiel zurückführen können.
- Recruiter-Scan und ATS über Relevanz und Belege optimieren — nicht durch Keyword-Wiederholung.

DER LEBENLAUF MUSS KLAR ZEIGEN:
- Wer die Kandidatin ist
- Welche Probleme sie löst
- Warum sie für diese Rolle relevant ist
- Wo sie diese Fähigkeiten bereits belegt hat`

const SKILLS_ATS_QUALITY_CHECK_EN = `SKILLS & ATS CHECK (before final output):
1. Is every skill derived from experience, projects, education, certifications, or publications?
2. Does every major skill appear in at least one experience bullet?
3. Are unverifiable skills removed?
4. Were job requirements matched to proven evidence before skills were added?
5. Is there no keyword stuffing or repetition for ATS?
6. Can every skill be traced to a specific example (Job Requirement → Evidence → Skill)?
7. Are prioritized skills both required by the target role and demonstrated in history?
8. Does the resume show who the candidate is, what problems they solve, why they are relevant, and where capabilities were demonstrated?`

const SKILLS_ATS_QUALITY_CHECK_DE = `SKILLS & ATS-PRÜFUNG (vor Ausgabe):
1. Ist jeder Skill aus Erfahrung, Projekten, Ausbildung, Zertifikaten oder Publikationen abgeleitet?
2. Erscheint jede zentrale Fähigkeit in mindestens einem Erfahrungs-Stichpunkt?
3. Sind unbelegbare Skills entfernt?
4. Wurden Stellenanforderungen mit belegter Evidenz abgeglichen?
5. Kein Keyword-Stuffing oder Wiederholung?
6. Ist jeder Skill auf ein Beispiel zurückführbar (Anforderung → Evidenz → Skill)?
7. Priorisierte Skills sowohl gefordert als auch nachweisbar?
8. Zeigt der Lebenslauf Wer, welche Probleme, warum relevant, wo belegt?`

/** Evidence-backed skills and ATS rules for CV generation. */
export function cvSkillsAtsPromptBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? SKILLS_ATS_RULES_DE : SKILLS_ATS_RULES_EN
}

/** Pre-output skills and ATS validation checklist. */
export function cvSkillsAtsQualityCheckBlock(outputLanguage: "en" | "de"): string {
  return outputLanguage === "de" ? SKILLS_ATS_QUALITY_CHECK_DE : SKILLS_ATS_QUALITY_CHECK_EN
}
