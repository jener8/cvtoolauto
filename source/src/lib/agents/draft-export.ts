import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx"
import { chromium } from "playwright"
import { parseResumeMarkupLine } from "@/lib/resume-markup-line"
import { escapeHtmlText } from "@/lib/resume-inline-links"

export type AgentDraftExportKind = "cv" | "cover"
export type AgentDraftExportFormat = "pdf" | "docx"

function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim()
}

function paragraphsFromPlainText(text: string): Paragraph[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const out: Paragraph[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      out.push(new Paragraph({ text: "", spacing: { after: 120 } }))
      continue
    }
    out.push(
      new Paragraph({
        children: [new TextRun({ text: stripInlineMarkdown(trimmed), size: 22 })],
        spacing: { after: 160 },
      }),
    )
  }
  return out
}

function paragraphsFromCvMarkup(cvText: string): Paragraph[] {
  const lines = cvText.replace(/\r\n/g, "\n").split("\n")
  const out: Paragraph[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      out.push(new Paragraph({ text: "" }))
      continue
    }
    const parsed = parseResumeMarkupLine(trimmed)
    if (parsed.kind === "page-break") {
      continue
    }
    if (parsed.kind === "section-heading") {
      out.push(
        new Paragraph({
          text: parsed.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 160 },
        }),
      )
      continue
    }
    if (parsed.kind === "job-title") {
      out.push(
        new Paragraph({
          text: parsed.text,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 80 },
        }),
      )
      continue
    }
    if (parsed.kind === "company") {
      out.push(
        new Paragraph({
          text: parsed.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 80, after: 40 },
        }),
      )
      continue
    }
    if (parsed.kind === "date") {
      out.push(
        new Paragraph({
          text: parsed.text,
          heading: HeadingLevel.HEADING_3,
          spacing: { after: 80 },
        }),
      )
      continue
    }
    if (parsed.kind === "bullet") {
      out.push(
        new Paragraph({
          text: stripInlineMarkdown(parsed.text),
          bullet: { level: 0 },
          spacing: { after: 80 },
        }),
      )
      continue
    }
    // ALL-CAPS section fallback
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && !trimmed.startsWith("#")) {
      out.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 160 },
        }),
      )
      continue
    }
    out.push(
      new Paragraph({
        text: stripInlineMarkdown(parsed.text || trimmed),
        spacing: { after: 100 },
      }),
    )
  }
  return out
}

/** Build DOCX buffer for agent draft CV or cover letter. */
export async function buildAgentDraftDocx(input: {
  kind: AgentDraftExportKind
  text: string
  title?: string
}): Promise<Buffer> {
  const title =
    input.title ||
    (input.kind === "cv" ? "Curriculum Vitae" : "Cover Letter")
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    ...(input.kind === "cv"
      ? paragraphsFromCvMarkup(input.text)
      : paragraphsFromPlainText(input.text)),
  ]

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })
  const uint8 = await Packer.toBuffer(doc)
  return Buffer.from(uint8)
}

function buildPrintHtml(input: {
  kind: AgentDraftExportKind
  text: string
  title?: string
}): string {
  const title =
    input.title ||
    (input.kind === "cv" ? "Curriculum Vitae" : "Cover Letter")
  const body =
    input.kind === "cv"
      ? cvMarkupToHtml(input.text)
      : plainTextToHtml(input.text)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtmlText(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #171717;
    font-size: 11pt;
    line-height: 1.4;
    margin: 0;
  }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 18pt; font-weight: 600; }
  h2 { font-size: 12pt; margin: 14pt 0 6pt; text-transform: uppercase; letter-spacing: 0.04em; }
  h3 { font-size: 11pt; margin: 8pt 0 2pt; font-weight: 600; }
  h4 { font-size: 10.5pt; margin: 2pt 0 8pt; font-weight: 400; color: #404040; }
  p { margin: 0 0 8pt; white-space: pre-wrap; }
  ul { margin: 0 0 8pt; padding-left: 18pt; }
  li { margin: 0 0 4pt; }
</style>
</head>
<body>
  <h1>${escapeHtmlText(title)}</h1>
  ${body}
</body>
</html>`
}

function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((l) => escapeHtmlText(stripInlineMarkdown(l))).join("<br/>")
      return `<p>${lines}</p>`
    })
    .join("\n")
}

function cvMarkupToHtml(cvText: string): string {
  const lines = cvText.replace(/\r\n/g, "\n").split("\n")
  const parts: string[] = []
  let listOpen = false
  const closeList = () => {
    if (listOpen) {
      parts.push("</ul>")
      listOpen = false
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      continue
    }
    const parsed = parseResumeMarkupLine(trimmed)
    if (parsed.kind === "page-break") {
      closeList()
      continue
    }
    if (parsed.kind === "section-heading") {
      closeList()
      parts.push(`<h2>${escapeHtmlText(parsed.text)}</h2>`)
      continue
    }
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2 &&
      !trimmed.startsWith("#") &&
      parsed.kind === "paragraph"
    ) {
      closeList()
      parts.push(`<h2>${escapeHtmlText(trimmed)}</h2>`)
      continue
    }
    if (parsed.kind === "job-title") {
      closeList()
      parts.push(`<h3>${escapeHtmlText(parsed.text)}</h3>`)
      continue
    }
    if (parsed.kind === "company") {
      closeList()
      parts.push(`<h3>${escapeHtmlText(parsed.text)}</h3>`)
      continue
    }
    if (parsed.kind === "date") {
      closeList()
      parts.push(`<h4>${escapeHtmlText(parsed.text)}</h4>`)
      continue
    }
    if (parsed.kind === "bullet") {
      if (!listOpen) {
        parts.push("<ul>")
        listOpen = true
      }
      parts.push(`<li>${escapeHtmlText(stripInlineMarkdown(parsed.text))}</li>`)
      continue
    }
    closeList()
    parts.push(`<p>${escapeHtmlText(stripInlineMarkdown(parsed.text || trimmed))}</p>`)
  }
  closeList()
  return parts.join("\n")
}

/** Build PDF buffer via Playwright print (same approach as cover-letter export). */
export async function buildAgentDraftPdf(input: {
  kind: AgentDraftExportKind
  text: string
  title?: string
}): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
    await page.setViewportSize({ width: 820, height: 1200 })
    await page.setContent(buildPrintHtml(input), {
      waitUntil: "load",
      timeout: 60_000,
    })
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })
    return Buffer.from(pdf)
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

export function agentDraftFilename(input: {
  kind: AgentDraftExportKind
  format: AgentDraftExportFormat
  jobTitle?: string | null
}): string {
  const base = (input.jobTitle || "application")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60) || "application"
  const suffix = input.kind === "cv" ? "CV" : "CoverLetter"
  return `${base}_${suffix}.${input.format}`
}
