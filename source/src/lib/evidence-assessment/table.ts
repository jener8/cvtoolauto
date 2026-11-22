import {
  evidenceSectionHeading,
  evidenceTableHeaders,
} from "@/lib/evidence-assessment/labels"
import type {
  EvidenceAssessmentRow,
  EvidenceTableLayout,
} from "@/lib/evidence-assessment/types"
import { approvedEvidenceRows } from "@/lib/evidence-assessment/parse"
import { tableHasDenseCells, tryParseMarkdownTableAt } from "@/lib/resume-markdown-table"

function escapeCell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\n+/g, " ").trim()
}

/**
 * Build employer-facing Markdown pipe table from approved rows.
 * Default two columns; optional Outcome / Status third column.
 */
export function buildEvidenceTableMarkdown(
  rows: EvidenceAssessmentRow[],
  options: {
    layout?: EvidenceTableLayout
    outputLanguage?: "en" | "de"
  } = {},
): string {
  const layout = options.layout ?? "two_column"
  const lang = options.outputLanguage ?? "en"
  const approved = approvedEvidenceRows(rows).slice(0, 5)
  if (approved.length === 0) return ""

  const headers = evidenceTableHeaders(layout, lang)
  const heading = evidenceSectionHeading(lang)
  const sep = `| ${headers.map(() => "---").join(" | ")} |`
  const headerLine = `| ${headers.join(" | ")} |`

  const body = approved.map((row) => {
    const criterion = escapeCell(row.requirementPhrase)
    const evidence = escapeCell(row.evidenceText)
    if (layout === "three_column") {
      const outcome = escapeCell(row.outcomeLabel || maturityFallbackLabel(row.maturity, lang))
      return `| ${criterion} | ${evidence} | ${outcome} |`
    }
    return `| ${criterion} | ${evidence} |`
  })

  return [heading, "", headerLine, sep, ...body].join("\n")
}

function maturityFallbackLabel(
  maturity: EvidenceAssessmentRow["maturity"],
  lang: "en" | "de",
): string {
  if (lang === "de") {
    if (maturity === "delivered") return "Umgesetzt"
    if (maturity === "in_progress") return "In Arbeit"
    return "Vorgeschlagen"
  }
  if (maturity === "delivered") return "Delivered"
  if (maturity === "in_progress") return "In progress"
  return "Proposed"
}

const EVIDENCE_SECTION_RE =
  /^(SELECTED EVIDENCE|AUSGEWÄHLTE BELEGE|ROLE REQUIREMENTS(?:\s*&\s*MY EVIDENCE)?|ROLLENANFORDERUNGEN.*)$/i

/**
 * Ensure the CV contains the approved evidence table (insert or replace section).
 * Places the block after PROFILE / PROFIL when present; otherwise at the top.
 */
export function ensureEvidenceTableInCv(
  cvText: string,
  tableMarkdown: string,
): string {
  const block = tableMarkdown.trim()
  if (!block) return cvText

  const lines = cvText.replace(/\r\n/g, "\n").split("\n")
  const sectionStart = lines.findIndex((line) => EVIDENCE_SECTION_RE.test(line.trim()))

  if (sectionStart >= 0) {
    let end = sectionStart + 1
    while (end < lines.length) {
      const t = lines[end].trim()
      if (
        t &&
        !t.startsWith("|") &&
        !/^[-|:\s]+$/.test(t) &&
        /^[A-ZÄÖÜ][A-ZÄÖÜ\s&/]{2,}$/.test(t) &&
        !EVIDENCE_SECTION_RE.test(t)
      ) {
        break
      }
      // Stop at next major section header (ALL CAPS word line)
      if (
        t &&
        !t.startsWith("|") &&
        /^[A-ZÄÖÜ][A-ZÄÖÜ\s&-]{3,}$/.test(t) &&
        !EVIDENCE_SECTION_RE.test(t) &&
        end > sectionStart + 1
      ) {
        break
      }
      end++
      // Safety: table usually ends within ~20 lines
      if (end - sectionStart > 40) break
    }
    const next = [...lines.slice(0, sectionStart), ...block.split("\n"), "", ...lines.slice(end)]
    return next.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
  }

  const profileIdx = lines.findIndex((line) =>
    /^(PROFILE|PROFIL|ZUSAMMENFASSUNG|SUMMARY)$/i.test(line.trim()),
  )
  if (profileIdx >= 0) {
    let insertAt = profileIdx + 1
    while (insertAt < lines.length) {
      const t = lines[insertAt].trim()
      if (
        t &&
        /^[A-ZÄÖÜ][A-ZÄÖÜ\s&-]{3,}$/.test(t) &&
        !/^(PROFILE|PROFIL|ZUSAMMENFASSUNG|SUMMARY)$/i.test(t)
      ) {
        break
      }
      insertAt++
    }
    const next = [
      ...lines.slice(0, insertAt),
      "",
      ...block.split("\n"),
      "",
      ...lines.slice(insertAt),
    ]
    return next.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
  }

  return `${block}\n\n${cvText.trim()}\n`
}

/** Soft check: recommend two-column if three-column cells look too dense. */
export function shouldRecommendTwoColumnLayout(tableMarkdown: string): boolean {
  const lines = tableMarkdown.split("\n")
  const start = lines.findIndex((l) => l.trim().startsWith("|"))
  if (start < 0) return false
  const parsed = tryParseMarkdownTableAt(lines, start)
  if (!parsed || parsed.table.headers.length < 3) return false
  return tableHasDenseCells(parsed.table, 42)
}
