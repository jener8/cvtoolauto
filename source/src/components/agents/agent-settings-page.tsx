"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type { AgentSearchSettings } from "@/lib/agents/types"
import type { AgentControlKey, AgentControlsMap } from "@/lib/agents/agent-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, Loader2, Play, Search, Save, Trash2 } from "lucide-react"
import { DEFAULT_JOB_SCOUT_KEYWORDS } from "@/lib/agents/default-keywords"

type RunResult = {
  fetched?: number
  inserted?: number
  duplicates?: number
  bySource?: Record<string, { fetched: number; matched: number; skipped?: boolean }>
  errors?: string[]
  error?: string
}

const AGENT_ROWS: Array<{
  key: AgentControlKey
  title: string
  schedule: string
  runMode: "step" | "pipeline"
}> = [
  {
    key: "job_scout",
    title: "Job Scout",
    schedule: "3× daily (06:00 / 12:00 / 18:00 UTC) → then Assessor → Writer",
    runMode: "pipeline",
  },
  {
    key: "company_scout",
    title: "Company Scout",
    schedule: "Weekly (Mon 07:00 UTC) → then Assessor → Writer · cap COMPANY_SCOUT_WEEKLY_CAP",
    runMode: "pipeline",
  },
  {
    key: "assessor",
    title: "Assessor",
    schedule: "Runs after each scout (relevance review)",
    runMode: "step",
  },
  {
    key: "writer",
    title: "Writer / Fact Checker",
    schedule: "Runs after Assessor · drafts prefer strongest + freshest · JOB_DRAFTS_DAILY_CAP",
    runMode: "step",
  },
]

function listToCsv(values: string[]): string {
  return values.join(", ")
}

function csvToList(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const SENIORITY_OPTIONS = [
  { value: "any", label: "Any seniority" },
  { value: "intern", label: "Intern / trainee" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / principal" },
]

const DEFAULT_CONTROLS: AgentControlsMap = {
  job_scout: { paused: false },
  company_scout: { paused: false },
  assessor: { paused: false },
  writer: { paused: false },
}

export function AgentSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runningAgent, setRunningAgent] = useState<AgentControlKey | null>(null)
  const [togglingAgent, setTogglingAgent] = useState<AgentControlKey | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [keywords, setKeywords] = useState("")
  const [location, setLocation] = useState("Berlin")
  const [remote, setRemote] = useState(false)
  const [languages, setLanguages] = useState("")
  const [seniority, setSeniority] = useState("any")
  const [targetCompanies, setTargetCompanies] = useState("")
  const [controls, setControls] = useState<AgentControlsMap>(DEFAULT_CONTROLS)
  const [lastRun, setLastRun] = useState<RunResult | null>(null)
  const [lastAgentRun, setLastAgentRun] = useState<string | null>(null)

  const applySettings = (settings: AgentSearchSettings) => {
    setKeywords(listToCsv(settings.keywords))
    setLocation(settings.location || "Berlin")
    setRemote(Boolean(settings.remote))
    setLanguages(listToCsv(settings.languages))
    setSeniority(settings.seniority?.trim() || "any")
    setTargetCompanies(listToCsv(settings.targetCompanies ?? []))
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, controlsRes] = await Promise.all([
        fetch("/api/agents/settings", { credentials: "same-origin" }),
        fetch("/api/agents/controls", { credentials: "same-origin" }),
      ])
      if (settingsRes.status === 404) throw new Error("Job agents are disabled")
      const settingsData = (await settingsRes.json()) as {
        settings?: AgentSearchSettings
        error?: string
      }
      if (!settingsRes.ok) throw new Error(settingsData.error ?? "Failed to load settings")
      if (settingsData.settings) applySettings(settingsData.settings)

      if (controlsRes.ok) {
        const controlsData = (await controlsRes.json()) as {
          controls?: AgentControlsMap
          error?: string
        }
        if (controlsData.controls) setControls(controlsData.controls)
      }
    } catch (error) {
      toast({
        title: "Could not load search settings",
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

  const buildPayload = () => ({
    keywords: csvToList(keywords),
    location: location.trim() || "Berlin",
    remote,
    languages: csvToList(languages),
    seniority: seniority === "any" ? null : seniority,
    targetCompanies: csvToList(targetCompanies),
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/agents/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const data = (await res.json()) as { settings?: AgentSearchSettings; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      if (data.settings) applySettings(data.settings)
      toast({ title: "Settings saved", description: "Search preferences updated." })
    } catch (error) {
      toast({
        title: "Could not save settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePause = async (agentKey: AgentControlKey, paused: boolean) => {
    setTogglingAgent(agentKey)
    try {
      const res = await fetch("/api/agents/controls", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, paused }),
      })
      const data = (await res.json()) as {
        controls?: AgentControlsMap
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Could not update pause state")
      if (data.controls) setControls(data.controls)
      toast({
        title: paused ? "Agent paused" : "Agent resumed",
        description: `${agentKey} is now ${paused ? "paused" : "active"}.`,
      })
    } catch (error) {
      toast({
        title: "Could not update agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setTogglingAgent(null)
    }
  }

  const handleRunAgent = async (
    agentKey: AgentControlKey,
    mode: "step" | "pipeline",
  ) => {
    setRunningAgent(agentKey)
    setLastAgentRun(null)
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, mode }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        fetched?: number
        inserted?: number
        relevant?: number
        drafted?: number
        errors?: number
        errorMessages?: string[]
        error?: string
        skipped?: boolean
      }
      if (!res.ok) throw new Error(data.error ?? "Run failed")
      const summary =
        mode === "pipeline"
          ? `${agentKey} pipeline: fetched ${data.fetched ?? 0} · relevant ${data.relevant ?? 0} · drafted ${data.drafted ?? 0} · errors ${data.errors ?? 0}`
          : `${agentKey} finished${data.skipped ? " (skipped)" : ""}${
              data.errorMessages?.length ? ` · ${data.errorMessages[0]}` : ""
            }`
      setLastAgentRun(summary)
      toast({ title: "Run complete", description: summary })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      const friendly =
        /unauthorized/i.test(message)
          ? "You are not signed in. Open Login, then return here and try again."
          : /PGRST205|Could not find the table/i.test(message)
            ? `${message} — apply scripts 020–023 on a non-live Supabase project (do not migrate live without approval).`
            : message
      setLastAgentRun(`Run failed: ${friendly}`)
      toast({
        title: "Run failed",
        description: friendly,
        variant: "destructive",
      })
    } finally {
      setRunningAgent(null)
    }
  }

  const handleRunSearch = async () => {
    setRunning(true)
    setLastRun(null)
    try {
      const saveRes = await fetch("/api/agents/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const saveData = (await saveRes.json()) as { settings?: AgentSearchSettings; error?: string }
      if (!saveRes.ok) throw new Error(saveData.error ?? "Could not save settings before search")
      if (saveData.settings) applySettings(saveData.settings)

      const res = await fetch("/api/agents/search/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as RunResult
      if (!res.ok) throw new Error(data.error ?? "Search failed")
      setLastRun(data)
      toast({
        title: "Search complete",
        description: `Fetched ${data.fetched ?? 0} · inserted ${data.inserted ?? 0} · skipped ${data.duplicates ?? 0} duplicates. Review fits on the job agents queue.`,
      })
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  const handleDeleteAllAgentData = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch("/api/agents/data", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_AGENT_DATA" }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        total?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Delete failed")
      setConfirmDelete(false)
      applySettings({
        id: "",
        userId: "",
        keywords: [],
        location: "Berlin",
        remote: false,
        languages: [],
        seniority: null,
        targetCompanies: [],
        createdAt: "",
        updatedAt: "",
      })
      setControls(DEFAULT_CONTROLS)
      setLastRun(null)
      setLastAgentRun(null)
      toast({
        title: "Agent data deleted",
        description: `Removed ${data.total ?? 0} agent rows. Resumes and job applications were not touched.`,
      })
    } catch (error) {
      toast({
        title: "Could not delete agent data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const busy =
    saving || running || deleting || runningAgent !== null || togglingAgent !== null

  return (
    <div
      className="min-h-[70vh] px-4 py-10 sm:px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,122,95,0.12), transparent), linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
      }}
    >
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link href="/app/agents">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to job agents
          </Link>
        </Button>

        <p className="text-sm font-medium tracking-wide" style={{ color: "#2D7A5F" }}>
          EquitAI
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Search settings
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Configure keywords, company watchlist, and per-agent pause / run. Job Scout runs 3× daily;
          Company Scout weekly. Assessor and Writer follow each scout within caps. Nothing is sent to
          employers automatically.
        </p>

        {loading ? (
          <div className="mt-12 flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings…
          </div>
        ) : (
          <>
            <div className="mt-10 space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-stone-900">Agents — pause / run now</h2>
              <p className="text-sm text-stone-600">
                Pause skips that agent on cron and pipelines. <span className="font-medium">Run now</span>{" "}
                always runs the chosen agent (and scout pipelines continue to Assessor → Writer unless
                those are paused).
              </p>
              <ul className="space-y-4">
                {AGENT_ROWS.map((row) => {
                  const paused = controls[row.key]?.paused ?? false
                  return (
                    <li
                      key={row.key}
                      className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900">{row.title}</p>
                        <p className="mt-0.5 text-xs text-stone-500">{row.schedule}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`pause-${row.key}`} className="text-xs text-stone-600">
                            {paused ? "Paused" : "Active"}
                          </Label>
                          <Switch
                            id={`pause-${row.key}`}
                            checked={!paused}
                            disabled={busy}
                            onCheckedChange={(active) =>
                              void handleTogglePause(row.key, !active)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleRunAgent(row.key, row.runMode)}
                        >
                          {runningAgent === row.key ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Run now
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {lastAgentRun && (
                <p className="text-sm text-stone-600">{lastAgentRun}</p>
              )}
            </div>

            <div className="mt-10 space-y-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={DEFAULT_JOB_SCOUT_KEYWORDS.slice(0, 4).join(", ")}
                />
                <p className="text-xs text-stone-500">
                  Comma-separated. Job Scout keeps a listing only if title or description matches at
                  least one keyword (OR). Non-matches are logged in Activity as &ldquo;Filtered out:
                  not a target role&rdquo; and never appear in the list or Assessor queue.
                </p>
                <p className="text-xs text-stone-500">
                  Default list (editable): {DEFAULT_JOB_SCOUT_KEYWORDS.join(", ")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Berlin"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
                <div>
                  <Label htmlFor="remote">Remote / home office</Label>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Prefer remote listings (BA uses Heim-/Telearbeit; others filter client-side).
                  </p>
                </div>
                <Switch id="remote" checked={remote} onCheckedChange={setRemote} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="languages">Languages</Label>
                <Input
                  id="languages"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="de, en"
                />
                <p className="text-xs text-stone-500">
                  Optional filter (e.g. de, en). Empty = no language filter.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Seniority</Label>
                <Select value={seniority} onValueChange={setSeniority}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any seniority" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetCompanies">Company Scout watchlist</Label>
                <Input
                  id="targetCompanies"
                  value={targetCompanies}
                  onChange={(e) => setTargetCompanies(e.target.value)}
                  placeholder="Acme GmbH, Example AG"
                />
                <p className="text-xs text-stone-500">
                  Comma-separated company names for weekly Company Scout initiative targets. If empty,
                  scout uses companies already seen via allowed job APIs. No LinkedIn/StepStone scrape.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={busy}
                  variant="outline"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save settings
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleRunSearch()}
                  disabled={busy}
                  style={{ backgroundColor: "#2D7A5F" }}
                  className="text-white hover:opacity-90"
                >
                  {running ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Run search
                </Button>
              </div>

              {lastRun && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                  <p className="font-medium text-stone-900">Last run</p>
                  <p className="mt-1">
                    Fetched {lastRun.fetched ?? 0} · inserted {lastRun.inserted ?? 0} · duplicates
                    skipped {lastRun.duplicates ?? 0}
                  </p>
                  {lastRun.bySource && (
                    <ul className="mt-2 space-y-1 text-xs text-stone-600">
                      {Object.entries(lastRun.bySource).map(([source, stats]) => (
                        <li key={source}>
                          {source}: fetched {stats.fetched}, matched {stats.matched}
                          {stats.skipped ? " (skipped — missing API keys)" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {lastRun.errors && lastRun.errors.length > 0 && (
                    <p className="mt-2 text-xs text-amber-800">
                      {lastRun.errors.length} warning(s): {lastRun.errors.slice(0, 3).join(" · ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-10 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">Delete all agent data</h2>
          <p className="mt-2 text-sm text-stone-600">
            Removes all <code className="text-xs">agent_*</code> rows for this workspace user
            (facts, settings, controls, companies, jobs, drafts, activity). Does{" "}
            <span className="font-medium">not</span> delete resumes or job applications.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteAllAgentData()}
              disabled={busy}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {confirmDelete ? "Click again to confirm delete" : "Delete all agent data"}
            </Button>
            {confirmDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
