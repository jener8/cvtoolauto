"use client"

import { useEffect, useMemo, useState } from "react"
import { getAiTransparencyInfo } from "@/app/actions/ai-transparency-info"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { buildWorkspaceAiOversight } from "@/lib/workspace-ai-oversight"
import type { ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

const TRUST_POINTS = [
  "User remains in control",
  "No automatic document changes",
  "AI suggestions require approval",
] as const

const LITERACY_POINTS = [
  "Accuracy — facts match your real experience",
  "Completeness — nothing important is missing",
  "Personal authenticity — the wording sounds like you",
] as const

function StatusLine({
  children,
  variant = "positive",
}: {
  children: React.ReactNode
  variant?: "positive" | "neutral" | "warning"
}) {
  const Icon = variant === "warning" ? Circle : Check
  return (
    <li className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          variant === "positive" && "text-emerald-600",
          variant === "neutral" && "text-[var(--brand-teal)]",
          variant === "warning" && "text-amber-600",
        )}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  )
}

export function WorkspaceAiOversightPanel({
  folderId,
  allResumes = [],
  onLearnMore,
  onOpenHowAiWorks,
}: {
  folderId?: string | null
  allResumes?: ResumeVersion[]
  onLearnMore?: () => void
  onOpenHowAiWorks?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [liveProvider, setLiveProvider] = useState<string | null>(null)
  const [liveModel, setLiveModel] = useState<string | null>(null)

  useEffect(() => {
    void getAiTransparencyInfo()
      .then((info) => {
        if (info.configured) {
          setLiveProvider(info.providerLabel)
          setLiveModel(info.model)
        }
      })
      .catch(() => {})
  }, [])

  const oversight = useMemo(
    () => buildWorkspaceAiOversight(folderId, allResumes),
    [folderId, allResumes],
  )

  const providerLabel = oversight.providerLabel ?? liveProvider
  const model = oversight.model ?? liveModel

  const collapsedSummary = oversight.hasActivity
    ? `${oversight.recentActions.length} recent AI action${oversight.recentActions.length === 1 ? "" : "s"} · You remain in control`
    : "See what AI has done in this workspace and what you have reviewed"

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card
        className="ui-workspace-card gap-0 rounded-lg border-[var(--border)] py-0 shadow-none"
        id="workspace-ai-oversight"
        role="region"
        aria-label="AI Activity and Human Oversight"
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
            aria-controls="workspace-ai-oversight-content"
          >
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-[var(--brand-teal)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm font-semibold text-foreground">
                AI Activity &amp; Human Oversight
              </span>
              <span className="block text-xs text-muted-foreground leading-snug">
                What AI has done, what you reviewed, and who stays in control.
              </span>
              {!expanded ? (
                <span className="block text-xs text-foreground/80">{collapsedSummary}</span>
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

        <CollapsibleContent id="workspace-ai-oversight-content">
          <div className="space-y-4 px-4 pb-4 pt-3">
            <section aria-labelledby="recent-ai-actions-heading">
              <h3
                id="recent-ai-actions-heading"
                className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"
              >
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Recent AI actions
              </h3>
              <div className="rounded-lg border bg-background p-3">
                {oversight.recentActions.length > 0 ? (
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {oversight.recentActions.map((action) => (
                      <li key={action} className="flex gap-2">
                        <span className="text-muted-foreground" aria-hidden>
                          •
                        </span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No AI actions in this workspace yet. When you generate cover letters,
                    tailor CVs, or accept AI suggestions, they will appear here.
                  </p>
                )}
              </div>
            </section>

            {(oversight.approvedCount > 0 ||
              oversight.rejectedCount > 0 ||
              oversight.pendingCount > 0) && (
              <section aria-labelledby="human-review-heading">
                <h3 id="human-review-heading" className="text-sm font-semibold text-foreground mb-2">
                  Human review status
                </h3>
                <ul className="rounded-lg border bg-background p-3 space-y-2">
                  {oversight.approvedCount > 0 ? (
                    <StatusLine>
                      {oversight.approvedCount} AI suggestion
                      {oversight.approvedCount === 1 ? "" : "s"} approved
                    </StatusLine>
                  ) : null}
                  {oversight.rejectedCount > 0 ? (
                    <StatusLine variant="warning">
                      {oversight.rejectedCount} AI suggestion
                      {oversight.rejectedCount === 1 ? "" : "s"} rejected
                    </StatusLine>
                  ) : null}
                  {oversight.pendingCount > 0 ? (
                    <StatusLine variant="warning">
                      {oversight.pendingCount} suggestion
                      {oversight.pendingCount === 1 ? "" : "s"} awaiting your review
                    </StatusLine>
                  ) : null}
                  {oversight.allSuggestionsReviewed ? (
                    <StatusLine>All AI suggestions in this workspace have been reviewed</StatusLine>
                  ) : null}
                </ul>
              </section>
            )}

            {(providerLabel || model || oversight.featuresUsed.length > 0) && (
              <section aria-labelledby="transparency-heading">
                <h3 id="transparency-heading" className="text-sm font-semibold text-foreground mb-2">
                  Transparency
                </h3>
                <dl className="rounded-lg border bg-background p-3 grid gap-2 text-sm">
                  {providerLabel ? (
                    <>
                      <dt className="text-muted-foreground">Provider</dt>
                      <dd className="font-medium">{providerLabel}</dd>
                    </>
                  ) : null}
                  {model ? (
                    <>
                      <dt className="text-muted-foreground">Model</dt>
                      <dd className="font-medium">{model}</dd>
                    </>
                  ) : null}
                  {oversight.featuresUsed.length > 0 ? (
                    <div className="col-span-full pt-1">
                      <dt className="text-muted-foreground mb-1.5">Features used in this workspace</dt>
                      <dd>
                        <ul className="space-y-1">
                          {oversight.featuresUsed.map((feature) => (
                            <li key={feature} className="flex gap-2 text-foreground">
                              <span className="text-muted-foreground" aria-hidden>
                                •
                              </span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            )}

            <section aria-labelledby="trust-status-heading">
              <h3 id="trust-status-heading" className="text-sm font-semibold text-foreground mb-2">
                Trust status
              </h3>
              <ul className="rounded-lg border bg-background p-3 space-y-2">
                {TRUST_POINTS.map((point) => (
                  <StatusLine key={point}>{point}</StatusLine>
                ))}
              </ul>
            </section>

            <section aria-labelledby="ai-literacy-heading">
              <h3 id="ai-literacy-heading" className="text-sm font-semibold text-foreground mb-2">
                AI literacy
              </h3>
              <div className="rounded-lg border bg-background p-3 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AI-generated content should be reviewed for:
                </p>
                <ul className="space-y-1.5">
                  {LITERACY_POINTS.map((point) => (
                    <li key={point} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-foreground font-medium shrink-0">
                        {point.split(" — ")[0]}
                      </span>
                      <span>— {point.split(" — ")[1]}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  {onLearnMore ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={onLearnMore}
                    >
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                      Learn more
                    </Button>
                  ) : null}
                  {onOpenHowAiWorks ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={onOpenHowAiWorks}
                    >
                      How AI is used
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
