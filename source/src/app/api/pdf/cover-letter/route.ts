import { type NextRequest, NextResponse } from "next/server"
import { chromium } from "playwright"
import { buildCoverLetterPrintDocument } from "@/lib/cover-letter-export-html"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Cover-letter PDF with selectable/searchable text (Playwright print).
 * Client posts the prepared letter HTML (images already inlined as data URLs).
 * CV resume PDF export is unchanged (`/api/pdf/resume/[id]`).
 */
export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    const body = (await request.json()) as { html?: unknown; filename?: unknown }
    const letterHtml = typeof body.html === "string" ? body.html.trim() : ""
    if (!letterHtml || letterHtml.length > 6_000_000) {
      return NextResponse.json({ error: "Invalid cover letter HTML" }, { status: 400 })
    }
    if (!letterHtml.includes("cover-letter-preview")) {
      return NextResponse.json({ error: "Unexpected cover letter payload" }, { status: 400 })
    }

    const filenameRaw = typeof body.filename === "string" ? body.filename.trim() : "cover-letter.pdf"
    const filename = filenameRaw.toLowerCase().endsWith(".pdf")
      ? filenameRaw
      : `${filenameRaw || "cover-letter"}.pdf`

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
    await page.setViewportSize({ width: 820, height: 1200 })
    await page.setContent(buildCoverLetterPrintDocument(letterHtml), {
      waitUntil: "load",
      timeout: 60000,
    })
    await page.evaluate(async () => {
      await document.fonts.ready
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
              setTimeout(() => resolve(), 4000)
            }),
        ),
      )
    })

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[cover-letter pdf]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cover letter PDF failed" },
      { status: 500 },
    )
  } finally {
    await browser?.close().catch(() => undefined)
  }
}
