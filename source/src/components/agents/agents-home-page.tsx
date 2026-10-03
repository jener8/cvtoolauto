"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type {
  AgentApplyMethod,
  AgentDraft,
  AgentJobKind,
  AgentJobStatus,
  AgentProfileFact,
  AgentRelevancePayload,
  FabricationFlag,
} from "@/lib/agents/types"
import {
  AGENTS_ACCENT,
  detectAgentsLocale,
  getAgentsCopy,
  SEND_UNDO_MS,
  type AgentsCopy,
  type AgentsLocale,
} from "@/lib/agents/copy"
import {
  detectProfileLocale,
  getProfileCopy,
} from "@/lib/agents/profile-copy"
import { evaluateProfileReadiness } from "@/lib/agents/profile-readiness"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Undo2,
  UserCheck,
  XCircle,
} from "lucide-react"

type JobItem = {
  id: string
  status: AgentJobStatus
  kind: AgentJobKind
  applyMethod: AgentApplyMethod | null
  title: string | null
  location: string | null
  language: string | null
  url: string | null
  source: string | null
  companyName: string | null
  postedAt: string | null
  emailTo: string | null
  rejectReason: string | null
  gmailMessageId: string | null
  sendingStartedAt: string | null
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
  refused?: boolean
  refuseReason?: string
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

type PipelineResult = {
  fetched?: number
  inserted?: number
  relevant?: number
  drafted?: number
  errors?: number
  dailyCap?: number
  errorMessages?: string[]
  error?: string
}

type FilterTab =
  | "all"
  | "new"
  | "potential_fit"
  | "not_a_fit"
  | "manual"
  | "shortlisted"
  | "skipped"
  | "drafting"
  | "drafts_ready"
  | "changes_requested"
  | "documents_approved"
  | "sending"
  | "sent"
  | "rejected"

type ActionName =
  | "approve"
  | "request_changes"
  | "reject"
  | "start_send"
  | "undo_send"
  | "complete_send"
  | "mark_sent"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D7A5F] focus-visible:ring-offset-2"

function isRelevancePayload(value: unknown): value is AgentRelevancePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "relevant" in value &&
    typeof (value as AgentRelevancePayload).relevant === "boolean" &&
    Array.isArray((value as AgentRelevancePayload).requirements_met)
  )
}

function formatPostedDate(postedAt: string | null, locale: AgentsLocale): string | null {
  if (!postedAt) return null
  const d = new Date(postedAt.length <= 10 ? `${postedAt}T12:00:00` : postedAt)
  if (Number.isNaN(d.getTime())) return postedAt
  return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatPostingAge(postedAt: string | null, locale: AgentsLocale): string {
  if (!postedAt) return locale === "de" ? "Alter unbekannt" : "Age unknown"
  const d = new Date(postedAt.length <= 10 ? `${postedAt}T12:00:00` : postedAt)
  if (Number.isNaN(d.getTime())) return locale === "de" ? "Alter unbekannt" : "Age unknown"
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
  if (locale === "de") {
    if (days === 0) return "Heute veröffentlicht"
    if (days === 1) return "Vor 1 Tag"
    return `Vor ${days} Tagen`
  }
  if (days === 0) return "Posted today"
  if (days === 1) return "1 day old"
  return `${days} days old`
}

function usesEmailSendPath(job: JobItem): boolean {
  if (job.applyMethod === "portal") return false
  if (job.applyMethod === "email") return true
  if (job.kind === "initiative") return true
  return Boolean(job.emailTo)
}

function emptyMessageForTab(tab: FilterTab, copy: AgentsCopy): { title: string; body: string } {
  switch (tab) {
    case "new":
      return { title: copy.empty.noNewToday, body: copy.empty.body }
    case "potential_fit":
    case "manual":
      return { title: copy.empty.noFits, body: copy.empty.body }
    case "documents_approved":
      return { title: copy.empty.noApproved, body: copy.empty.body }
    case "sent":
      return { title: copy.empty.noSent, body: copy.empty.body }
    case "rejected":
      return { title: copy.empty.noRejected, body: copy.empty.body }
    default:
      return { title: copy.empty.title, body: copy.empty.body }
  }
}

function RelevanceBlock({
  job,
  copy,
  factById,
}: {
  job: JobItem
  copy: AgentsCopy
  factById: Map<string, AgentProfileFact>
}) {
  const relevance = isRelevancePayload(job.relevance) ? job.relevance : null
  const reviewError =
    typeof job.relevance === "object" &&
    job.relevance &&
    "error" in job.relevance &&
    typeof (job.relevance as { error?: unknown }).error === "string"
      ? (job.relevance as { error: string }).error
      : null

  if (relevance) {
    return (
      <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
        <p className="text-sm leading-relaxed text-stone-700">{relevance.summary}</p>

        {relevance.requirements_met.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
              <CheckCircle2 className="h-4 w-4 text-[#2D7A5F]" aria-hidden />
              {copy.requirementsMet}
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
                          {copy.evidence}: {fact ? fact.factText : `fact ${fid.slice(0, 8)}…`}
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
              <XCircle className="h-4 w-4 text-amber-700" aria-hidden />
              {copy.requirementsNotMet}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
              {relevance.requirements_not_met.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (reviewError) {
    return (
      <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-amber-800">
        {copy.reviewError(reviewError)}
      </p>
    )
  }

  if (job.status === "new") {
    return (
      <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-500">
        {copy.notReviewedYet}
      </p>
    )
  }

  return null
}

function RejectInline({
  jobId,
  copy,
  rejectReason,
  setRejectReason,
  busy,
  onConfirm,
  onCancel,
}: {
  jobId: string
  copy: AgentsCopy
  rejectReason: string
  setRejectReason: (v: string) => void
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <label htmlFor={`reject-${jobId}`} className="text-sm font-medium text-stone-800">
        {copy.rejectReasonLabel}
      </label>
      <Textarea
        id={`reject-${jobId}`}
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        placeholder={copy.rejectReasonPlaceholder}
        className={`min-h-[72px] bg-white ${focusRing}`}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onConfirm} className={focusRing}>
          {copy.rejectConfirm}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className={focusRing}>
          {copy.rejectCancel}
        </Button>
      </div>
    </div>
  )
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

function FabricationFlagsList({
  flags,
  copy,
}: {
  flags: FabricationFlag[]
  copy: AgentsCopy
}) {
  if (flags.length === 0) {
    return <p className="text-sm text-[#2D7A5F]">{copy.fabricationPassed}</p>
  }
  return (
    <ul className="space-y-2">
      {flags.map((flag, i) => (
        <li
          key={`${flag.claim}-${i}`}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
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
  copy,
  onSaved,
}: {
  draft: AgentDraft
  copy: AgentsCopy
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
      toast({ title: copy.toast.draftSaved })
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
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
        title: copy.toast.actionFailed,
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
        <p className="text-sm font-medium text-stone-900">{copy.draftsHeading(draft.version)}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className={focusRing}
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {copy.saveText}
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-800">{copy.fabricationFlags}</p>
        <FabricationFlagsList flags={draft.fabricationFlags ?? []} copy={copy} />
      </div>

      <div>
        <label htmlFor={`cv-${draft.id}`} className="text-sm font-medium text-stone-800">
          {copy.tailoredCv}
        </label>
        <Textarea
          id={`cv-${draft.id}`}
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          className={`mt-1.5 min-h-[180px] font-mono text-xs ${focusRing}`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cv", "pdf")}
            className={focusRing}
          >
            {downloading === "cv-pdf" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            CV PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cv", "docx")}
            className={focusRing}
          >
            {downloading === "cv-docx" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            CV DOCX
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor={`cover-${draft.id}`} className="text-sm font-medium text-stone-800">
          {copy.coverLetter}
        </label>
        <Textarea
          id={`cover-${draft.id}`}
          value={coverText}
          onChange={(e) => setCoverText(e.target.value)}
          className={`mt-1.5 min-h-[160px] font-mono text-xs ${focusRing}`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cover", "pdf")}
            className={focusRing}
          >
            {downloading === "cover-pdf" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Cover PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void download("cover", "docx")}
            className={focusRing}
          >
            {downloading === "cover-docx" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Cover DOCX
          </Button>
        </div>
      </div>

      {(draft.citedFactsSnapshot?.length ?? 0) > 0 && (
        <details className="text-sm text-stone-600">
          <summary className={`cursor-pointer font-medium text-stone-800 ${focusRing} rounded`}>
            {copy.citedFacts(draft.citedFactsSnapshot.length)}
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

function SendUndoBanner({
  job,
  copy,
  busy,
  onUndo,
  onComplete,
}: {
  job: JobItem
  copy: AgentsCopy
  busy: boolean
  onUndo: () => void
  onComplete: () => void
}) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!job.sendingStartedAt) return SEND_UNDO_MS
    const started = Date.parse(job.sendingStartedAt)
    if (!Number.isFinite(started)) return SEND_UNDO_MS
    return Math.max(0, SEND_UNDO_MS - (Date.now() - started))
  })

  useEffect(() => {
    if (!job.sendingStartedAt) return
    let completed = false
    const tick = () => {
      const started = Date.parse(job.sendingStartedAt!)
      const left = Number.isFinite(started)
        ? Math.max(0, SEND_UNDO_MS - (Date.now() - started))
        : 0
      setRemainingMs(left)
      if (left <= 0 && !completed) {
        completed = true
        onComplete()
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [job.sendingStartedAt, job.id, onComplete])

  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <div
      className="mt-4 rounded-lg border border-[#2D7A5F]/40 bg-[#2D7A5F]/10 px-3 py-3"
      role="status"
      aria-live="polite"
      aria-label={copy.a11y.undoLive}
    >
      <p className="text-sm font-medium text-stone-900">{copy.undoCountdown(seconds)}</p>
      <p className="mt-1 text-xs text-stone-600">{copy.sendingHint}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={`mt-2 border-[#2D7A5F] text-[#2D7A5F] ${focusRing}`}
        disabled={busy || remainingMs <= 0}
        onClick={onUndo}
      >
        {busy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        )}
        {copy.undoSend}
      </Button>
    </div>
  )
}

function formatAgentsError(raw: string) {
  const msg = raw.trim() || "Unknown error"
  if (/unauthorized/i.test(msg)) {
    return "You are not signed in. Open Login, then return here and try again."
  }
  if (/PGRST205|Could not find the table/i.test(msg)) {
    return `${msg} — agent tables (scripts 020–023) are missing on this Supabase project. Point .env.local at a project that has them applied; do not run those migrations on live without explicit approval.`
  }
  return msg
}

export function AgentsHomePage() {
  const [locale, setLocale] = useState<AgentsLocale>("en")
  const copy = useMemo(() => getAgentsCopy(locale), [locale])

  useEffect(() => {
    setLocale(detectAgentsLocale())
  }, [])

  const [loading, setLoading] = useState(true)
  const [reviewingAll, setReviewingAll] = useState(false)
  const [draftingAll, setDraftingAll] = useState(false)
  const [runningPipeline, setRunningPipeline] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [addingAppId, setAddingAppId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [facts, setFacts] = useState<AgentProfileFact[]>([])
  const [draftsByJob, setDraftsByJob] = useState<Map<string, AgentDraft>>(new Map())
  const [tab, setTab] = useState<FilterTab>("all")
  const [lastReview, setLastReview] = useState<ReviewResult | null>(null)
  const [lastDraft, setLastDraft] = useState<DraftResult | null>(null)
  const [lastPipeline, setLastPipeline] = useState<PipelineResult | null>(null)
  /** Persistent banner — toasts alone were easy to miss / could fail silently. */
  const [pageError, setPageError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [linkedAppIds, setLinkedAppIds] = useState<Set<string>>(new Set())
  /** Per-item email send confirmation — never batch. */
  const [confirmSendJobId, setConfirmSendJobId] = useState<string | null>(null)
  /** Gate 1 multi-select — shortlist / skip only. */
  const [selectedGate1, setSelectedGate1] = useState<Set<string>>(new Set())
  const [gate1Busy, setGate1Busy] = useState(false)
  /** Optimistic: live when last start_send reported gmailConnected. */
  const [gmailLive, setGmailLive] = useState(false)

  const factById = useMemo(() => {
    const map = new Map<string, AgentProfileFact>()
    for (const f of facts) map.set(f.id, f)
    return map
  }, [facts])

  const profileCopy = useMemo(
    () => getProfileCopy(locale === "de" ? "de" : detectProfileLocale()),
    [locale],
  )
  const profileReady = useMemo(
    () => evaluateProfileReadiness(facts, profileCopy),
    [facts, profileCopy],
  )
  const profileNotReadyReason =
    locale === "de"
      ? `Profil nicht bereit — noch fehlend: ${profileReady.missingLabels.join(", ") || "Einträge bestätigen"}`
      : `Profile not ready — still missing: ${profileReady.missingLabels.join(", ") || "confirm items"}`
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
      setJobs(
        (jobsData.jobs ?? []).map((j) => ({
          ...j,
          kind: j.kind ?? "listing",
          applyMethod: j.applyMethod ?? null,
          postedAt: j.postedAt ?? null,
          emailTo: j.emailTo ?? null,
          rejectReason: j.rejectReason ?? null,
          gmailMessageId: j.gmailMessageId ?? null,
          sendingStartedAt: j.sendingStartedAt ?? null,
        })),
      )
      setFacts(factsData.facts ?? [])
      const map = new Map<string, AgentDraft>()
      for (const d of draftsData.drafts ?? []) map.set(d.jobId, d)
      setDraftsByJob(map)
      setSelectedGate1((prev) => {
        const next = new Set<string>()
        for (const id of prev) {
          if ((jobsData.jobs ?? []).some((j) => j.id === id)) next.add(id)
        }
        return next
      })
      setPageError(null)
    } catch (error) {
      const description = formatAgentsError(
        error instanceof Error ? error.message : "Unknown error",
      )
      setPageError(description)
      toast({
        title: copy.toast.loadFailed,
        description,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [copy.toast.loadFailed])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (tab === "all") return jobs
    return jobs.filter((j) => j.status === tab)
  }, [jobs, tab])

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = {
      all: jobs.length,
      new: 0,
      potential_fit: 0,
      not_a_fit: 0,
      manual: 0,
      shortlisted: 0,
      skipped: 0,
      drafting: 0,
      drafts_ready: 0,
      changes_requested: 0,
      documents_approved: 0,
      sending: 0,
      sent: 0,
      rejected: 0,
    }
    for (const j of jobs) {
      const status = j.status as FilterTab
      if (status !== "all" && status in c) {
        c[status] += 1
      }
    }
    return c
  }, [jobs])

  const queueChoose = useMemo(
    () => jobs.filter((j) => j.status === "potential_fit" || j.status === "manual"),
    [jobs],
  )
  const queueDocuments = useMemo(
    () =>
      jobs.filter((j) => j.status === "drafts_ready" || j.status === "changes_requested"),
    [jobs],
  )
  const queueSend = useMemo(
    () =>
      jobs.filter((j) => j.status === "documents_approved" || j.status === "sending"),
    [jobs],
  )
  const sentHistory = useMemo(() => jobs.filter((j) => j.status === "sent"), [jobs])

  const draftEligible = counts.shortlisted + counts.changes_requested

  const runGate1Bulk = async (action: "shortlist" | "skip") => {
    const jobIds = [...selectedGate1]
    if (jobIds.length === 0) return
    setGate1Busy(true)
    try {
      const res = await fetch("/api/agents/jobs/gate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, jobIds }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Gate action failed")
      setSelectedGate1(new Set())
      toast({
        title: action === "shortlist" ? copy.queues.shortlist : copy.queues.skip,
        description: copy.queues.selected(jobIds.length),
      })
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGate1Busy(false)
    }
  }

  const toggleGate1 = (jobId: string, checked: boolean) => {
    setSelectedGate1((prev) => {
      const next = new Set(prev)
      if (checked) next.add(jobId)
      else next.delete(jobId)
      return next
    })
  }

  const runJobAction = async (
    jobId: string,
    action: ActionName,
    extra?: { reason?: string },
  ) => {
    setActionId(jobId)
    try {
      const res = await fetch(`/api/agents/jobs/${jobId}/action`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = (await res.json()) as {
        error?: string
        status?: AgentJobStatus
        gmailConnected?: boolean
        gmailMessageId?: string | null
        message?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Action failed")

      if (typeof data.gmailConnected === "boolean") {
        setGmailLive(data.gmailConnected)
      }

      if (action === "approve") toast({ title: copy.toast.approved })
      else if (action === "request_changes") toast({ title: copy.requestChanges })
      else if (action === "reject") toast({ title: copy.toast.rejected })
      else if (action === "start_send") toast({ title: copy.toast.sendingStarted })
      else if (action === "undo_send") toast({ title: copy.toast.sendUndone })
      else if (action === "mark_sent") toast({ title: copy.toast.markedSent })
      else if (action === "complete_send") {
        if (data.gmailConnected === false) {
          toast({
            title: copy.toast.gmailStub,
            description: data.message ?? copy.gmailNotConnected,
          })
        } else if (data.status === "sent" && data.gmailMessageId?.startsWith("stub-")) {
          toast({
            title: copy.toast.markedSent,
            description: data.message,
          })
        } else if (data.status === "sent") {
          toast({ title: copy.toast.emailSent })
        } else {
          toast({
            title: copy.toast.gmailSendFailed,
            description: data.message,
            variant: "destructive",
          })
        }
      }

      setRejectingId(null)
      setRejectReason("")
      setConfirmSendJobId(null)
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setActionId(null)
    }
  }

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
      if (data.refused || (data.errors ?? 0) > 0) {
        const detail =
          data.refuseReason ||
          data.errorMessages?.[0] ||
          copy.lastReview({
            reviewed: data.reviewed ?? 0,
            relevant: data.relevant ?? 0,
            notRelevant: data.notRelevant ?? 0,
            manual: data.needsManualReview ?? 0,
            errors: data.errors ?? 0,
          })
        toast({
          title: data.refused ? "Assessor refused to run" : copy.toast.reviewComplete,
          description: detail,
          variant: data.refused ? "destructive" : "default",
        })
      } else {
        toast({
          title: copy.toast.reviewComplete,
          description: copy.lastReview({
            reviewed: data.reviewed ?? 0,
            relevant: data.relevant ?? 0,
            notRelevant: data.notRelevant ?? 0,
            manual: data.needsManualReview ?? 0,
            errors: data.errors ?? 0,
          }),
        })
      }
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
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
        title: copy.toast.draftReady,
        description: copy.lastDraft({
          drafted: data.drafted ?? 0,
          flags: data.flagsTotal ?? 0,
          cap: data.dailyCap ?? 5,
          already: data.draftedTodayBefore ?? 0,
          errors: data.errors ?? 0,
        }),
      })
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDraftingAll(false)
    }
  }

  const runPipelineNow = async () => {
    setRunningPipeline(true)
    setLastPipeline(null)
    setPageError(null)
    try {
      const res = await fetch("/api/agents/pipeline/run", {
        method: "POST",
        credentials: "same-origin",
      })
      const data = (await res.json()) as PipelineResult
      if (!res.ok) throw new Error(data.error ?? "Pipeline failed")
      setLastPipeline(data)
      toast({
        title: copy.toast.pipelineComplete,
        description: copy.lastPipeline({
          fetched: data.fetched ?? 0,
          relevant: data.relevant ?? 0,
          drafted: data.drafted ?? 0,
          cap: data.dailyCap ?? 5,
          errors: data.errors ?? 0,
        }),
      })
      await refresh()
    } catch (error) {
      const description = formatAgentsError(
        error instanceof Error ? error.message : "Unknown error",
      )
      setPageError(description)
      toast({
        title: copy.toast.actionFailed,
        description,
        variant: "destructive",
      })
    } finally {
      setRunningPipeline(false)
    }
  }

  const addToApplications = async (jobId: string) => {
    setAddingAppId(jobId)
    try {
      const res = await fetch(`/api/agents/jobs/${jobId}/add-to-applications`, {
        method: "POST",
        credentials: "same-origin",
      })
      const data = (await res.json()) as {
        ok?: boolean
        created?: boolean
        applicationId?: string
        reason?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Could not add to applications")
      if (data.applicationId) {
        setLinkedAppIds((prev) => new Set(prev).add(jobId))
      }
      toast({
        title:
          data.created === false
            ? copy.toast.alreadyInApplications
            : copy.toast.addedToApplications,
        description: copy.addToApplicationsHint,
      })
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setAddingAppId(null)
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
      toast({ title: copy.toast.reviewComplete })
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
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
      toast({ title: copy.toast.draftReady })
      await refresh()
    } catch (error) {
      toast({
        title: copy.toast.actionFailed,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDraftingId(null)
    }
  }

  const handleCompleteSend = useCallback(
    (jobId: string) => {
      setCompletingIds((prev) => {
        if (prev.has(jobId)) return prev
        const next = new Set(prev)
        next.add(jobId)
        return next
      })
      void (async () => {
        try {
          await runJobAction(jobId, "complete_send")
        } finally {
          setCompletingIds((prev) => {
            const next = new Set(prev)
            next.delete(jobId)
            return next
          })
        }
      })()
    },
    // runJobAction closes over copy/refresh; intentional per job complete
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copy, refresh],
  )

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: copy.tabs.all(counts.all) },
    { id: "new", label: copy.tabs.new(counts.new) },
    { id: "potential_fit", label: copy.tabs.potentialFit(counts.potential_fit) },
    { id: "manual", label: copy.tabs.manual(counts.manual) },
    { id: "shortlisted", label: copy.tabs.shortlisted(counts.shortlisted) },
    { id: "drafts_ready", label: copy.tabs.draftsReady(counts.drafts_ready) },
    { id: "changes_requested", label: copy.tabs.changes(counts.changes_requested) },
    {
      id: "documents_approved",
      label: copy.tabs.documentsApproved(counts.documents_approved),
    },
    { id: "sending", label: copy.tabs.sending(counts.sending) },
    { id: "sent", label: copy.tabs.sent(counts.sent) },
    { id: "rejected", label: copy.tabs.rejected(counts.rejected) },
    { id: "not_a_fit", label: copy.tabs.notAFit(counts.not_a_fit) },
    { id: "skipped", label: copy.tabs.skipped(counts.skipped) },
    { id: "drafting", label: copy.tabs.drafting(counts.drafting) },
  ]

  const empty = emptyMessageForTab(tab, copy)
  const busyGlobal = reviewingAll || draftingAll || runningPipeline || loading || gate1Busy
  const confirmSendJob = jobs.find((j) => j.id === confirmSendJobId) ?? null
  const confirmSendDraft = confirmSendJob ? draftsByJob.get(confirmSendJob.id) : undefined

  return (
    <div
      className="min-h-[70vh] px-4 py-10 sm:px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,122,95,0.12), transparent), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild className={focusRing}>
            <Link href="/app">
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
              {copy.backWorkspace}
            </Link>
          </Button>
          <div
            className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-stone-200"
            role="group"
            aria-label={copy.a11y.localeToggle}
          >
            {(["en", "de"] as AgentsLocale[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLocale(lang)}
                className={`rounded-full px-3 py-1 text-xs font-medium uppercase transition ${focusRing} ${
                  locale === lang
                    ? "bg-[#2D7A5F] text-white"
                    : "text-stone-700 hover:bg-stone-50"
                }`}
                aria-pressed={locale === lang}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm font-medium tracking-wide" style={{ color: AGENTS_ACCENT }}>
          {copy.brand}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">{copy.subtitle}</p>

        <div
          className="mt-6 rounded-xl border-2 border-[#2D7A5F] bg-white p-5 shadow-sm"
          role="note"
        >
          <p className="text-base font-semibold text-stone-900">{copy.controlBannerTitle}</p>
          <p className="mt-2 text-base leading-relaxed text-stone-700">{copy.controlBannerBody}</p>
        </div>

        {pageError && (
          <div
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            <p className="font-medium">Could not run agents</p>
            <p className="mt-1 leading-relaxed">{pageError}</p>
            {/not signed in/i.test(pageError) && (
              <p className="mt-2">
                <Link href="/login" className="font-medium underline underline-offset-2">
                  Go to login
                </Link>
              </p>
            )}
          </div>
        )}

        {!loading && !profileReady.ready && (
          <div
            className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-semibold">
              {locale === "de" ? "Zuerst Profil vervollständigen" : "Complete your profile first"}
            </p>
            <p className="mt-1 text-amber-900/90">
              {locale === "de"
                ? "Die Agenten brauchen bestätigte Erfahrung, bevor sie prüfen oder schreiben."
                : "The agents need confirmed experience before review or draft."}
            </p>
            <p className="mt-1 text-xs text-amber-900/80">{profileNotReadyReason}</p>
            <Button
              asChild
              size="sm"
              className="mt-3 text-white hover:opacity-90"
              style={{ backgroundColor: AGENTS_ACCENT }}
            >
              <Link href="/app/agents/profile">
                {locale === "de" ? "Profil öffnen" : "Open your profile"}
              </Link>
            </Button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runPipelineNow()}
            disabled={busyGlobal}
            title={copy.findJobsHint}
            className={`border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#2D7A5F]/10 ${focusRing}`}
          >
            {runningPipeline ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="mr-2 h-4 w-4" aria-hidden />
            )}
            {copy.findJobs}
          </Button>
          <Button
            type="button"
            onClick={() => void runReviewAll()}
            disabled={busyGlobal || counts.new === 0 || !profileReady.ready}
            title={!profileReady.ready ? profileNotReadyReason : undefined}
            variant="outline"
            className={`border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#2D7A5F]/10 ${focusRing}`}
          >
            {reviewingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            )}
            {copy.reviewNewJobs}
          </Button>
          <Button
            type="button"
            onClick={() => void runDraftAll()}
            disabled={busyGlobal || draftEligible === 0 || !profileReady.ready}
            title={
              !profileReady.ready
                ? profileNotReadyReason
                : draftEligible === 0
                  ? "Shortlist jobs first — drafts only run for jobs you chose"
                  : undefined
            }
            variant="outline"
            className={`border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#2D7A5F]/10 ${focusRing}`}
          >
            {draftingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="mr-2 h-4 w-4" aria-hidden />
            )}
            {copy.draftApplications}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            disabled={loading}
            className={focusRing}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            {copy.refresh}
          </Button>
          <Button variant="outline" asChild className={focusRing}>
            <Link href="/app/agents/profile">
              <UserCheck className="mr-2 h-4 w-4" aria-hidden />
              {copy.masterProfile}
            </Link>
          </Button>
          <Button variant="outline" asChild className={focusRing}>
            <Link href="/app/agents/settings">
              <Search className="mr-2 h-4 w-4" aria-hidden />
              {copy.searchSettings}
            </Link>
          </Button>
        </div>

        {lastPipeline && (
          <p className="mt-4 text-sm text-stone-600">
            {copy.lastPipeline({
              fetched: lastPipeline.fetched ?? 0,
              relevant: lastPipeline.relevant ?? 0,
              drafted: lastPipeline.drafted ?? 0,
              cap: lastPipeline.dailyCap ?? 5,
              errors: lastPipeline.errors ?? 0,
            })}
          </p>
        )}
        {lastReview && (
          <div className="mt-1 text-sm text-stone-600">
            <p>
              {copy.lastReview({
                reviewed: lastReview.reviewed ?? 0,
                relevant: lastReview.relevant ?? 0,
                notRelevant: lastReview.notRelevant ?? 0,
                manual: lastReview.needsManualReview ?? 0,
                errors: lastReview.errors ?? 0,
              })}
            </p>
            {(lastReview.refuseReason ||
              (lastReview.errorMessages && lastReview.errorMessages.length > 0)) && (
              <p className="mt-1 text-red-800" role="status">
                {lastReview.refuseReason || lastReview.errorMessages?.[0]}
              </p>
            )}
          </div>
        )}
        {lastDraft && (
          <p className="mt-1 text-sm text-stone-600">
            {copy.lastDraft({
              drafted: lastDraft.drafted ?? 0,
              flags: lastDraft.flagsTotal ?? 0,
              cap: lastDraft.dailyCap ?? 5,
              already: lastDraft.draftedTodayBefore ?? 0,
              errors: lastDraft.errors ?? 0,
            })}
          </p>
        )}

        {/* Overview cards → three gates */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                href: "#queue-choose",
                label: copy.queues.overviewChoose,
                count: queueChoose.length,
              },
              {
                href: "#queue-documents",
                label: copy.queues.overviewDocuments,
                count: queueDocuments.length,
              },
              {
                href: "#queue-send",
                label: copy.queues.overviewSend,
                count: queueSend.filter((j) => j.status === "documents_approved").length,
              },
            ] as const
          ).map((card) => (
            <a
              key={card.href}
              href={card.href}
              className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-[#2D7A5F]/40 hover:bg-[#2D7A5F]/5 ${focusRing}`}
            >
              <p className="text-sm font-medium text-stone-600">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-stone-900">{card.count}</p>
            </a>
          ))}
        </div>

        {loading ? (
          <div className="mt-12 flex items-center gap-2 text-stone-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {copy.loadingQueue}
          </div>
        ) : (
          <>
            {/* Gate 1 — Choose jobs */}
            <section id="queue-choose" className="mt-10 scroll-mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-stone-900">
                  {copy.queues.choose(queueChoose.length)}
                </h2>
                {selectedGate1.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-stone-500">
                      {copy.queues.selected(selectedGate1.size)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyGlobal}
                      onClick={() => void runGate1Bulk("shortlist")}
                      style={{ backgroundColor: AGENTS_ACCENT }}
                      className={`text-white hover:opacity-90 ${focusRing}`}
                    >
                      {gate1Busy ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      {copy.queues.shortlist}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyGlobal}
                      onClick={() => void runGate1Bulk("skip")}
                      className={focusRing}
                    >
                      {copy.queues.skip}
                    </Button>
                  </div>
                )}
              </div>
              {queueChoose.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">{copy.queues.emptyChoose}</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {queueChoose.map((job) => {
                    const busyRow =
                      actionId === job.id || busyGlobal || gate1Busy
                    return (
                      <li
                        key={job.id}
                        className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <Checkbox
                            checked={selectedGate1.has(job.id)}
                            onCheckedChange={(v) => toggleGate1(job.id, v === true)}
                            aria-label={`Select ${job.title || copy.untitledRole}`}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                                  {copy.status[job.status] ?? job.status}
                                  {job.companyName ? ` · ${job.companyName}` : ""}
                                </p>
                                <h3 className="mt-1 text-lg font-semibold text-stone-900">
                                  {job.title || copy.untitledRole}
                                </h3>
                                <p className="mt-1 text-xs text-stone-500">
                                  {formatPostingAge(job.postedAt, locale)}
                                  {formatPostedDate(job.postedAt, locale)
                                    ? ` · ${copy.posted(formatPostedDate(job.postedAt, locale)!)}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {job.url && (
                                  <Button variant="outline" size="sm" asChild className={focusRing}>
                                    <a href={job.url} target="_blank" rel="noreferrer">
                                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                      {copy.listingLink}
                                    </a>
                                  </Button>
                                )}
                                {rejectingId !== job.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busyRow}
                                    onClick={() => {
                                      setRejectingId(job.id)
                                      setRejectReason("")
                                    }}
                                    className={`text-amber-800 ${focusRing}`}
                                  >
                                    <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                    {copy.reject}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <RelevanceBlock job={job} copy={copy} factById={factById} />
                            {rejectingId === job.id && (
                              <RejectInline
                                jobId={job.id}
                                copy={copy}
                                rejectReason={rejectReason}
                                setRejectReason={setRejectReason}
                                busy={busyRow}
                                onConfirm={() =>
                                  void runJobAction(job.id, "reject", { reason: rejectReason })
                                }
                                onCancel={() => {
                                  setRejectingId(null)
                                  setRejectReason("")
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Gate 2 — Check documents */}
            <section id="queue-documents" className="mt-12 scroll-mt-6">
              <h2 className="text-lg font-semibold text-stone-900">
                {copy.queues.documents(queueDocuments.length)}
              </h2>
              {queueDocuments.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">{copy.queues.emptyDocuments}</p>
              ) : (
                <ul className="mt-4 space-y-5">
                  {queueDocuments.map((job) => {
                    const draft = draftsByJob.get(job.id)
                    const busyRow =
                      actionId === job.id ||
                      draftingId === job.id ||
                      busyGlobal
                    const canApproveDocs = job.status === "drafts_ready" && Boolean(draft)
                    return (
                      <li
                        key={job.id}
                        className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                              {copy.status[job.status] ?? job.status}
                              {job.status === "changes_requested"
                                ? ` · ${copy.queues.waitingRedraft}`
                                : ""}
                              {draft ? ` · draft v${draft.version}` : ""}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-stone-900">
                              {job.title || copy.untitledRole}
                            </h3>
                            <p className="mt-1 text-sm text-stone-600">
                              {[job.companyName, job.location].filter(Boolean).join(" · ") ||
                                copy.companyUnknown}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {job.url && (
                              <Button variant="outline" size="sm" asChild className={focusRing}>
                                <a href={job.url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                  {copy.listingLink}
                                </a>
                              </Button>
                            )}
                            {job.status === "changes_requested" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyRow}
                                onClick={() => void runDraftOne(job.id)}
                                className={focusRing}
                              >
                                {draftingId === job.id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                )}
                                {copy.redraft}
                              </Button>
                            )}
                            {canApproveDocs && (
                              <Button
                                size="sm"
                                disabled={busyRow}
                                onClick={() => void runJobAction(job.id, "approve")}
                                style={{ backgroundColor: AGENTS_ACCENT }}
                                className={`text-white hover:opacity-90 ${focusRing}`}
                              >
                                {actionId === job.id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                )}
                                {copy.queues.approveDocuments}
                              </Button>
                            )}
                            {job.status === "drafts_ready" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyRow}
                                onClick={() => void runJobAction(job.id, "request_changes")}
                                className={focusRing}
                              >
                                {copy.requestChanges}
                              </Button>
                            )}
                            {rejectingId !== job.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyRow}
                                onClick={() => {
                                  setRejectingId(job.id)
                                  setRejectReason("")
                                }}
                                className={`text-amber-800 ${focusRing}`}
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                {copy.reject}
                              </Button>
                            )}
                          </div>
                        </div>
                        {rejectingId === job.id && (
                          <RejectInline
                            jobId={job.id}
                            copy={copy}
                            rejectReason={rejectReason}
                            setRejectReason={setRejectReason}
                            busy={busyRow}
                            onConfirm={() =>
                              void runJobAction(job.id, "reject", { reason: rejectReason })
                            }
                            onCancel={() => {
                              setRejectingId(null)
                              setRejectReason("")
                            }}
                          />
                        )}
                        {draft ? (
                          <DraftPanel
                            draft={draft}
                            copy={copy}
                            onSaved={(next) => {
                              setDraftsByJob((prev) => {
                                const map = new Map(prev)
                                map.set(next.jobId, next)
                                return map
                              })
                            }}
                          />
                        ) : (
                          <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-500">
                            {copy.noDraftYet}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Gate 3 — Ready to send */}
            <section id="queue-send" className="mt-12 scroll-mt-6">
              <h2 className="text-lg font-semibold text-stone-900">
                {copy.queues.send(queueSend.length)}
              </h2>
              {queueSend.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">{copy.queues.emptySend}</p>
              ) : (
                <ul className="mt-4 space-y-5">
                  {queueSend.map((job) => {
                    const draft = draftsByJob.get(job.id)
                    const emailPath = usesEmailSendPath(job)
                    const flags = draft?.fabricationFlags ?? []
                    const sendBlocked = flags.length > 0
                    const busyRow =
                      actionId === job.id ||
                      addingAppId === job.id ||
                      completingIds.has(job.id) ||
                      busyGlobal
                    return (
                      <li
                        key={job.id}
                        className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                              {copy.status[job.status] ?? job.status}
                              {" · "}
                              {emailPath
                                ? copy.applyMethod.email
                                : job.applyMethod === "portal"
                                  ? copy.queues.readyToSubmit
                                  : copy.applyMethod.unknown}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-stone-900">
                              {job.title || copy.untitledRole}
                            </h3>
                            <p className="mt-1 text-sm text-stone-600">
                              {[job.companyName, job.location].filter(Boolean).join(" · ") ||
                                copy.companyUnknown}
                            </p>
                            {job.emailTo ? (
                              <p className="mt-1 text-xs text-stone-500">{job.emailTo}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {job.status === "documents_approved" && emailPath && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyRow || sendBlocked}
                                title={sendBlocked ? copy.queues.sendBlockedFlags : undefined}
                                onClick={() => setConfirmSendJobId(job.id)}
                                className={`border-[#2D7A5F] text-[#2D7A5F] ${focusRing}`}
                              >
                                <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                {copy.startEmailSend}
                              </Button>
                            )}
                            {job.status === "documents_approved" && !emailPath && (
                              <>
                                {job.url && (
                                  <Button variant="outline" size="sm" asChild className={focusRing}>
                                    <a href={job.url} target="_blank" rel="noreferrer">
                                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                      {copy.queues.openPortal}
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyRow || sendBlocked}
                                  title={sendBlocked ? copy.queues.sendBlockedFlags : undefined}
                                  onClick={() => void runJobAction(job.id, "mark_sent")}
                                  className={focusRing}
                                >
                                  {copy.markAsSent}
                                </Button>
                              </>
                            )}
                            {(job.status === "documents_approved" || job.status === "sent") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyRow || linkedAppIds.has(job.id)}
                                onClick={() => void addToApplications(job.id)}
                                className={`border-[#2D7A5F] text-[#2D7A5F] ${focusRing}`}
                                title={copy.addToApplicationsHint}
                              >
                                {addingAppId === job.id ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Briefcase className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                )}
                                {linkedAppIds.has(job.id)
                                  ? copy.toast.alreadyInApplications
                                  : copy.addToApplications}
                              </Button>
                            )}
                            {job.status === "documents_approved" && rejectingId !== job.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyRow}
                                onClick={() => {
                                  setRejectingId(job.id)
                                  setRejectReason("")
                                }}
                                className={`text-amber-800 ${focusRing}`}
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                {copy.reject}
                              </Button>
                            )}
                          </div>
                        </div>

                        {job.status === "documents_approved" && (
                          <p className="mt-3 text-sm text-stone-600">
                            {emailPath ? copy.emailApprovedHint : copy.portalReadyHint}
                          </p>
                        )}

                        {sendBlocked && job.status === "documents_approved" && (
                          <p className="mt-2 text-sm text-amber-800" role="status">
                            {copy.queues.sendBlockedFlags}
                          </p>
                        )}

                        {job.status === "sending" && (
                          <SendUndoBanner
                            job={job}
                            copy={copy}
                            busy={actionId === job.id || completingIds.has(job.id)}
                            onUndo={() => void runJobAction(job.id, "undo_send")}
                            onComplete={() => handleCompleteSend(job.id)}
                          />
                        )}

                        {rejectingId === job.id && (
                          <RejectInline
                            jobId={job.id}
                            copy={copy}
                            rejectReason={rejectReason}
                            setRejectReason={setRejectReason}
                            busy={busyRow}
                            onConfirm={() =>
                              void runJobAction(job.id, "reject", { reason: rejectReason })
                            }
                            onCancel={() => {
                              setRejectingId(null)
                              setRejectReason("")
                            }}
                          />
                        )}

                        {draft ? (
                          <DraftPanel
                            draft={draft}
                            copy={copy}
                            onSaved={(next) => {
                              setDraftsByJob((prev) => {
                                const map = new Map(prev)
                                map.set(next.jobId, next)
                                return map
                              })
                            }}
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Sent history */}
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-stone-900">
                {copy.queues.sentHistory(sentHistory.length)}
              </h2>
              {sentHistory.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">{copy.empty.noSent}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {sentHistory.map((job) => (
                    <li
                      key={job.id}
                      className="rounded-xl border border-stone-200 bg-white/80 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-stone-900">
                            {job.title || copy.untitledRole}
                          </p>
                          <p className="text-sm text-stone-600">
                            {job.companyName || copy.companyUnknown}
                            {job.gmailMessageId ? ` · Gmail: ${job.gmailMessageId}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-[#2D7A5F]">{copy.sentHint}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={addingAppId === job.id || linkedAppIds.has(job.id)}
                          onClick={() => void addToApplications(job.id)}
                          className={`border-[#2D7A5F] text-[#2D7A5F] ${focusRing}`}
                        >
                          {addingAppId === job.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Briefcase className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          )}
                          {linkedAppIds.has(job.id)
                            ? copy.toast.alreadyInApplications
                            : copy.addToApplications}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Full list filter tabs (below gates) */}
        <div className="mt-14 border-t border-stone-200 pt-8">
          <h2 className="text-base font-semibold text-stone-900">
            {locale === "de" ? "Alle Jobs" : "All jobs"}
          </h2>
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label={copy.a11y.filterTabs}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${focusRing} ${
                  tab === t.id
                    ? "bg-[#2D7A5F] text-white"
                    : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? null : filtered.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white/70 p-8 text-center text-stone-600">
              <p className="font-medium text-stone-800">{empty.title}</p>
              <p className="mt-2 text-sm">{empty.body}</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-4" aria-label={copy.a11y.jobList}>
              {filtered.map((job) => {
                const draft = draftsByJob.get(job.id)
                const postedLabel = formatPostedDate(job.postedAt, locale)
                const canReview = job.status === "new" || job.status === "manual"
                const canDraft =
                  job.status === "shortlisted" || job.status === "changes_requested"
                const emailPath = usesEmailSendPath(job)
                const busyRow =
                  actionId === job.id ||
                  reviewingId === job.id ||
                  draftingId === job.id ||
                  addingAppId === job.id ||
                  busyGlobal
                const flags = draft?.fabricationFlags ?? []
                const sendBlocked = flags.length > 0

                return (
                  <li
                    key={job.id}
                    className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                          {copy.status[job.status] ?? job.status}
                          {" · "}
                          {job.kind === "initiative" ? copy.kind.initiative : copy.kind.listing}
                          {job.source ? ` · ${job.source}` : ""}
                          {draft ? ` · draft v${draft.version}` : ""}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-stone-900">
                          {job.title || copy.untitledRole}
                        </h3>
                        <p className="mt-1 text-sm text-stone-600">
                          {[job.companyName, job.location].filter(Boolean).join(" · ") ||
                            copy.companyUnknown}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {postedLabel ? copy.posted(postedLabel) : copy.postedUnknown}
                          {job.emailTo ? ` · ${job.emailTo}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {job.url && (
                          <Button variant="outline" size="sm" asChild className={focusRing}>
                            <a href={job.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              {copy.listingLink}
                            </a>
                          </Button>
                        )}
                        {canReview && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyRow}
                            onClick={() => void runReviewOne(job.id)}
                            className={focusRing}
                          >
                            {reviewingId === job.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            )}
                            {copy.review}
                          </Button>
                        )}
                        {canDraft && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyRow}
                            onClick={() => void runDraftOne(job.id)}
                            className={focusRing}
                          >
                            {draftingId === job.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            )}
                            {draft ? copy.redraft : copy.draft}
                          </Button>
                        )}
                        {job.status === "drafts_ready" && draft && (
                          <Button
                            size="sm"
                            disabled={busyRow}
                            onClick={() => void runJobAction(job.id, "approve")}
                            style={{ backgroundColor: AGENTS_ACCENT }}
                            className={`text-white hover:opacity-90 ${focusRing}`}
                          >
                            {copy.queues.approveDocuments}
                          </Button>
                        )}
                        {job.status === "documents_approved" && emailPath && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyRow || sendBlocked}
                            onClick={() => setConfirmSendJobId(job.id)}
                            className={`border-[#2D7A5F] text-[#2D7A5F] ${focusRing}`}
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {copy.startEmailSend}
                          </Button>
                        )}
                        {job.status === "documents_approved" && !emailPath && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyRow || sendBlocked}
                            onClick={() => void runJobAction(job.id, "mark_sent")}
                            className={focusRing}
                          >
                            {copy.markAsSent}
                          </Button>
                        )}
                        {(job.status === "documents_approved" || job.status === "sent") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyRow || linkedAppIds.has(job.id)}
                            onClick={() => void addToApplications(job.id)}
                            className={`border-[#2D7A5F] text-[#2D7A5F] ${focusRing}`}
                          >
                            {linkedAppIds.has(job.id)
                              ? copy.toast.alreadyInApplications
                              : copy.addToApplications}
                          </Button>
                        )}
                        {!["sent", "rejected", "skipped"].includes(job.status) &&
                          rejectingId !== job.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyRow}
                              onClick={() => {
                                setRejectingId(job.id)
                                setRejectReason("")
                              }}
                              className={`text-amber-800 ${focusRing}`}
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              {copy.reject}
                            </Button>
                          )}
                      </div>
                    </div>

                    {job.status === "sending" && (
                      <SendUndoBanner
                        job={job}
                        copy={copy}
                        busy={actionId === job.id || completingIds.has(job.id)}
                        onUndo={() => void runJobAction(job.id, "undo_send")}
                        onComplete={() => handleCompleteSend(job.id)}
                      />
                    )}

                    {job.status === "rejected" && (
                      <p className="mt-3 text-sm text-stone-600">
                        {copy.rejectedHint(job.rejectReason)}
                      </p>
                    )}

                    {rejectingId === job.id && (
                      <RejectInline
                        jobId={job.id}
                        copy={copy}
                        rejectReason={rejectReason}
                        setRejectReason={setRejectReason}
                        busy={busyRow}
                        onConfirm={() =>
                          void runJobAction(job.id, "reject", { reason: rejectReason })
                        }
                        onCancel={() => {
                          setRejectingId(null)
                          setRejectReason("")
                        }}
                      />
                    )}

                    <RelevanceBlock job={job} copy={copy} factById={factById} />

                    {draft ? (
                      <DraftPanel
                        draft={draft}
                        copy={copy}
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
                        {copy.noDraftYet}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmSendJobId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmSendJobId(null)
        }}
      >
        <AlertDialogContent busy={actionId === confirmSendJobId} className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmSendTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.confirmSendDescription(confirmSendJob?.emailTo ?? null)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm text-stone-600">
            <p>
              <span className="font-medium text-stone-800">To:</span>{" "}
              {confirmSendJob?.emailTo || "—"}
            </p>
            <p>
              <span className="font-medium text-stone-800">Subject:</span>{" "}
              {copy.confirmSendSubject(confirmSendJob?.title || copy.untitledRole)}
            </p>
            <p>{copy.confirmSendMode(gmailLive ? "live" : "test")}</p>
            <div>
              <p className="font-medium text-stone-800">{copy.confirmSendAttachments}</p>
              <ul className="mt-1 list-disc pl-5 text-stone-600">
                <li>CV.pdf</li>
                <li>Cover letter.pdf</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-stone-800">{copy.confirmSendCoverLabel}</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50 p-2 text-xs text-stone-800">
                {confirmSendDraft?.coverText?.trim() || "—"}
              </pre>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionId === confirmSendJobId}>
              {copy.confirmSendCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                actionId === confirmSendJobId ||
                !confirmSendJobId ||
                (confirmSendDraft?.fabricationFlags?.length ?? 0) > 0
              }
              className="bg-[#2D7A5F] text-white hover:bg-[#2D7A5F]/90"
              onClick={(e) => {
                e.preventDefault()
                if (!confirmSendJobId) return
                void runJobAction(confirmSendJobId, "start_send")
              }}
            >
              {actionId === confirmSendJobId ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              {copy.confirmSendConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
