"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type {
  AgentDraft,
  AgentJobStatus,
  AgentProfileFact,
  AgentRelevancePayload,
  FabricationFlag,
} from "@/lib/agents/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
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

type DraftResult = {
  drafted?: number
  skippedCap?: number
  errors?: number
  flagsTotal?: number
  dailyCap?: number
  draftedTodayBefore?: number
  errorMessages?: string[]
  error?: string
}

type FilterTab =
  | "all"
  | "new"
  | "reviewing"
  | "not_relevant"
  | "needs_manual_review"
  | "changes_requested"

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
    case "changes_requested":
      return "Changes requested"
    default:
      return status
  }
}

async function downloadDraftExport(
  draftId: string,
  doc: "cv" | "cover",
  format: "pdf" | "docx",
) {
  const res = await fetch(
    `/api/agents/drafts/${draftId}/export?doc=${doc}&format=${format}`,
    { credentials: "same-origin" },
  )
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? "Download failed")
  }
  const blob = await res.blob()
  const disposition = res.headers.get("Content-Disposition") || ""
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || `draft_${doc}.${format}`
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function FabricationFlagsList({ flags }: { flags: FabricationFlag[] }) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-[#2D7A5F]">
        Fact check passed — no unsupported claims flagged.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {flags.map((flag, i) => (
        <li
          key={`${flag.claim}-${i}`}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>
              [{flag.location}] {flag.claim}
            </span>
          </p>
          <p className="mt-1 pl-5 text-xs text-amber-800">{flag.reason}</p>
        </li>
      ))}
    </ul>
  )
}

function DraftPanel({
  draft,
  onSaved,
}: {
  draft: AgentDraft
  onSaved: (next: AgentDraft) => void
}) {
  const [cvText, setCvText] = useState(draft.cvText ?? "")
  const [coverText, setCoverText] = useState(draft.coverText ?? "")
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    setCvText(draft.cvText ?? "")
    setCoverText(draft.coverText ?? "")
  }, [draft.id, draft.cvText, draft.coverText, draft.version])

  const dirty =
    cvText !== (draft.cvText ?? "") || coverText !== (draft.coverText ?? "")

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/agents/drafts/${draft.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, coverText }),
      })
      const data = (await res.json()) as { draft?: AgentDraft; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      if (data.draft) onSaved(data.draft)
      toast({ title: "Draft saved" })
    } catch (error) {
      toast({
        title: "Could not save draft",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const download = async (doc: "cv" | "cover", format: "pdf" | "docx") => {
    const key = `${doc}-${format}`
    setDownloading(key)
    try {
      await downloadDraftExport(draft.id, doc, format)
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-900">
          Drafts <span className="font-normal text-stone-500">(v{draft.version})</span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save text
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-800">Fabrication flags</p>
        <FabricationFlagsList flags={draft.fabricationFlags ?? []} />
      </div>

      <div>
        <label htmlFor={`cv-${draft.id}`} className="text-sm font-medium text-stone-800">
          Tailored CV (editable)
        </label>
        <Textarea
          id={`cv-${draft.id}`}
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          className="mt-1.5 min-h-[180px] font-mono text-xs"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cv", "pdf")}
          >
            {downloading === "cv-pdf" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            CV PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cv", "docx")}
          >
            {downloading === "cv-docx" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" />
            )}
            CV DOCX
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor={`cover-${draft.id}`} className="text-sm font-medium text-stone-800">
          Cover letter / Anschreiben (editable)
        </label>
        <Textarea
          id={`cover-${draft.id}`}
          value={coverText}
          onChange={(e) => setCoverText(e.target.value)}
          className="mt-1.5 min-h-[160px] font-mono text-xs"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cover", "pdf")}
          >
            {downloading === "cover-pdf" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Cover PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cover", "docx")}
          >
            {downloading === "cover-docx" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" />
            )}
            Cover DOCX
          </Button>
        </div>
      </div>

      {(draft.citedFactsSnapshot?.length ?? 0) > 0 && (
        <details className="text-sm text-stone-600">
          <summary className="cursor-pointer font-medium text-stone-800">
            Cited facts snapshot ({draft.citedFactsSnapshot.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {draft.citedFactsSnapshot.map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function AgentsHomePage() {
  const [loading, setLoading] = useState(true)
  const [reviewingAll, setReviewingAll] = useState(false)
  const [draftingAll, setDraftingAll] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [facts, setFacts] = useState<AgentProfileFact[]>([])
  const [draftsByJob, setDraftsByJob] = useState<Map<string, AgentDraft>>(new Map())
  const [tab, setTab] = useState<FilterTab>("all")
  const [lastReview, setLastReview] = useState<ReviewResult | null>(null)
  const [lastDraft, setLastDraft] = useState<DraftResult | null>(null)

  const factById = useMemo(() => {
    const map = new Map<string, AgentProfileFact>()
    for (const f of facts) map.set(f.id, f)
    return map
  }, [facts])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [jobsRes, factsRes, draftsRes] = await Promise.all([
        fetch("/api/agents/jobs", { credentials: "same-origin" }),
        fetch("/api/agents/profile?status=confirmed", { credentials: "same-origin" }),
        fetch("/api/agents/drafts", { credentials: "same-origin" }),
      ])
      if (jobsRes.status === 404 || factsRes.status === 404) {
        throw new Error("Job agents are disabled")
      }
      const jobsData = (await jobsRes.json()) as { jobs?: JobItem[]; error?: string }
      const factsData = (await factsRes.json()) as { facts?: AgentProfileFact[]; error?: string }
      const draftsData = (await draftsRes.json()) as { drafts?: AgentDraft[]; error?: string }
      if (!jobsRes.ok) throw new Error(jobsData.error ?? "Failed to load jobs")
      if (!factsRes.ok) throw new Error(factsData.error ?? "Failed to load facts")
      if (!draftsRes.ok) throw new Error(draftsData.error ?? "Failed to load drafts")
      setJobs(jobsData.jobs ?? [])
      setFacts(factsData.facts ?? [])
      const map = new Map<string, AgentDraft>()
      for (const d of draftsData.drafts ?? []) map.set(d.jobId, d)
      setDraftsByJob(map)
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
    const c = {
      all: jobs.length,
      new: 0,
      reviewing: 0,
      not_relevant: 0,
      needs_manual_review: 0,
      changes_requested: 0,
    }
    for (const j of jobs) {
      if (j.status === "new") c.new += 1
      else if (j.status === "reviewing") c.reviewing += 1
      else if (j.status === "not_relevant") c.not_relevant += 1
      else if (j.status === "needs_manual_review") c.needs_manual_review += 1
      else if (j.status === "changes_requested") c.changes_requested += 1
    }
    return c
  }, [jobs])

  const draftEligible = counts.reviewing + counts.changes_requested

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

  const runDraftAll = async () => {
    setDraftingAll(true)
    setLastDraft(null)
    try {
      const res = await fetch("/api/agents/draft/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as DraftResult
      if (!res.ok) throw new Error(data.error ?? "Draft failed")
      setLastDraft(data)
      toast({
        title: "Drafts ready",
        description: `Drafted ${data.drafted ?? 0} (cap ${data.dailyCap ?? 5}) · flags ${data.flagsTotal ?? 0} · errors ${data.errors ?? 0}`,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Draft failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDraftingAll(false)
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

  const runDraftOne = async (jobId: string) => {
    setDraftingId(jobId)
    try {
      const res = await fetch(`/api/agents/jobs/${jobId}/draft`, {
        method: "POST",
        credentials: "same-origin",
      })
      const data = (await res.json()) as DraftResult
      if (!res.ok) throw new Error(data.error ?? "Draft failed")
      toast({
        title: "Draft generated",
        description: `Drafted ${data.drafted ?? 0} · flags ${data.flagsTotal ?? 0}`,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Could not draft",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDraftingId(null)
    }
  }

  const requestChangesAndRedraft = async (jobId: string) => {
    setDraftingId(jobId)
    try {
      const mark = await fetch(`/api/agents/jobs/${jobId}/request-changes`, {
        method: "POST",
        credentials: "same-origin",
      })
      const markData = (await mark.json()) as { error?: string }
      if (!mark.ok) throw new Error(markData.error ?? "Could not request changes")

      const res = await fetch(`/api/agents/jobs/${jobId}/draft`, {
        method: "POST",
        credentials: "same-origin",
      })
      const data = (await res.json()) as DraftResult
      if (!res.ok) throw new Error(data.error ?? "Redraft failed")
      toast({
        title: "Redraft complete",
        description: "Status returned to reviewing with a new draft version.",
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Redraft failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDraftingId(null)
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "new", label: `New (${counts.new})` },
    { id: "reviewing", label: `Potential fits (${counts.reviewing})` },
    { id: "changes_requested", label: `Changes (${counts.changes_requested})` },
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
          Review fit explanations, then draft tailored CVs and cover letters from confirmed profile
          facts only. Nothing is sent automatically.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void runReviewAll()}
            disabled={reviewingAll || draftingAll || loading || counts.new === 0}
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
          <Button
            type="button"
            onClick={() => void runDraftAll()}
            disabled={draftingAll || reviewingAll || loading || draftEligible === 0}
            variant="outline"
            className="border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#2D7A5F]/10"
          >
            {draftingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Draft applications
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
        {lastDraft && (
          <p className="mt-1 text-sm text-stone-600">
            Last draft run: {lastDraft.drafted ?? 0} drafted · flags {lastDraft.flagsTotal ?? 0} ·
            cap {lastDraft.dailyCap ?? 5} (already today {lastDraft.draftedTodayBefore ?? 0}) ·{" "}
            {lastDraft.errors ?? 0} errors
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
              Confirm profile facts, run a search, review fits, then draft applications here.
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
              const canDraft =
                job.status === "reviewing" || job.status === "changes_requested"
              const draft = draftsByJob.get(job.id)

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
                        {draft ? ` · draft v${draft.version}` : ""}
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
                          disabled={reviewingId === job.id || reviewingAll || draftingAll}
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
                      {canDraft && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={draftingId === job.id || draftingAll || reviewingAll}
                          onClick={() => void runDraftOne(job.id)}
                        >
                          {draftingId === job.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {draft ? "Redraft" : "Draft"}
                        </Button>
                      )}
                      {job.status === "reviewing" && draft && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={draftingId === job.id || draftingAll}
                          onClick={() => void requestChangesAndRedraft(job.id)}
                        >
                          Request changes
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

                  {draft ? (
                    <DraftPanel
                      draft={draft}
                      onSaved={(next) => {
                        setDraftsByJob((prev) => {
                          const map = new Map(prev)
                          map.set(next.jobId, next)
                          return map
                        })
                      }}
                    />
                  ) : canDraft ? (
                    <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-500">
                      No draft yet — use Draft applications or Draft on this listing.
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
