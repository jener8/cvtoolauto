"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ApplicationStatistics } from "@/lib/application-statistics"
import type {
  StrategyAnalysisReport,
  StrategyInsightItem,
} from "@/lib/strategy-analysis-types"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

function pct(rate: number | null): string {
  if (rate == null) return "—"
  return `${Math.round(rate * 100)}%`
}

function ConfidenceBadge({ level }: { level?: StrategyInsightItem["confidence"] }) {
  if (!level) return null
  const styles = {
    high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    medium: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    low: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        styles[level],
      )}
    >
      {level} confidence
    </span>
  )
}

function InsightList({ items }: { items: StrategyInsightItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No insights in this category yet.</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className="rounded-lg border border-border/50 bg-background/50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug">{item.title}</p>
            <ConfidenceBadge level={item.confidence} />
          </div>
          {item.detail && item.detail !== item.title && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
          )}
          {item.evidence && (
            <p className="mt-1.5 text-xs text-muted-foreground/80 border-t border-border/40 pt-1.5">
              Evidence: {item.evidence}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function AnalysisSection({
  title,
  icon: Icon,
  iconClassName,
  items,
  tone = "neutral",
}: {
  title: string
  icon: LucideIcon
  iconClassName?: string
  items: StrategyInsightItem[]
  tone?: "success" | "warning" | "focus" | "neutral"
}) {
  const toneBorder = {
    success: "border-emerald-300/40",
    warning: "border-amber-300/40",
    focus: "border-primary/30",
    neutral: "border-border/60",
  }

  return (
    <Card className={cn("shadow-sm", toneBorder[tone])}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <InsightList items={items} />
      </CardContent>
    </Card>
  )
}

function MetricsStrip({ stats }: { stats?: ApplicationStatistics }) {
  if (!stats) return null

  const metrics = [
    { label: "Applications", value: String(stats.totalApplications) },
    { label: "Interviews", value: String(stats.interviewsReceived) },
    { label: "Interview rate", value: pct(stats.interviewConversionRate) },
    { label: "Offer rate", value: pct(stats.offerConversionRate) },
    { label: "Hired", value: String(stats.hired) },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg border bg-muted/30 px-3 py-2 text-center"
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {metric.label}
          </p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{metric.value}</p>
        </div>
      ))}
    </div>
  )
}

export interface StrategyAnalysisDashboardProps {
  report: StrategyAnalysisReport
  stats?: ApplicationStatistics
  usedFallback?: boolean
}

export function StrategyAnalysisDashboard({
  report,
  stats,
  usedFallback,
}: StrategyAnalysisDashboardProps) {
  return (
    <div className="space-y-6">
      {usedFallback && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-300/30 rounded-md px-3 py-2">
          Showing a simplified view — the latest analysis could not be fully structured.
        </p>
      )}

      {report.summary && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Executive summary</p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
        </div>
      )}

      <MetricsStrip stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysisSection
          title="What worked"
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          items={report.whatWorked}
          tone="success"
        />
        <AnalysisSection
          title="Best performing roles"
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          items={report.bestRoles}
          tone="success"
        />
        <AnalysisSection
          title="Best resume versions"
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          items={report.bestResumes}
          tone="success"
        />
        <AnalysisSection
          title="Successful keywords"
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          items={report.successfulKeywords}
          tone="success"
        />
        <AnalysisSection
          title="What didn't work"
          icon={AlertTriangle}
          iconClassName="text-amber-600 dark:text-amber-400"
          items={report.whatDidNotWork}
          tone="warning"
        />
        <AnalysisSection
          title="Underperforming roles"
          icon={AlertTriangle}
          iconClassName="text-amber-600 dark:text-amber-400"
          items={report.underperformingRoles}
          tone="warning"
        />
        <AnalysisSection
          title="Recommended next applications"
          icon={Target}
          iconClassName="text-primary"
          items={report.recommendedRoles}
          tone="focus"
        />
        <AnalysisSection
          title="Strategy improvements"
          icon={TrendingUp}
          iconClassName="text-primary"
          items={report.strategyChanges}
          tone="focus"
        />
      </div>
    </div>
  )
}
