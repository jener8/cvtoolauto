"use client"

import { useEffect, useState } from "react"

/** Minimum width for the CV tool (desktop / large tablet landscape). */
const MIN_WIDTH_PX = 1024
/** Portrait viewports wider than narrow phones but still “tablet portrait” stay blocked. */
const PORTRAIT_BLOCK_MAX_WIDTH_PX = 1366

function isToolViewportAllowed(): boolean {
  const w = window.innerWidth
  if (w < MIN_WIDTH_PX) return false

  const portrait = window.matchMedia("(orientation: portrait)").matches
  if (portrait && w <= PORTRAIT_BLOCK_MAX_WIDTH_PX) return false

  return true
}

/**
 * Client-only viewport check for `/app`. Returns `ready` after first measure + listeners.
 */
export function useToolViewportAllowed(): { ready: boolean; allowed: boolean } {
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const update = () => {
      setAllowed(isToolViewportAllowed())
      setReady(true)
    }

    update()

    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)

    const portraitMq = window.matchMedia("(orientation: portrait)")
    portraitMq.addEventListener("change", update)

    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
      portraitMq.removeEventListener("change", update)
    }
  }, [])

  return { ready, allowed }
}
