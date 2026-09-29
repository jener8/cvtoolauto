"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { loadQualificationProfile } from "@/lib/qualification-profile/storage"
import type { AgentProfileFact, AgentFactStatus } from "@/lib/agents/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, Check, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"

const CATEGORIES = [
  "identity",
  "summary",
  "role",
  "employer",
  "dates",
  "achievement",
  "skill",
  "education",
  "language",
  "certification",
  "experience",
  "other",
] as const

type FilterStatus = "all" | AgentFactStatus

async function fetchFacts(): Promise<AgentProfileFact[]> {
  const res = await fetch("/api/agents/profile", { credentials: "same-origin" })
  if (res.status === 404) {
    throw new Error("Job agents are disabled")
  }
  const data = (await res.json()) as { facts?: AgentProfileFact[]; error?: string }
  if (!res.ok) throw new Error(data.error ?? "Failed to load facts")
  return data.facts ?? []
}

export function AgentProfilePage() {
  const [facts, setFacts] = useState<AgentProfileFact[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newText, setNewText] = useState("")
  const [newCategory, setNewCategory] = useState<string>("other")
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchFacts()
      setFacts(next)
    } catch (error) {
      toast({
        title: "Could not load master profile",
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
    if (filter === "all") return facts
    return facts.filter((f) => f.status === filter)
  }, [facts, filter])

  const counts = useMemo(() => {
    const confirmed = facts.filter((f) => f.status === "confirmed").length
    return {
      total: facts.length,
      confirmed,
      unconfirmed: facts.length - confirmed,
    }
  }, [facts])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const qualificationProfile = loadQualificationProfile()
      const res = await fetch("/api/agents/profile/seed", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualificationProfile }),
      })
      const data = (await res.json()) as {
        inserted?: number
        skipped?: number
        resumeName?: string | null
        message?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Seed failed")

      const summary =
        data.message ??
        [
          `Imported ${data.inserted ?? 0} new unconfirmed fact(s)`,
          data.skipped ? `(${data.skipped} already present)` : null,
          data.resumeName ? `from “${data.resumeName}”` : null,
        ]
          .filter(Boolean)
          .join(" ") + "."
      toast({
        title: "Seed complete",
        description: summary,
      })
      await refresh()
    } catch (error) {
      toast({
        title: "Seed failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSeeding(false)
    }
  }

  const patchFact = async (
    id: string,
    body: { factText?: string; status?: AgentFactStatus; category?: string },
  ) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/agents/profile/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { fact?: AgentProfileFact; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Update failed")
      if (data.fact) {
        setFacts((prev) => prev.map((f) => (f.id === id ? data.fact! : f)))
      }
      setEditingId(null)
    } catch (error) {
      toast({
        title: "Could not update fact",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const deleteFact = async (id: string) => {
    if (!window.confirm("Permanently delete this fact? This cannot be undone.")) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/agents/profile/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Delete failed")
      setFacts((prev) => prev.filter((f) => f.id !== id))
    } catch (error) {
      toast({
        title: "Could not delete fact",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const addFact = async () => {
    const factText = newText.trim()
    if (!factText) return
    setAdding(true)
    try {
      const res = await fetch("/api/agents/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factText,
          category: newCategory,
          status: "unconfirmed",
          source: "manual",
        }),
      })
      const data = (await res.json()) as { fact?: AgentProfileFact; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Create failed")
      if (data.fact) {
        setFacts((prev) => [...prev, data.fact!])
      }
      setNewText("")
      toast({ title: "Fact added", description: "Starts as unconfirmed — confirm when ready." })
    } catch (error) {
      toast({
        title: "Could not add fact",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/agents">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Agents
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">Back to workspace</Link>
        </Button>
      </div>

      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide" style={{ color: "#2D7A5F" }}>
          Job agents
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Master profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
          Facts are imported as unconfirmed from your existing resume and qualification profile
          (read-only). Confirm what writers may use; edit or delete anything that is wrong.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void handleSeed()}
          disabled={seeding || loading}
          style={{ backgroundColor: "#2D7A5F" }}
          className="text-white hover:opacity-90"
        >
          {seeding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Seed from resume &amp; qualifications
        </Button>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-stone-500">
          <span>{counts.total} total</span>
          <span>·</span>
          <span>{counts.confirmed} confirmed</span>
          <span>·</span>
          <span>{counts.unconfirmed} unconfirmed</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "unconfirmed", "confirmed"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
            className={filter === value ? "bg-stone-800" : undefined}
          >
            {value === "all" ? "All" : value === "unconfirmed" ? "Unconfirmed" : "Confirmed"}
          </Button>
        ))}
      </div>

      <section
        className="mb-8 rounded-lg border border-stone-200 bg-stone-50/80 p-4"
        aria-labelledby="add-fact-heading"
      >
        <h2 id="add-fact-heading" className="mb-3 text-sm font-semibold text-stone-800">
          Add a fact
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger className="w-full bg-white sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write an atomic fact…"
            className="min-h-[72px] flex-1 bg-white"
            rows={2}
          />
          <Button onClick={() => void addFact()} disabled={adding || !newText.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1.5">Add</span>
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading facts…
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
          {facts.length === 0
            ? "No facts yet. Seed from your resume and qualifications, or add one manually."
            : "No facts match this filter."}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Profile facts">
          {filtered.map((fact) => {
            const busy = busyId === fact.id
            const editing = editingId === fact.id
            return (
              <li
                key={fact.id}
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-normal capitalize">
                    {fact.category}
                  </Badge>
                  <Badge
                    variant={fact.status === "confirmed" ? "default" : "outline"}
                    className={
                      fact.status === "confirmed"
                        ? "border-transparent bg-[#2D7A5F] font-normal"
                        : "font-normal"
                    }
                  >
                    {fact.status}
                  </Badge>
                  <span className="text-xs text-stone-400">
                    {fact.source === "qualification_profile"
                      ? "qualification profile"
                      : fact.source}
                  </span>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[80px]"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy || !editText.trim()}
                        onClick={() => void patchFact(fact.id, { factText: editText })}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-stone-800">{fact.factText}</p>
                )}

                {!editing ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fact.status !== "confirmed" ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        style={{ backgroundColor: "#2D7A5F" }}
                        className="text-white hover:opacity-90"
                        onClick={() => void patchFact(fact.id, { status: "confirmed" })}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Confirm
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void patchFact(fact.id, { status: "unconfirmed" })}
                      >
                        Unconfirm
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(fact.id)
                        setEditText(fact.factText)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={busy}
                      onClick={() => void deleteFact(fact.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
