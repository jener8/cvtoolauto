import { type NextRequest, NextResponse } from "next/server"
import { chromium } from "playwright"
import { getServerCvUser } from "@/lib/cv-auth-session-server"
import { sessionMayAccessFolderId } from "@/lib/folder-access-server"
import { generatePdfToken } from "@/lib/pdf-token"
import {
  DEFAULT_PDF_EXPORT_PRESET,
  PDF_EXPORT_PRESETS,
  parsePdfExportPreset,
} from "@/lib/pdf-export-presets"
import { createServerServiceSupabaseClient } from "@/lib/supabase/server-service-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    const user = await getServerCvUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params
    const resumeId = params.id
    const searchParams = request.nextUrl.searchParams
    const preset = parsePdfExportPreset(searchParams.get("preset"))
    const presetConfig = PDF_EXPORT_PRESETS[preset]
    const includeTransparency = searchParams.get("transparency") === "1"
    const includeMetadata = searchParams.get("metadata") !== "0"

    const supabase = await createServerServiceSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 })
    }
    const { data: resumeRow, error: resumeError } = await supabase
      .from("resume_versions")
      .select("id, folder_id")
      .eq("id", resumeId)
      .maybeSingle()
    if (resumeError || !resumeRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const allowed = await sessionMayAccessFolderId(
      user,
      resumeRow.folder_id ? String(resumeRow.folder_id) : null,
      supabase,
    )
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Generate a signed token for server-side access
    const userId = "authenticated-user"
    const token = await generatePdfToken(resumeId, userId)

    // Get the base URL
    const baseUrl = process.env.NEXT_PUBLIC_URL || request.nextUrl.origin
    const exportQuery = new URLSearchParams({
      token,
      preset,
      metadata: includeMetadata ? "1" : "0",
    })
    if (includeTransparency) exportQuery.set("transparency", "1")
    const exportUrl = `${baseUrl}/export/resume/${resumeId}?${exportQuery.toString()}`

    console.log("[v0] Launching Playwright to generate PDF with selectable text")

    // Launch Playwright with minimal resources
    browser = await chromium.launch({
      headless: true,
    })

    const browserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    })

    const page = await browserContext.newPage()
    await page.setViewportSize({ width: 820, height: 1200 })

    // Navigate to export page
    await page.goto(exportUrl, {
      waitUntil: "networkidle",
      timeout: 60000,
    })

    // Wait for resume root
    await page.waitForSelector("#resume-root", { timeout: 10000 })

    await page.waitForSelector("#resume-root [data-pdf-pagination-ready='true']", {
      timeout: 20000,
    })

    // Match on-screen typography/layout (no font substitution, no image resizing).
    // Race fonts.ready so a hung FontFaceSet can never stall PDF generation.
    await page.evaluate(async () => {
      const fontsReady = document.fonts?.ready
        ? Promise.race([
            document.fonts.ready.then(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, 3000)),
          ])
        : Promise.resolve()
      await fontsReady
      await Promise.all(
        Array.from(document.images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve()
                return
              }
              img.onload = () => resolve()
              img.onerror = () => resolve()
              setTimeout(() => resolve(), 5000)
            }),
        ),
      )
    })

    // Generate PDF — A4 from @page / CSS; tagged PDF keeps text selectable and accessible.
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: presetConfig.playwrightScale,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      tagged: preset === DEFAULT_PDF_EXPORT_PRESET,
    })

    const pdfSizeKB = Math.round(pdf.length / 1024)
    const pdfSizeMB = (pdf.length / (1024 * 1024)).toFixed(2)
    console.log("[v0] PDF generated, size:", pdfSizeKB, "KB (", pdfSizeMB, "MB)")

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume-${resumeId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[v0] PDF generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
