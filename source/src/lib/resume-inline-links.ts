/** Markdown-style inline links: [Label](https://example.com) */

export const RESUME_INLINE_LINK_REGEX = /\[([^\]\n]+)\]\(([^)\n]+)\)/g

export type ResumeInlineSegment =
  | { type: "text"; value: string }
  | { type: "link"; text: string; href: string }

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"])

export function sanitizeResumeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^mailto:/i.test(trimmed)) {
    const mailbox = decodeURIComponent(trimmed.replace(/^mailto:/i, "").trim())
    if (!mailbox.includes("@")) return null
    return `mailto:${mailbox}`
  }

  if (/^[^\s/]+@[^\s/]+\.[^\s/]+$/i.test(trimmed)) {
    return `mailto:${trimmed}`
  }

  if (!/^https?:\/\//i.test(trimmed)) return null

  try {
    const url = new URL(trimmed)
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null
    if (url.protocol === "mailto:") return null
    return url.href
  } catch {
    return null
  }
}

export function parseResumeInlineSegments(text: string): ResumeInlineSegment[] {
  if (!text) return [{ type: "text", value: "" }]

  const segments: ResumeInlineSegment[] = []
  const re = new RegExp(RESUME_INLINE_LINK_REGEX.source, "g")
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }

    const linkText = match[1]
    const href = sanitizeResumeLinkUrl(match[2])
    if (href) {
      segments.push({ type: "link", text: linkText, href })
    } else {
      segments.push({ type: "text", value: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }]
}

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeHtmlAttr(text: string): string {
  return escapeHtmlText(text).replace(/'/g, "&#39;")
}

export interface ResumeInlineHtmlOptions {
  linkColor?: string
  underline?: boolean
  /** Avoid overflow-wrap:anywhere — html2canvas mis-measures those lines in PDF export. */
  pdfSafe?: boolean
}

/** Safe HTML for preview / PDF (clickable links). */
export function resumeInlineTextToHtml(
  text: string,
  options: ResumeInlineHtmlOptions = {},
): string {
  const linkColor = options.linkColor ?? "inherit"
  const decoration = options.underline !== false ? "underline" : "none"
  const linkStyle = options.pdfSafe
    ? `color:${linkColor};text-decoration:${decoration};display:inline;`
    : `color:${linkColor};text-decoration:${decoration};word-break:break-word;overflow-wrap:anywhere;`

  return parseResumeInlineSegments(text)
    .map((segment) => {
      if (segment.type === "text") {
        return escapeHtmlText(segment.value)
      }
      return `<a href="${escapeHtmlAttr(segment.href)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${escapeHtmlText(segment.text)}</a>`
    })
    .join("")
}

/** Plain text for ATS / Word export: Link Text (https://example.com). */
/** Bold (**text**) plus inline links for HTML preview / PDF / print. */
export function formattedTextToHtml(
  text: string,
  options: ResumeInlineHtmlOptions = {},
): string {
  if (!text) return ""

  return text
    .split(/(\*\*[\s\S]*?\*\*)/g)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        const inner = resumeInlineTextToHtml(part.slice(2, -2), options)
        const strongStyle = options.pdfSafe ? ' style="font-weight:700;display:inline;"' : ""
        return `<strong${strongStyle}>${inner}</strong>`
      }
      return resumeInlineTextToHtml(part, options)
    })
    .join("")
}

/** Bold plus links as plain text (ATS / Word). */
export function formattedTextToPlain(text: string): string {
  if (!text) return ""

  return text
    .split(/(\*\*[\s\S]*?\*\*)/g)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return resumeInlineTextToPlain(part.slice(2, -2))
      }
      return resumeInlineTextToPlain(part)
    })
    .join("")
}

export function resumeInlineTextToPlain(text: string): string {
  return parseResumeInlineSegments(text)
    .map((segment) => {
      if (segment.type === "text") return segment.value
      return `${segment.text} (${segment.href})`
    })
    .join("")
}

export function validateResumeInlineLinks(text: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const re = new RegExp(RESUME_INLINE_LINK_REGEX.source, "g")
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (!sanitizeResumeLinkUrl(match[2])) {
      errors.push(
        `Disallowed or invalid URL in [${match[1]}](${match[2]}). Use http://, https://, or mailto: only.`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

export function containsResumeInlineLinks(text: string): boolean {
  return new RegExp(RESUME_INLINE_LINK_REGEX.source).test(text)
}

export const CHATGPT_INLINE_LINK_RULES_EN = `INLINE LINKS:
- Use [Link Text](https://example.com) anywhere in bullets or text lines.
- Allowed URL schemes only: https://, http://, and mailto:
- Example: - Published research on [Trust Bridge](https://trustbridge.design).`

export const CHATGPT_INLINE_LINK_RULES_DE = `INLINE-LINKS:
- Verwende [Linktext](https://example.com) in Stichpunkten oder Fließtext.
- Nur diese URL-Schemata: https://, http:// und mailto:
- Beispiel: - Forschung veröffentlicht auf [Trust Bridge](https://trustbridge.design).`
