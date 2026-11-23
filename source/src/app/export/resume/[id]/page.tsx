import { notFound } from "next/navigation"
import { verifyPdfToken } from "@/lib/pdf-token"
import { createServerServiceSupabaseClient } from "@/lib/supabase/server-service-client"
import { ExportPdfMetadata } from "@/components/export-pdf-metadata"
import { ResumePreview } from "@/components/resume-preview"
import { contactInfoFromResumeRecord } from "@/lib/contact-info"
import { optimizeResumeVersionForPdfExport } from "@/lib/pdf-export-optimize-server"
import {
  buildExportMetadataComments,
  normalizeCvFormatStyle,
  resolveExportProvenance,
} from "@/lib/ai-transparency"
import { PDF_EXPORT_PRESETS, parsePdfExportPreset } from "@/lib/pdf-export-presets"
import { normalizeResumeVersion } from "@/lib/resume-persistence"
import type { ResumeVersion } from "@/lib/types"

export default async function ExportResumePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    token?: string
    preset?: string
    transparency?: string
    metadata?: string
    formatStyle?: string
  }>
}) {
  const { id } = await params
  const query = await searchParams

  if (!query.token) {
    return notFound()
  }

  const tokenPayload = await verifyPdfToken(query.token)
  if (!tokenPayload || tokenPayload.resumeId !== id) {
    return notFound()
  }

  // Must use the signed-in service user — anon client is blocked by RLS and
  // Playwright PDF export would 404 (no #resume-root), falling back to ATS print.
  const supabase = await createServerServiceSupabaseClient()
  if (!supabase) {
    return notFound()
  }

  const { data: resumeData, error } = await supabase.from("resume_versions").select("*").eq("id", id).single()

  if (error || !resumeData) {
    return notFound()
  }

  const preset = parsePdfExportPreset(query.preset)
  const presetConfig = PDF_EXPORT_PRESETS[preset]
  const exportIncludeTransparencyPage = query.transparency === "1"
  const exportIncludeMetadata =
    query.metadata !== "0" && !presetConfig.stripHtmlMetadata

  const contactInfo = contactInfoFromResumeRecord(resumeData as Record<string, unknown>)
  // Prefer live editor formatStyle (query) when present so PDF matches unsaved
  // Appearance selection; otherwise use persisted contactInfo.formatStyle.
  if (query.formatStyle) {
    contactInfo.formatStyle = normalizeCvFormatStyle(query.formatStyle)
  }

  let version: ResumeVersion = normalizeResumeVersion({
    id: resumeData.id,
    name: resumeData.name,
    resumeText: resumeData.resume_text,
    profileImage: resumeData.profile_image,
    companyLogo: resumeData.company_logo,
    timestamp: new Date(resumeData.created_at).getTime(),
    contactInfo,
    accentColor: resumeData.accent_color,
    accentColorHex: resumeData.accent_color_hex ?? resumeData.accent_color,
    folderId: resumeData.folder_id,
  })

  version = await optimizeResumeVersionForPdfExport(version, preset)

  const provenance = resolveExportProvenance(version)
  const exportMeta = buildExportMetadataComments({
    model: provenance.model,
    providerLabel: provenance.providerLabel,
    aiAssistanceEnabled: provenance.aiAssistanceEnabled,
  })

  // Same HTML as the on-screen preview: a stack of `<section class="pdf-page">`
  // sheets. Print margins come only from `@page { margin: 15mm }` in globals.css
  // (Playwright: preferCSSPageSize + zero engine margins). Do not re-wrap or
  // re-pad pages here — double insets / max-height caused Chrome/Safari mismatches.
  return (
    <>
      {exportIncludeMetadata ? <ExportPdfMetadata content={exportMeta.pdfMeta} /> : null}
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* No screen-only chrome on the export page — the stack of
           .pdf-page wrappers is the entire visible document. */
        body > * { background: #ffffff; }
      `}</style>
      <div id="resume-root">
        <ResumePreview
          version={version}
          variant="export"
          pdfExportPreset={preset}
          exportIncludeTransparencyPage={exportIncludeTransparencyPage}
          exportIncludeMetadata={exportIncludeMetadata}
        />
      </div>
    </>
  )
}
