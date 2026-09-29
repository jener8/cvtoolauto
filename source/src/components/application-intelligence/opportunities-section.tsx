"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { JobApplication, ResumeVersion } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Save,
  Sparkles,
  Target,
  Upload,
  XCircle,
} from "lucide-react"

export type OpportunitiesSectionProps = {
  jobApplications: JobApplication[]
  versions: ResumeVersion[]
  onStartApplication: () => void
  onTrackApplication: (jobId: string) => void
  onSaveOpportunity?: (draft: OpportunityDraft) => void
}

export type OpportunityDraft = {
  jobTitle: string
  company: string
  jobDescription: string
  jobUrl: string
  companyWebsite: string
}

function averageFitScore(job: JobApplication): number | null {
  const scores = job.fitScores
  if (!scores) return null
  const values = [scores.culture, scores.ambitions, scores.skills, scores.strategy]
    .map((s) => s?.score)
    .filter((n): n is number => typeof n === "number")
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function scoreColor(score: number): string {
  if (score >= 4) return "text-emerald-600"
  if (score >= 3) return "text-amber-600"
  return "text-rose-600"
}

export function OpportunitiesSection({
  jobApplications,
  versions,
  onStartApplication,
  onTrackApplication,
}: OpportunitiesSectionProps) {
  const [draft, setDraft] = useState<OpportunityDraft>({
    jobTitle: "",
    company: "",
    jobDescription: "",
    jobUrl: "",
    companyWebsite: "",
  })
  const [analysing, setAnalysing] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const analysedJob = selectedJobId
    ? jobApplications.find((j) => j.id === selectedJobId)
    : null

  const matchScore = analysedJob ? averageFitScore(analysedJob) : null

  const handleAnalyseDraft = () => {
    setAnalysing(true)
    const match = jobApplications.find(
      (j) =>
        j.jobTitle?.toLowerCase() === draft.jobTitle.trim().toLowerCase() &&
        j.company?.toLowerCase() === draft.company.trim().toLowerCase(),
    )
    if (match) {
      setSelectedJobId(match.id)
    } else {
      setSelectedJobId(null)
    }
    setTimeout(() => setAnalysing(false), 400)
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 px-6 py-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Explore roles before you apply. Review fit, understand German job postings, then build your application with confidence.
        </p>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-12 lg:p-8">
        <Card className="lg:col-span-5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Upload job description</CardTitle>
            <CardDescription>Paste text, add a URL, or pick an existing application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="opp-role">Role title</Label>
              <Input
                id="opp-role"
                value={draft.jobTitle}
                onChange={(e) => setDraft((d) => ({ ...d, jobTitle: e.target.value }))}
                placeholder="e.g. Product Strategy Lead"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opp-company">Company</Label>
              <Input
                id="opp-company"
                value={draft.company}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opp-url">Job URL</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="opp-url"
                  className="pl-9"
                  value={draft.jobUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, jobUrl: e.target.value }))}
                  placeholder="LinkedIn or careers page"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opp-jd">Job description</Label>
              <Textarea
                id="opp-jd"
                rows={8}
                value={draft.jobDescription}
                onChange={(e) => setDraft((d) => ({ ...d, jobDescription: e.target.value }))}
                placeholder="Paste the full job description…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled>
                <Upload className="mr-2 h-4 w-4" />
                PDF upload
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAnalyseDraft}
                disabled={!draft.jobDescription.trim() && !selectedJobId}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {analysing ? "Analysing…" : "Analyse opportunity"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-7">
          {analysedJob ? (
            <>
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{analysedJob.jobTitle}</CardTitle>
                      <CardDescription>{analysedJob.company}</CardDescription>
                    </div>
                    {matchScore != null && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Match score</p>
                        <p className={cn("text-3xl font-bold tabular-nums", scoreColor(matchScore))}>
                          {matchScore.toFixed(1)}
                          <span className="text-base font-normal text-muted-foreground"> / 5</span>
                        </p>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["culture", "Culture fit", analysedJob.fitScores?.culture],
                      ["skills", "Skills match", analysedJob.fitScores?.skills],
                      ["ambitions", "Ambitions", analysedJob.fitScores?.ambitions],
                      ["strategy", "Strategy fit", analysedJob.fitScores?.strategy],
                    ] as const
                  ).map(([key, label, fit]) => (
                    <div key={key} className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      {fit ? (
                        <>
                          <p className="mt-1 text-lg font-semibold tabular-nums">{fit.score}/5</p>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{fit.summary}</p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Not scored yet</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Positioning strategy</CardTitle>
                  <CardDescription>Recommended professional identity for this role</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysedJob.jobStrategy?.positioning ? (
                    <p className="text-sm leading-relaxed">{analysedJob.jobStrategy.positioning}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Open Job Strategy on this application to generate positioning recommendations.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {analysedJob.strategySummary && (
                      <Badge variant="secondary">{analysedJob.strategySummary.slice(0, 48)}…</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onStartApplication}>
                  <Target className="mr-2 h-4 w-4" />
                  Generate application
                </Button>
                <Button variant="outline" onClick={() => onTrackApplication(analysedJob.id)}>
                  Track application
                </Button>
              </div>
            </>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Sparkles className="mb-4 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">No opportunity analysed yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Paste a job description or select an application below to see match analysis, risks, and positioning.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Saved opportunities</CardTitle>
              <CardDescription>Applications in your workspace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {jobApplications.slice(0, 8).map((job) => {
                const score = averageFitScore(job)
                return (
                  <button
                    key={job.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                      selectedJobId === job.id && "border-primary/40 bg-primary/5",
                    )}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">{job.jobTitle}</p>
                      <p className="text-xs text-muted-foreground">{job.company}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {score != null && <span className="tabular-nums">{score.toFixed(1)}/5</span>}
                      {score != null && score >= 3.5 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : score != null ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                )
              })}
              {jobApplications.length === 0 && (
                <p className="text-sm text-muted-foreground">Create an application to analyse opportunities.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {versions.length > 0 && (
        <p className="sr-only">{versions.length} resume versions available for tailoring</p>
      )}
    </div>
  )
}
