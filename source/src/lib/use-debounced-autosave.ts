"use client"

import { useEffect, useRef, useState } from "react"

export type AutosaveStatus = "saved" | "unsaved" | "saving" | "error"

const DEFAULT_DEBOUNCE_MS = 1000
const DEFAULT_HYDRATE_MS = 300

type UseDebouncedAutosaveOptions = {
  /** When this changes (e.g. job id, resume version id), baseline is reset so another entity is not overwritten. */
  resetKey: string
  /** Serialized state; when it differs from the post-hydration baseline, a debounced save is scheduled. */
  snapshot: string
  save: () => void | Promise<void>
  enabled?: boolean
  /** When false, debounced saves are skipped (e.g. during manual save). */
  canSave?: boolean
  debounceMs?: number
  /** Ignore saves until this long after resetKey changes so parent effects can hydrate local state. */
  hydrateDelayMs?: number
}

/**
 * Debounced persist with status for UI. Skips the initial snapshot after each reset (no save on first paint).
 * Pending timers are cleared when `enabled` or `canSave` becomes false; in-flight saves are cancelled via generation.
 */
export function useDebouncedAutosave(options: UseDebouncedAutosaveOptions): AutosaveStatus {
  const {
    resetKey,
    snapshot,
    save,
    enabled = true,
    canSave = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    hydrateDelayMs = DEFAULT_HYDRATE_MS,
  } = options

  const [status, setStatus] = useState<AutosaveStatus>("saved")
  const [hydrated, setHydrated] = useState(false)
  const baselineRef = useRef<string | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save
  const saveGenerationRef = useRef(0)

  const mayRunSave = enabled && canSave

  useEffect(() => {
    baselineRef.current = null
    setHydrated(false)
    setStatus("saved")
    saveGenerationRef.current += 1
    const t = setTimeout(() => setHydrated(true), hydrateDelayMs)
    return () => {
      clearTimeout(t)
      saveGenerationRef.current += 1
    }
  }, [resetKey, hydrateDelayMs])

  useEffect(() => {
    if (!enabled) {
      saveGenerationRef.current += 1
      baselineRef.current = snapshot
      setStatus("saved")
    }
  }, [enabled, snapshot])

  useEffect(() => {
    if (!canSave) {
      saveGenerationRef.current += 1
    }
  }, [canSave])

  useEffect(() => {
    if (!mayRunSave || !hydrated) return

    if (baselineRef.current === null) {
      baselineRef.current = snapshot
      setStatus("saved")
      return
    }

    if (snapshot === baselineRef.current) {
      setStatus("saved")
      return
    }

    setStatus("unsaved")
    const generation = saveGenerationRef.current
    const timeout = setTimeout(async () => {
      if (generation !== saveGenerationRef.current) return

      setStatus("saving")
      try {
        await Promise.resolve(saveRef.current())
        if (generation !== saveGenerationRef.current) return
        baselineRef.current = snapshot
        setStatus("saved")
      } catch (err) {
        if (generation !== saveGenerationRef.current) return
        const message = err instanceof Error ? err.message : String(err)
        console.warn("[autosave] Save failed:", message)
        setStatus("error")
      }
    }, debounceMs)

    return () => {
      clearTimeout(timeout)
      saveGenerationRef.current += 1
    }
  }, [snapshot, mayRunSave, hydrated, debounceMs, resetKey])

  return status
}

export function autosaveStatusLabel(status: AutosaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving…"
    case "saved":
      return "Saved"
    case "unsaved":
      return "Unsaved changes"
    case "error":
      return "Save failed"
    default:
      return ""
  }
}
