import { notFound } from "next/navigation"
import { verifyPdfToken } from "@/lib/pdf-token"
import { getServerSupabaseClient } from "@/lib/supabase/server"
import { ExportPdfMetadata } from "@/components/export-pdf-metadata"
import { ResumePreview } from "@/components/resume-preview"
import { contactInfoFromResumeRecord } from "@/lib/contact-info"
import { optimizeResumeVersionForPdfExport } from "@/lib/pdf-export-optimize-server"
import { buildExportMetadataComments, resolveExportProvenance } from "@/lib/ai-transparency"
import { PDF_EXPORT_PRESETS, parsePdfExportPreset } from "@/lib/pdf-export-presets"
import { normalizeResumeVersion } from "@/lib/resume-persistence"
import type { ResumeVersion } from "@/lib/types"

export default async function ExportResumePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { token?: string; preset?: string; transparency?: string; metadata?: string }
}) {
  if (!searchParams.token) {
    return notFound()
  }

  const tokenPayload = await verifyPdfToken(searchParams.token)
  if (!tokenPayload || tokenPayload.resumeId !== params.id) {
    return notFound()
  }

  const supabase = getServerSupabaseClient()
  if (!supabase) {
    return notFound()
  }

  const { data: resumeData, error } = await supabase.from("resume_versions").select("*").eq("id", params.id).single()

  if (error || !resumeData) {
    return notFound()
  }

  const preset = parsePdfExportPreset(searchParams.preset)
  const presetConfig = PDF_EXPORT_PRESETS[preset]
  const exportIncludeTransparencyPage = searchParams.transparency === "1"
  const exportIncludeMetadata =
    searchParams.metadata !== "0" && !presetConfig.stripHtmlMetadata

  let version: ResumeVersion = normalizeResumeVersion({
    id: resumeData.id,
    name: resumeData.name,
    resumeText: resumeData.resume_text,
    profileImage: resumeData.profile_image,
    companyLogo: resumeData.company_logo,
    timestamp: new Date(resumeData.created_at).getTime(),
    contactInfo: contactInfoFromResumeRecord(resumeData as Record<string, unknown>),
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
