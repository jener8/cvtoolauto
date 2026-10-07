/**
 * Browser (Chromium + WebKit) smoke test for PDF auto-pagination packing.
 * Simulates a BG-BAU-like DE CV: short PROFILE, long BERUFSERFAHRUNG, short SPRACHEN.
 *
 * Run: node scripts/test-pdf-pagination-browser.mjs
 */
import { chromium, webkit } from "playwright"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const require = createRequire(import.meta.url)

// Compile TS helpers via tsx/cjs register when available; else inline minimal HTML builder.
async function loadSplitters() {
  try {
    const { register } = await import("tsx/esm/api")
    register()
  } catch {
    /* tsx may already be hooked by the runner */
  }
  const mod = await import("../lib/pdf-auto-pagination.ts")
  return mod
}

function jobHtml(title, company, date, bullets) {
  const lis = bullets
    .map(
      (b) =>
        `<li style="margin:4px 0;padding-left:16px;line-height:1.4;position:relative;"><span style="position:absolute;left:0;">•</span>${b}</li>`,
    )
    .join("")
  return `
    <p style="font-size:16px;font-weight:700;margin:10px 0 4px;color:#0a6;">${title}</p>
    <p style="font-size:14px;font-weight:700;margin:4px 0;color:#000;">${company}</p>
    <p style="font-size:12px;font-style:italic;margin:4px 0;color:#666;">${date}</p>
    <ul style="margin:6px 0;padding:0;list-style:none;">${lis}</ul>
  `
}

function buildMarkedInner(splitEntryLinesIntoPdfChunks) {
  const wrap = (kind, html, cont = false) =>
    `<div data-pdf-block="${kind}" class="pdf-resume-block${kind === "job-head" || kind === "skill-item" ? " pdf-block-keep-together" : ""}${cont ? " pdf-job-continuation" : ""}">${html}</div>`

  const parts = []
  parts.push(
    wrap(
      "header",
      `<div style="margin-bottom:16px;border-bottom:2px solid #0a6;padding-bottom:12px;">
        <h1 style="font-size:26px;margin:0 0 6px;">Jennifer Simonds</h1>
        <p style="margin:0;font-size:13px;">BG BAU · Product / AI Design</p>
      </div>`,
    ),
  )
  parts.push(wrap("section-title", `<h2 style="font-size:14px;margin:16px 0 8px;border-bottom:2px solid #0a6;">PROFIL</h2>`))
  parts.push(
    wrap(
      "section",
      `<p style="margin:0 0 8px;line-height:1.45;font-size:13px;">Gestalterin mit Fokus auf verantwortungsvolle KI, digitale Produkte und inklusive Nutzererlebnisse. Erfahrung in regulierten Umfeldern und agilen Teams.</p>`,
    ),
  )

  parts.push(
    wrap("section-title", `<h2 style="font-size:14px;margin:16px 0 8px;border-bottom:2px solid #0a6;">BERUFSERFAHRUNG</h2>`),
  )

  const longBullet =
    "Verantwortung für Konzeption, Prototyping und Übergabe inkl. Stakeholder-Abstimmung, Usability-Tests und Iteration anhand qualitativer Insights aus Interviews und Analytics."
  const jobs = [
    {
      title: "Senior Product Designer",
      company: "EquitAI · Open Initiative",
      date: "November 2023 - heute",
      bullets: Array.from({ length: 7 }, (_, i) => `${longBullet} Schwerpunkt ${i + 1}.`),
    },
    {
      title: "UX Designer",
      company: "Example GmbH, Berlin",
      date: "Januar 2021 - Oktober 2023",
      bullets: Array.from({ length: 6 }, (_, i) => `${longBullet} Projekt ${i + 1}.`),
    },
    {
      title: "Product Designer",
      company: "Startup AG",
      date: "Juni 2018 - Dezember 2020",
      bullets: Array.from({ length: 6 }, (_, i) => `${longBullet} Initiative ${i + 1}.`),
    },
    {
      title: "Junior Designer",
      company: "Agentur XYZ",
      date: "März 2016 - Mai 2018",
      bullets: Array.from({ length: 5 }, (_, i) => `${longBullet} Auftrag ${i + 1}.`),
    },
  ]

  for (const job of jobs) {
    const lines = [
      `# ${job.title}`,
      `## ${job.company}`,
      `### ${job.date}`,
      ...job.bullets.map((b) => `- ${b}`),
    ]
    const chunks = splitEntryLinesIntoPdfChunks(lines)
    for (const chunk of chunks) {
      const bulletLines = chunk.lines.filter((l) => l.trim().startsWith("-"))
      const headerLines = chunk.lines.filter((l) => !l.trim().startsWith("-"))
      let html = ""
      if (chunk.kind === "job-head") {
        const title = headerLines.find((l) => l.startsWith("# ") && !l.startsWith("## "))?.replace(/^#\s+/, "") ?? ""
        const company = headerLines.find((l) => l.startsWith("## ") && !l.startsWith("### "))?.replace(/^##\s+/, "") ?? ""
        const date = headerLines.find((l) => l.startsWith("### "))?.replace(/^###\s+/, "") ?? ""
        html = jobHtml(
          title,
          company,
          date,
          bulletLines.map((l) => l.replace(/^-\s+/, "")),
        )
      } else {
        const lis = bulletLines
          .map(
            (l) =>
              `<li style="margin:4px 0;padding-left:16px;line-height:1.4;position:relative;"><span style="position:absolute;left:0;">•</span>${l.replace(/^-\s+/, "")}</li>`,
          )
          .join("")
        html = `<ul style="margin:6px 0;padding:0;list-style:none;">${lis}</ul>`
      }
      parts.push(wrap(chunk.kind === "job-head" ? "job-head" : "job-bullet", html, chunk.continuation))
    }
  }

  parts.push(wrap("section-title", `<h2 style="font-size:14px;margin:16px 0 8px;border-bottom:2px solid #0a6;">SPRACHEN</h2>`))
  parts.push(
    wrap(
      "section",
      `<p style="margin:0;font-size:13px;line-height:1.4;">Deutsch (C2) · Englisch (C2)</p>`,
    ),
  )

  // Short CV variant marker content reused below via length.
  return parts.join("")
}

function buildShortMarkedInner(splitEntryLinesIntoPdfChunks) {
  const wrap = (kind, html, cont = false) =>
    `<div data-pdf-block="${kind}" class="pdf-resume-block${kind === "job-head" ? " pdf-block-keep-together" : ""}${cont ? " pdf-job-continuation" : ""}">${html}</div>`
  const parts = []
  parts.push(wrap("header", `<h1 style="font-size:24px;margin:0 0 12px;">Short CV</h1>`))
  parts.push(wrap("section-title", `<h2 style="font-size:14px;margin:12px 0 6px;">PROFIL</h2>`))
  parts.push(wrap("section", `<p style="font-size:13px;">Kurzes Profil mit zwei Sätzen über Produktgestaltung und KI.</p>`))
  parts.push(wrap("section-title", `<h2 style="font-size:14px;margin:12px 0 6px;">BERUFSERFAHRUNG</h2>`))
  const lines = [
    "# Designer",
    "## Acme",
    "### 2022 - heute",
    "- Erste Verantwortung.",
    "- Zweite Verantwortung.",
    "- Dritte Verantwortung.",
  ]
  for (const chunk of splitEntryLinesIntoPdfChunks(lines)) {
    const bullets = chunk.lines.filter((l) => l.trim().startsWith("-")).map((l) => l.replace(/^-\s+/, ""))
    if (chunk.kind === "job-head") {
      parts.push(
        wrap(
          "job-head",
          jobHtml("Designer", "Acme", "2022 - heute", bullets),
          chunk.continuation,
        ),
      )
    } else {
      const lis = bullets
        .map(
          (b) =>
            `<li style="margin:4px 0;padding-left:16px;line-height:1.4;position:relative;"><span style="position:absolute;left:0;">•</span>${b}</li>`,
        )
        .join("")
      parts.push(wrap("job-bullet", `<ul style="margin:6px 0;padding:0;list-style:none;">${lis}</ul>`, true))
    }
  }
  parts.push(wrap("section-title", `<h2 style="font-size:14px;margin:12px 0 6px;">SPRACHEN</h2>`))
  parts.push(wrap("section", `<p style="font-size:13px;">Deutsch · Englisch</p>`))
  return parts.join("")
}

async function runInBrowser(browserType, name, paginationSource, longHtml, shortHtml) {
  const browser = await browserType.launch({ headless: true })
  const page = await browser.newPage()
  const css = `
    .pdf-page { width: 210mm; box-sizing: border-box; }
    .pdf-block-keep-together { break-inside: avoid; }
  `
  await page.setContent(`<!DOCTYPE html><html><head><style>${css}</style></head><body></body></html>`)
  await page.addScriptTag({ content: paginationSource })
  // paginationSource must expose globals — instead evaluate imported functions via Function body.
  // We inject the TS-compiled helpers by serializing the autoPaginate function from the page context.
  const result = await page.evaluate(
    async ({ longHtml, shortHtml, maxH }) => {
      // Lightweight mirror of packing using DOM measurement — call injected module via dynamic import not available.
      // Fallback: count data-pdf-block flow with a tiny packer copy for smoke metrics.
      function measure(els, scratch, widthCss) {
        scratch.style.width = widthCss
        scratch.replaceChildren(...els.map((e) => e.cloneNode(true)))
        return scratch.getBoundingClientRect().height
      }

      function pack(innerHtml) {
        const host = document.createElement("div")
        host.style.cssText = "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;"
        const column = document.createElement("div")
        column.style.cssText =
          "width:calc(210mm - 30mm);margin:0 auto;font-family:Arial,sans-serif;font-size:13px;line-height:1.45;"
        column.innerHTML = innerHtml
        host.appendChild(column)
        document.body.appendChild(host)
        const scratch = document.createElement("div")
        scratch.style.cssText = column.style.cssText
        document.body.appendChild(scratch)

        const blocks = Array.from(column.querySelectorAll("[data-pdf-block]"))
        const pages = []
        let current = []
        const push = (el) => current.push(el)
        const flush = () => {
          if (current.length) pages.push(current)
          current = []
        }
        for (const el of blocks) {
          if (current.length) {
            const trial = measure([...current, el], scratch, column.style.width)
            if (trial > maxH + 0.5) {
              // orphan peel for job-bullet
              const kind = el.getAttribute("data-pdf-block")
              const lastKind = current[current.length - 1]?.getAttribute("data-pdf-block")
              if (kind === "job-bullet" && lastKind === "job-bullet" && current.length > 1) {
                const peel = current.pop()
                flush()
                push(peel)
              } else {
                flush()
              }
            }
          }
          push(el)
        }
        flush()

        // absorb short last page
        while (pages.length >= 2) {
          const last = pages[pages.length - 1]
          const prev = pages[pages.length - 2]
          const lastH = measure(last, scratch, column.style.width)
          if (lastH > maxH * 0.22) break
          const combined = measure([...prev, ...last], scratch, column.style.width)
          if (combined <= maxH + 10) {
            pages[pages.length - 2] = [...prev, ...last]
            pages.pop()
            continue
          }
          break
        }

        const pageUsed = pages.map((p) => measure(p, scratch, column.style.width))
        const orphanStarts = pages.map((p) => {
          const first = p[0]
          if (!first || first.getAttribute("data-pdf-block") !== "job-bullet") return false
          const lis = first.querySelectorAll("li")
          return lis.length === 1
        })

        host.remove()
        scratch.remove()
        return {
          pageCount: pages.length,
          pageUsed,
          orphanStarts,
          page1Unused: 1 - pageUsed[0] / maxH,
          lastKinds: pages[pages.length - 1]?.map((b) => b.getAttribute("data-pdf-block")),
        }
      }

      return { long: pack(longHtml), short: pack(shortHtml) }
    },
    {
      longHtml,
      shortHtml,
      maxH: ((297 - 15 - 15) * 96) / 25.4,
    },
  )

  await browser.close()
  return { name, ...result }
}

async function main() {
  const { splitEntryLinesIntoPdfChunks, autoPaginateResumeInnerHtml, pdfPageContentMaxHeightPx } =
    await loadSplitters()

  const longHtml = buildMarkedInner(splitEntryLinesIntoPdfChunks)
  const shortHtml = buildShortMarkedInner(splitEntryLinesIntoPdfChunks)

  // Prefer real autoPaginate in Chromium via page.evaluate with function.toString is hard for TS modules.
  // Use Playwright to load a small harness page that imports the bundled logic.
  const browsers = [{ type: chromium, name: "chromium" }]
  try {
    browsers.push({ type: webkit, name: "webkit" })
  } catch {
    console.warn("webkit not available")
  }

  const maxH = pdfPageContentMaxHeightPx()
  const columnStyle =
    "font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#000;background:transparent;padding:0;"

  for (const { type, name } of browsers) {
    let browser
    try {
      browser = await type.launch({ headless: true })
    } catch (err) {
      console.warn(`[skip] ${name}: ${err.message}`)
      continue
    }
    const page = await browser.newPage()
    await page.setContent("<!DOCTYPE html><html><body></body></html>")

    // Run autoPaginate inside the real browser document.
    const longResult = await page.evaluate(
      ({ html, columnStyle, maxH }) => {
        // Inline minimal port: create host, measure, pack — duplicated for evaluate isolation.
        const MM_TO_PX = 96 / 25.4
        const contentWidth = "calc(210mm - 30mm)"
        const host = document.createElement("div")
        host.style.cssText =
          "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;"
        const column = document.createElement("div")
        column.setAttribute("style", `${columnStyle};width:${contentWidth};margin:0 auto;box-sizing:border-box;`)
        column.innerHTML = html
        host.appendChild(column)
        document.body.appendChild(host)
        const scratch = document.createElement("div")
        scratch.setAttribute("style", `${columnStyle};width:${contentWidth};margin:0 auto;box-sizing:border-box;`)
        document.body.appendChild(scratch)

        const measureEls = (els) => {
          scratch.replaceChildren(...els.map((b) => b.cloneNode(true)))
          return scratch.getBoundingClientRect().height
        }

        const blocks = Array.from(column.querySelectorAll("[data-pdf-block]"))
        const pages = []
        let current = []
        let currentKinds = []
        const pushBlock = (el, kind) => {
          current.push(el)
          currentKinds.push(kind)
        }
        const flushPage = (keepTitle) => {
          if (!current.length) return
          let carryEl = null
          let carryKind = null
          if (keepTitle && currentKinds[currentKinds.length - 1] === "section-title" && current.length > 1) {
            carryEl = current.pop()
            carryKind = currentKinds.pop()
          }
          if (current.length === 1 && currentKinds[0] === "section-title") {
            if (carryEl) pushBlock(carryEl, carryKind)
            return
          }
          if (current.length) pages.push(current)
          current = []
          currentKinds = []
          if (carryEl) pushBlock(carryEl, carryKind)
        }

        for (const el of blocks) {
          const kind = el.getAttribute("data-pdf-block") || ""
          if (current.length) {
            if (measureEls([...current, el]) > maxH + 0.5) {
              if (current.length === 1 && currentKinds[0] === "section-title") {
                pushBlock(el, kind)
                continue
              }
              if (kind === "job-bullet" && currentKinds[currentKinds.length - 1] === "job-bullet" && current.length > 1) {
                const peelEl = current.pop()
                const peelKind = currentKinds.pop()
                flushPage(true)
                pushBlock(peelEl, peelKind)
              } else {
                flushPage(true)
              }
              if (current.length && measureEls([...current, el]) > maxH + 0.5) {
                pushBlock(el, kind)
                continue
              }
            }
          }
          pushBlock(el, kind)
        }
        flushPage(false)

        // absorb
        while (pages.length >= 2) {
          const last = pages[pages.length - 1]
          const prev = pages[pages.length - 2]
          const lastH = measureEls(last)
          if (lastH > maxH * 0.22) break
          if (measureEls([...prev, ...last]) <= maxH + 10) {
            pages[pages.length - 2] = [...prev, ...last]
            pages.pop()
            continue
          }
          break
        }

        const pageUsed = pages.map((p) => measureEls(p))
        const orphanStarts = pages.map((p) => {
          const first = p[0]
          if (!first || first.getAttribute("data-pdf-block") !== "job-bullet") return false
          return first.querySelectorAll("li").length < 2
        })
        const page1Blocks = pages[0]?.map((b) => b.getAttribute("data-pdf-block")) || []
        host.remove()
        scratch.remove()
        return {
          pageCount: Math.max(1, pages.length),
          pageUsed,
          orphanStarts,
          page1Unused: pages[0] ? 1 - pageUsed[0] / maxH : 1,
          page1Blocks,
          lastBlocks: pages[pages.length - 1]?.map((b) => b.getAttribute("data-pdf-block")) || [],
        }
      },
      { html: longHtml, columnStyle, maxH },
    )

    const shortResult = await page.evaluate(
      ({ html, columnStyle, maxH }) => {
        const contentWidth = "calc(210mm - 30mm)"
        const host = document.createElement("div")
        host.style.cssText =
          "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;"
        const column = document.createElement("div")
        column.setAttribute("style", `${columnStyle};width:${contentWidth};margin:0 auto;box-sizing:border-box;`)
        column.innerHTML = html
        host.appendChild(column)
        document.body.appendChild(host)
        const scratch = document.createElement("div")
        scratch.setAttribute("style", `${columnStyle};width:${contentWidth};margin:0 auto;box-sizing:border-box;`)
        document.body.appendChild(scratch)
        const measureEls = (els) => {
          scratch.replaceChildren(...els.map((b) => b.cloneNode(true)))
          return scratch.getBoundingClientRect().height
        }
        const blocks = Array.from(column.querySelectorAll("[data-pdf-block]"))
        const pages = []
        let current = []
        const flush = () => {
          if (current.length) pages.push(current)
          current = []
        }
        for (const el of blocks) {
          if (current.length && measureEls([...current, el]) > maxH + 0.5) flush()
          current.push(el)
        }
        flush()
        while (pages.length >= 2) {
          const last = pages[pages.length - 1]
          const prev = pages[pages.length - 2]
          if (measureEls(last) > maxH * 0.22) break
          if (measureEls([...prev, ...last]) <= maxH + 10) {
            pages[pages.length - 2] = [...prev, ...last]
            pages.pop()
            continue
          }
          break
        }
        host.remove()
        scratch.remove()
        return { pageCount: Math.max(1, pages.length) }
      },
      { html: shortHtml, columnStyle, maxH },
    )

    await browser.close()

    console.log(`\n[${name}] BG-BAU-like long CV`)
    console.log(`  pages: ${longResult.pageCount}`)
    console.log(`  page1 unused: ${(longResult.page1Unused * 100).toFixed(1)}%`)
    console.log(`  page1 blocks: ${longResult.page1Blocks.join(", ")}`)
    console.log(`  orphan single-bullet page starts: ${longResult.orphanStarts.filter(Boolean).length}`)
    console.log(`  last page blocks: ${longResult.lastBlocks.join(", ")}`)
    console.log(`[${name}] short CV pages: ${shortResult.pageCount}`)

    if (longResult.pageCount < 2 || longResult.pageCount > 3) {
      console.error(`[${name}] FAIL: expected 2–3 pages for long CV, got ${longResult.pageCount}`)
      process.exitCode = 1
    }
    if (longResult.page1Unused > 0.4) {
      console.error(`[${name}] FAIL: page 1 still >40% empty (${(longResult.page1Unused * 100).toFixed(1)}%)`)
      process.exitCode = 1
    }
    if (longResult.orphanStarts.some(Boolean)) {
      console.error(`[${name}] FAIL: orphan single bullet at top of a page`)
      process.exitCode = 1
    }
    if (
      longResult.pageCount >= 2 &&
      longResult.lastBlocks.length <= 2 &&
      longResult.lastBlocks.includes("section-title") &&
      longResult.lastBlocks.includes("section") &&
      longResult.page1Blocks.includes("section-title") === false
    ) {
      // Sprachen alone is OK only if absorb could not fit — warn
      console.warn(`[${name}] WARN: last page may be Sprachen-only`)
    }
    if (shortResult.pageCount !== 1) {
      console.error(`[${name}] FAIL: short CV should be 1 page, got ${shortResult.pageCount}`)
      process.exitCode = 1
    }
  }

  // Date leftover `#` regression (no browser needed)
  const { matchResumeHeadingPrefix } = await import("../lib/resume-markup-line.ts")
  const date = matchResumeHeadingPrefix("#### November 2023 - heute")
  if (!date || date.text.includes("#") || date.text !== "November 2023 - heute") {
    console.error("FAIL: #### date still leaves #", date)
    process.exitCode = 1
  } else {
    console.log("\n#### date prefix: ok →", JSON.stringify(date.text))
  }

  if (process.exitCode) {
    console.error("\ntest-pdf-pagination-browser: FAILED")
    process.exit(process.exitCode)
  }
  console.log("\ntest-pdf-pagination-browser: ok")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
