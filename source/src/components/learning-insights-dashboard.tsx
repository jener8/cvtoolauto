"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { analyzeWorkspaceForLearning } from "@/lib/personal-learning/analyze-workspace"
import {
  clearLearningMemory,
  deleteAllPersonalLearningData,
  loadLearningMemory,
  loadLearningSettings,
  saveLearningMemory,
  setApplicationExcludedFromLearning,
  updateInsightInMemory,
} from "@/lib/personal-learning/storage"
import type {
  InsightConfidence,
  LearnedInsight,
  PersonalLearningMemory,
} from "@/lib/personal-learning/types"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { getCurrentOutcome, getCurrentStage } from "@/lib/application-pipeline"
import { getPipelineSummaryLabel } from "@/lib/translations"
import {
  BarChart3,
  Brain,
  FileText,
  Shield,
  Trash2,
  X,
} from "lucide-react"

function confidenceLabel(c: InsightConfidence): string {
  return c === "high" ? "High" : c === "medium" ? "Medium" : "Low"
}

function confidenceVariant(c: InsightConfidence): "default" | "secondary" | "outline" {
  if (c === "high") return "default"
  if (c === "medium") return "secondary"
  return "outline"
}

function mergeAnalyzedWithExisting(
  analyzed: PersonalLearningMemory,
  existing: PersonalLearningMemory,
): PersonalLearningMemory {
  const prevById = new Map(existing.insights.map((i) => [i.id, i]))
  const mergedAnalyzed = analyzed.insights.map((a) => {
    const prev = prevById.get(a.id)
    if (!prev) return a
    return {
      ...a,
      dismissed: prev.dismissed,
      userCorrection: prev.userCorrection,
    }
  })
  const conversationOnly = existing.insights.filter(
    (e) =>
      e.source === "conversation" &&
      !mergedAnalyzed.some((a) => a.id === e.id),
  )
  return {
    ...analyzed,
    insights: [...conversationOnly, ...mergedAnalyzed].slice(0, 30),
  }
}

function jobDisplayLabel(job: JobApplication): string {
  const c = job.company?.trim() || "Unknown company"
  const t = job.jobTitle?.trim() || "Role"
  return `${c} — ${t}`
}

export interface LearningInsightsDashboardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string
  versions: ResumeVersion[]
  jobApplications: JobApplication[]
  onMemoryUpdated?: (memory: PersonalLearningMemory) => void
}

export function LearningInsightsDashboard({
  open,
  onOpenChange,
  folderId,
  versions,
  jobApplications,
  onMemoryUpdated,
}: LearningInsightsDashboardProps) {
  const [memory, setMemory] = useState<PersonalLearningMemory | null>(null)
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [learningEnabled, setLearningEnabled] = useState(true)

  const reanalyze = useCallback(() => {
    if (!folderId) return
    const settings = loadLearningSettings(folderId)
    setExcludedIds(settings.excludedApplicationIds)
    setLearningEnabled(settings.enabled)
    if (!settings.enabled) {
      const loaded = loadLearningMemory(folderId)
      setMemory(loaded)
      onMemoryUpdated?.(loaded)
      return
    }
    const analyzed = analyzeWorkspaceForLearning({
      folderId,
      versions,
      jobs: jobApplications,
      excludedApplicationIds: settings.excludedApplicationIds,
    })
    const existing = loadLearningMemory(folderId)
    const merged = mergeAnalyzedWithExisting(analyzed, existing)
    saveLearningMemory(merged)
    setMemory(merged)
    onMemoryUpdated?.(merged)
  }, [folderId, versions, jobApplications, onMemoryUpdated])

  useEffect(() => {
    if (open) reanalyze()
  }, [open, reanalyze])

  const folderJobs = useMemo(
    () =>
      jobApplications.filter((j) => !j.folderId || j.folderId === folderId),
    [jobApplications, folderId],
  )

  const activeInsights = useMemo(
    () => memory?.insights.filter((i) => !i.dismissed) ?? [],
    [memory],
  )

  const handleToggleExclude = (applicationId: string, excluded: boolean) => {
    const next = setApplicationExcludedFromLearning(folderId, applicationId, excluded)
    setExcludedIds(next.excludedApplicationIds)
    reanalyze()
  }

  const handleDismissInsight = (insightId: string) => {
    const updated = updateInsightInMemory(folderId, insightId, { dismissed: true })
    setMemory(updated)
    onMemoryUpdated?.(updated)
  }

  const handleSaveCorrection = (insightId: string, correction: string) => {
    const updated = updateInsightInMemory(folderId, insightId, {
      userCorrection: correction.trim() || null,
      source: "user_correction",
    })
    setMemory(updated)
    onMemoryUpdated?.(updated)
  }

  const handleReset = () => {
    clearLearningMemory(folderId)
    reanalyze()
  }

  const handleDeleteAll = () => {
    deleteAllPersonalLearningData(folderId)
    setMemory(loadLearningMemory(folderId))
    setExcludedIds([])
    onMemoryUpdated?.(loadLearningMemory(folderId))
  }

  const m = memory?.metrics

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Insight &amp; learning dashboard
          </DialogTitle>
          <DialogDescription>
            What the AI has learned from <strong>this workspace only</strong> — treated as
            evidence, not facts. You can review, correct, or exclude data at any time.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0 px-6 pb-6">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="insights">
              Insights ({activeInsights.length})
            </TabsTrigger>
            <TabsTrigger value="controls">Your control</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4 overflow-y-auto max-h-[55vh]">
            {!learningEnabled && (
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
                Personal learning is turned off. Enable it in AI Assistant settings to refresh
                patterns.
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricCard
                label="Applications"
                value={String(memory?.stats.totalApplications ?? 0)}
              />
              <MetricCard
                label="Interview / offer"
                value={String(memory?.stats.interviewOrOfferCount ?? 0)}
              />
              <MetricCard
                label="Interview rate"
                value={
                  m?.interviewRate != null
                    ? `~${Math.round(m.interviewRate * 100)}%`
                    : "—"
                }
                hint="Evidence-based; small samples = low confidence"
              />
              <MetricCard
                label="Rejections"
                value={String(m?.rejectionCount ?? 0)}
              />
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents analyzed
              </h3>
              <ul className="text-sm text-muted-foreground grid grid-cols-2 gap-1">
                <li>{m?.documentsAnalyzed.resumes ?? 0} resumes</li>
                <li>{m?.documentsAnalyzed.jobDescriptions ?? 0} job descriptions</li>
                <li>{m?.documentsAnalyzed.coverLetters ?? 0} cover letters</li>
                <li>{m?.documentsAnalyzed.interviewNotes ?? 0} interview note sets</li>
              </ul>
            </section>

            {(m?.roleTypeStats.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Outcomes by role type</h3>
                <ul className="text-sm space-y-1">
                  {m!.roleTypeStats.slice(0, 6).map((r) => (
                    <li key={r.role} className="flex justify-between gap-2">
                      <span className="truncate">{r.role}</span>
                      <span className="text-muted-foreground shrink-0">
                        {r.interviewOrOffer}/{r.total} interview+
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(m?.topKeywords.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Top keywords (job descriptions)</h3>
                <div className="flex flex-wrap gap-1.5">
                  {m!.topKeywords.slice(0, 10).map((k) => (
                    <Badge key={k.keyword} variant="outline" className="text-xs">
                      {k.keyword}{" "}
                      <span className="text-muted-foreground">
                        ({k.successfulApps}/{k.totalApps} success)
                      </span>
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {(m?.resumeVersionStats.length ?? 0) > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Resume versions linked</h3>
                <ul className="text-sm space-y-1">
                  {m!.resumeVersionStats.slice(0, 5).map((rv) => (
                    <li key={rv.versionId} className="flex justify-between gap-2">
                      <span className="truncate">{rv.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {rv.successfulApplications}/{rv.linkedApplications} success
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-xs text-muted-foreground flex items-start gap-2 border-t pt-3">
              <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Patterns are derived only from your applications in this folder — never from other
              users. The AI should cite confidence and evidence when using these insights.
            </p>
          </TabsContent>

          <TabsContent value="insights" className="mt-4 overflow-y-auto max-h-[55vh] space-y-3">
            {activeInsights.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No insights yet. Add applications with job descriptions and update statuses
                (interview, offer, rejected) to build evidence.
              </p>
            ) : (
              activeInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onDismiss={() => handleDismissInsight(insight.id)}
                  onSaveCorrection={(text) => handleSaveCorrection(insight.id, text)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="controls" className="mt-4 overflow-y-auto max-h-[55vh] space-y-4">
            <section className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Exclude applications from learning
              </h3>
              <p className="text-xs text-muted-foreground">
                Excluded applications are not used to detect patterns. Your saved application
                data is not deleted.
              </p>
              {folderJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications in this workspace.</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {folderJobs.map((job) => {
                    const excluded = excludedIds.includes(job.id)
                    return (
                      <li key={job.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          id={`exclude-${job.id}`}
                          checked={excluded}
                          onCheckedChange={(checked) =>
                            handleToggleExclude(job.id, checked === true)
                          }
                        />
                        <label
                          htmlFor={`exclude-${job.id}`}
                          className="cursor-pointer leading-snug flex-1"
                        >
                          {jobDisplayLabel(job)}
                          <span className="block text-xs text-muted-foreground">
                            {getPipelineSummaryLabel(
                              "en",
                              getCurrentStage(job),
                              getCurrentOutcome(job),
                            )}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Reset or delete</h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  Reset learned insights
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={handleDeleteAll}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete all AI memory
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Reset clears analyzed patterns. Delete also removes assistant chat history for
                this workspace.
              </p>
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function InsightCard({
  insight,
  onDismiss,
  onSaveCorrection,
}: {
  insight: LearnedInsight
  onDismiss: () => void
  onSaveCorrection: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(insight.userCorrection ?? "")

  const displayText = insight.userCorrection?.trim() || insight.text
  const e = insight.evidence

  return (
    <article className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Badge variant={confidenceVariant(insight.confidence)} className="text-[10px]">
            {confidenceLabel(insight.confidence)} confidence
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {insight.category.replace(/_/g, " ")}
          </Badge>
          {insight.userCorrection && (
            <Badge variant="secondary" className="text-[10px]">
              Your correction
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss insight"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="font-medium leading-snug">{displayText}</p>

      {insight.why && (
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-foreground/80">Why: </span>
          {insight.why}
        </p>
      )}

      {e && (
        <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 rounded px-2 py-1.5">
          {e.sampleCount != null && e.totalConsidered != null && (
            <p>
              Evidence: {e.sampleCount} of {e.totalConsidered} applications in this workspace
            </p>
          )}
          {e.pattern && (
            <p>
              Pattern: <code className="text-[10px]">{e.pattern}</code>
            </p>
          )}
          {e.documentTypes?.length ? (
            <p>Documents: {e.documentTypes.join(", ").replace(/_/g, " ")}</p>
          ) : null}
          {e.applicationLabels?.length ? (
            <p className="line-clamp-2">
              Applications: {e.applicationLabels.join(" · ")}
            </p>
          ) : null}
        </div>
      )}

      {editing ? (
        <div className="space-y-2 pt-1">
          <Label className="text-xs">Correct this assumption</Label>
          <Textarea
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            rows={2}
            className="text-xs"
            placeholder="How the AI should treat this pattern instead…"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onSaveCorrection(draft)
                setEditing(false)
              }}
            >
              Save correction
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setDraft(insight.userCorrection ?? "")
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={() => setEditing(true)}
        >
          Correct this insight
        </Button>
      )}
    </article>
  )
}
