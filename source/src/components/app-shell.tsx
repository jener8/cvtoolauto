"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { SupabaseStatusBanner } from "@/components/supabase-status-banner"
import { useSupabaseStatus } from "@/hooks/use-supabase-status"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const supabaseStatus = useSupabaseStatus()
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await supabaseStatus.retry()
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden">
      <SupabaseStatusBanner
        status={supabaseStatus.status}
        message={supabaseStatus.message}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
