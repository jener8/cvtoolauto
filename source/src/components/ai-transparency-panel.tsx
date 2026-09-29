"use client"

import { useEffect, useMemo, useState } from "react"
import { getAiTransparencyInfo, type AiTransparencyInfo } from "@/app/actions/ai-transparency-info"
import { CvEditDiffDialog } from "@/components/cv-edit-diff-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mergeAiActivityLog, type AiActivityEntry } from "@/lib/ai-activity-log"
import { AI_DATA_USAGE_POINTS } from "@/lib/gdpr-data-policy"
import {
  approvalStatusLabel,
  authorshipLabel,
  buildProvenanceSummary,
  confidenceLabel,
  computeAiContribution,
} from "@/lib/ai-transparency"
import { snapshotToDisplayResume } from "@/lib/resume-version-history"
import type { ResumeVersion } from "@/lib/types"
import {
  Bot,
  GitCompare,
  History,
  Info,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react"

function formatTimestamp(ts?: number): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ContributionBar({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="space-y-1.5" role="group" aria-label={`${label}: ${value}%`}>
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <Progress value={value} className="h-2" aria-hidden />
    </div>
  )
}

type DiffMode = "original_accepted" | "original_suggested" | "suggested_accepted"

export function AiTransparencyPanel({
  resume,
  allResumes = [],
  folderId,
  onOpenHowAiWorks,
  onOpenPrivacyCentre,
  onRestoreSnapshot,
}: {
  resume: ResumeVersion | null
  allResumes?: ResumeVersion[]
  folderId?: string | null
  onOpenHowAiWorks?: () => void
  onOpenPrivacyCentre?: () => void
  onRestoreSnapshot?: (resumeId: string, snapshotId: string) => void
}) {
  const [liveInfo, setLiveInfo] = useState<AiTransparencyInfo | null>(null)
  const [diffSnapshotId, setDiffSnapshotId] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<DiffMode>("original_accepted")
  const [versionDiff, setVersionDiff] = useState<{
    title: string
    changes: import("@/lib/cv-edit-types").CvEditChange[]
    previousResumeText: string
    newResumeText: string
  } | null>(null)

  useEffect(() => {
    void getAiTransparencyInfo().then(setLiveInfo).catch(() => setLiveInfo(null))
  }, [])

  const activityLog = useMemo(() => {
    if (!folderId) {
      return (resume?.aiAuditLog ?? []).map((e) => ({
        ...e,
        resumeId: resume?.id,
        resumeName: resume?.name,
      }))
    }
    return mergeAiActivityLog(allResumes.length > 0 ? allResumes : resume ? [resume] : [], folderId)
  }, [folderId, allResumes, resume])

  const provenance = useMemo(
    () => resume?.aiProvenance ?? (resume ? buildProvenanceSummary(resume) : undefined),
    [resume],
  )
  const contribution = useMemo(
    () => (resume ? computeAiContribution(resume) : provenance?.contribution),
    [resume, provenance],
  )

  const lastAction = activityLog[activityLog.length - 1]

  const displayResume = resume ?? allResumes[0] ?? null

  const diffEntry = useMemo(() => {
    if (!diffSnapshotId || !displayResume) return null
    const snapshot = displayResume.versionHistory?.find((s) => s.id === diffSnapshotId)
    if (!snapshot) return null
    const meta = snapshot.aiMetadata
    const original = snapshot.resumeText
    const suggested = meta?.suggestedResumeText ?? meta?.acceptedResumeText ?? displayResume.resumeText
    const accepted = meta?.acceptedResumeText ?? displayResume.resumeText

    if (diffMode === "original_suggested") {
      return {
        changes: meta?.changes ?? [],
        previousResumeText: original,
        newResumeText: suggested,
        title: `${snapshot.label} — Original vs AI suggestion`,
      }
    }
    if (diffMode === "suggested_accepted") {
      return {
        changes: meta?.changes ?? [],
        previousResumeText: suggested,
        newResumeText: accepted,
        title: `${snapshot.label} — AI suggestion vs accepted`,
      }
    }
    return {
      changes: meta?.changes ?? [],
      previousResumeText: original,
      newResumeText: accepted,
      title: `${snapshot.label} — Original vs accepted`,
    }
  }, [diffSnapshotId, displayResume, diffMode])

  const versionHistory = useMemo(() => {
    if (!displayResume?.versionHistory?.length) return []
    return [...displayResume.versionHistory].sort((a, b) => b.createdAt - a.createdAt)
  }, [displayResume])

  return (
    <Card
      id="ai-transparency-panel"
      className="ui-workspace-card min-w-0 gap-0 rounded-lg border-[var(--border)] py-0 shadow-none"
      role="region"
      aria-label="AI Transparency"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              AI Transparency
            </CardTitle>
            <CardDescription className="mt-1">
              Model details, activity log, version history, and authorship — trust by design.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {onOpenHowAiWorks && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={onOpenHowAiWorks}
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
                How AI is used
              </Button>
            )}
            {onOpenPrivacyCentre && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={onOpenPrivacyCentre}
              >
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Privacy Centre
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activity" className="w-full min-w-0">
          <TabsList
            className="!grid h-auto w-full min-w-0 grid-cols-2 gap-1 p-1"
            aria-label="AI Transparency sections"
          >
            <TabsTrigger
              value="activity"
              className="!flex h-auto min-h-9 w-full min-w-0 flex-none items-center justify-start gap-1.5 whitespace-normal px-2 py-2 text-left text-xs"
            >
              <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Activity log</span>
            </TabsTrigger>
            <TabsTrigger
              value="info"
              className="!flex h-auto min-h-9 w-full min-w-0 flex-none items-center justify-start gap-1.5 whitespace-normal px-2 py-2 text-left text-xs"
            >
              <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>AI info</span>
            </TabsTrigger>
            <TabsTrigger
              value="authorship"
              className="!flex h-auto min-h-9 w-full min-w-0 flex-none items-center justify-start gap-1.5 whitespace-normal px-2 py-2 text-left text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Authorship</span>
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="!flex h-auto min-h-9 w-full min-w-0 flex-none items-center justify-start gap-1.5 whitespace-normal px-2 py-2 text-left text-xs"
            >
              <GitCompare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Versions</span>
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="!flex h-auto min-h-9 w-full min-w-0 flex-none items-center justify-start gap-1.5 whitespace-normal px-2 py-2 text-left text-xs col-span-2"
            >
              <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Data use</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-3">
            <div
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              id="ai-activity-announcer"
            />
            {activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground font-medium" role="status">
                No AI activity yet.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="AI Activity Log">
                {[...activityLog].reverse().map((entry) => (
                  <ActivityRow
                    key={entry.id}
                    entry={entry}
                    onViewDiff={
                      entry.snapshotId
                        ? () => {
                            setDiffMode("original_accepted")
                            setDiffSnapshotId(entry.snapshotId!)
                          }
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-4 space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">AI provider</dt>
              <dd>{provenance?.lastProviderLabel ?? liveInfo?.providerLabel ?? "Not configured"}</dd>
              <dt className="text-muted-foreground">Model</dt>
              <dd>{provenance?.lastModel ?? liveInfo?.model ?? "Not configured"}</dd>
              <dt className="text-muted-foreground">Model version</dt>
              <dd>{provenance?.lastModel ?? liveInfo?.model ?? "—"}</dd>
              <dt className="text-muted-foreground">Last AI action</dt>
              <dd>
                {lastAction ? (
                  <span>
                    {lastAction.action}{" "}
                    <span className="text-muted-foreground">
                      · {formatTimestamp(lastAction.approvedAt ?? lastAction.rejectedAt ?? lastAction.createdAt)}
                    </span>
                  </span>
                ) : (
                  "No AI actions yet"
                )}
              </dd>
              <dt className="text-muted-foreground">Human approval required</dt>
              <dd>
                <strong>Yes</strong> — AI never changes your CV without Accept
              </dd>
              <dt className="text-muted-foreground">Training on user data</dt>
              <dd>
                <strong>No</strong> — your documents are not used to train AI models
              </dd>
              <dt className="text-muted-foreground">Last generation</dt>
              <dd>
                <time
                  dateTime={
                    provenance?.lastAiUpdateAt
                      ? new Date(provenance.lastAiUpdateAt).toISOString()
                      : undefined
                  }
                >
                  {formatTimestamp(provenance?.lastAiUpdateAt)}
                </time>
              </dd>
            </dl>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">AI features used</p>
              {provenance?.featuresUsed && provenance.featuresUsed.length > 0 ? (
                <ul className="text-sm space-y-1 list-disc pl-4 text-foreground">
                  {provenance.featuresUsed.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No features logged yet.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="authorship" className="mt-4 space-y-4">
            {activityLog.length > 0 && (
              <div className="space-y-2" aria-label="Section authorship markers">
                <p className="text-xs font-medium text-muted-foreground">Sections marked by AI</p>
                <ul className="space-y-1.5">
                  {[...activityLog]
                    .reverse()
                    .flatMap((entry) => entry.changes ?? [])
                    .slice(0, 16)
                    .map((change, index) => (
                      <li
                        key={`${change.section}-${index}`}
                        className="flex flex-wrap items-center gap-2 text-xs rounded-md border px-2 py-1.5 bg-background"
                      >
                        <span className="font-medium">{change.section}</span>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {authorshipLabel(change.authorship ?? "ai_enhanced")}
                        </Badge>
                        {change.description && (
                          <span className="text-muted-foreground">{change.description}</span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {contribution ? (
              <div className="space-y-3" aria-label="AI contribution dashboard">
                <p className="text-xs font-medium text-muted-foreground">Estimated contribution</p>
                <ContributionBar
                  label="User Authored"
                  value={contribution.userAuthoredPercent}
                  icon={<span aria-hidden>✎</span>}
                />
                <ContributionBar
                  label="AI Assisted"
                  value={contribution.aiAssistedPercent}
                  icon={<Bot className="h-3.5 w-3.5" aria-hidden />}
                />
                <ContributionBar
                  label="AI Generated"
                  value={contribution.aiGeneratedPercent}
                  icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Authorship breakdown appears after your first AI interaction.
              </p>
            )}
          </TabsContent>

          <TabsContent value="versions" className="mt-4 space-y-3">
            {!displayResume ? (
              <p className="text-sm text-muted-foreground">Open or save a CV to view version history.</p>
            ) : versionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Version history builds as you save edits. AI-approved changes create snapshots you
                can compare and restore.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="Document version history">
                {versionHistory.map((snapshot) => {
                  const sourceLabel =
                    snapshot.source === "ai_edit"
                      ? "AI Assisted"
                      : snapshot.source === "generation"
                        ? "AI Generated"
                        : snapshot.source === "restore"
                          ? "Restored"
                          : "User Authored"
                  return (
                    <li
                      key={snapshot.id}
                      className="rounded-lg border px-3 py-2.5 text-sm space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{snapshot.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {sourceLabel}
                        </Badge>
                        {snapshot.aiMetadata?.model && (
                          <Badge variant="secondary" className="text-[10px]">
                            {snapshot.aiMetadata.model}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <time dateTime={new Date(snapshot.createdAt).toISOString()}>
                          {formatTimestamp(snapshot.createdAt)}
                        </time>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setDiffMode("original_accepted")
                            setDiffSnapshotId(snapshot.id)
                          }}
                        >
                          <GitCompare className="h-3.5 w-3.5" aria-hidden />
                          Compare
                        </Button>
                        {snapshot.aiMetadata?.suggestedResumeText && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setDiffMode("original_suggested")
                              setDiffSnapshotId(snapshot.id)
                            }}
                          >
                            View AI suggestion
                          </Button>
                        )}
                        {onRestoreSnapshot && displayResume && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => onRestoreSnapshot(displayResume.id, snapshot.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            Restore
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const display = snapshotToDisplayResume(displayResume, snapshot)
                            setVersionDiff({
                              title: `Preview: ${snapshot.label}`,
                              changes: snapshot.aiMetadata?.changes ?? [],
                              previousResumeText: displayResume.resumeText,
                              newResumeText: display.resumeText,
                            })
                          }}
                        >
                          Preview version
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="data" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              How your data is used when AI features are enabled (GDPR transparency).
            </p>
            <ul className="space-y-2">
              {AI_DATA_USAGE_POINTS.map((point) => (
                <li key={point.id} className="rounded-md border px-3 py-2 text-sm">
                  <p className="font-medium">{point.title}</p>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{point.body}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </CardContent>

      {diffEntry && (
        <CvEditDiffDialog
          open={Boolean(diffEntry)}
          onOpenChange={(open) => !open && setDiffSnapshotId(null)}
          changes={diffEntry.changes}
          previousResumeText={diffEntry.previousResumeText}
          newResumeText={diffEntry.newResumeText}
          title={diffEntry.title}
        />
      )}
      {versionDiff && (
        <CvEditDiffDialog
          open={Boolean(versionDiff)}
          onOpenChange={(open) => !open && setVersionDiff(null)}
          changes={versionDiff.changes}
          previousResumeText={versionDiff.previousResumeText}
          newResumeText={versionDiff.newResumeText}
          title={versionDiff.title}
        />
      )}
    </Card>
  )
}

function ActivityRow({
  entry,
  onViewDiff,
}: {
  entry: AiActivityEntry
  onViewDiff?: () => void
}) {
  const when = entry.approvedAt ?? entry.rejectedAt ?? entry.createdAt
  return (
    <li className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm space-y-1">
      <time className="text-[11px] text-muted-foreground" dateTime={new Date(when).toISOString()}>
        {formatTimestamp(when)}
      </time>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{entry.action}</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          {entry.model}
        </Badge>
        <Badge
          variant={entry.approvalStatus === "approved" ? "secondary" : "outline"}
          className="text-[10px] font-normal"
        >
          {approvalStatusLabel(entry.approvalStatus)}
        </Badge>
      </div>
      {entry.resumeName && (
        <p className="text-xs text-muted-foreground">CV: {entry.resumeName}</p>
      )}
      {entry.explainability?.rationale && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why: </span>
          {entry.explainability.rationale}
          {entry.explainability.confidence && (
            <span className="ml-1">
              (Confidence: {confidenceLabel(entry.explainability.confidence)})
            </span>
          )}
        </p>
      )}
      {onViewDiff && entry.approvalStatus === "approved" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={onViewDiff}
        >
          <GitCompare className="h-3.5 w-3.5" aria-hidden />
          Original · suggestion · accepted
        </Button>
      )}
    </li>
  )
}
