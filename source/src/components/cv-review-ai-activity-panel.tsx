"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { authorshipLabel, providerDisplayName } from "@/lib/ai-transparency"
import {
  buildAuthorshipSummary,
  buildCvSectionAuthorshipGroups,
  readCvSectionAuthorshipPanelExpanded,
  writeCvSectionAuthorshipPanelExpanded,
} from "@/lib/cv-section-authorship"
import {
  buildCvReviewInsights,
  EXPORT_REVIEW_CHECKLIST,
} from "@/lib/cv-review-insights"
import type { ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  GitCompare,
  Sparkles,
} from "lucide-react"

function badgeVariant(label: string): "default" | "secondary" | "outline" {
  if (label === "AI Generated") return "default"
  if (label === "AI Assisted" || label === "Edited by User After AI") return "secondary"
  return "outline"
}

function SuggestionRow({ text, tone }: { text: string; tone: "positive" | "warning" }) {
  const Icon = tone === "positive" ? Check : AlertTriangle
  return (
    <li className="flex gap-2 text-sm leading-snug">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "positive" ? "text-emerald-600" : "text-amber-600",
        )}
        aria-hidden
      />
      <span className="text-muted-foreground">{text}</span>
    </li>
  )
}

function AdvancedMetadataSection({ resume }: { resume: ResumeVersion | null }) {
  const [showMetadata, setShowMetadata] = useState(false)
  const groups = useMemo(() => buildCvSectionAuthorshipGroups(resume), [resume])
  const summary = useMemo(() => buildAuthorshipSummary(groups), [groups])
  const provenance = resume?.aiProvenance

  if (!showMetadata) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-muted-foreground"
        onClick={() => setShowMetadata(true)}
      >
        Show AI metadata
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Advanced transparency
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowMetadata(false)}
        >
          Hide
        </Button>
      </div>
      <dl className="grid gap-1.5 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">User authored</dt>
        <dd>{summary.percentages.user_authored}%</dd>
        <dt className="text-muted-foreground">AI assisted</dt>
        <dd>{summary.percentages.ai_enhanced}%</dd>
        <dt className="text-muted-foreground">AI generated</dt>
        <dd>{summary.percentages.ai_generated}%</dd>
        <dt className="text-muted-foreground">Model</dt>
        <dd>{provenance?.lastModel ?? "Not recorded"}</dd>
        <dt className="text-muted-foreground">Provider</dt>
        <dd>
          {provenance?.lastProviderLabel ??
            providerDisplayName(provenance?.lastProvider) ??
            "Not recorded"}
        </dd>
        <dt className="text-muted-foreground">Last AI update</dt>
        <dd>
          {provenance?.lastAiUpdateAt
            ? new Date(provenance.lastAiUpdateAt).toLocaleString()
            : "—"}
        </dd>
      </dl>
      {groups.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Section authorship metadata">
          {groups.map((group) => (
            <li
              key={group.section}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium">{group.section}</span>
              <Badge variant={badgeVariant(authorshipLabel(group.label))} className="text-[10px]">
                {authorshipLabel(group.label)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function CvReviewAiActivityPanel({
  resume,
  onReviewChanges,
  onLearnMore,
}: {
  resume: ResumeVersion | null
  onReviewChanges?: () => void
  onLearnMore?: () => void
}) {
  const insights = useMemo(() => buildCvReviewInsights(resume), [resume])
  const [expanded, setExpanded] = useState(false)
  const [showContributionDetails, setShowContributionDetails] = useState(false)

  useEffect(() => {
    setExpanded(readCvSectionAuthorshipPanelExpanded())
  }, [])

  const handleExpandedChange = (open: boolean) => {
    setExpanded(open)
    writeCvSectionAuthorshipPanelExpanded(open)
  }

  const hasResumeText = Boolean(resume?.resumeText?.trim())
  const showScore = hasResumeText && insights.score > 0
  const showContribution =
    insights.aiAssistedSections > 0 || insights.userWrittenSections > 0

  const collapsedSummary = insights.hasAiActivity
    ? `${insights.recentAiActions[0] ?? "AI changes to review"}`
    : hasResumeText
      ? insights.suggestions[0]?.text ?? "Review your CV before applying"
      : "Open a CV to see review guidance"

  return (
    <Collapsible open={expanded} onOpenChange={handleExpandedChange}>
      <Card
        className="ui-workspace-card gap-0 rounded-lg border-[var(--border)] py-0 shadow-none"
        id="cv-review-ai-activity"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full min-h-11 items-center gap-3 px-4 py-3 text-left transition-colors",
              "hover:bg-[var(--bg-page)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2",
              expanded && "border-b border-border/60",
            )}
            aria-expanded={expanded}
            aria-controls="cv-review-ai-activity-content"
          >
            {!expanded && showScore ? (
              <span className="ui-score-ring shrink-0" aria-label={`Resume score ${insights.score} percent`}>
                {insights.score}
              </span>
            ) : (
              <ClipboardCheck className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden />
            )}
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm font-semibold text-foreground">
                CV Review &amp; AI Activity
              </span>
              <span className="block text-xs text-muted-foreground leading-snug">
                Actionable guidance to improve your CV before you apply.
              </span>
              {!expanded ? (
                <span className="block text-xs text-foreground/80">
                  {showScore ? `Resume score: ${insights.score}% · ` : ""}
                  {collapsedSummary}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 self-center min-h-11 px-1">
              <span className="text-xs font-medium text-muted-foreground">
                {expanded ? "Collapse" : "Expand"}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  expanded && "rotate-180",
                )}
                aria-hidden
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent id="cv-review-ai-activity-content">
          <div className="space-y-4 px-4 pb-4 pt-3">
            {hasResumeText ? (
              <section aria-labelledby="cv-improvement-summary-heading">
                <h3
                  id="cv-improvement-summary-heading"
                  className="text-sm font-semibold text-foreground mb-2"
                >
                  CV improvement summary
                </h3>
                <div className="rounded-lg border bg-background p-3 space-y-3">
                  {showScore ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Resume score</span>
                        <span className="ui-score-ring text-base" aria-hidden>
                          {insights.score}
                        </span>
                      </div>
                      <Progress value={insights.score} className="h-2" aria-hidden />
                    </>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Suggestions</p>
                    <ul className="space-y-2">
                      {insights.suggestions.map((item) => (
                        <SuggestionRow key={item.text} text={item.text} tone={item.tone} />
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            ) : null}

            {insights.hasAiActivity ? (
              <section aria-labelledby="recent-ai-changes-heading">
                <h3
                  id="recent-ai-changes-heading"
                  className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                  Recent AI changes
                </h3>
                <div className="rounded-lg border bg-background p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">The AI recently:</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {insights.recentAiActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                  {onReviewChanges ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs mt-1"
                      onClick={onReviewChanges}
                    >
                      <GitCompare className="h-3.5 w-3.5" aria-hidden />
                      Review changes
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showContribution ? (
              <section aria-labelledby="ai-contribution-heading">
                <h3 id="ai-contribution-heading" className="text-sm font-semibold text-foreground mb-2">
                  AI contribution
                </h3>
                <div className="rounded-lg border bg-background p-3 space-y-2 text-sm">
                  {insights.aiAssistedSections > 0 ? (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">AI assisted:</span>{" "}
                      {insights.aiAssistedSections} section
                      {insights.aiAssistedSections === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  {insights.userWrittenSections > 0 ? (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">User written:</span>{" "}
                      {insights.userWrittenSections} section
                      {insights.userWrittenSections === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-0 text-xs text-primary"
                    onClick={() => setShowContributionDetails((value) => !value)}
                  >
                    {showContributionDetails ? "Hide details" : "View details"}
                  </Button>
                  {showContributionDetails ? (
                    <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2">
                      Section counts are based on approved AI edits in your change history. Your CV
                      preview and exports stay clean — this is editor guidance only.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="review-before-export-heading">
              <h3
                id="review-before-export-heading"
                className="text-sm font-semibold text-foreground mb-2"
              >
                Review before export
              </h3>
              <ul className="space-y-2 rounded-lg border bg-background p-3">
                {EXPORT_REVIEW_CHECKLIST.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {onLearnMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onLearnMore}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Learn more about AI assistance
              </Button>
            ) : null}

            <section aria-labelledby="advanced-info-heading" className="border-t pt-3">
              <h3
                id="advanced-info-heading"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
              >
                Advanced information
              </h3>
              <AdvancedMetadataSection resume={resume} />
            </section>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
