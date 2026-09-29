"use client"

import { createPortal } from "react-dom"
import { Languages, Loader2 } from "lucide-react"

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(8, 8, 8, 0.78)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
}

const CARD_STYLE: React.CSSProperties = {
  width: "min(420px, 100%)",
  padding: "32px 28px 28px",
  background: "#1f1f1f",
  border: "0.5px solid #3a3a3a",
  borderRadius: 14,
  boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 12,
}

const ICON_STYLE: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 64,
  height: 64,
  marginBottom: 6,
  borderRadius: "50%",
  background: "#2a2a2a",
  color: "#7dd3c0",
}

/**
 * Full-viewport translating modal.
 * Uses inline styles so it stays visible when portaled to document.body
 * (CSS nested under @layer can fail to apply outside the app shell).
 */
export function ResumeTranslateOverlay({
  open,
  targetLanguage,
}: {
  open: boolean
  targetLanguage?: "en" | "de" | null
}) {
  if (typeof document === "undefined" || !open) return null

  const title =
    targetLanguage === "de"
      ? "Switching to Deutsch…"
      : targetLanguage === "en"
        ? "Switching to English…"
        : "Updating resume language…"

  return createPortal(
    <div
      className="resume-translate-overlay"
      style={OVERLAY_STYLE}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="resume-translate-overlay-title"
      aria-describedby="resume-translate-overlay-desc"
    >
      <div className="resume-translate-overlay__card" style={CARD_STYLE}>
        <div className="resume-translate-overlay__icon" style={ICON_STYLE} aria-hidden>
          <Loader2 className="h-8 w-8 animate-spin" />
          <Languages
            className="resume-translate-overlay__lang-icon h-4 w-4"
            style={{ position: "absolute", right: 8, bottom: 8, color: "#c7c5bf" }}
          />
        </div>
        <p
          id="resume-translate-overlay-title"
          className="resume-translate-overlay__title"
          style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.35, color: "#f0efeb" }}
        >
          {title}
        </p>
        <p
          id="resume-translate-overlay-desc"
          className="resume-translate-overlay__body"
          style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#a8a69f", maxWidth: "34ch" }}
        >
          Please keep this tab open. This usually takes under a minute for a full CV.
        </p>
      </div>
    </div>,
    document.body,
  )
}
