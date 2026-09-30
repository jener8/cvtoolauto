"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { AgentJobStatus, AgentProfileFact, AgentRelevancePayload } from "@/lib/agents/types"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react"

type JobItem = {
  id: string
  status: AgentJobStatus
  title: string | null
  location: string | null
  language: string | null
  url: string | null
  source: string | null
  companyName: string | null
  relevance: AgentRelevancePayload | Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type ReviewResult = {
  reviewed?: number
  relevant?: number
  notRelevant?: number
  needsManualReview?: number
  errors?: number
  errorMessages?: string[]
  error?: string
}

type FilterTab = "all" | "new" | "reviewing" | "not_relevant" | "needs_manual_review"

function isRelevancePayload(value: unknown): value is AgentRelevancePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "relevant" in value &&
    typeof (value as AgentRelevancePayload).relevant === "boolean" &&
    Array.isArray((value as AgentRelevancePayload).requirements_met)
  )
}

function statusLabel(status: AgentJobStatus): string {
  switch (status) {
    case "new":
      return "New"
    case "reviewing":
      return "Potential fit"
    case "not_relevant":
      return "Not a fit"
    case "needs_manual_review":
      return "Needs manual review"
    default:
      return status
  }
}

export function AgentsHomePage() {
  const [loading, setLoading] = useState(true)
  const [reviewingAll, setReviewingAll] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [facts, setFacts] = useState<AgentProfileFact[]>([])
  const [tab, setTab] = useState<FilterTab>("all")
  const [lastReview, setLastReview] = useState<ReviewResult | null>(null)

  const factById = useMemo(() => {
    const map = new Map<string, AgentProfileFact>()
    for (const f of facts) map.set(f.id, f)
    return map
  }, [facts])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [jobsRes, factsRes] = await Promise.all([
        fetch("/api/agents/jobs", { credentials: "same-origin" }),
        fetch("/api/agents/profile?status=confirmed", { credentials: "same-origin" }),
      ])
      if (jobsRes.status === 404 || factsRes.status === 404) {
        throw new Error("Job agents are disabled")
      }
      const jobsData = (await jobsRes.json()) as { jobs?: JobItem[]; error?: string }
      const factsData = (await factsRes.json()) as { facts?: AgentProfileFact[]; error?: string }
      if (!jobsRes.ok) throw new Error(jobsData.error ?? "Failed to load jobs")
      if (!factsRes.ok) throw new Error(factsData.error ?? "Failed to load facts")
      setJobs(jobsData.jobs ?? [])
      setFacts(factsData.facts ?? [])
    } catch (error) {
      toast({
        title: "Could not load job queue",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (tab === "all") return jobs
    return jobs.filter((j) => j.status === tab)
  }, [jobs, tab])

  const counts = useMemo(() => {
    const c = { all: jobs.length, new: 0, reviewing: 0, not_relevant: 0, needs_manual_review: 0 }
    for (const j of jobs) {
      if (j.status === "new") c.new += 1
      else if (j.status === "reviewing") c.reviewing += 1
      else if (j.status === "not_relevant") c.not_relevant += 1
      else if (j.status === "needs_manual_review") c.needs_manual_review += 1
    }
    return c
  }, [jobs])

  const runReviewAll = async () => {
    setReviewingAll(true)
    setLastReview(null)
    try {
      const res = await fetch("/api/agents/review/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as ReviewResult
      if (!res.ok) throw new Error(data.error ?? "Review failed")
      setLastReview(data)
      toast({
        title: "Relevance review complete",
        description: `Reviewed ${data.reviewed ?? 0} · fits ${data.relevant ?? 0} · not a fit ${data.notRelevant ?? 0} · manual ${data.needsManualReview ?? 0}`,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setReviewingAll(false)
    }
  }

  const runReviewOne = async (jobId: string) => {
    setReviewingId(jobId)
    try {
      const res = await fetch(`/api/agents/jobs/${jobId}/review`, {
        method: "POST",
        credentials: "same-origin",
      })
      const data = (await res.json()) as ReviewResult
      if (!res.ok) throw new Error(data.error ?? "Review failed")
      toast({
        title: "Job reviewed",
        description: `Status updated (${data.reviewed ?? 0} reviewed)`,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Could not review job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setReviewingId(null)
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "new", label: `New (${counts.new})` },
    { id: "reviewing", label: `Potential fits (${counts.reviewing})` },
    { id: "not_relevant", label: `Not a fit (${counts.not_relevant})` },
    { id: "needs_manual_review", label: `Manual (${counts.needs_manual_review})` },
  ]

  return (
    <div
      className="min-h-[70vh] px-4 py-10 sm:px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,122,95,0.12), transparent), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link href="/app">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to workspace
          </Link>
        </Button>

        <p className="text-sm font-medium tracking-wide" style={{ color: "#2D7A5F" }}>
          EquitAI
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Job agents
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Review how each listing fits your confirmed master profile — in words, not scores. Nothing
          is drafted or sent until a later step.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void runReviewAll()}
            disabled={reviewingAll || loading || counts.new === 0}
            style={{ backgroundColor: "#2D7A5F" }}
            className="text-white hover:opacity-90"
          >
            {reviewingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Review new jobs
          </Button>
          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/agents/profile">
              <UserCheck className="mr-2 h-4 w-4" />
              Master profile
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/agents/settings">
              <Search className="mr-2 h-4 w-4" />
              Search settings
            </Link>
          </Button>
        </div>

        {lastReview && (
          <p className="mt-4 text-sm text-stone-600">
            Last review: {lastReview.reviewed ?? 0} reviewed · {lastReview.relevant ?? 0} fits ·{" "}
            {lastReview.notRelevant ?? 0} not a fit · {lastReview.needsManualReview ?? 0} manual ·{" "}
            {lastReview.errors ?? 0} errors
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                tab === t.id
                  ? "bg-[#2D7A5F] text-white"
                  : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-12 flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading queue…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-stone-300 bg-white/70 p-8 text-center text-stone-600">
            <p className="font-medium text-stone-800">No jobs in this view</p>
            <p className="mt-2 text-sm">
              Confirm profile facts, run a search, then review new listings here.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-5">
            {filtered.map((job) => {
              const relevance = isRelevancePayload(job.relevance) ? job.relevance : null
              const reviewError =
                typeof job.relevance === "object" &&
                job.relevance &&
                "error" in job.relevance &&
                typeof (job.relevance as { error?: unknown }).error === "string"
                  ? (job.relevance as { error: string }).error
                  : null
              const canReview =
                job.status === "new" || job.status === "needs_manual_review"

              return (
                <li
                  key={job.id}
                  className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        {statusLabel(job.status)}
                        {job.source ? ` · ${job.source}` : ""}
                        {job.language ? ` · ${job.language}` : ""}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-stone-900">
                        {job.title || "Untitled role"}
                      </h2>
                      <p className="mt-1 text-sm text-stone-600">
                        {[job.companyName, job.location].filter(Boolean).join(" · ") ||
                          "Company unknown"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {job.url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={job.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Listing
                          </a>
                        </Button>
                      )}
                      {canReview && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewingId === job.id || reviewingAll}
                          onClick={() => void runReviewOne(job.id)}
                        >
                          {reviewingId === job.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Review
                        </Button>
                      )}
                    </div>
                  </div>

                  {relevance ? (
                    <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
                      <p className="text-sm leading-relaxed text-stone-700">{relevance.summary}</p>

                      {relevance.requirements_met.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                            <CheckCircle2 className="h-4 w-4 text-[#2D7A5F]" />
                            Requirements met
                          </p>
                          <ul className="mt-2 space-y-2">
                            {relevance.requirements_met.map((item) => (
                              <li key={item.requirement} className="text-sm text-stone-700">
                                <span className="font-medium">{item.requirement}</span>
                                <ul className="mt-1 space-y-0.5 pl-4 text-xs text-stone-500">
                                  {item.evidence_fact_ids.map((fid) => {
                                    const fact = factById.get(fid)
                                    return (
                                      <li key={fid}>
                                        Evidence:{" "}
                                        {fact ? fact.factText : `fact ${fid.slice(0, 8)}…`}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {relevance.requirements_not_met.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                            <XCircle className="h-4 w-4 text-amber-700" />
                            Requirements not met
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                            {relevance.requirements_not_met.map((req) => (
                              <li key={req}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : reviewError ? (
                    <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-amber-800">
                      Review could not be completed: {reviewError}
                    </p>
                  ) : job.status === "new" ? (
                    <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-500">
                      Not reviewed yet — use Review new jobs or Review on this listing.
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
