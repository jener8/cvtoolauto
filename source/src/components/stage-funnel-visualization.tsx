"use client"

import type { ApplicationStatistics } from "@/lib/application-statistics"
import type { StageFunnelStep } from "@/lib/application-statistics"
import type { ApplicationStage } from "@/lib/application-pipeline"
import { getStageShortLabel } from "@/lib/application-pipeline-ui"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowDown } from "lucide-react"

type Lang = "en" | "de"

const COPY = {
  en: {
    applications: "Applications",
    interviews: "Interviews",
    offers: "Offers",
    hires: "Hires",
    offerRate: "Offer rate",
    biggestBottleneck: "Biggest bottleneck",
    dropOff: "drop-off",
    lost: "lost",
    active: "active",
    pendingAtStage: "still in progress",
    noData: "No pipeline data yet.",
    funnelSummary: (summary: string) => `Pipeline summary: ${summary}`,
    stageAria: (
      label: string,
      entered: number,
      passed: number,
      pending: number,
      lost: number,
    ) =>
      `${label}: ${entered} entered, ${passed} advanced, ${pending} still in progress, ${lost} lost at this stage`,
    transitionAria: (
      from: string,
      to: string,
      lost: number,
      dropOff: string,
    ) => `${lost} applications lost between ${from} and ${to}, ${dropOff} drop-off`,
    bottleneckHint: "The stage transition where you lose the most candidates",
    funnelHint: "Bar width reflects volume at each stage. All bars start from the left edge.",
  },
  de: {
    applications: "Bewerbungen",
    interviews: "Gespräche",
    offers: "Angebote",
    hires: "Einstellungen",
    offerRate: "Angebotsquote",
    biggestBottleneck: "Größter Engpass",
    dropOff: "Abfall",
    lost: "verloren",
    active: "aktiv",
    pendingAtStage: "noch in Bearbeitung",
    noData: "Noch keine Pipeline-Daten.",
    funnelSummary: (summary: string) => `Pipeline-Zusammenfassung: ${summary}`,
    stageAria: (
      label: string,
      entered: number,
      passed: number,
      pending: number,
      lost: number,
    ) =>
      `${label}: ${entered} eingetreten, ${passed} weiter, ${pending} noch in Bearbeitung, ${lost} an dieser Stufe verloren`,
    transitionAria: (
      from: string,
      to: string,
      lost: number,
      dropOff: string,
    ) => `${lost} Bewerbungen zwischen ${from} und ${to} verloren, ${dropOff} Abfall`,
    bottleneckHint: "Der Übergang, an dem Sie die meisten Kandidaten verlieren",
    funnelHint: "Die Balkenbreite zeigt das Volumen je Stufe. Alle Balken beginnen am linken Rand.",
  },
} as const

function pct(rate: number | null): string {
  if (rate == null) return "—"
  return `${Math.round(rate * 100)}%`
}

type StageTransition = {
  fromIndex: number
  toIndex: number
  fromStage: ApplicationStage
  toStage: ApplicationStage
  fromLabel: string
  toLabel: string
  previousEntered: number
  currentEntered: number
  lost: number
  dropOff: number | null
  conversion: number | null
}

function computeTransitions(steps: StageFunnelStep[], lang: Lang): StageTransition[] {
  const transitions: StageTransition[] = []

  for (let i = 1; i < steps.length; i++) {
    const previous = steps[i - 1]
    const current = steps[i]
    if (!previous || !current) continue

    const previousEntered = previous.entered
    const currentEntered = current.entered
    const lost = Math.max(previousEntered - currentEntered, 0)
    const conversion =
      previousEntered > 0 ? currentEntered / previousEntered : null
    const dropOff = conversion != null ? 1 - conversion : null

    transitions.push({
      fromIndex: i - 1,
      toIndex: i,
      fromStage: previous.stage,
      toStage: current.stage,
      fromLabel: getStageShortLabel(lang, previous.stage),
      toLabel: getStageShortLabel(lang, current.stage),
      previousEntered,
      currentEntered,
      lost,
      dropOff,
      conversion,
    })
  }

  return transitions
}

function findBottleneck(
  transitions: StageTransition[],
): StageTransition | null {
  let biggest: StageTransition | null = null

  for (const transition of transitions) {
    if (transition.lost <= 0 || transition.dropOff == null) continue
    if (
      !biggest ||
      transition.dropOff > biggest.dropOff ||
      (transition.dropOff === biggest.dropOff && transition.lost > biggest.lost)
    ) {
      biggest = transition
    }
  }

  return biggest
}

function buildScreenReaderSummary(
  steps: StageFunnelStep[],
  bottleneck: StageTransition | null,
  lang: Lang,
): string {
  const parts = steps
    .filter((step) => step.entered > 0)
    .map(
      (step) =>
        `${getStageShortLabel(lang, step.stage)} ${step.entered}`,
    )

  const base = parts.length > 0 ? parts.join(", ") : "no stages with data"
  if (!bottleneck || bottleneck.lost <= 0) return base

  return `${base}. Biggest bottleneck: ${bottleneck.fromLabel} to ${bottleneck.toLabel}, ${pct(bottleneck.dropOff)} drop-off, ${bottleneck.lost} lost.`
}

function stageBarTone(stage: ApplicationStage): string {
  if (stage === "hired") {
    return "bg-emerald-600/90 dark:bg-emerald-500/85 border-emerald-700/30 dark:border-emerald-400/30"
  }
  if (stage === "offer") {
    return "bg-emerald-500/75 dark:bg-emerald-600/70 border-emerald-600/25 dark:border-emerald-400/25"
  }
  return "bg-primary/75 dark:bg-primary/65 border-primary/20"
}

export function StageFunnelVisualization({
  funnel,
  stats,
  lang,
}: {
  funnel: StageFunnelStep[]
  stats?: Pick<
    ApplicationStatistics,
    | "totalApplications"
    | "interviewsReceived"
    | "offersReceived"
    | "hired"
    | "offerConversionRate"
  >
  lang: Lang
}) {
  const t = COPY[lang]
  const maxEntered = Math.max(funnel[0]?.entered ?? 0, 1)
  const hasData = funnel.some((step) => step.entered > 0)
  const transitions = computeTransitions(funnel, lang)
  const bottleneck = findBottleneck(transitions)
  const bottleneckIndex = bottleneck?.toIndex ?? -1

  const applications = stats?.totalApplications ?? funnel[0]?.entered ?? 0
  const interviews = stats?.interviewsReceived ?? funnel[1]?.entered ?? 0
  const offers =
    stats?.offersReceived ??
    funnel.find((step) => step.stage === "offer")?.entered ??
    0
  const hires =
    stats?.hired ?? funnel.find((step) => step.stage === "hired")?.passed ?? 0
  const offerRate =
    applications > 0 ? offers / applications : null

  const summaryId = "funnel-screen-reader-summary"

  if (!hasData) {
    return <p className="text-sm text-muted-foreground">{t.noData}</p>
  }

  const screenReaderSummary = buildScreenReaderSummary(funnel, bottleneck, lang)

  return (
    <div
      className="space-y-6"
      role="region"
      aria-labelledby="funnel-heading"
      aria-describedby={summaryId}
    >
      <p id={summaryId} className="sr-only">
        {t.funnelSummary(screenReaderSummary)}
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label={t.applications} value={String(applications)} />
        <KpiCard label={t.interviews} value={String(interviews)} />
        <KpiCard label={t.offers} value={String(offers)} />
        <KpiCard label={t.hires} value={String(hires)} />
        <KpiCard
          label={t.offerRate}
          value={pct(offerRate)}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Bottleneck callout */}
      {bottleneck && bottleneck.lost > 0 ? (
        <div
          className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3"
          role="status"
          aria-label={`${t.biggestBottleneck}: ${bottleneck.fromLabel} to ${bottleneck.toLabel}, ${pct(bottleneck.dropOff)} ${t.dropOff}, ${bottleneck.lost} ${t.lost}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
                {t.biggestBottleneck}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {bottleneck.fromLabel} → {bottleneck.toLabel}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-red-700 dark:text-red-400 tabular-nums">
                  −{pct(bottleneck.dropOff)}
                </span>{" "}
                {t.dropOff}
                <span className="mx-1.5 text-border">·</span>
                <span className="font-medium tabular-nums text-foreground">
                  {bottleneck.lost}
                </span>{" "}
                {t.lost}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t.bottleneckHint}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Left-aligned funnel */}
      <div className="w-full">
        <p className="text-xs text-muted-foreground mb-4">{t.funnelHint}</p>

        <div className="space-y-5">
          {funnel.map((step, index) => {
            const label = getStageShortLabel(lang, step.stage)
            const widthPct =
              step.entered > 0
                ? Math.max((step.entered / maxEntered) * 100, 6)
                : 2
            const outgoingTransition = transitions.find((tr) => tr.fromIndex === index)
            const isBottleneckStage = outgoingTransition
              ? outgoingTransition.toIndex === bottleneckIndex
              : false
            const isSuccessStage = step.stage === "offer" || step.stage === "hired"

            return (
              <div
                key={step.stage}
                className="w-full"
                aria-label={t.stageAria(
                  label,
                  step.entered,
                  step.passed,
                  step.pending,
                  step.lost,
                )}
              >
                <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4">
                  <span className="text-left text-sm font-medium leading-snug">{label}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {step.entered}
                  </span>
                </div>

                <div className="relative h-10 w-full rounded-md bg-muted/30">
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full rounded-md border shadow-sm transition-all duration-300",
                      step.entered === 0 && "opacity-35",
                      isBottleneckStage && step.entered > 0 && "ring-2 ring-amber-400/50",
                      stageBarTone(step.stage),
                    )}
                    style={{
                      width: `${widthPct}%`,
                      minWidth: step.entered > 0 ? "2.5rem" : "0.5rem",
                    }}
                    aria-hidden="true"
                  />
                </div>

                {(step.passed > 0 || step.pending > 0 || (step.lost > 0 && !isSuccessStage)) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-left text-xs text-muted-foreground">
                    {step.passed > 0 && (
                      <span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {step.passed}
                        </span>{" "}
                        {lang === "de" ? "weiter" : "advanced"}
                      </span>
                    )}
                    {step.pending > 0 && (
                      <span>
                        <span className="font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                          {step.pending}
                        </span>{" "}
                        {t.pendingAtStage}
                      </span>
                    )}
                    {step.lost > 0 && !isSuccessStage && (
                      <span>
                        <span className="font-medium text-red-700 dark:text-red-400 tabular-nums">
                          {step.lost}
                        </span>{" "}
                        {lang === "de" ? "verloren" : "lost here"}
                      </span>
                    )}
                  </div>
                )}

                {outgoingTransition && outgoingTransition.lost > 0 ? (
                  <StageDropOff
                    transition={outgoingTransition}
                    isBottleneck={isBottleneckStage}
                    lang={lang}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 px-3 py-2.5 text-center",
        className,
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function StageDropOff({
  transition,
  isBottleneck,
  lang,
}: {
  transition: StageTransition
  isBottleneck: boolean
  lang: Lang
}) {
  const t = COPY[lang]

  return (
    <div
      className={cn(
        "mt-2 flex items-start gap-2 text-left",
        isBottleneck && "rounded-md border border-amber-300/40 bg-amber-50/40 px-2.5 py-2 dark:bg-amber-950/20",
      )}
      aria-label={t.transitionAria(
        transition.fromLabel,
        transition.toLabel,
        transition.lost,
        pct(transition.dropOff),
      )}
    >
      <ArrowDown
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          isBottleneck
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground/50",
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "text-xs tabular-nums leading-snug",
          isBottleneck
            ? "font-medium text-amber-900 dark:text-amber-100"
            : "text-muted-foreground",
        )}
      >
        <p>
          <span className="font-semibold text-red-700 dark:text-red-400">
            {pct(transition.dropOff)} {t.dropOff}
          </span>
        </p>
        <p className="mt-0.5">
          <span className="font-medium text-foreground">{transition.lost}</span> {t.lost}
        </p>
      </div>
    </div>
  )
}
