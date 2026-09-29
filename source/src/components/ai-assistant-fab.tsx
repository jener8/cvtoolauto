"use client"

import { useIsMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"
import type { CSSProperties } from "react"

function normalizeHex(hex: string): string | null {
  const trimmed = hex.trim().replace(/^#/, "")
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .split("")
      .map((c) => c + c)
      .join("")}`
  }
  return null
}

function darkenHex(hex: string, amount = 0.22): string {
  const normalized = normalizeHex(hex)
  if (!normalized) return hex
  const num = parseInt(normalized.slice(1), 16)
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount))
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount))
  const b = Math.max(0, (num & 0xff) * (1 - amount))
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
}

function buildAccentStyle(accentColorHex?: string | null): CSSProperties | undefined {
  const hex = accentColorHex ? normalizeHex(accentColorHex) : null
  if (!hex) return undefined
  const dark = darkenHex(hex, 0.42)
  return {
    ["--ai-fab-from" as string]: hex,
    ["--ai-fab-to" as string]: dark,
  }
}

export interface AiAssistantFabProps {
  onClick: () => void
  label?: string
  tooltip?: string
  hasAttention?: boolean
  accentColorHex?: string | null
  className?: string
}

export function AiAssistantFab({
  onClick,
  label = "Ask AI Coach",
  tooltip,
  hasAttention = false,
  accentColorHex,
  className,
}: AiAssistantFabProps) {
  const isMobile = useIsMobile()
  const accentStyle = buildAccentStyle(accentColorHex)
  const usesAccent = Boolean(accentStyle)
  const ariaLabel = hasAttention ? `${label} — updates available` : label

  return (
    <button
      type="button"
      onClick={onClick}
      style={accentStyle}
      title={tooltip ?? label}
      className={cn(
        "ai-assistant-fab group fixed z-[100] flex items-center overflow-hidden",
        "rounded-full text-white font-semibold",
        "shadow-[0_10px_36px_rgba(79,70,229,0.42),0_4px_14px_rgba(15,23,42,0.18)]",
        "hover:-translate-y-1 hover:shadow-[0_14px_44px_rgba(99,102,241,0.52),0_6px_18px_rgba(15,23,42,0.22)]",
        "active:translate-y-0 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-[transform,box-shadow,width,padding,gap] duration-300 ease-out",
        usesAccent ? "ai-assistant-fab--accent" : "ai-assistant-fab--gradient",
        isMobile ? "bottom-5 right-4" : "bottom-6 right-6",
        "min-h-12 gap-2 px-3.5 py-2.5",
        hasAttention && "ring-2 ring-amber-300/90 ring-offset-2 ring-offset-background",
        className,
      )}
      aria-label={ariaLabel}
    >
      <span className="ai-assistant-fab__glow pointer-events-none absolute inset-0 rounded-full" aria-hidden />
      <span className="ai-assistant-fab__pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />

      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-[2px] transition-transform duration-300 group-hover:scale-105">
        <Sparkles className="h-5 w-5 drop-shadow-md" strokeWidth={2.25} aria-hidden />
        {hasAttention && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-80" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 ring-2 ring-violet-700" />
          </span>
        )}
      </span>

      <span className="relative pr-0.5 text-sm font-medium tracking-tight whitespace-nowrap">
        {label}
      </span>
    </button>
  )
}
