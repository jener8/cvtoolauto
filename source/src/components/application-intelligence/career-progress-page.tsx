"use client"

import { useMemo, useState } from "react"
import { ApplicationStatisticsPage } from "@/components/application-statistics-page"
import { usePageTitle } from "@/hooks/use-page-title"
import {
  computeApplicationStatistics,
  type MonthlyTrend,
} from "@/lib/application-statistics"
import type { ApplicationStage } from "@/lib/application-pipeline"
import { firstNameFromUserName } from "@/lib/workspace-shell-copy"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Illustration } from "@/components/illustrations/illustration"
import { HeroIllustrationCard } from "@/components/illustrations/hero-card"
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  FileText,
  MessageCircle,
  Network,
  PartyPopper,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"
import "./career-progress-page.css"

export type CareerProgressPageProps = {
  folderId: string
  folderName?: string
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  outputLanguage?: "en" | "de"
  userName?: string
  userEmail?: string
  onSaveProfile?: (name: string, email: string, password: string) => void
  onNavigateAiCoach?: () => void
  onOpenResume?: () => void
  onNavigateApplications?: () => void
}

function countRecentRejections(jobs: JobApplication[], days = 30): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return jobs.filter((job) => {
    const pipeline = job.pipeline ?? []
    const rejectedRecord = pipeline.find((record) => record.outcome === "rejected")
    if (rejectedRecord?.date && rejectedRecord.date >= cutoff) return true
    if (job.status === "rejected") {
      const date = job.rejectionDate ?? job.lastModified
      return date >= cutoff
    }
    return false
  }).length
}

function pct(rate: number | null): string {
  if (rate == null) return "—"
  return `${Math.round(rate * 100)}%`
}

function monthKeyNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-")
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function funnelCount(
  funnel: ReturnType<typeof computeApplicationStatistics>["stageFunnel"],
  stages: ApplicationStage[],
): number {
  return funnel
    .filter((step) => stages.includes(step.stage))
    .reduce((sum, step) => sum + step.entered, 0)
}

function TrendLineChart({ trends }: { trends: MonthlyTrend[] }) {
  const points = trends.slice(-6)
  if (points.length === 0) {
    return (
      <div className="career-progress-chart-empty">
        <svg viewBox="0 0 200 100" className="career-progress-chart-empty__art" aria-hidden>
          <path d="M20 70 L60 55 L100 62 L140 40 L180 48" stroke="#ddd6fe" strokeWidth="2" fill="none" strokeDasharray="6 4" />
          <circle cx="60" cy="55" r="4" fill="#8fd4b8" opacity="0.5" />
          <circle cx="140" cy="40" r="4" fill="var(--color-primary-light)" opacity="0.4" />
        </svg>
        <p>Your chart will appear as you add applications.</p>
      </div>
    )
  }

  const maxY = Math.max(1, ...points.flatMap((p) => [p.applications, p.interview]))
  const width = 400
  const height = 180
  const padX = 32
  const padY = 24

  const xAt = (index: number) =>
    padX + (index / Math.max(1, points.length - 1)) * (width - padX * 2)
  const yAt = (value: number) => height - padY - (value / maxY) * (height - padY * 2)

  const linePath = (key: "applications" | "interview") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p[key])}`).join(" ")

  const areaPath = (key: "applications" | "interview") => {
    const baseline = height - padY
    const top = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p[key])}`).join(" ")
    const close = `L ${xAt(points.length - 1)} ${baseline} L ${xAt(0)} ${baseline} Z`
    return `${top} ${close}`
  }

  const yTicks = [0, Math.ceil(maxY / 2), maxY]

  return (
    <div className="career-progress-chart-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="career-progress-chart"
        role="img"
        aria-label="Line chart of applications and interviews over time"
      >
        <defs>
          <linearGradient id="progress-app-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-light)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary-light)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="progress-int-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fd4b8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8fd4b8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => {
          const y = yAt(tick)
          return (
            <g key={tick}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e3ebe7" strokeWidth="1" />
              <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ab0a6">
                {tick}
              </text>
            </g>
          )
        })}
        <path d={areaPath("applications")} fill="url(#progress-app-area)" />
        <path d={areaPath("interview")} fill="url(#progress-int-area)" />
        <path d={linePath("applications")} fill="none" stroke="var(--color-primary-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath("interview")} fill="none" stroke="#8fd4b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={`${p.monthKey}-apps`}>
            <circle cx={xAt(i)} cy={yAt(p.applications)} r="4" fill="#fff" stroke="var(--color-primary-light)" strokeWidth="2" />
            <circle cx={xAt(i)} cy={yAt(p.interview)} r="4" fill="#fff" stroke="#8fd4b8" strokeWidth="2" />
          </g>
        ))}
        {points.map((p, i) => (
          <text
            key={p.monthKey}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="500"
            fill="#6b8279"
          >
            {p.label.split(" ")[0]}
          </text>
        ))}
      </svg>
      <div className="career-progress-chart-legend">
        <span className="career-progress-chart-legend__item">
          <span className="career-progress-chart-legend__dot" style={{ background: "var(--color-primary-light)" }} />
          Applications
        </span>
        <span className="career-progress-chart-legend__item">
          <span className="career-progress-chart-legend__dot" style={{ background: "#8fd4b8" }} />
          Interviews
        </span>
      </div>
    </div>
  )
}

export function CareerProgressPage({
  folderId,
  folderName,
  jobApplications,
  versions,
  outputLanguage = "en",
  userName,
  userEmail,
  onSaveProfile,
  onNavigateAiCoach,
  onOpenResume,
  onNavigateApplications,
}: CareerProgressPageProps) {
  const stats = useMemo(
    () => computeApplicationStatistics({ folderId, jobs: jobApplications, versions }),
    [folderId, jobApplications, versions],
  )

  const monthOptions = useMemo(() => {
    const keys = new Set(stats.trendsOverTime.map((t) => t.monthKey))
    keys.add(monthKeyNow())
    return [...keys]
      .sort()
      .reverse()
      .map((key) => ({ key, label: monthLabelFromKey(key) }))
  }, [stats.trendsOverTime])

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.key ?? monthKeyNow())

  const monthTrend = stats.trendsOverTime.find((t) => t.monthKey === selectedMonth)
  const monthApplications = monthTrend?.applications ?? 0
  const monthInterviews = monthTrend?.interview ?? 0
  const monthOffers = monthTrend?.offer ?? 0
  const monthInterviewRate =
    monthApplications > 0 ? monthInterviews / monthApplications : stats.interviewConversionRate

  const prevMonthIndex = stats.trendsOverTime.findIndex((t) => t.monthKey === selectedMonth) + 1
  const prevMonth = stats.trendsOverTime[prevMonthIndex]
  const rateDelta =
    prevMonth && prevMonth.applications > 0 && monthApplications > 0
      ? Math.round(
          (monthInterviews / monthApplications - prevMonth.interview / prevMonth.applications) * 100,
        )
      : null

  const applied = funnelCount(stats.stageFunnel, ["applied"])
  const hrScreening = funnelCount(stats.stageFunnel, ["hr_screening"])
  const interviews = funnelCount(stats.stageFunnel, [
    "hiring_manager_interview_1",
    "hiring_manager_interview_2",
    "final_interview",
  ])
  const offers = funnelCount(stats.stageFunnel, ["offer"])
  const hired = funnelCount(stats.stageFunnel, ["hired"])

  const pipelineProgress =
    stats.totalApplications > 0
      ? Math.min(100, Math.round(((interviews + offers + hired) / stats.totalApplications) * 100))
      : 0

  const strengthTags = useMemo(() => {
    const fromKeywords = stats.bestKeywords.slice(0, 4).map((k) => k.label)
    const fromTitles = stats.bestJobTitles.slice(0, 2).map((t) => t.label)
    const merged = [...fromKeywords, ...fromTitles].filter(Boolean)
    if (merged.length > 0) return merged.slice(0, 6)
    return ["Communication", "Problem solving", "Team collaboration", "Adaptability"]
  }, [stats.bestKeywords, stats.bestJobTitles])

  const recentRejections = useMemo(
    () => countRecentRejections(jobApplications),
    [jobApplications],
  )

  const firstName = firstNameFromUserName(userName)
  usePageTitle(`Your progress · EquitAI`)

  const pipelineSteps = [
    { label: "Applied", count: applied, icon: Send },
    { label: "HR Screening", count: hrScreening, icon: Users },
    { label: "Interviews", count: interviews, icon: MessageCircle },
    { label: "Offer", count: offers, icon: PartyPopper },
    { label: "Hired", count: hired, icon: UserCheck },
  ]

  const activePipelineIndex = (() => {
    for (let i = pipelineSteps.length - 1; i >= 0; i--) {
      if (pipelineSteps[i]!.count > 0) return i
    }
    return 0
  })()

  return (
    <div className="career-progress-page">
      <header className="career-progress-page__header">
        <div>
          <h1 className="career-progress-page__title">Your progress, {firstName} ✨</h1>
          <p className="career-progress-page__subtitle">
            You&apos;re building something real — one application at a time. Every step forward
            counts, and we&apos;re here to help you see it.
          </p>
        </div>
        <label className="career-progress-page__month">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          <select
            className="bg-transparent outline-none cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select month"
          >
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </label>
      </header>

      <div className="career-progress-grid career-progress-grid--top">
        <div className="career-progress-card">
          <h2 className="career-progress-card__title">Your journey this month</h2>
          <div className="career-progress-journey-card">
            <div className="career-progress-journey">
              <div className="career-progress-journey__item">
                <span className="career-progress-journey__icon">
                  <Send className="h-4 w-4" />
                </span>
                <span className="career-progress-journey__value">{monthApplications}</span>
                <span className="career-progress-journey__label">Applications</span>
                <span className="career-progress-journey__sub">You put yourself out there!</span>
              </div>
              <div className="career-progress-journey__item">
                <span className="career-progress-journey__icon">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="career-progress-journey__value">{monthInterviews}</span>
                <span className="career-progress-journey__label">Interviews</span>
                <span className="career-progress-journey__sub">Great conversations!</span>
              </div>
              <div className="career-progress-journey__item">
                <span className="career-progress-journey__icon">
                  <PartyPopper className="h-4 w-4" />
                </span>
                <span className="career-progress-journey__value">{monthOffers}</span>
                <span className="career-progress-journey__label">Offers</span>
                <span className="career-progress-journey__sub">The right one is coming.</span>
              </div>
              <div className="career-progress-journey__item">
                <span className="career-progress-journey__icon">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <span className="career-progress-journey__value">{pct(monthInterviewRate)}</span>
                <span className="career-progress-journey__label">Interview rate</span>
                {rateDelta != null && rateDelta > 0 ? (
                  <span className="career-progress-journey__badge">
                    <ArrowUpRight className="h-3 w-3" />
                    +{rateDelta}%
                  </span>
                ) : (
                  <span className="career-progress-journey__sub">Improving!</span>
                )}
              </div>
            </div>
            <div className="career-progress-heart">
              <Illustration slot="progress.journeyAccent" size="medium" />
              <p className="career-progress-heart__text">
                You&apos;re making progress and it shows!
              </p>
            </div>
          </div>
        </div>

        <HeroIllustrationCard
          slot="progress.motivation"
          title="You've got this!"
          body="Every application is evidence that you're moving. The right opportunity takes time — and you're building toward it."
          className="career-progress-motivation"
        />
      </div>

      <div className="career-progress-grid career-progress-grid--middle mt-4">
        <div className="career-progress-card">
          <h2 className="career-progress-card__title">Your progress over time</h2>
          <div className="career-progress-chart-wrap">
            <TrendLineChart trends={stats.trendsOverTime} />
            <div className="career-progress-means">
              <h3 className="career-progress-means__title">What this means</h3>
              <p className="career-progress-means__item">
                <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                <span>
                  {stats.totalApplications > 0
                    ? "You're applying more consistently — that builds real momentum."
                    : "When you start applying, your activity will show up here."}
                </span>
              </p>
              <p className="career-progress-means__item">
                <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                <span>
                  {stats.interviewsReceived > 0
                    ? "You're getting more interviews — employers are noticing you."
                    : "Interview stages will appear as your applications progress."}
                </span>
              </p>
              <p className="career-progress-means__item">
                <PartyPopper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary-light)]" aria-hidden />
                <span>
                  {stats.totalApplications > 0
                    ? "You're building visibility in the job market, one step at a time."
                    : "Offers will show here when they arrive — keep going."}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="career-progress-card">
          <h2 className="career-progress-card__title">Where you are in the process</h2>
          <div className="career-progress-pipeline">
            {pipelineSteps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === activePipelineIndex
              const isPast = index < activePipelineIndex
              return (
                <div key={step.label} className="contents">
                  <div
                    className={cn(
                      "career-progress-pipeline__step",
                      isActive && "career-progress-pipeline__step--active",
                      isPast && "career-progress-pipeline__step--past",
                    )}
                  >
                    <span className="career-progress-pipeline__icon">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="career-progress-pipeline__count">{step.count}</span>
                    <span className="career-progress-pipeline__label">{step.label}</span>
                  </div>
                  {index < pipelineSteps.length - 1 ? (
                    <span
                      className={cn(
                        "career-progress-pipeline__arrow",
                        index < activePipelineIndex && "career-progress-pipeline__arrow--past",
                      )}
                      aria-hidden
                    >
                      →
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="career-progress-bar" aria-hidden>
            <div
              className="career-progress-bar__fill"
              style={{
                width: `${Math.max(pipelineProgress, stats.totalApplications > 0 ? 8 : 0)}%`,
              }}
            />
          </div>
          <p className="career-progress-pipeline__footer">
            {stats.totalApplications > 0
              ? "You're doing the most important part—applying and getting noticed. The right opportunity takes time. You're on your way! ♥"
              : "Add your first application to start tracking your journey. ♥"}
          </p>
        </div>
      </div>

      <div className="career-progress-grid career-progress-grid--bottom mt-4">
        {recentRejections >= 3 ? (
          <div className="career-progress-card career-progress-rejection-card lg:col-span-2">
            <h2 className="career-progress-card__title">This stretch is hard.</h2>
            <p className="career-progress-rejection-card__body">
              Rejection is part of the process — it doesn&apos;t reflect your worth or your potential.
              Here&apos;s what we can see is still working.
            </p>
            <div className="career-progress-strengths career-progress-strengths--compact">
              {strengthTags.slice(0, 4).map((tag) => (
                <span key={tag} className="career-progress-strengths__pill">
                  {tag}
                </span>
              ))}
            </div>
            {onNavigateAiCoach ? (
              <button
                type="button"
                className="career-progress-rejection-card__cta"
                onClick={onNavigateAiCoach}
              >
                Talk to the AI Coach →
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="career-progress-card">
          <h2 className="career-progress-card__title">What you&apos;re known for</h2>
          <div className="career-progress-strengths">
            {strengthTags.map((tag) => (
              <span key={tag} className="career-progress-strengths__pill">
                {tag}
              </span>
            ))}
          </div>
          <div className="career-progress-strengths__quote">
            <Illustration slot="progress.story" size="hero" />
            <p className="career-progress-strengths__quote-text">
              Your perspective is something no one else has. Keep bringing it.
            </p>
          </div>
        </div>

        <div className="career-progress-card">
          <h2 className="career-progress-card__title">What to focus on next</h2>
          <div className="career-progress-focus">
            <div className="career-progress-focus__item">
              <span className="career-progress-focus__icon">
                <Search className="h-4 w-4" />
              </span>
              <div>
                <p className="career-progress-focus__title">Tailor your CV for more roles</p>
                <p className="career-progress-focus__desc">
                  Small changes can make a big difference in German applications.
                </p>
              </div>
              <button
                type="button"
                className="career-progress-focus__btn"
                onClick={onNavigateAiCoach}
              >
                Get coaching →
              </button>
            </div>
            <div className="career-progress-focus__item">
              <span className="career-progress-focus__icon">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="career-progress-focus__title">Highlight your impact</p>
                <p className="career-progress-focus__desc">
                  Add measurable results to your CV sections.
                </p>
              </div>
              <button
                type="button"
                className="career-progress-focus__btn"
                onClick={onOpenResume}
              >
                Refine my CV →
              </button>
            </div>
            <div className="career-progress-focus__item">
              <span className="career-progress-focus__icon">
                <Network className="h-4 w-4" />
              </span>
              <div>
                <p className="career-progress-focus__title">Reach out &amp; grow your network</p>
                <p className="career-progress-focus__desc">
                  Track new applications and follow up with confidence.
                </p>
              </div>
              <button
                type="button"
                className="career-progress-focus__btn"
                onClick={onNavigateApplications}
              >
                Grow my network →
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="career-progress-advanced" aria-label="Detailed statistics and AI analysis">
        <ApplicationStatisticsPage
          folderId={folderId}
          folderName={folderName}
          jobApplications={jobApplications}
          versions={versions}
          outputLanguage={outputLanguage}
          userName={userName}
          userEmail={userEmail}
          onSaveProfile={onSaveProfile}
        />
      </section>

      <div className="career-progress-page__scroll-spacer" aria-hidden />

      {onNavigateAiCoach ? (
        <button type="button" className="career-progress-fab" onClick={onNavigateAiCoach}>
          <Sparkles className="h-4 w-4" aria-hidden />
          AI Career Coach
        </button>
      ) : null}
    </div>
  )
}
