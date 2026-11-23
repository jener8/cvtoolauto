/**
 * Deterministic Career Evolution suggestions from verified CV evidence + target job.
 * Never invents employers, titles, dates, promotions, or outcomes.
 */

import { parseResumeText } from "@/lib/parse-resume-text"
import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"
import {
  findOverlappingEmployerPairs,
  splitExperienceJobEntries,
  type ExperienceJobEntry,
} from "@/lib/experience-organization"
import {
  emptyCareerEvolutionConfig,
  newCareerEvolutionId,
  type CareerEvolutionAlignment,
  type CareerEvolutionCapability,
  type CareerEvolutionConfig,
  type CareerEvolutionConnection,
  type CareerEvolutionEvidenceFit,
  type CareerEvolutionMilestone,
} from "@/lib/career-evolution/types"
import {
  formatCareerEvolutionDateRange,
  parseCareerEvolutionDateToken,
  splitCareerEvolutionDateRange,
} from "@/lib/career-evolution/date-format"
import { serializeCareerEvolutionAlignmentText } from "@/lib/career-evolution/alignment-text"
import { serializeCareerEvolutionText } from "@/lib/career-evolution/text-syntax"
import { recommendCareerEvolutionLayout } from "@/lib/career-evolution/layout-catalog"
import {
  hasMeaningfulCareerEvolutionNarrative,
  hasUserProtectedCareerEvolutionEdits,
} from "@/lib/career-evolution/resolve"
import {
  extractJobCapabilityThemes,
  scoreEvidenceAgainstTheme,
  themeLabel,
  type JobCapabilityTheme,
} from "@/lib/career-evolution/job-themes"
import {
  applySuggestedDisplayLabels,
  isUserProtectedConvergenceTarget,
  mergePreservingUserDisplayLabels,
  suggestCentralOutcomeLabel,
} from "@/lib/career-evolution/suggest-display-label"
import {
  formatEmploymentDurationLabel,
  parseEmploymentMonthToken,
  splitEmploymentDateRange,
} from "@/lib/employment-duration"
import type { EvidenceAssessmentRow } from "@/lib/evidence-assessment/types"

export type CareerEvolutionSuggestInput = {
  resumeText: string
  targetRole?: string
  targetCompany?: string
  jobDescription?: string
  /** Optional Career Profile positioning (never hardcoded). */
  careerPositioning?: string
  language?: "en" | "de"
  /** Approved evidence rows from CV Creator (optional). */
  approvedEvidence?: EvidenceAssessmentRow[]
  /** Silent job-analysis summary when available. */
  employerProblemSummary?: string
}

export type CareerEvolutionSuggestResult = {
  config: CareerEvolutionConfig
  /** True when the graph was auto-enabled because it adds clear value. */
  autoEnabled: boolean
  omitReason?: string
}

function sectionLines(
  resumeText: string,
  key: "EXPERIENCE" | "PARALLEL_WORK" | "PROJECTS",
): string[] {
  const sections = parseResumeText(resumeText)
  const match = sections.find(
    (s) => normalizeCvSectionKey(stripSectionColumnModifier(s.title)) === key,
  )
  return match?.content ?? []
}

function toMonthKey(dateText: string, side: "start" | "end"): string | undefined {
  // Prefer CE-safe split (does not break YYYY-MM on internal hyphens).
  const split =
    splitCareerEvolutionDateRange(dateText) ||
    splitEmploymentDateRange(dateText)
  if (!split) {
    const ceOnly = parseCareerEvolutionDateToken(dateText.trim())
    if (ceOnly?.kind === "present") {
      return side === "end" ? "present" : undefined
    }
    if (ceOnly && ceOnly.kind !== "present") {
      if (ceOnly.kind === "year") {
        return side === "start"
          ? `${ceOnly.year}-01`
          : `${ceOnly.year}-12`
      }
      return `${ceOnly.year}-${String(ceOnly.month).padStart(2, "0")}`
    }
    const only = parseEmploymentMonthToken(dateText.trim(), { assumeMonth: 1 })
    if (!only || only === "present") return side === "end" ? "present" : undefined
    return `${only.year}-${String(only.month).padStart(2, "0")}`
  }
  const token = side === "start" ? split.start : split.end
  const ce = parseCareerEvolutionDateToken(token)
  if (ce?.kind === "present") return "present"
  if (ce && ce.kind !== "present") {
    if (ce.kind === "year") {
      return side === "start" ? `${ce.year}-01` : `${ce.year}-12`
    }
    return `${ce.year}-${String(ce.month).padStart(2, "0")}`
  }
  const parsed = parseEmploymentMonthToken(token, { assumeMonth: 1 })
  if (!parsed) return undefined
  if (parsed === "present") return "present"
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}`
}

function jobEvidenceBlob(job: ExperienceJobEntry): string {
  return `${job.title} ${job.company} ${job.lines.join(" ")}`
}

function bestThemeForJob(
  job: ExperienceJobEntry,
  themes: JobCapabilityTheme[],
): { theme: JobCapabilityTheme; score: number } | null {
  let best: { theme: JobCapabilityTheme; score: number } | null = null
  const blob = jobEvidenceBlob(job)
  for (const theme of themes) {
    const score = scoreEvidenceAgainstTheme(blob, theme)
    if (score <= 0) continue
    if (!best || score > best.score) best = { theme, score }
  }
  return best
}

function evidenceFitForScore(score: number): CareerEvolutionEvidenceFit {
  if (score >= 3) return "direct"
  if (score >= 1) return "transferable"
  return "partial"
}

function matchApprovedEvidence(
  job: ExperienceJobEntry,
  rows: EvidenceAssessmentRow[] | undefined,
): EvidenceAssessmentRow | undefined {
  if (!rows?.length) return undefined
  const blob = jobEvidenceBlob(job).toLowerCase()
  const scored = rows
    .filter((r) => r.fit === "direct" || r.fit === "transferable" || r.fit === "partial")
    .map((r) => {
      const ref = `${r.evidenceText} ${r.evidenceSourceRef ?? ""}`.toLowerCase()
      let score = 0
      if (job.company && ref.includes(job.company.toLowerCase())) score += 3
      if (job.title && ref.includes(job.title.toLowerCase())) score += 2
      const words = job.title
        .toLowerCase()
        .split(/[^a-zäöüß0-9]+/i)
        .filter((w) => w.length > 3)
      score += words.filter((w) => blob.includes(w) && ref.includes(w)).length
      return { row: r, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.row
}

function graphTitleFor(
  themes: JobCapabilityTheme[],
  targetRole: string,
  language: "en" | "de",
): string {
  if (themes[0]) {
    return language === "de"
      ? `Karriereentwicklung — ${themeLabel(themes[0], "de")}`
      : `Career evolution — ${themeLabel(themes[0], "en")}`
  }
  if (targetRole) {
    return language === "de"
      ? `Karriereentwicklung — ${targetRole}`
      : `Career evolution — ${targetRole}`
  }
  return language === "de" ? "Karriereentwicklung" : "Career evolution"
}

function decideAutoEnable(input: {
  milestones: CareerEvolutionMilestone[]
  hasParallel: boolean
  interpretiveCount: number
  themes: JobCapabilityTheme[]
  language: "en" | "de"
}): { enable: boolean; omitReason?: string } {
  const { milestones, hasParallel, interpretiveCount, themes, language } = input
  if (milestones.length < 2) {
    return {
      enable: false,
      omitReason:
        language === "de"
          ? "Zu wenig verifizierte Stationen für einen aussagekräftigen Graphen."
          : "Not enough verified career stages for a meaningful graph.",
    }
  }

  // Parallel concurrent work clearly adds value beyond a linear Experience list
  if (hasParallel) return { enable: true }

  // Distinct interpretive stages tied to JD themes (not a re-listing of job titles)
  if (interpretiveCount >= 2 && themes.length > 0) return { enable: true }

  // Strong multi-theme JD with 3+ evidence-backed stages
  if (themes.length >= 2 && milestones.length >= 3 && interpretiveCount >= 1) {
    return { enable: true }
  }

  return {
    enable: false,
    omitReason:
      language === "de"
        ? "Der Graph würde die Erfahrungssektion nur wiederholen — daher ausgeblendet. Sie können ihn unter Bearbeiten aktivieren."
        : "The graph would mostly repeat Experience — left off. You can enable it under Edit → Career Evolution.",
  }
}

/**
 * Build a suggested Career Evolution config from the current CV + target job.
 * Milestones stay unapproved until the user confirms interpretive labels.
 * Evidence-supported cross-track connections may be approved for auto display.
 */
export function suggestCareerEvolutionFromEvidence(
  input: CareerEvolutionSuggestInput,
): CareerEvolutionConfig {
  return buildCareerEvolutionSuggestion(input).config
}

export function buildCareerEvolutionSuggestion(
  input: CareerEvolutionSuggestInput,
): CareerEvolutionSuggestResult {
  const language = input.language === "de" ? "de" : "en"
  const targetRole = input.targetRole?.trim() || ""
  const jd = input.jobDescription?.trim() || ""
  const themes = extractJobCapabilityThemes(jd, targetRole)
  const approvedEvidence = (input.approvedEvidence ?? []).filter(
    (r) => r.approved !== false && r.fit !== "not_evidenced",
  )

  const experienceSectionJobs = splitExperienceJobEntries(
    sectionLines(input.resumeText, "EXPERIENCE"),
  )
  const parallelSectionJobs = splitExperienceJobEntries(
    sectionLines(input.resumeText, "PARALLEL_WORK"),
  )
  // Classification from [work=…] markers — summarise on the independent track;
  // never invent extra experience entries. Section placement is presentation only.
  const markedParallelInExperience = experienceSectionJobs.filter((j) =>
    j.workType === "parallel-independent" || j.workType === "parallel-consulting",
  )
  const experienceJobs = experienceSectionJobs.filter(
    (j) =>
      j.workType !== "parallel-independent" && j.workType !== "parallel-consulting",
  )
  const parallelJobs = [...parallelSectionJobs, ...markedParallelInExperience]
  const projectJobs = splitExperienceJobEntries(sectionLines(input.resumeText, "PROJECTS"))

  const employmentTrack = {
    id: "track-employment",
    label: language === "de" ? "Berufliche Erfahrung" : "Professional Experience",
  }
  const independentTrack = {
    id: "track-independent",
    label: language === "de" ? "Unabhängige Arbeit" : "Independent work",
  }
  const projectsTrack = {
    id: "track-projects",
    label: language === "de" ? "Projekte" : "Projects",
  }

  type ScoredJob = {
    job: ExperienceJobEntry
    trackId: string
    themeScore: number
    theme: JobCapabilityTheme | null
    evidenceRow?: EvidenceAssessmentRow
  }

  const scoreJob = (job: ExperienceJobEntry, trackId: string): ScoredJob => {
    const match = bestThemeForJob(job, themes)
    const evidenceRow = matchApprovedEvidence(job, approvedEvidence)
    let themeScore = match?.score ?? 0
    if (evidenceRow) {
      themeScore += evidenceRow.fit === "direct" ? 4 : evidenceRow.fit === "transferable" ? 2 : 1
    }
    // Prefer recent roles slightly when scores tie
    const end = toMonthKey(job.dateText, "end") || ""
    if (end === "present" || end >= "2022") themeScore += 0.5
    return {
      job,
      trackId,
      themeScore,
      theme: match?.theme ?? null,
      evidenceRow,
    }
  }

  const scoredEmployment = experienceJobs
    .map((j) => scoreJob(j, employmentTrack.id))
    .sort((a, b) => b.themeScore - a.themeScore || (toMonthKey(b.job.dateText, "end") || "").localeCompare(toMonthKey(a.job.dateText, "end") || ""))

  // Keep chronological story: take top-scoring employment roles, then re-sort by time (newest first)
  const primaryPool = scoredEmployment.slice(0, Math.min(4, scoredEmployment.length))
  primaryPool.sort((a, b) =>
    (toMonthKey(b.job.dateText, "end") || "").localeCompare(toMonthKey(a.job.dateText, "end") || ""),
  )

  const parallelScored = parallelJobs
    .map((j) => scoreJob(j, independentTrack.id))
    .sort((a, b) => b.themeScore - a.themeScore)
    .slice(0, 2)

  const milestones: CareerEvolutionMilestone[] = []
  let interpretiveCount = 0
  const usedThemeIds = new Set<string>()

  const pushMilestone = (scored: ScoredJob) => {
    const { job, trackId, theme, themeScore, evidenceRow } = scored
    // Prefer interpretive stage labels, but avoid repeating the same theme label
    const themeFresh = Boolean(theme && themeScore >= 1 && !usedThemeIds.has(theme.id))
    const useStage = themeFresh
    if (themeFresh && theme) usedThemeIds.add(theme.id)
    if (useStage) interpretiveCount += 1
    const label = useStage && theme ? themeLabel(theme, language) : job.title
    const requirement =
      evidenceRow?.requirementPhrase ||
      (theme ? theme.matchedPhrases[0] || themeLabel(theme, language) : undefined)
    const fit: CareerEvolutionEvidenceFit | undefined = evidenceRow
      ? evidenceRow.fit === "direct" || evidenceRow.fit === "transferable"
        ? evidenceRow.fit
        : "partial"
      : theme
        ? evidenceFitForScore(themeScore)
        : undefined

    const relevanceNote = (() => {
      if (language === "de") {
        if (requirement && fit === "direct") {
          return `Direkte Evidenz für „${requirement}“.`
        }
        if (requirement) {
          return `Übertragbare Evidenz für „${requirement}“ — bitte prüfen.`
        }
        return targetRole
          ? `Aus dem Lebenslauf für „${targetRole}“ — Relevanz bestätigen.`
          : "Aus dem Lebenslauf — Relevanz bestätigen."
      }
      if (requirement && fit === "direct") {
        return `Direct evidence for “${requirement}”.`
      }
      if (requirement) {
        return `Transferable evidence for “${requirement}” — confirm before relying on it.`
      }
      return targetRole
        ? `From your CV for “${targetRole}” — confirm relevance.`
        : "From your CV evidence — confirm relevance."
    })()

    milestones.push({
      id: newCareerEvolutionId("m"),
      label,
      description: job.company ? `${job.title} · ${job.company}` : job.title,
      officialTitle: job.title,
      start: toMonthKey(job.dateText, "start"),
      end: toMonthKey(job.dateText, "end"),
      trackId,
      relevanceNote,
      jobRequirementAddressed: requirement,
      evidenceRef:
        evidenceRow?.evidenceSourceRef ||
        (job.company ? `${job.title} @ ${job.company}` : job.title),
      evidenceFit: fit,
      milestoneKind: useStage ? "career-stage" : "formal-role",
      approved: false,
    })
  }

  for (const scored of primaryPool) pushMilestone(scored)
  for (const scored of parallelScored) {
    if (scored.themeScore > 0 || parallelJobs.length > 0) pushMilestone(scored)
  }

  if (milestones.length < 2) {
    for (const job of projectJobs.slice(0, 3 - milestones.length)) {
      pushMilestone(scoreJob(job, projectsTrack.id))
    }
  }

  // Do not force a 3-stage arc — keep what evidence supports (cap 5)
  const capped = milestones.slice(0, 5)

  const connections: CareerEvolutionConnection[] = []
  const employmentMs = capped.filter((m) => m.trackId === employmentTrack.id)
  for (let i = 0; i < employmentMs.length - 1; i++) {
    const newer = employmentMs[i]!
    const older = employmentMs[i + 1]!
    connections.push({
      id: newCareerEvolutionId("c"),
      fromMilestoneId: older.id,
      toMilestoneId: newer.id,
      label: language === "de" ? "Entwicklung" : "Growth",
      approved: false,
    })
  }

  const overlaps = findOverlappingEmployerPairs([...experienceJobs, ...parallelJobs])
  if (overlaps.length > 0 && employmentMs[0]) {
    const parallelMs = capped.filter((m) => m.trackId === independentTrack.id)
    for (const p of parallelMs.slice(0, 1)) {
      connections.push({
        id: newCareerEvolutionId("c"),
        fromMilestoneId: p.id,
        toMilestoneId: employmentMs[0]!.id,
        label: language === "de" ? "Zusammenführung" : "Convergence",
        approved: true,
        evidenceRef: "Concurrent employment and independent work in CV",
      })
    }
  }

  const tracks = [employmentTrack]
  const hasParallel = capped.some((m) => m.trackId === independentTrack.id)
  if (hasParallel) tracks.push(independentTrack)
  if (capped.some((m) => m.trackId === projectsTrack.id)) tracks.push(projectsTrack)

  const decision = decideAutoEnable({
    milestones: capped,
    hasParallel,
    interpretiveCount,
    themes,
    language,
  })

  const positioningHint = input.careerPositioning?.trim()
  const problem = input.employerProblemSummary?.trim()

  // Evidence-to-Role pairs from verified CV evidence + JD themes — not career-stage labels.
  const verifiedEvidenceLabel = (m: CareerEvolutionMilestone): string => {
    const ref = m.evidenceRef?.trim()
    if (ref && !/^growth$|^entwicklung$/i.test(ref)) return ref
    if (m.description?.trim()) return m.description.trim()
    if (m.officialTitle?.trim()) return m.officialTitle.trim()
    return (m.label || "").trim()
  }

  const alignments: CareerEvolutionAlignment[] = []
  const seenAlign = new Set<string>()
  for (const m of capped) {
    const requirement = m.jobRequirementAddressed?.trim()
    if (!requirement) continue
    const evidenceLabel = verifiedEvidenceLabel(m)
    if (!evidenceLabel) continue
    const key = `${evidenceLabel.toLowerCase()}→${requirement.toLowerCase()}`
    if (seenAlign.has(key)) continue
    seenAlign.add(key)
    const matchType =
      m.evidenceFit === "direct" || m.evidenceFit === "transferable"
        ? m.evidenceFit
        : m.evidenceFit === "partial"
          ? "transferable"
          : undefined
    alignments.push({
      id: newCareerEvolutionId("al"),
      evidenceLabel,
      requirementLabel: requirement,
      evidenceRef: m.evidenceRef,
      matchType,
      approved: true,
    })
    if (alignments.length >= 4) break
  }
  // Theme → best verified evidence when milestones lack explicit requirement phrases
  if (alignments.length < 2) {
    for (const theme of themes.slice(0, 4)) {
      if (alignments.length >= 4) break
      const requirement =
        theme.matchedPhrases[0]?.trim() || themeLabel(theme, language)
      const best = capped
        .map((m) => ({
          m,
          score: scoreEvidenceAgainstTheme(
            `${m.officialTitle || ""} ${m.description || ""} ${m.evidenceRef || ""} ${m.label}`,
            theme,
          ),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]
      if (!best) continue
      const evidenceLabel = verifiedEvidenceLabel(best.m)
      if (!evidenceLabel || !requirement) continue
      const key = `${evidenceLabel.toLowerCase()}→${requirement.toLowerCase()}`
      if (seenAlign.has(key)) continue
      seenAlign.add(key)
      const fit = evidenceFitForScore(best.score)
      alignments.push({
        id: newCareerEvolutionId("al"),
        evidenceLabel,
        requirementLabel: requirement,
        evidenceRef: best.m.evidenceRef,
        matchType: fit === "direct" ? "direct" : "transferable",
        approved: true,
      })
    }
  }

  const capabilityLabels = new Map<string, CareerEvolutionCapability>()
  for (const theme of themes.slice(0, 4)) {
    const label = themeLabel(theme, language)
    const key = label.toLowerCase()
    if (!capabilityLabels.has(key)) {
      capabilityLabels.set(key, {
        id: newCareerEvolutionId("cap"),
        label,
      })
    }
  }
  for (const m of capped) {
    const label = String(m.label ?? "").trim()
    const key = label.toLowerCase()
    if (label && !capabilityLabels.has(key) && capabilityLabels.size < 4) {
      capabilityLabels.set(key, {
        id: newCareerEvolutionId("cap"),
        label,
        evidenceRef: m.evidenceRef,
      })
    }
  }
  const capabilities = [...capabilityLabels.values()]

  const layout = recommendCareerEvolutionLayout({
    hasParallel,
    milestoneCount: capped.length,
    interpretiveCount,
    themeCount: themes.length,
    alignmentPairCount: alignments.length,
    capabilityCount: capabilities.length,
    isCareerTransition:
      /transition|change|pivot|umstieg|wechsel/i.test(
        `${targetRole} ${jd} ${positioningHint || ""}`,
      ) || interpretiveCount >= 3,
  })

  const milestonesWithShortLabels = applySuggestedDisplayLabels(capped, {
    mode: "missing",
    language,
    layout,
    targetRole,
    jobDescription: jd,
    themes,
  })

  const suggested = emptyCareerEvolutionConfig({
    visible: decision.enable,
    userDisabled: false,
    layout,
    density: "compact",
    position: "before-experience",
    showParallelWork: hasParallel,
    showConnectionIcon: true,
    showConnectionLabels: true,
    tracks,
    milestones: milestonesWithShortLabels,
    connections,
    // Keep all layout payloads so switching templates has meaningful content
    capabilities,
    alignments,
    convergenceTarget: suggestCentralOutcomeLabel({
      language,
      targetRole,
      jobDescription: jd,
      themes,
      capabilities,
    }),
    convergenceTargetOrigin: "auto",
    graphTitle: graphTitleFor(themes, targetRole, language),
    generatedForRole: targetRole || undefined,
    generatedAt: Date.now(),
    omitReason: decision.enable ? undefined : decision.omitReason,
    origin: "ai",
  })
  void problem

  // Fold positioning / problem into omit or first relevance only as notes — never invent facts
  if (positioningHint && suggested.milestones[0] && !suggested.milestones[0].relevanceNote?.includes(positioningHint.slice(0, 24))) {
    void problem
  }

  const withText: CareerEvolutionConfig = {
    ...suggested,
    sourceText: serializeCareerEvolutionText(suggested),
    alignmentSourceText:
      alignments.length > 0
        ? serializeCareerEvolutionAlignmentText(alignments)
        : suggested.alignmentSourceText,
  }

  return {
    config: withText,
    autoEnabled: decision.enable,
    omitReason: decision.omitReason,
  }
}

/**
 * Merge a freshly generated suggestion with any existing per-CV preference.
 * - Empty / presentation-only state → apply suggestion immediately (no accept step).
 * - Respects explicit userDisabled (never silently re-enables).
 * - Preserves meaningful manual edits via pendingSuggestion.
 * - Replaces prior AI-only configs on regenerate.
 */
export function mergeCareerEvolutionOnRegenerate(
  previous: CareerEvolutionConfig | null | undefined,
  next: CareerEvolutionConfig,
): CareerEvolutionConfig {
  if (!previous || !hasMeaningfulCareerEvolutionNarrative(previous)) {
    if (previous?.userDisabled === true) {
      return {
        ...next,
        visible: false,
        userDisabled: true,
        pendingSuggestion: undefined,
        userEditedAt: undefined,
        origin: "ai",
      }
    }
    return { ...next, pendingSuggestion: undefined }
  }

  if (previous.userDisabled === true) {
    // Still apply narrative when empty of user text would have been handled above.
    // With existing content + disabled: update pending only if user-protected; else replace hidden.
    if (hasUserProtectedCareerEvolutionEdits(previous)) {
      return {
        ...previous,
        pendingSuggestion: { ...next, pendingSuggestion: undefined },
        generatedAt: next.generatedAt,
        generatedForRole: next.generatedForRole || previous.generatedForRole,
      }
    }
    return {
      ...next,
      visible: false,
      userDisabled: true,
      omitReason:
        previous.omitReason ||
        "You turned Career Evolution off for this application — content refreshed but left hidden.",
      pendingSuggestion: undefined,
      userEditedAt: undefined,
      origin: "ai",
    }
  }

  if (hasUserProtectedCareerEvolutionEdits(previous)) {
    // Skip pending if suggestion is identical to current narrative
    const prevText = (previous.sourceText || "").trim()
    const nextText = (next.sourceText || "").trim()
    if (prevText && nextText && prevText === nextText) {
      return { ...previous, pendingSuggestion: undefined, generatedAt: next.generatedAt }
    }
    return {
      ...previous,
      pendingSuggestion: {
        ...next,
        pendingSuggestion: undefined,
      },
      generatedAt: next.generatedAt,
      generatedForRole: next.generatedForRole || previous.generatedForRole,
    }
  }

  return { ...next, pendingSuggestion: undefined }
}

/** Accept a pending AI suggestion, replacing current narrative. */
export function acceptPendingCareerEvolution(
  current: CareerEvolutionConfig,
): CareerEvolutionConfig {
  const pending = current.pendingSuggestion
  if (!pending) return current
  const enable =
    current.userDisabled === true
      ? false
      : pending.visible === true || pending.milestones.length > 0
  const milestones = mergePreservingUserDisplayLabels(
    pending.milestones,
    current.milestones,
  )
  const keepOutcome = isUserProtectedConvergenceTarget(
    current,
    current.generatedForRole,
  )
  return {
    ...pending,
    milestones,
    convergenceTarget: keepOutcome
      ? current.convergenceTarget
      : pending.convergenceTarget,
    convergenceTargetOrigin: keepOutcome
      ? "user"
      : pending.convergenceTargetOrigin || "auto",
    // Keep authored Skills Convergence boxes when present
    capabilities:
      (current.capabilities || []).filter((c) => String(c.label ?? "").trim()).length >= 2
        ? current.capabilities
        : pending.capabilities,
    visible: enable,
    userDisabled: current.userDisabled === true,
    pendingSuggestion: undefined,
    origin: keepOutcome ? "mixed" : "ai",
    userEditedAt: keepOutcome ? current.userEditedAt : undefined,
    omitReason: enable ? undefined : pending.omitReason,
  }
}

/** Plain-text alternative for accessibility / ATS companions. */
export function careerEvolutionTextAlternative(
  config: CareerEvolutionConfig,
  language: "en" | "de" = "en",
): string {
  const lines: string[] = []
  lines.push(
    config.graphTitle ||
      (language === "de" ? "Karriereentwicklung (Textfassung):" : "Career evolution (text version):"),
  )

  // Evidence-to-Role alt text mirrors the ALIGNMENT dataset, not TRACK stages.
  if (config.layout === "alignment") {
    const pairs = (config.alignments || []).filter(
      (a) =>
        a.approved !== false &&
        String(a.evidenceLabel ?? "").trim() &&
        String(a.requirementLabel ?? "").trim(),
    )
    for (const a of pairs.slice(0, 4)) {
      lines.push(`- ${a.evidenceLabel} → ${a.requirementLabel}`)
    }
    if (pairs.length === 0) {
      lines.push(
        language === "de"
          ? "- (Noch keine Evidenz→Anforderungs-Paare)"
          : "- (No evidence-to-requirement pairs yet)",
      )
    }
    return lines.join("\n")
  }

  for (const m of config.milestones) {
    const label = String(m?.label ?? "").trim() || "Milestone"
    const when = formatCareerEvolutionDateRange(m.start, m.end, {
      mode: "full",
      language,
    }).full
    const title =
      m.officialTitle && m.officialTitle !== label ? ` (${m.officialTitle})` : ""
    lines.push(`- ${label}${title}${when ? `: ${when}` : ""}${m.description ? ` — ${m.description}` : ""}`)
    if (m.relevanceNote) lines.push(`  ${m.relevanceNote}`)
    if (m.jobRequirementAddressed) {
      lines.push(
        language === "de"
          ? `  Anforderung: ${m.jobRequirementAddressed}`
          : `  Requirement: ${m.jobRequirementAddressed}`,
      )
    }
  }
  const approvedLinks = config.connections.filter((c) => c.approved)
  if (approvedLinks.length) {
    lines.push(language === "de" ? "Verbindungen:" : "Connections:")
    for (const c of approvedLinks) {
      const from = config.milestones.find((m) => m.id === c.fromMilestoneId)?.label ?? "?"
      const to = config.milestones.find((m) => m.id === c.toMilestoneId)?.label ?? "?"
      lines.push(`- ${from} → ${to}${c.label ? ` (${c.label})` : ""}`)
    }
  }
  return lines.join("\n")
}

export { formatEmploymentDurationLabel }
