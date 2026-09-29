"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  applicationFromRecoveryRecord,
  searchAllApplicationRecords,
  type ApplicationRecoverySearchResult,
  type RecoveredApplicationRecord,
} from "@/lib/job-applications-recovery"
import type { Folder, JobApplication } from "@/lib/types"
import { Loader2, RotateCcw, Search } from "lucide-react"

type ApplicationsRecoveryPanelProps = {
  currentWorkspaceId: string | null
  currentApplications: JobApplication[]
  folders: Folder[]
  onRestore: (application: JobApplication) => Promise<void> | void
}

function formatWhen(timestamp: number | null): string {
  if (!timestamp) return "—"
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sourceLabel(source: RecoveredApplicationRecord["source"]): string {
  switch (source) {
    case "supabase":
      return "Supabase"
    case "local_cache":
      return "Local cache"
    case "resume_version":
      return "Resume (no application row)"
    case "resume_snapshot":
      return "Resume snapshot"
    case "reconciled_candidate":
      return "Reconciled candidate"
    default:
      return source
  }
}

export function ApplicationsRecoveryPanel({
  currentWorkspaceId,
  currentApplications,
  folders,
  onRestore,
}: ApplicationsRecoveryPanelProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [result, setResult] = useState<ApplicationRecoverySearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSearch = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const next = await searchAllApplicationRecords({
        query: q,
        currentWorkspaceId,
        currentApplications,
        folders,
      })
      setResult(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (record: RecoveredApplicationRecord) => {
    if (!currentWorkspaceId) {
      setError("Open a workspace before restoring an application.")
      return
    }
    const application = applicationFromRecoveryRecord(record, currentWorkspaceId)
    if (!application) {
      setError("This record cannot be restored — no application data found.")
      return
    }
    setRestoringId(record.id)
    setError(null)
    try {
      await onRestore(application)
      await runSearch(query)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed")
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="rounded-md border border-dashed border-sky-500/40 bg-sky-500/5 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground/90">Application recovery search</p>
        <p className="text-muted-foreground">
          Searches Supabase, browser cache, and resume snapshots — including records removed from
          the current list.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by company or job title…"
          className="h-9 max-w-md text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch()
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={loading || !query.trim()}
          onClick={() => void runSearch()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Search className="h-3.5 w-3.5" aria-hidden />
          )}
          Search all sources
        </Button>
      </div>

      {error ? <p className="mt-3 text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
            <dt>Supabase</dt>
            <dd>{result.supabaseAvailable ? "connected" : "unavailable / local mode"}</dd>
            <dt>Current list</dt>
            <dd>{result.currentListCount}</dd>
            <dt>Matches</dt>
            <dd>{result.summary.totalMatches}</dd>
            <dt>Missing from list</dt>
            <dd>{result.summary.missingFromCurrentList}</dd>
            <dt>Recoverable</dt>
            <dd>{result.summary.recoverable}</dd>
          </dl>

          {result.records.length === 0 ? (
            <p className="text-muted-foreground">
              No matches for “{result.query}”. The record may have been permanently deleted from
              Supabase and browser cache, or exists under a different spelling.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border bg-background/80">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Title / company</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Workspace</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.records.map((record) => (
                    <tr key={`${record.source}-${record.id}`} className="border-b last:border-0">
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium text-foreground">
                          {record.jobTitle || "Untitled Job"}
                        </p>
                        <p className="text-muted-foreground">
                          {record.company || "Unknown Company"}
                        </p>
                        {record.resumeVersionName ? (
                          <p className="mt-1 text-muted-foreground">CV: {record.resumeVersionName}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">{sourceLabel(record.source)}</td>
                      <td className="px-3 py-2 align-top">
                        {record.folderName || record.folderId || "—"}
                      </td>
                      <td className="px-3 py-2 align-top">{formatWhen(record.lastModified)}</td>
                      <td className="px-3 py-2 align-top">
                        {record.inCurrentList ? (
                          <span className="text-emerald-700 dark:text-emerald-400">In list</span>
                        ) : record.inCurrentWorkspace ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            In workspace, hidden
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not in current workspace</span>
                        )}
                        {record.recoveryNote ? (
                          <p className="mt-1 text-muted-foreground">{record.recoveryNote}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {record.recoverable ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={restoringId === record.id}
                            onClick={() => void handleRestore(record)}
                          >
                            {restoringId === record.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Restore
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
