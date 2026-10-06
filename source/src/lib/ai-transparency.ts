import type { CvEditChange } from "@/lib/cv-edit-types"
import type { AiAuditEntry, AiContributionSummary, ResumeVersion } from "@/lib/types"
import { SITE_ORIGIN } from "@/lib/brand"

export type AiApprovalStatus = "pending" | "approved" | "rejected" | "edited_after_ai"

export type AiConfidence = "high" | "medium" | "low"

export type AiExplainability = {
  rationale?: string
  evidence?: string[]
  confidence?: AiConfidence
  sources?: string[]
}

export type AiAuthorshipLabel =
  | "ai_generated"
  | "ai_enhanced"
  | "user_authored"
  | "user_edited_after_ai"

export type AiSnapshotMetadata = {
  instruction?: string
  changes?: CvEditChange[]
  model?: string
  provider?: string
  providerLabel?: string
  mode?: string
  feature?: string
  approvalStatus?: AiApprovalStatus
  approvedAt?: number
  rejectedAt?: number
  riskReasons?: string[]
  explainability?: AiExplainability
  assistantMessageId?: string
  suggestedResumeText?: string
  acceptedResumeText?: string
}

export const AI_TOOL_NAME = "EquitAI"

export const TRANSPARENCY_STATEMENT_PRODUCT_NAME = "EquitAI"

export const TRANSPARENCY_STATEMENT_PRODUCT_URL = `${SITE_ORIGIN}/`

export type CvFormatStyle = "executive-compact" | "current" | "modern-spacious"

export type TransparencyStatementOptions = {
  accentColorHex?: string
  formatStyle?: CvFormatStyle
}

export const TRANSPARENCY_STATEMENT_COPY = {
  title: "AI Transparency Statement",
  intro:
    "As someone who works in Responsible AI and Human-Centred Design, I believe applicants should be transparent about how AI is used in professional documents.",
  tool: `This CV was supported by ${TRANSPARENCY_STATEMENT_PRODUCT_NAME}, a tool I designed and developed to help align existing experience with the requirements of a specific role. The tool assists in analysing job descriptions, identifying relevant experience, and suggesting improvements to structure and language.`,
  accountability:
    "The career strategy, selection of evidence, interpretation of experience, and all final content decisions remain my own. Every statement in this CV has been reviewed, edited, and approved by me before submission.",
  closing:
    "AI was used as a supporting tool; accountability for the final document remains entirely with me.",
  linkLabel: `${TRANSPARENCY_STATEMENT_PRODUCT_NAME}:`,
} as const

/** Body paragraphs for Word export — same wording as the HTML/PDF statement. */
export function getTransparencyStatementBodyParagraphs(): string[] {
  return [
    TRANSPARENCY_STATEMENT_COPY.intro,
    TRANSPARENCY_STATEMENT_COPY.tool,
    TRANSPARENCY_STATEMENT_COPY.accountability,
    TRANSPARENCY_STATEMENT_COPY.closing,
    `${TRANSPARENCY_STATEMENT_COPY.linkLabel} ${TRANSPARENCY_STATEMENT_PRODUCT_URL}`,
  ]
}

export function providerDisplayName(provider?: string): string {
  switch (provider) {
    case "openai":
      return "OpenAI"
    case "anthropic":
      return "Anthropic"
    case "gateway":
      return "Vercel AI Gateway"
    default:
      return provider?.trim() || "Unknown"
  }
}

export function approvalStatusLabel(status: AiApprovalStatus): string {
  switch (status) {
    case "approved":
      return "Approved"
    case "rejected":
      return "Rejected"
    case "edited_after_ai":
      return "Edited after AI"
    default:
      return "Pending review"
  }
}

export function authorshipLabel(type: AiAuthorshipLabel): string {
  switch (type) {
    case "ai_generated":
      return "AI Generated"
    case "ai_enhanced":
      return "AI Assisted"
    case "user_edited_after_ai":
      return "Edited by User After AI"
    default:
      return "User Authored"
  }
}

export function confidenceLabel(confidence?: AiConfidence): string {
  switch (confidence) {
    case "high":
      return "High"
    case "medium":
      return "Medium"
    case "low":
      return "Low"
    default:
      return "Not rated"
  }
}

export function createAuditEntryId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function inferRationaleFromInstruction(instruction?: string): string | undefined {
  const text = instruction?.trim().toLowerCase() ?? ""
  if (!text) return undefined
  if (/ats|keyword/.test(text)) return "ATS optimisation opportunity — aligning CV language with role keywords."
  if (/leadership|manager|stakeholder/.test(text)) return "Leadership experience could be highlighted more prominently."
  if (/skill|match|fit/.test(text)) return "Skill match detected between your CV and the job description."
  if (/shorter|concise|trim/.test(text)) return "Content length can be reduced while preserving impact."
  if (/tailor|job description|role/.test(text)) return "Job description priorities suggest reframing this section."
  if (/rewrite|improve|strengthen/.test(text)) return "Section clarity or impact can be improved."
  return undefined
}

export function buildExplainabilityFromChangeWhy(
  changeWhy?: string,
  instruction?: string,
  jobDescription?: string,
): AiExplainability {
  const evidence: string[] = []
  if (instruction?.trim()) evidence.push(`Your instruction: “${instruction.trim().slice(0, 200)}”`)
  if (jobDescription?.trim()) {
    evidence.push(`Job description excerpt: “${jobDescription.trim().slice(0, 160)}…”`)
  }

  const rationale =
    changeWhy?.trim() || inferRationaleFromInstruction(instruction) || undefined

  return {
    rationale,
    evidence: evidence.length > 0 ? evidence : undefined,
    confidence: changeWhy?.trim() ? "high" : rationale ? "medium" : "low",
    sources: jobDescription?.trim()
      ? ["Job description", "Your CV", "Your instruction"]
      : ["Your CV", "Your instruction"],
  }
}

export function appendAuditEntry(
  resume: ResumeVersion,
  entry: Omit<AiAuditEntry, "id"> & { id?: string },
): ResumeVersion {
  const log = [...(resume.aiAuditLog ?? []), { ...entry, id: entry.id ?? createAuditEntryId() }].slice(-100)
  return {
    ...resume,
    aiAuditLog: log,
    aiProvenance: buildProvenanceSummary(resume, log),
  }
}

export function buildProvenanceSummary(
  resume: ResumeVersion,
  auditLog: AiAuditEntry[] = resume.aiAuditLog ?? [],
): ResumeVersion["aiProvenance"] {
  const approved = auditLog.filter((e) => e.approvalStatus === "approved")
  const last = approved[approved.length - 1] ?? auditLog[auditLog.length - 1]

  const features = Array.from(
    new Set(
      auditLog
        .map((e) => e.feature)
        .filter((f): f is string => Boolean(f?.trim())),
    ),
  )

  return {
    lastModel: last?.model,
    lastProvider: last?.provider,
    lastProviderLabel: last?.providerLabel ?? providerDisplayName(last?.provider),
    lastAiUpdateAt: last?.approvedAt ?? last?.createdAt,
    firstAiGeneratedAt: auditLog[0]?.createdAt,
    featuresUsed: features,
    contribution: computeAiContribution(resume, auditLog),
  }
}

/** Heuristic authorship split based on approved AI edit scope vs current CV length. */
export function computeAiContribution(
  resume: ResumeVersion,
  auditLog: AiAuditEntry[] = resume.aiAuditLog ?? [],
): AiContributionSummary {
  const totalChars = Math.max(resume.resumeText.length, 1)
  const approved = auditLog.filter((e) => e.approvalStatus === "approved")

  let touchedChars = 0
  let generatedActions = 0

  for (const entry of approved) {
    if (/generat/i.test(entry.action)) generatedActions += 1
    for (const change of entry.changes ?? []) {
      touchedChars += Math.max(change.after?.length ?? 0, change.before?.length ?? 0)
    }
  }

  const aiGeneratedPercent =
    generatedActions > 0
      ? Math.min(40, Math.round((touchedChars / totalChars) * 100 * 0.6) + 8)
      : 0

  const rawAssisted = Math.round((touchedChars / totalChars) * 100)
  const aiAssistedPercent = Math.min(
    100 - aiGeneratedPercent,
    Math.max(0, rawAssisted - aiGeneratedPercent),
  )

  const userAuthoredPercent = Math.max(0, 100 - aiGeneratedPercent - aiAssistedPercent)

  return {
    userAuthoredPercent,
    aiAssistedPercent,
    aiGeneratedPercent,
  }
}

function normalizeAccentHex(color?: string | null): string {
  if (color?.startsWith("#")) return color
  return "#b89968"
}

type TransparencyStyleTokens = {
  titleSize: string
  titleTransform: string
  titleLetterSpacing: string
  titleWeight: string
  titleMargin: string
  titlePadding: string
  titleBackground: string
  titleBorderLeft: string
  titleBorderBottom: string
  bodySize: string
  bodyLineHeight: string
  cardPadding: string
  cardBorder: string
  cardBorderLeft: string
  cardBackground: string
  introFontStyle: string
  footerBorderTop: string
  footerSize: string
  closingWeight: string
}

function transparencyStyleTokens(
  formatStyle: CvFormatStyle,
  accent: string,
): TransparencyStyleTokens {
  const tint = `${accent}14`
  const tintStrong = `${accent}22`

  switch (formatStyle) {
    case "executive-compact":
      return {
        titleSize: "11px",
        titleTransform: "uppercase",
        titleLetterSpacing: "1.5px",
        titleWeight: "700",
        titleMargin: "0 0 20px 0",
        titlePadding: "4px 8px",
        titleBackground: tintStrong,
        titleBorderLeft: `3px solid ${accent}`,
        titleBorderBottom: "none",
        bodySize: "12px",
        bodyLineHeight: "1.65",
        cardPadding: "20px 24px",
        cardBorder: `1px solid ${tintStrong}`,
        cardBorderLeft: `3px solid ${accent}`,
        cardBackground: tint,
        introFontStyle: "normal",
        footerBorderTop: `1px solid ${tintStrong}`,
        footerSize: "11px",
        closingWeight: "600",
      }
    case "modern-spacious":
      return {
        titleSize: "14px",
        titleTransform: "lowercase",
        titleLetterSpacing: "0.02em",
        titleWeight: "300",
        titleMargin: "0 0 24px 0",
        titlePadding: "0 0 8px 0",
        titleBackground: "transparent",
        titleBorderLeft: "none",
        titleBorderBottom: `4px solid ${accent}`,
        bodySize: "13px",
        bodyLineHeight: "1.75",
        cardPadding: "28px 32px",
        cardBorder: `1px solid ${tint}`,
        cardBorderLeft: "none",
        cardBackground: "#fafafa",
        introFontStyle: "italic",
        footerBorderTop: "1px solid #eeeeee",
        footerSize: "11px",
        closingWeight: "500",
      }
    default:
      return {
        titleSize: "16px",
        titleTransform: "uppercase",
        titleLetterSpacing: "0.04em",
        titleWeight: "700",
        titleMargin: "0 0 24px 0",
        titlePadding: "0 0 8px 0",
        titleBackground: "transparent",
        titleBorderLeft: "none",
        titleBorderBottom: `2px solid ${accent}`,
        bodySize: "12.5px",
        bodyLineHeight: "1.7",
        cardPadding: "24px 28px",
        cardBorder: `1px solid ${tintStrong}`,
        cardBorderLeft: `3px solid ${accent}`,
        cardBackground: tint,
        introFontStyle: "italic",
        footerBorderTop: "1px solid #e8e8e8",
        footerSize: "11px",
        closingWeight: "500",
      }
  }
}

export function buildTransparencyPageHtml(opts: TransparencyStatementOptions = {}): string {
  const accent = normalizeAccentHex(opts.accentColorHex)
  const formatStyle = opts.formatStyle ?? "current"
  const tokens = transparencyStyleTokens(formatStyle, accent)
  const copy = TRANSPARENCY_STATEMENT_COPY

  const titleBlockStyle = [
    `font-size:${tokens.titleSize}`,
    `font-weight:${tokens.titleWeight}`,
    `letter-spacing:${tokens.titleLetterSpacing}`,
    `text-transform:${tokens.titleTransform}`,
    `margin:${tokens.titleMargin}`,
    `padding:${tokens.titlePadding}`,
    `background:${tokens.titleBackground}`,
    tokens.titleBorderLeft !== "none" ? `border-left:${tokens.titleBorderLeft}` : "",
    tokens.titleBorderBottom !== "none" ? `border-bottom:${tokens.titleBorderBottom}` : "",
    "color:#1a1a1a",
    "line-height:1.3",
  ]
    .filter(Boolean)
    .join(";")

  const paragraph = (text: string, extra = "") =>
    `<p style="margin:0 0 16px;font-size:${tokens.bodySize};line-height:${tokens.bodyLineHeight};color:#2f2f2f;${extra}">${escapeHtml(text)}</p>`

  return `
    <section class="ai-transparency-page" role="doc-appendix" aria-label="AI Transparency Statement">
      <div class="ai-transparency-page__inner" style="max-width:100%;margin:0 auto;">
        <h1 class="ai-transparency-page__title" style="${titleBlockStyle}">${escapeHtml(copy.title)}</h1>
        <div class="ai-transparency-page__card" style="padding:${tokens.cardPadding};border:${tokens.cardBorder};${tokens.cardBorderLeft !== "none" ? `border-left:${tokens.cardBorderLeft};` : ""}background:${tokens.cardBackground};border-radius:2px;box-sizing:border-box;">
          ${paragraph(copy.intro, `font-style:${tokens.introFontStyle};color:#3a3a3a;`)}
          ${paragraph(copy.tool)}
          ${paragraph(copy.accountability)}
          <p style="margin:0;font-size:${tokens.bodySize};line-height:${tokens.bodyLineHeight};color:#2f2f2f;font-weight:${tokens.closingWeight};">${escapeHtml(copy.closing)}</p>
        </div>
        <p class="ai-transparency-page__footer" style="margin:20px 0 0;padding-top:14px;border-top:${tokens.footerBorderTop};font-size:${tokens.footerSize};line-height:1.5;color:#666666;">
          <span style="font-weight:600;color:#444444;">${escapeHtml(copy.linkLabel)}</span>
          <a href="${escapeHtml(TRANSPARENCY_STATEMENT_PRODUCT_URL)}" style="color:${accent};text-decoration:none;">${escapeHtml(TRANSPARENCY_STATEMENT_PRODUCT_URL)}</a>
        </p>
      </div>
    </section>
  `
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type ExportTransparencyPreviewOptions = {
  includeMetadata: boolean
  includeTransparencyPage: boolean
}

export type ExportDocumentFormat = "pdf" | "word"

export type ExportFeaturePlacement = "metadata-only" | "end-of-document" | "footer"

export type ExportFeatureFormatVisibility = {
  visible: boolean
  location: ExportFeaturePlacement
  locationLabel: string
}

export type ExportFeatureVisibility = Record<ExportDocumentFormat, ExportFeatureFormatVisibility>

const PLACEMENT_LABELS: Record<ExportFeaturePlacement, string> = {
  "metadata-only": "Metadata only",
  footer: "Footer",
  "end-of-document": "End of document",
}

export function getExportMetadataVisibility(): ExportFeatureVisibility {
  return {
    pdf: {
      visible: false,
      location: "metadata-only",
      locationLabel: PLACEMENT_LABELS["metadata-only"],
    },
    word: {
      visible: true,
      location: "end-of-document",
      locationLabel: PLACEMENT_LABELS["end-of-document"],
    },
  }
}

export function getTransparencyStatementVisibility(): ExportFeatureVisibility {
  return {
    pdf: {
      visible: true,
      location: "end-of-document",
      locationLabel: PLACEMENT_LABELS["end-of-document"],
    },
    word: {
      visible: true,
      location: "end-of-document",
      locationLabel: PLACEMENT_LABELS["end-of-document"],
    },
  }
}

export function resolveExportProvenance(resume: ResumeVersion | null) {
  const provenance = resume?.aiProvenance
  return {
    model: provenance?.lastModel,
    providerLabel: provenance?.lastProviderLabel,
    generatedAt: provenance?.lastAiUpdateAt,
    featuresUsed: provenance?.featuresUsed ?? [],
    aiAssistanceEnabled: Boolean(resume?.aiAuditLog?.length),
  }
}

/** Final appendix page — same markup used in preview and PDF export. */
export function buildExportTransparencyAppendixHtml(
  opts: TransparencyStatementOptions = {},
): string {
  return `<section class="pdf-page pdf-page--auto export-transparency-appendix" style="box-sizing:border-box;width:210mm;min-height:auto;padding:15mm;background:#ffffff;font-family:Inter,Arial,Helvetica,sans-serif;color:#000000;">${buildTransparencyPageHtml(opts)}</section>`
}

function transparencyOptionsFromResume(
  resume: ResumeVersion | null,
  overrides?: TransparencyStatementOptions,
): TransparencyStatementOptions {
  return {
    accentColorHex: normalizeAccentHex(
      overrides?.accentColorHex ?? resume?.accentColorHex ?? resume?.accentColor,
    ),
    formatStyle: overrides?.formatStyle ?? "current",
  }
}

/** Append export transparency content to paginated CV HTML (preview + print). */
export function appendExportTransparencyToHtml(
  html: string,
  resume: ResumeVersion | null,
  includeTransparencyPage: boolean,
  options?: TransparencyStatementOptions,
): string {
  if (!includeTransparencyPage) return html
  return `${html}${buildExportTransparencyAppendixHtml(transparencyOptionsFromResume(resume, options))}`
}

export function buildExportMetadataComments(opts: {
  model?: string
  providerLabel?: string
  aiAssistanceEnabled: boolean
}): { pdfMeta: string; docxFooter: string } {
  const date = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const pdfMeta = [
    `Created with: ${AI_TOOL_NAME}`,
    `AI Assistance: ${opts.aiAssistanceEnabled ? "Enabled" : "Disabled"}`,
    opts.model ? `Model: ${opts.model}` : null,
    opts.providerLabel ? `Provider: ${opts.providerLabel}` : null,
    `Date: ${date}`,
  ]
    .filter(Boolean)
    .join(" | ")

  const docxFooter = pdfMeta

  return { pdfMeta, docxFooter }
}

