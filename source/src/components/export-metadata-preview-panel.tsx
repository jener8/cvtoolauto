"use client"

import {
  AI_TOOL_NAME,
  getExportMetadataVisibility,
  resolveExportProvenance,
  type ExportDocumentFormat,
  type ExportFeatureVisibility,
} from "@/lib/ai-transparency"
import type { ResumeVersion } from "@/lib/types"

function formatVisibilityLabel(visible: boolean): string {
  return visible ? "Yes" : "No"
}

function FormatVisibilityRows({
  format,
  visibility,
}: {
  format: ExportDocumentFormat
  visibility: ExportFeatureVisibility
}) {
  const row = visibility[format]
  const formatLabel = format === "pdf" ? "PDF" : "Word"

  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {formatLabel} export
      </p>
      <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-muted-foreground">Visible in exported document</dt>
        <dd>{formatVisibilityLabel(row.visible)}</dd>
        <dt className="font-medium text-muted-foreground">Location</dt>
        <dd>{row.locationLabel}</dd>
      </dl>
    </div>
  )
}

export function ExportMetadataPreviewPanel({
  resume,
  visibility = getExportMetadataVisibility(),
  title = "Export metadata preview",
  description = "Embedded in PDF file properties. Word exports include the same text at the end of the document.",
  showMetadataRows = true,
  showWordPreview = true,
}: {
  resume: ResumeVersion | null
  visibility?: ExportFeatureVisibility
  title?: string
  description?: string
  showMetadataRows?: boolean
  showWordPreview?: boolean
}) {
  const provenance = resolveExportProvenance(resume)
  const date = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const features =
    provenance.featuresUsed.length > 0
      ? provenance.featuresUsed.join(", ")
      : "CV editing assistance"

  const rows: Array<{ label: string; value: string }> = [
    { label: "Tool", value: AI_TOOL_NAME },
    { label: "AI provider", value: provenance.providerLabel ?? "Not recorded" },
    { label: "Model", value: provenance.model ?? "Not recorded" },
    { label: "Date", value: date },
    { label: "AI features used", value: features },
  ]

  const wordPreviewText = [
    `Created with: ${AI_TOOL_NAME}`,
    `AI Assistance: ${provenance.aiAssistanceEnabled ? "Enabled" : "Disabled"}`,
    provenance.model ? `Model: ${provenance.model}` : null,
    provenance.providerLabel ? `Provider: ${provenance.providerLabel}` : null,
    `Date: ${date}`,
  ]
    .filter(Boolean)
    .join(" | ")

  return (
    <div
      className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm"
      role="region"
      aria-label="Export metadata preview"
    >
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-snug">{description}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <FormatVisibilityRows format="pdf" visibility={visibility} />
        <FormatVisibilityRows format="word" visibility={visibility} />
      </div>

      {showMetadataRows ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="font-medium text-muted-foreground">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {showWordPreview && visibility.word.visible ? (
        <div className="mt-3 rounded-md border border-dashed border-muted-foreground/30 bg-background/80 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Word export preview
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{wordPreviewText}</p>
        </div>
      ) : null}
    </div>
  )
}
