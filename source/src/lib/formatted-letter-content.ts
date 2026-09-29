import {
  formattedTextToHtml,
  formattedTextToPlain,
  type ResumeInlineHtmlOptions,
} from "./resume-inline-links"

/** Markdown bullet: `- item` or `* item` (asterisk must be followed by whitespace). */
export const LETTER_BULLET_LINE_REGEX = /^\s*[-*•]\s+(.+)$/

export type LetterContentBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "ul"; items: string[] }

export function isLetterBulletLine(line: string): boolean {
  return LETTER_BULLET_LINE_REGEX.test(line)
}

export function parseLetterContentBlocks(text: string): LetterContentBlock[] {
  if (!text) return []

  const blocks: LetterContentBlock[] = []
  let paragraphLines: string[] = []
  let bulletItems: string[] = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    blocks.push({ type: "paragraph", lines: paragraphLines })
    paragraphLines = []
  }

  const flushBullets = () => {
    if (bulletItems.length === 0) return
    blocks.push({ type: "ul", items: bulletItems })
    bulletItems = []
  }

  for (const line of text.split("\n")) {
    const bulletMatch = line.match(LETTER_BULLET_LINE_REGEX)
    if (bulletMatch) {
      flushParagraph()
      bulletItems.push(bulletMatch[1])
      continue
    }

    flushBullets()

    // Blank line = paragraph break (not a soft line break within one paragraph).
    if (line.trim() === "") {
      flushParagraph()
      continue
    }

    paragraphLines.push(line)
  }

  flushBullets()
  flushParagraph()

  return blocks
}

/** Shared body typography for preview HTML and PDF export. */
export const LETTER_BODY_LINE_HEIGHT = 1.45
export const LETTER_PARAGRAPH_GAP = "0.7em"
export const LETTER_LIST_MARGIN = "0.55em 0"

/** Denser spacing for single-page A4 PDF rasterization / print. */
export const LETTER_BODY_LINE_HEIGHT_PDF = 1.35
export const LETTER_PARAGRAPH_GAP_PDF = "0.55em"
export const LETTER_LIST_MARGIN_PDF = "0.45em 0"

const LIST_STYLE = `margin:${LETTER_LIST_MARGIN};padding-left:1.35em;list-style-type:disc;list-style-position:outside;`
const LI_STYLE = `margin:0.15em 0;line-height:${LETTER_BODY_LINE_HEIGHT};padding-left:0.15em;`
const P_STYLE = `margin:0 0 ${LETTER_PARAGRAPH_GAP} 0;line-height:${LETTER_BODY_LINE_HEIGHT};text-align:left;text-align-last:left;display:block;width:100%;white-space:normal;word-wrap:break-word;overflow-wrap:normal;`

const LIST_STYLE_PDF = `margin:${LETTER_LIST_MARGIN_PDF};padding-left:1.35em;list-style-type:disc;list-style-position:outside;`
const LI_STYLE_PDF = `margin:0.1em 0;line-height:${LETTER_BODY_LINE_HEIGHT_PDF};padding-left:0.15em;`
const P_STYLE_PDF = `margin:0 0 ${LETTER_PARAGRAPH_GAP_PDF} 0;line-height:${LETTER_BODY_LINE_HEIGHT_PDF};text-align:left;text-align-last:left;display:block;width:100%;white-space:normal;word-wrap:break-word;overflow-wrap:normal;`

export function letterParagraphStyleAttr(): string {
  return P_STYLE
}

/** HTML for cover letter preview / PDF export (paragraphs + bullet lists). */
export function formattedLetterContentToHtml(
  text: string,
  options: ResumeInlineHtmlOptions = {},
): string {
  const blocks = parseLetterContentBlocks(text)
  if (blocks.length === 0) return ""
  const htmlOptions: ResumeInlineHtmlOptions = options.pdfSafe
    ? { ...options, pdfSafe: true }
    : options
  const pStyle = options.pdfSafe ? P_STYLE_PDF : P_STYLE
  const listStyle = options.pdfSafe ? LIST_STYLE_PDF : LIST_STYLE
  const liStyle = options.pdfSafe ? LI_STYLE_PDF : LI_STYLE

  return blocks
    .map((block) => {
      if (block.type === "ul") {
        const items = block.items
          .map(
            (item) =>
              `<li style="${liStyle}">${formattedTextToHtml(item, htmlOptions)}</li>`,
          )
          .join("")
        return `<ul class="formatted-letter-list" style="${listStyle}">${items}</ul>`
      }

      const inner = block.lines
        .map((line, index) => {
          const html = formattedTextToHtml(line, htmlOptions)
          if (index === 0) return html
          return `<br />${html}`
        })
        .join("")

      if (block.lines.every((l) => !l.trim())) {
        return `<p style="${pStyle}">&nbsp;</p>`
      }

      return `<p style="${pStyle}">${inner}</p>`
    })
    .join("")
}

export function formattedLetterContentToPlain(text: string): string {
  const blocks = parseLetterContentBlocks(text)
  if (blocks.length === 0) return ""

  return blocks
    .map((block) => {
      if (block.type === "ul") {
        return block.items
          .map((item) => `• ${formattedTextToPlain(item)}`)
          .join("\n")
      }
      return block.lines.map((line) => formattedTextToPlain(line)).join("\n")
    })
    .join("\n\n")
}
