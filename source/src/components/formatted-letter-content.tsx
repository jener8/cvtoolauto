"use client"

import type { ReactNode } from "react"
import { formattedLetterContentToHtml } from "@/lib/formatted-letter-content"
import type { ResumeInlineHtmlOptions } from "@/lib/resume-inline-links"

export type FormattedLetterContentProps = {
  text: string
  className?: string
  linkClassName?: string
  emptyFallback?: ReactNode
  linkColor?: string
  /** Use stricter link wrapping rules for PDF rasterization. */
  pdfSafe?: boolean
}

/**
 * Cover letter body: paragraphs (blank line = new paragraph), bullet lists, **bold**, [links](url).
 * Renders the same HTML as PDF export ({@link formattedLetterContentToHtml}).
 */
export function FormattedLetterContent({
  text,
  className,
  linkClassName: _linkClassName,
  emptyFallback = null,
  linkColor = "#0369a1",
  pdfSafe = false,
}: FormattedLetterContentProps) {
  if (!text?.trim()) {
    return emptyFallback
  }

  const htmlOptions: ResumeInlineHtmlOptions = {
    linkColor,
    underline: true,
    ...(pdfSafe ? { pdfSafe: true } : {}),
  }

  const html = formattedLetterContentToHtml(text, htmlOptions)

  return (
    <div
      className={["formatted-letter-content", className].filter(Boolean).join(" ")}
      style={{ textAlign: "left" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function formattedLetterHtmlOptions(
  linkColor?: string,
): ResumeInlineHtmlOptions {
  return {
    linkColor: linkColor ?? "#0369a1",
    underline: true,
  }
}
