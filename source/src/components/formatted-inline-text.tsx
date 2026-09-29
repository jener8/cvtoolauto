"use client"

import type { ReactNode } from "react"
import {
  parseResumeInlineSegments,
  type ResumeInlineHtmlOptions,
} from "@/lib/resume-inline-links"

function renderLinkSegments(
  text: string,
  keyPrefix: string,
  linkClassName: string,
): ReactNode[] {
  return parseResumeInlineSegments(text).map((segment, index) => {
    const key = `${keyPrefix}-${index}`
    if (segment.type === "link") {
      return (
        <a
          key={key}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {segment.text}
        </a>
      )
    }
    return (
      <span key={key} className="whitespace-pre-wrap">
        {segment.value}
      </span>
    )
  })
}

function renderFormattedNodes(
  text: string,
  linkClassName: string,
  keyPrefix = "fmt",
): ReactNode[] {
  const parts = text.split(/(\*\*[\s\S]*?\*\*)/g)
  return parts.flatMap((part, partIndex) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2)
      return [
        <strong key={`${keyPrefix}-b-${partIndex}`}>
          {renderLinkSegments(inner, `${keyPrefix}-b-${partIndex}`, linkClassName)}
        </strong>,
      ]
    }
    return renderLinkSegments(part, `${keyPrefix}-p-${partIndex}`, linkClassName)
  })
}

export type FormattedInlineTextProps = {
  text: string
  className?: string
  linkClassName?: string
  emptyFallback?: ReactNode
  /** When set, used for mailto/http link color in HTML export helpers. */
  linkColor?: string
}

const DEFAULT_LINK_CLASS =
  "text-sky-800 underline underline-offset-2 break-words [overflow-wrap:anywhere]"

/** Preview renderer: [Label](url) and **bold** without showing raw markdown. */
export function FormattedInlineText({
  text,
  className,
  linkClassName = DEFAULT_LINK_CLASS,
  emptyFallback = null,
}: FormattedInlineTextProps) {
  if (!text?.trim()) {
    return emptyFallback
  }

  return (
    <span className={["formatted-inline-text", className].filter(Boolean).join(" ")}>
      {renderFormattedNodes(text, linkClassName)}
    </span>
  )
}

export function formattedInlineHtmlOptions(
  linkColor?: string,
): ResumeInlineHtmlOptions {
  return {
    linkColor: linkColor ?? "#0369a1",
    underline: true,
  }
}
