"use client"

import { useEffect, useState } from "react"
import { getAiConfigurationStatus, type AiConfigurationStatus } from "@/app/actions/platform-status"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSupabaseStatus } from "@/hooks/use-supabase-status"
import { CheckCircle2, Loader2, Settings2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type StatusRowProps = {
  ok: boolean | null
  label: string
  detail?: string
}

function StatusRow({ ok, label, detail }: StatusRowProps) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok === null ? (
        <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin text-muted-foreground" />
      ) : ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
      )}
      <div className="min-w-0">
        <p className={cn("font-medium", ok === false && "text-destructive")}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </li>
  )
}

export function PlatformConfigurationPanel({ className }: { className?: string }) {
  const supabase = useSupabaseStatus()
  const [aiStatus, setAiStatus] = useState<AiConfigurationStatus | null>(null)
  const [aiLoading, setAiLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setAiLoading(true)
    void getAiConfigurationStatus()
      .then((status) => {
        if (!cancelled) setAiStatus(status)
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const supabaseConfigured = supabase.configured || supabase.status === "local"
  const databaseConnected =
    supabase.status === "online" || supabase.status === "local"
  const aiAvailable = Boolean(aiStatus?.configured)

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Configuration status
        </CardTitle>
        <CardDescription>
          Services required for cloud sync and AI-powered analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          <StatusRow
            ok={aiLoading ? null : aiAvailable}
            label={aiAvailable ? "OpenAI configured" : "OpenAI API key missing"}
            detail={
              aiLoading
                ? "Checking server environment…"
                : aiAvailable
                  ? `${aiStatus?.backend} · ${aiStatus?.model ?? "default model"}`
                  : `${aiStatus?.envVar ?? "OPENAI_API_KEY"} is not set on the server`
            }
          />
          <StatusRow
            ok={
              supabase.status === "checking"
                ? null
                : supabaseConfigured
            }
            label={
              supabaseConfigured
                ? "Supabase configured"
                : "Supabase not configured"
            }
            detail={
              supabase.status === "checking"
                ? "Checking environment…"
                : supabase.status === "unconfigured"
                  ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
                  : supabase.storageMode
            }
          />
          <StatusRow
            ok={
              supabase.status === "checking"
                ? null
                : databaseConnected
            }
            label={
              databaseConnected
                ? "Database connected"
                : "Supabase connection failed"
            }
            detail={
              supabase.status === "checking"
                ? "Testing connection…"
                : supabase.message ?? undefined
            }
          />
          <StatusRow
            ok={aiLoading ? null : aiAvailable}
            label={aiAvailable ? "AI analysis available" : "AI analysis unavailable"}
            detail={
              !aiLoading && !aiAvailable
                ? aiStatus?.setupHintLocal
                : undefined
            }
          />
        </ul>

        {!aiLoading && !aiAvailable && aiStatus && (
          <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
            {aiStatus.setupHintVercel}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
