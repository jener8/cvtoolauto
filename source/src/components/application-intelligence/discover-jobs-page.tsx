"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { loadCareerProfilePrefs, patchAutomatePrefs } from "@/lib/career-profile/storage"
import { isJobAgentEnabledClient } from "@/lib/agents/feature-flag"
import type { AgentJobListItem } from "@/app/api/agents/jobs/route"
import type { AgentRelevancePayload } from "@/lib/agents/types"
import { buildLiveDiscoverySearchQuery } from "@/lib/live-discovery/build-search-query"
import {
  loadLiveDiscoveryLocalState,
  markJobDismissed,
  markJobSaved,
  type LiveDiscoveryLocalState,
} from "@/lib/live-discovery/local-state"
import { loadSavedRoleMatches } from "@/lib/role-matches/saved-storage"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { pageTitleForSection } from "@/lib/workspace-shell-copy"
import { usePageTitle } from "@/hooks/use-page-title"
import { ExternalLink, Loader2, RefreshCw, Search } from "lucide-react"
import "./discover-jobs-page.css"

export type DiscoverJobsOpenPayload = {
  jobTitle: string
  company: string
  location?: string
  jobDescription: string
  jobDescriptionUrl?: string
  agentJobId?: string
}

type DiscoverJobsPageProps = {
  folderId: string
  strategicProfile: StrategicProfile | null
  onNavigateCareerProfile: () => void
  onNavigateRoleStrategy: () => void
  onOpenInApplications: (payload: DiscoverJobsOpenPayload) => void | Promise<void>
}

type FilterMode = "active" | "saved" | "dismissed"

function isRelevance(value: unknown): value is AgentRelevancePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AgentRelevancePayload).summary === "string"
  )
}

function sourceLabel(source: string | null): string {
  if (!source) return "Listing"
  if (source === "arbeitsagentur") return "Bundesagentur für Arbeit"
  if (source === "arbeitnow") return "Arbeitnow"
  if (source === "adzuna") return "Adzuna"
  return source
}

export function DiscoverJobsPage({
  folderId,
  strategicProfile,
  onNavigateCareerProfile,
  onNavigateRoleStrategy,
  onOpenInApplications,
}: DiscoverJobsPageProps) {
  usePageTitle(pageTitleForSection("liveJobs"))
  const agentsEnabled = isJobAgentEnabledClient()
  const [jobs, setJobs] = useState<AgentJobListItem[]>([])
  const [local, setLocal] = useState<LiveDiscoveryLocalState>(() =>
    loadLiveDiscoveryLocalState(folderId),
  )
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)
  const [filter, setFilter] = useState<FilterMode>("active")
  const [lastRunNote, setLastRunNote] = useState<string | null>(null)

  const searchPreview = useMemo(() => {
    const careerPrefs = loadCareerProfilePrefs()
    const saved = loadSavedRoleMatches(folderId)
    return buildLiveDiscoverySearchQuery({
      careerPrefs,
      strategicProfile,
      savedRoleMatches: saved,
    })
  }, [folderId, strategicProfile])

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/agents/jobs?fields=description", {
        credentials: "same-origin",
      })
      if (res.status === 404) {
        setApiAvailable(false)
        setJobs([])
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Could not load jobs (${res.status})`)
      }
      setApiAvailable(true)
      const body = (await res.json()) as { jobs?: AgentJobListItem[] }
      setJobs(Array.isArray(body.jobs) ? body.jobs : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load vacancies")
      setApiAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLocal(loadLiveDiscoveryLocalState(folderId))
  }, [folderId])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const runDiscovery = async () => {
    setRunning(true)
    setError(null)
    setLastRunNote(null)
    try {
      const query = buildLiveDiscoverySearchQuery({
        careerPrefs: loadCareerProfilePrefs(),
        strategicProfile,
        savedRoleMatches: loadSavedRoleMatches(folderId),
      })

      if (query.keywords.length === 0) {
        setError(
          "Add roles of interest in Career Profile or save directions in Role Strategy before searching.",
        )
        return
      }

      const settingsRes = await fetch("/api/agents/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: query.keywords,
          location: query.location,
          remote: query.remote,
        }),
      })
      if (settingsRes.status === 404) {
        setApiAvailable(false)
        setError("Live job search is not enabled on this server yet.")
        return
      }
      if (!settingsRes.ok) {
        const body = (await settingsRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || "Could not update search settings")
      }

      const searchRes = await fetch("/api/agents/search/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReview: true }),
      })
      if (!searchRes.ok) {
        const body = (await searchRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || "Search failed")
      }
      const result = (await searchRes.json()) as {
        fetched?: number
        inserted?: number
        duplicates?: number
      }

      patchAutomatePrefs({
        lastSuccessfulSearchAt: Date.now(),
        newRecommendationCount: result.inserted ?? 0,
      })

      setLastRunNote(
        `Fetched ${result.fetched ?? 0} · new ${result.inserted ?? 0} · duplicates ${result.duplicates ?? 0}. Sources: ${query.sourcesUsed.join(", ")}.`,
      )
      setApiAvailable(true)
      await loadJobs()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery run failed")
    } finally {
      setRunning(false)
    }
  }

  const shortlistRemote = async (jobId: string) => {
    try {
      await fetch("/api/agents/jobs/gate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shortlist", jobIds: [jobId] }),
      })
    } catch {
      /* local save still applies */
    }
  }

  const skipRemote = async (jobId: string) => {
    try {
      await fetch("/api/agents/jobs/gate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip", jobIds: [jobId] }),
      })
    } catch {
      /* local dismiss still applies */
    }
  }

  const visibleJobs = useMemo(() => {
    return jobs.filter((job) => {
      const saved = local.savedIds.includes(job.id)
      const dismissed = local.dismissedIds.includes(job.id) || job.status === "skipped"
      if (filter === "saved") return saved
      if (filter === "dismissed") return dismissed
      return !dismissed
    })
  }, [jobs, local, filter])

  const openApplication = (job: AgentJobListItem & { description?: string | null }) => {
    const relevance = isRelevance(job.relevance) ? job.relevance : null
    const descriptionParts = [
      job.description?.trim(),
      relevance?.summary
        ? `Why this may be relevant (AI interpretation — verify against the listing):\n${relevance.summary}`
        : "",
      job.url ? `Original listing: ${job.url}` : "",
    ].filter(Boolean)

    void onOpenInApplications({
      jobTitle: job.title?.trim() || "Untitled role",
      company: job.companyName?.trim() || "Unknown company",
      location: job.location?.trim() || undefined,
      jobDescription: descriptionParts.join("\n\n"),
      jobDescriptionUrl: job.url?.trim() || undefined,
      agentJobId: job.id,
    })
  }

  return (
    <div className="discover-jobs-page">
      <header className="discover-jobs-page__header">
        <h1>Discover Jobs</h1>
        <p>
          Live vacancies from permitted sources, matched to your Career Profile and Role Strategy.
          Explanations are qualitative — not hiring probabilities.
        </p>
      </header>

      <section className="discover-jobs-page__panel" aria-label="Search setup">
        <p className="discover-jobs-page__meta">
          Search will use:{" "}
          <strong>
            {searchPreview.keywords.length > 0
              ? searchPreview.keywords.slice(0, 6).join(" · ")
              : "No keywords yet"}
          </strong>
          {searchPreview.keywords.length > 6 ? "…" : ""}
          <br />
          Location: {searchPreview.location}
          {searchPreview.remote ? " · remote/hybrid preferred" : ""} · Informed by{" "}
          {searchPreview.sourcesUsed.join(", ")}
        </p>
        <div className="discover-jobs-page__actions">
          <button
            type="button"
            className="discover-jobs-page__btn discover-jobs-page__btn--primary"
            disabled={running || loading}
            onClick={() => void runDiscovery()}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {running ? "Searching…" : "Run discovery now"}
          </button>
          <button
            type="button"
            className="discover-jobs-page__btn"
            disabled={loading || running}
            onClick={() => void loadJobs()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            className="discover-jobs-page__btn discover-jobs-page__btn--ghost"
            onClick={onNavigateCareerProfile}
          >
            Career Profile
          </button>
          <button
            type="button"
            className="discover-jobs-page__btn discover-jobs-page__btn--ghost"
            onClick={onNavigateRoleStrategy}
          >
            Role Strategy
          </button>
        </div>
        {lastRunNote ? <p className="discover-jobs-page__meta">{lastRunNote}</p> : null}
      </section>

      {apiAvailable === false || (!agentsEnabled && apiAvailable !== true) ? (
        <div className="discover-jobs-page__alert" role="status">
          Live vacancy search needs job discovery enabled on the server (
          <code>JOB_AGENT_ENABLED</code> and <code>NEXT_PUBLIC_JOB_AGENT_ENABLED</code>). Career
          Profile keywords above are ready — enable the APIs to fetch Adzuna, Arbeitnow and
          Bundesagentur listings. Existing applications and CV generation stay unchanged.
        </div>
      ) : null}

      {error ? (
        <div className="discover-jobs-page__alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="discover-jobs-page__filters" role="tablist" aria-label="Filter vacancies">
        {(
          [
            ["active", "Active"],
            ["saved", "Saved"],
            ["dismissed", "Dismissed"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`discover-jobs-page__filter${filter === id ? " discover-jobs-page__filter--active" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && jobs.length === 0 ? (
        <p className="discover-jobs-page__empty">Loading vacancies…</p>
      ) : visibleJobs.length === 0 ? (
        <p className="discover-jobs-page__empty">
          No vacancies here yet. Run discovery after setting Career Profile or Role Strategy
          directions.
        </p>
      ) : (
        <div className="discover-jobs-page__list">
          {visibleJobs.map((job) => {
            const relevance = isRelevance(job.relevance) ? job.relevance : null
            const saved = local.savedIds.includes(job.id)
            const dismissed = local.dismissedIds.includes(job.id)
            return (
              <article
                key={job.id}
                className={`discover-jobs-page__card${dismissed ? " discover-jobs-page__card--dismissed" : ""}`}
              >
                <div>
                  <h2 className="discover-jobs-page__title">{job.title || "Untitled role"}</h2>
                  <p className="discover-jobs-page__company">
                    {[job.companyName, job.location].filter(Boolean).join(" · ") || "Employer TBA"}
                  </p>
                </div>

                <div className="discover-jobs-page__chips">
                  <span className="discover-jobs-page__chip">{sourceLabel(job.source)}</span>
                  {job.postedAt ? (
                    <span className="discover-jobs-page__chip">
                      Posted {new Date(job.postedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {saved ? <span className="discover-jobs-page__chip">Saved</span> : null}
                  {relevance?.relevant === true ? (
                    <span className="discover-jobs-page__chip discover-jobs-page__chip--fit">
                      Potential fit
                    </span>
                  ) : null}
                  {relevance?.relevant === false ? (
                    <span className="discover-jobs-page__chip discover-jobs-page__chip--gap">
                      Weaker match
                    </span>
                  ) : null}
                </div>

                {relevance?.summary ? (
                  <div>
                    <div className="discover-jobs-page__why-label">Why this may be worth considering</div>
                    <p className="discover-jobs-page__why">{relevance.summary}</p>
                    {relevance.requirements_met?.length ? (
                      <p className="discover-jobs-page__meta" style={{ marginTop: "0.4rem" }}>
                        Strengths:{" "}
                        {relevance.requirements_met
                          .slice(0, 3)
                          .map((r) => r.requirement)
                          .join("; ")}
                      </p>
                    ) : null}
                    {relevance.requirements_not_met?.length ? (
                      <p className="discover-jobs-page__meta">
                        Gaps: {relevance.requirements_not_met.slice(0, 3).join("; ")}
                      </p>
                    ) : null}
                    <p className="discover-jobs-page__verified">
                      Listing details are from the source. Fit notes are AI interpretation — verify
                      before applying.
                    </p>
                  </div>
                ) : (
                  <p className="discover-jobs-page__meta">
                    No fit review yet. Run discovery with review enabled, or open the listing to
                    decide yourself.
                  </p>
                )}

                <div className="discover-jobs-page__actions">
                  {job.url ? (
                    <a
                      className="discover-jobs-page__btn"
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Original listing
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="discover-jobs-page__btn discover-jobs-page__btn--primary"
                    onClick={() => openApplication(job)}
                  >
                    Open in My applications
                  </button>
                  <button
                    type="button"
                    className="discover-jobs-page__btn"
                    onClick={() => {
                      setLocal(markJobSaved(folderId, job.id))
                      void shortlistRemote(job.id)
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="discover-jobs-page__btn discover-jobs-page__btn--ghost"
                    onClick={() => {
                      setLocal(markJobDismissed(folderId, job.id))
                      void skipRemote(job.id)
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
