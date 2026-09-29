import type { ApplicationStage, StageOutcome } from "@/lib/application-pipeline"
import { STAGE_OUTCOMES } from "@/lib/application-pipeline"
import { getStageLabel, getStageOutcomeLabel, type Language } from "@/lib/translations"
import type { LucideIcon } from "lucide-react"
import {
  CheckCircle2,
  Clock,
  MailWarning,
  Undo2,
  UserMinus,
  XCircle,
} from "lucide-react"

export type OutcomeVisual = {
  icon: LucideIcon
  emoji: string
  badgeClass: string
  iconClass: string
  menuClass: string
  menuSelectedClass: string
}

export const OUTCOME_VISUALS: Record<StageOutcome, OutcomeVisual> = {
  pending: {
    icon: Clock,
    emoji: "⏳",
    badgeClass: "ui-status-pill ui-status-pill--pending",
    iconClass: "text-[var(--status-pending-dot)]",
    menuClass: "hover:bg-[var(--status-pending-bg)] focus:bg-[var(--status-pending-bg)]",
    menuSelectedClass:
      "bg-[var(--status-pending-bg)] ring-2 ring-[var(--status-pending-dot)] ring-offset-1",
  },
  passed: {
    icon: CheckCircle2,
    emoji: "✅",
    badgeClass: "ui-status-pill ui-status-pill--screening",
    iconClass: "text-[var(--status-screening-dot)]",
    menuClass: "hover:bg-[var(--status-screening-bg)] focus:bg-[var(--status-screening-bg)]",
    menuSelectedClass:
      "bg-[var(--status-screening-bg)] ring-2 ring-[var(--status-screening-dot)] ring-offset-1",
  },
  rejected: {
    icon: XCircle,
    emoji: "❌",
    badgeClass: "ui-status-pill ui-status-pill--rejected",
    iconClass: "text-[var(--status-rejected-dot)]",
    menuClass: "hover:bg-[var(--status-rejected-bg)] focus:bg-[var(--status-rejected-bg)]",
    menuSelectedClass:
      "bg-[var(--status-rejected-bg)] ring-2 ring-[var(--status-rejected-dot)] ring-offset-1",
  },
  declined: {
    icon: Undo2,
    emoji: "↩️",
    badgeClass: "ui-status-pill ui-status-pill--pending",
    iconClass: "text-[var(--status-pending-dot)]",
    menuClass: "hover:bg-[var(--status-pending-bg)] focus:bg-[var(--status-pending-bg)]",
    menuSelectedClass:
      "bg-[var(--status-pending-bg)] ring-2 ring-[var(--status-pending-dot)] ring-offset-1",
  },
  withdrawn: {
    icon: UserMinus,
    emoji: "🚫",
    badgeClass: "ui-status-pill ui-status-pill--pending",
    iconClass: "text-[var(--text-secondary)]",
    menuClass: "hover:bg-[var(--page-bg)] focus:bg-[var(--page-bg)]",
    menuSelectedClass:
      "bg-[var(--page-bg)] ring-2 ring-[var(--text-secondary)] ring-offset-1",
  },
  no_response: {
    icon: MailWarning,
    emoji: "📭",
    badgeClass: "ui-status-pill ui-status-pill--screening",
    iconClass: "text-[var(--status-screening-dot)]",
    menuClass: "hover:bg-[var(--status-screening-bg)] focus:bg-[var(--status-screening-bg)]",
    menuSelectedClass:
      "bg-[var(--status-screening-bg)] ring-2 ring-[var(--status-screening-dot)] ring-offset-1",
  },
}

/** Compact stage label for cards and badges. */
export function getStageShortLabel(lang: Language, stage: ApplicationStage): string {
  const short: Record<ApplicationStage, { en: string; de: string }> = {
    applied: { en: "Applied", de: "Beworben" },
    hr_screening: { en: "HR Screening", de: "HR-Screening" },
    hiring_manager_interview_1: { en: "Interview 1", de: "Gespräch 1" },
    hiring_manager_interview_2: { en: "Interview 2", de: "Gespräch 2" },
    final_interview: { en: "Final Interview", de: "Finales Gespräch" },
    offer: { en: "Offer", de: "Angebot" },
    hired: { en: "Hired", de: "Eingestellt" },
  }
  return short[stage]?.[lang] ?? getStageLabel(lang, stage)
}

export function getPipelineCardLabel(
  lang: Language,
  stage: ApplicationStage,
  outcome: StageOutcome,
): string {
  return `${getStageShortLabel(lang, stage)} · ${getStageOutcomeLabel(lang, outcome)}`
}

export function getStageOutcomeDescription(
  lang: Language,
  stage: ApplicationStage,
  outcome: StageOutcome,
): string {
  const stageName = getStageShortLabel(lang, stage)
  const fullStage = getStageLabel(lang, stage)

  const copy: Record<StageOutcome, { en: string; de: string }> = {
    pending: {
      en:
        stage === "applied"
          ? "Waiting to hear back after submitting your application"
          : `Waiting for the company’s response at ${stageName}`,
      de:
        stage === "applied"
          ? "Warten auf Rückmeldung nach der Bewerbung"
          : `Warten auf Antwort der Firma bei ${stageName}`,
    },
    passed: {
      en:
        stage === "hired"
          ? "Accepted offer and marked as hired"
          : `Passed ${stageName} and advanced to the next stage`,
      de:
        stage === "hired"
          ? "Angebot angenommen und als eingestellt markiert"
          : `${stageName} bestanden — nächste Stufe erreicht`,
    },
    rejected: {
      en: `Company declined your application at ${stageName}`,
      de: `Firma hat bei ${stageName} abgelehnt`,
    },
    declined: {
      en:
        stage === "offer"
          ? "You declined the job offer"
          : `You declined to continue at ${stageName}`,
      de:
        stage === "offer"
          ? "Du hast das Jobangebot abgelehnt"
          : `Du hast bei ${stageName} abgesagt`,
    },
    withdrawn: {
      en: `You withdrew your application during ${fullStage}`,
      de: `Du hast die Bewerbung während ${fullStage} zurückgezogen`,
    },
    no_response: {
      en:
        stage === "applied"
          ? "No reply received after submitting your application"
          : `No reply received at ${stageName} within your tracking period`,
      de:
        stage === "applied"
          ? "Keine Antwort nach der Bewerbung erhalten"
          : `Keine Antwort bei ${stageName} innerhalb deines Tracking-Zeitraums`,
    },
  }

  return copy[outcome]?.[lang] ?? getStageOutcomeLabel(lang, outcome)
}

export function getOutcomeVisual(outcome: StageOutcome): OutcomeVisual {
  return OUTCOME_VISUALS[outcome]
}

export { STAGE_OUTCOMES }
