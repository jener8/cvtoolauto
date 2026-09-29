"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { loadQualificationProfile } from "@/lib/qualification-profile/storage"
import {
  buildExploreKeywordCluster,
  extractKeywordClusters,
  toKeywordCardModels,
} from "@/lib/search-keywords/extract"
import {
  loadSavedKeywords,
  saveSavedKeywords,
  toggleSavedKeyword,
} from "@/lib/search-keywords/saved-storage"
import type { KeywordCardModel, SavedKeywordCluster } from "@/lib/search-keywords/types"
import { loadStrategicProfile } from "@/lib/strategic-profile"
import { foldersStorage } from "@/lib/storage"
import type { JobApplication } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react"

type MobileKeywordsProps = {
  applications: JobApplication[]
}

async function resolveFolderId(applications: JobApplication[]): Promise<string | null> {
  const fromApps = applications.find((job) => job.folderId?.trim())?.folderId?.trim()
  if (fromApps) return fromApps
  try {
    const folders = await foldersStorage.list()
    return folders[0]?.id ?? null
  } catch {
    return null
  }
}

async function ensureFolderId(applications: JobApplication[]): Promise<string> {
  const existing = await resolveFolderId(applications)
  if (existing) return existing
  const folder = await foldersStorage.create("My workspace")
  return folder.id
}

export function MobileKeywords({ applications }: MobileKeywordsProps) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedKeywordCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const id = await resolveFolderId(applications)
      if (cancelled) return
      setFolderId(id)
      setSaved(id ? loadSavedKeywords(id) : [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [applications])

  const derivedCards = useMemo(() => {
    if (!folderId) return [] as KeywordCardModel[]
    const strategicProfile = loadStrategicProfile()
    const qualificationProfile = loadQualificationProfile()
    return toKeywordCardModels(
      extractKeywordClusters({
        folderId,
        strategicProfile,
        jobApplications: applications,
        qualificationProfile,
        maxCards: 10,
      }),
    )
  }, [folderId, applications])

  const cards = useMemo(() => {
    const derivedIds = new Set(derivedCards.map((card) => card.id))
    const savedOnly = toKeywordCardModels(saved.filter((item) => !derivedIds.has(item.id)))
    // Show user-saved / custom keywords first, then derived matches
    return [...savedOnly, ...derivedCards]
  }, [derivedCards, saved])

  const savedIds = useMemo(() => new Set(saved.map((item) => item.id)), [saved])

  const handleCopy = useCallback(async (card: KeywordCardModel) => {
    try {
      await navigator.clipboard.writeText(card.searchString)
      setCopiedId(card.id)
      window.setTimeout(() => setCopiedId((id) => (id === card.id ? null : id)), 1600)
    } catch (err) {
      console.error("[mobile] Keyword copy failed:", err)
      window.prompt("Copy this search string:", card.searchString)
    }
  }, [])

  const handleAdd = useCallback(async () => {
    const query = draft.trim()
    if (!query) {
      setAddError("Enter a keyword or search phrase.")
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const cluster = buildExploreKeywordCluster(query)
      if (!cluster) {
        setAddError("Use a short search phrase (under 60 characters).")
        return
      }
      const id = folderId ?? (await ensureFolderId(applications))
      if (!folderId) setFolderId(id)

      const existing = loadSavedKeywords(id)
      if (existing.some((item) => item.id === cluster.id || item.searchString === cluster.searchString)) {
        setAddError("That keyword is already saved.")
        return
      }
      const next = [{ ...cluster, savedAt: Date.now() }, ...existing]
      saveSavedKeywords(id, next)
      setSaved(next)
      setDraft("")
    } catch (err) {
      console.error("[mobile] Add keyword failed:", err)
      setAddError(err instanceof Error ? err.message : "Couldn’t save keyword.")
    } finally {
      setAdding(false)
    }
  }, [draft, folderId, applications])

  const handleRemoveSaved = useCallback(
    (card: KeywordCardModel) => {
      if (!folderId) return
      const next = toggleSavedKeyword(saved, card)
      // toggle removes if present
      saveSavedKeywords(folderId, next)
      setSaved(next)
    },
    [folderId, saved],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-zinc-200/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              EquitAI
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900">
              Keywords
            </h1>
          </div>
          <p className="pb-0.5 text-xs tabular-nums text-zinc-500">{cards.length}</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Add your own phrases, then copy them into LinkedIn, Indeed, or StepStone.
        </p>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void handleAdd()
          }}
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (addError) setAddError(null)
            }}
            placeholder="e.g. Accessibility OR Barrierefreiheit"
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            maxLength={60}
            enterKeyHint="done"
          />
          <button
            type="submit"
            disabled={adding || !draft.trim()}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-sm font-medium text-white disabled:opacity-40 active:bg-zinc-800"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {adding ? "…" : "Add"}
          </button>
        </form>
        {addError ? <p className="mt-2 text-xs text-red-700">{addError}</p> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <KeyRound className="h-5 w-5 text-zinc-500" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-900">No keywords yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
              Add a search phrase above, or they will also appear from your career story and
              applications.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {cards.map((card) => {
              const copied = copiedId === card.id
              const isSaved = savedIds.has(card.id)
              return (
                <li
                  key={card.id}
                  className="rounded-2xl border border-zinc-200 bg-white px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-zinc-900">
                        {card.displayTitle}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        {isSaved && card.provenance === "Your search."
                          ? "Your keyword"
                          : card.fitLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isSaved ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveSaved(card)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 active:bg-zinc-50"
                          aria-label="Remove keyword"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleCopy(card)}
                        className={cn(
                          "flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium",
                          copied
                            ? "bg-teal-50 text-teal-800"
                            : "bg-zinc-900 text-white active:bg-zinc-800",
                        )}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" aria-hidden />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 break-words rounded-xl bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-700">
                    {card.searchString}
                  </p>
                  {card.provenance ? (
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">{card.provenance}</p>
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
