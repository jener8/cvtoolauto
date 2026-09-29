"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseStorageMode, isForceLocalMode, isSupabaseConfigured } from "@/lib/supabase/config"
import { getSupabaseInitError } from "@/lib/supabase/client"
import { checkSupabaseHealth } from "@/lib/supabase/health"
import {
  clearSupabaseOffline,
  getStorageModeLabel,
  getSupabaseOfflineReason,
  shouldUseLocalFallback,
} from "@/lib/supabase/availability"

export type SupabaseUiStatus = "checking" | "online" | "offline" | "local" | "unconfigured"

export function useSupabaseStatus() {
  const [status, setStatus] = useState<SupabaseUiStatus>(() => {
    if (!isSupabaseConfigured()) return "unconfigured"
    if (isForceLocalMode()) return "local"
    return "checking"
  })
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setStatus("unconfigured")
      setMessage(getSupabaseInitError() ?? "Supabase environment variables are not set.")
      return
    }

    if (isForceLocalMode()) {
      setStatus("local")
      setMessage("Local development mode — data is stored in this browser only.")
      return
    }

    setStatus("checking")
    setMessage(null)

    const healthy = await checkSupabaseHealth()
    if (healthy) {
      setStatus("online")
      setMessage(null)
      return
    }

    setStatus("offline")
    setMessage(
      getSupabaseOfflineReason() ??
        "Supabase is unreachable. The app will use cached or local data until the connection recovers.",
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const retry = useCallback(async () => {
    clearSupabaseOffline()
    await refresh()
  }, [refresh])

  return {
    status,
    message,
    isOffline: status === "offline" || status === "unconfigured",
    isLocalMode: status === "local" || shouldUseLocalFallback(),
    storageMode: getStorageModeLabel(),
    configured: isSupabaseConfigured(),
    envMode: getSupabaseStorageMode(),
    retry,
  }
}
