import {
  formattedLetterContentToHtml,
  LETTER_BODY_LINE_HEIGHT,
  LETTER_LIST_MARGIN,
  LETTER_PARAGRAPH_GAP,
} from "@/lib/formatted-letter-content"

const UNSUPPORTED_COLOR_PATTERN = /oklch|oklab|lab\(|lch\(|color-mix/i

const COLOR_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "columnRuleColor",
] as const

function resolvedColor(value: string, fallback: string): string {
  if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") {
    return fallback
  }
  if (UNSUPPORTED_COLOR_PATTERN.test(value)) {
    const probe = document.createElement("span")
    probe.style.color = value
    document.body.appendChild(probe)
    const computed = window.getComputedStyle(probe).color
    document.body.removeChild(probe)
    return computed && !UNSUPPORTED_COLOR_PATTERN.test(computed) ? computed : fallback
  }
  return value
}

/**
 * Inline resolved RGB colors so html2canvas does not parse global oklch/lab theme CSS.
 * Call on a live DOM node (attached to document) before html2canvas runs.
 */
export function inlineResolvedColorsForHtml2Canvas(root: HTMLElement): void {
  const visit = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el)

    for (const prop of COLOR_PROPERTIES) {
      const value = computed[prop]
      if (!value) continue
      const fallback = prop === "backgroundColor" ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)"
      const resolved = resolvedColor(value, fallback)
      el.style.setProperty(
        prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
        resolved,
        "important",
      )
    }

    if (computed.boxShadow && computed.boxShadow !== "none") {
      el.style.setProperty("box-shadow", "none", "important")
    }

    Array.from(el.children).forEach((child) => {
      if (child instanceof HTMLElement) visit(child)
    })
  }

  visit(root)
}

/** Safe CSS re-applied after global stylesheets are stripped for html2canvas. */
export const COVER_LETTER_EXPORT_CSS = `
#cover-letter-preview,
#cover-letter-preview * {
  text-align: left !important;
  text-align-last: left !important;
}
#cover-letter-preview .formatted-letter-content {
  display: block;
  width: 100%;
}
#cover-letter-preview .formatted-letter-content p {
  display: block;
  width: 100%;
  margin: 0 0 ${LETTER_PARAGRAPH_GAP} 0;
  line-height: ${LETTER_BODY_LINE_HEIGHT};
  text-align: left !important;
  text-align-last: left !important;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: normal;
}
#cover-letter-preview .formatted-letter-content p:last-child {
  margin-bottom: 0;
}
#cover-letter-preview .formatted-letter-content strong,
#cover-letter-preview .formatted-letter-content a,
#cover-letter-preview .formatted-letter-content span {
  display: inline !important;
  float: none !important;
  position: static !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
  max-width: none !important;
}
#cover-letter-preview .formatted-letter-content ul {
  display: block;
  list-style-type: disc;
  list-style-position: outside;
  margin: ${LETTER_LIST_MARGIN};
  padding-left: 1.35em;
}
#cover-letter-preview .formatted-letter-content li {
  display: list-item;
  margin: 0.2em 0;
  line-height: ${LETTER_BODY_LINE_HEIGHT};
  text-align: left !important;
}
#cover-letter-preview .formatted-letter-content a {
  color: #0369a1;
  text-decoration: underline;
  display: inline;
}
#cover-letter-preview .formatted-letter-content strong {
  font-weight: 700;
}
#cover-letter-preview table {
  display: table !important;
  width: 100% !important;
  max-width: 100% !important;
  border-collapse: collapse !important;
  table-layout: fixed !important;
}
#cover-letter-preview td {
  display: table-cell !important;
  vertical-align: top !important;
  text-align: left !important;
}
#cover-letter-preview .cover-letter-sender-header {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}
#cover-letter-preview .cover-letter-sender-left {
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
#cover-letter-preview .cover-letter-sender-right {
  width: 112px !important;
  max-width: 112px !important;
  text-align: right !important;
  text-align-last: right !important;
  overflow: visible !important;
}
#cover-letter-preview .cover-letter-sender-right,
#cover-letter-preview .cover-letter-sender-right * {
  text-align: right !important;
  text-align-last: right !important;
}
#cover-letter-preview .cover-letter-sender-right-inner {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}
#cover-letter-preview .cover-letter-sender-phone {
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  max-width: 100% !important;
}
#cover-letter-preview > div {
  display: block;
  text-align: left !important;
  margin: 0 0 1.5em 0;
}
#cover-letter-preview > div:last-child {
  margin-bottom: 0;
}
#cover-letter-preview .cover-letter-logo-frame {
  display: block !important;
  overflow: visible !important;
  background: #ffffff !important;
  padding: 6px;
  border-radius: 4px;
}
#cover-letter-preview .cover-letter-company-logo {
  display: block !important;
  background: #ffffff !important;
  visibility: visible !important;
  opacity: 1 !important;
  object-fit: none !important;
}
#cover-letter-preview .cover-letter-profile-photo {
  display: block !important;
  border-radius: 50%;
  width: 72px !important;
  height: 72px !important;
  max-width: 72px !important;
  max-height: 72px !important;
  margin: 0 0 0 auto !important;
  padding: 0 !important;
  object-fit: cover !important;
  image-rendering: auto;
  box-sizing: border-box !important;
}
`

export function injectCoverLetterExportStyles(doc: Document): void {
  if (doc.getElementById("cover-letter-export-styles")) return
  const style = doc.createElement("style")
  style.id = "cover-letter-export-styles"
  style.textContent = COVER_LETTER_EXPORT_CSS
  doc.head.appendChild(style)
}

function unwrapElement(el: Element): void {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

/** Replace React paragraph tree with flat HTML so html2canvas wraps text predictably. */
export function replaceLetterBodyForPdfExport(root: HTMLElement, letterText: string): void {
  const container = root.querySelector(".formatted-letter-content")
  if (!(container instanceof HTMLElement) || !letterText.trim()) return

  container.className = "formatted-letter-content"
  container.innerHTML = formattedLetterContentToHtml(letterText, {
    linkColor: "#0369a1",
    underline: true,
    pdfSafe: true,
  })
}

/**
 * Flatten paragraph markup and force left-aligned blocks so html2canvas matches preview.
 */
export function prepareCoverLetterRootForPdfExport(root: HTMLElement): void {
  root.style.textAlign = "left"
  root.style.textAlignLast = "left"

  const doc = root.ownerDocument
  if (doc) injectCoverLetterExportStyles(doc)

  root.querySelectorAll(".formatted-letter-content").forEach((container) => {
    if (!(container instanceof HTMLElement)) return
    container.style.textAlign = "left"
    container.style.textAlignLast = "left"
    container.style.display = "block"
    container.style.width = "100%"

    container.querySelectorAll("p").forEach((p) => {
      if (!(p instanceof HTMLElement)) return
      p.querySelectorAll(":scope > span").forEach((span) => unwrapElement(span))
      p.style.textAlign = "left"
      p.style.textAlignLast = "left"
      p.style.display = "block"
      p.style.width = "100%"
      p.style.margin = `0 0 ${LETTER_PARAGRAPH_GAP} 0`
      p.style.lineHeight = String(LETTER_BODY_LINE_HEIGHT)
      p.style.whiteSpace = "normal"
      p.style.wordWrap = "break-word"
      p.style.overflowWrap = "normal"
    })

    container.querySelectorAll("strong, a, span").forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      el.style.display = "inline"
      el.style.float = "none"
      el.style.position = "static"
      el.style.overflowWrap = "normal"
      el.style.wordBreak = "normal"
      el.style.maxWidth = "none"
    })

    container.querySelectorAll("ul").forEach((ul) => {
      if (!(ul instanceof HTMLElement)) return
      ul.style.display = "block"
      ul.style.listStyleType = "disc"
      ul.style.paddingLeft = "1.35em"
      ul.style.margin = "0.5em 0"
    })

    container.querySelectorAll("a").forEach((a) => {
      if (!(a instanceof HTMLElement)) return
      a.style.display = "inline"
      a.style.color = "#0369a1"
      a.style.textDecoration = "underline"
    })
  })

  root.querySelectorAll(":scope > div").forEach((section) => {
    if (!(section instanceof HTMLElement)) return
    section.style.textAlign = "left"
    section.style.textAlignLast = "left"
    section.style.display = "block"
  })
}

/** Strip linked/global styles from html2canvas's cloned document (oklch in :root breaks parsing). */
export function stripUnsupportedStylesFromClone(clonedDoc: Document): void {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove())
  injectCoverLetterExportStyles(clonedDoc)
}

export function finalizeCoverLetterCloneForPdf(
  root: HTMLElement,
  letterBodyText?: string,
): void {
  if (letterBodyText?.trim()) {
    replaceLetterBodyForPdfExport(root, letterBodyText)
  }
  prepareCoverLetterRootForPdfExport(root)
  inlineResolvedColorsForHtml2Canvas(root)
}
