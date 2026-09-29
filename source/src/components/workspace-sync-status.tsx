"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUPABASE_CONNECTION_FAILED_BANNER } from "@/lib/supabase/connection-messages"

export type WorkspaceSyncUiStatus =
  | "idle"
  | "loading"
  | "loaded_local"
  | "syncing"
  | "synced"
  | "unavailable"

export const WORKSPACE_SYNC_LABELS: Record<
  Exclude<WorkspaceSyncUiStatus, "idle">,
  string
> = {
  loading: "Loading workspace…",
  loaded_local: "Showing saved copy — checking cloud for updates…",
  syncing: "Syncing…",
  synced: "Synced",
  unavailable: SUPABASE_CONNECTION_FAILED_BANNER,
}

/** Background sync must not block workspace interactions. */
export function isWorkspaceSyncActive(_status: WorkspaceSyncUiStatus): boolean {
  return false
}

type WorkspaceSyncStatusProps = {
  status: WorkspaceSyncUiStatus
  message?: string | null
  className?: string
}

export function WorkspaceSyncStatus({
  status,
  message,
  className,
}: WorkspaceSyncStatusProps) {
  if (status === "idle") return null

  const label = message?.trim() || WORKSPACE_SYNC_LABELS[status]
  const showSpinner = status === "loading" || status === "syncing"
  const isWarning = status === "unavailable"

  if (isWarning) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
          className,
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "ui-sync-status-pill",
        status === "synced" && "ui-sync-status-pill--synced",
        className,
      )}
    >
      {showSpinner ? (
        <span className="ui-sync-status-pill__spinner" aria-hidden />
      ) : (
        <span
          className={cn(
            "ui-sync-status-pill__dot",
            status === "synced" && "ui-sync-status-pill__dot--synced",
          )}
          aria-hidden
        />
      )}
      <span>{label}</span>
    </div>
  )
}
