"use client"

import { AlertTriangle, Database, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SupabaseUiStatus } from "@/hooks/use-supabase-status"

interface SupabaseStatusBannerProps {
  status: SupabaseUiStatus
  message: string | null
  onRetry?: () => void
  isRetrying?: boolean
}

export function SupabaseStatusBanner({
  status,
  message,
  onRetry,
  isRetrying = false,
}: SupabaseStatusBannerProps) {
  if (status === "checking" || status === "online") return null

  const isLocal = status === "local"
  const title =
    status === "unconfigured"
      ? "Database not configured"
      : isLocal
        ? "Local development mode"
        : "Database temporarily unavailable"

  const description =
    message ??
    (status === "unconfigured"
      ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, or enable NEXT_PUBLIC_SUPABASE_LOCAL_MODE=true to work offline."
      : "You can keep using the app with data saved in this browser. Cloud sync will resume when Supabase is healthy.")

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        isLocal
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-destructive/30 bg-destructive/5 text-destructive"
      }`}
    >
      <div className="flex gap-3">
        {isLocal ? (
          <Database className="h-5 w-5 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className={`text-sm mt-0.5 ${isLocal ? "opacity-90" : "opacity-80"}`}>{description}</p>
        </div>
      </div>
      {onRetry && status === "offline" && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
          Retry connection
        </Button>
      )}
    </div>
  )
}
