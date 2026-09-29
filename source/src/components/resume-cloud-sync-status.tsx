"use client"

import { AlertTriangle, Check, Cloud, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  resumeCloudSyncDescription,
  resumeCloudSyncLabel,
  type ResumeCloudSyncStatus,
} from "@/lib/resume-sync-status"
import { cn } from "@/lib/utils"

type ResumeCloudSyncStatusProps = {
  status: ResumeCloudSyncStatus
  remoteError?: string | null
  unsaved?: boolean
  className?: string
  onRetrySync?: () => void | Promise<void>
  isRetryingSync?: boolean
}

export function ResumeCloudSyncStatus({
  status,
  remoteError,
  unsaved = false,
  className,
  onRetrySync,
  isRetryingSync = false,
}: ResumeCloudSyncStatusProps) {
  if (status === "idle" && !unsaved) return null

  const label = status === "idle" ? "" : resumeCloudSyncLabel(status)
  const description =
    status === "idle" ? "" : resumeCloudSyncDescription(status, remoteError)

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-normal",
          status === "synced" && "text-[#9b9a97]",
          status === "local_only" && "text-amber-700 dark:text-amber-400",
          status === "syncing" && "text-[#9b9a97]",
        )}
      >
        {status === "syncing" ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : status === "synced" ? (
          <Check className="h-3 w-3" aria-hidden />
        ) : status === "local_only" ? (
          <AlertTriangle className="h-3 w-3" aria-hidden />
        ) : unsaved ? (
          <Cloud className="h-3 w-3 opacity-50" aria-hidden />
        ) : null}
        <span>
          {label}
          {unsaved ? (label ? " · Unsaved edits" : "Unsaved edits") : ""}
        </span>
      </div>
      {description && status === "local_only" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-snug max-w-xl">{description}</p>
          {onRetrySync ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={isRetryingSync}
              onClick={() => void onRetrySync()}
            >
              {isRetryingSync ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              Retry cloud sync
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
