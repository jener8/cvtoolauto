"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type { AgentSearchSettings } from "@/lib/agents/types"
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
import { ArrowLeft, Loader2, Search, Save } from "lucide-react"

type RunResult = {
  fetched?: number
  inserted?: number
  duplicates?: number
  bySource?: Record<string, { fetched: number; matched: number; skipped?: boolean }>
  errors?: string[]
  error?: string
}

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

export function AgentSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [keywords, setKeywords] = useState("")
  const [location, setLocation] = useState("Berlin")
  const [remote, setRemote] = useState(false)
  const [languages, setLanguages] = useState("")
  const [seniority, setSeniority] = useState("any")
  const [lastRun, setLastRun] = useState<RunResult | null>(null)

  const applySettings = (settings: AgentSearchSettings) => {
    setKeywords(listToCsv(settings.keywords))
    setLocation(settings.location || "Berlin")
    setRemote(Boolean(settings.remote))
    setLanguages(listToCsv(settings.languages))
    setSeniority(settings.seniority?.trim() || "any")
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/agents/settings", { credentials: "same-origin" })
      if (res.status === 404) throw new Error("Job agents are disabled")
      const data = (await res.json()) as { settings?: AgentSearchSettings; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to load settings")
      if (data.settings) applySettings(data.settings)
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

  const handleRunSearch = async () => {
    setRunning(true)
    setLastRun(null)
    try {
      // Persist current form first so the run uses the latest criteria
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
      })
      const data = (await res.json()) as RunResult
      if (!res.ok) throw new Error(data.error ?? "Search failed")
      setLastRun(data)
      toast({
        title: "Search complete",
        description: `Fetched ${data.fetched ?? 0} · inserted ${data.inserted ?? 0} · skipped ${data.duplicates ?? 0} duplicates`,
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
          Configure keywords and location, then run a manual fetch from Arbeitsagentur, Arbeitnow,
          and Adzuna (when keyed). Listings are normalized, de-duplicated, and stored as{" "}
          <span className="font-medium text-stone-800">new</span> — no auto-apply.
        </p>

        {loading ? (
          <div className="mt-12 flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings…
          </div>
        ) : (
          <div className="mt-10 space-y-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Product Manager, Product Owner"
              />
              <p className="text-xs text-stone-500">Comma-separated. Used as the primary search query.</p>
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

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || running}
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
                disabled={saving || running}
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
        )}
      </div>
    </div>
  )
}
