/**
 * Verify Markdown table PDF chunks: single-page fit + multi-page span with header repeat.
 * Run: npx tsx scripts/verify-markdown-table-pagination.ts
 */
import { chromium } from "playwright"
import {
  buildMarkdownTablePdfChunks,
  CV_MARKDOWN_TABLE_CSS,
  type ParsedMarkdownTable,
} from "../lib/resume-markdown-table"

function wrap(kind: string, html: string, cont = false) {
  const keep =
    kind === "table-head" || kind === "table-row" ? " pdf-block-keep-together" : ""
  const contClass = cont ? " pdf-job-continuation" : ""
  return `<div data-pdf-block="${kind}" class="pdf-resume-block${keep}${contClass}">${html}</div>`
}

function buildEvidenceTable(rowCount: number) {
  const long =
    "Combined interviews, surveys, focus groups and red teaming to study how adults aged 60+ use AI-enabled services. Turned findings into a risk dashboard prototype and design patterns for human review and recovery across product squads."
  const table: ParsedMarkdownTable = {
    headers: ["Role criterion", "Strongest evidence"],
    alignments: ["none", "none"],
    rows: Array.from({ length: rowCount }, (_, i) => [
      `Criterion ${i + 1}: lead strategic research and shape discovery outcomes`,
      `${long} Detail ${i + 1}.`,
    ]),
  }
  const opts = { fontSize: 13, lineHeight: 1.4, linkColor: "#0f7b6c" }
  const chunks = buildMarkdownTablePdfChunks(table, opts)
  const title = wrap(
    "section-title",
    `<h2 style="font-size:14px;margin:12px 0 8px;border-bottom:2px solid #0f7b6c;">SELECTED EVIDENCE</h2>`,
  )
  return {
    html: title + chunks.map((c) => wrap(c.kind, c.html, c.continuation)).join(""),
    chunkCount: chunks.length,
  }
}

async function main() {
  const columnStyle =
    "font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.4;color:#000;background:transparent;padding:0;"

  const short = buildEvidenceTable(3)
  // Enough tall evidence rows to force a page break under A4 content height.
  const long = buildEvidenceTable(16)
  const longWithFiller = {
    html:
      wrap(
        "header",
        `<div style="margin-bottom:16px;"><h1 style="font-size:26px;margin:0 0 8px;">Sample Name</h1><p style="margin:0 0 12px;line-height:1.45;">${"Professional summary with enough lines to consume vertical space. ".repeat(12)}</p></div>`,
      ) + long.html,
    chunkCount: long.chunkCount,
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(
    `<!DOCTYPE html><html><head><style>${CV_MARKDOWN_TABLE_CSS}
  .pdf-page{width:210mm;min-height:297mm;box-sizing:border-box;padding:15mm;background:#fff;margin:0 auto 12px;border:1px solid #ddd;}
  </style></head><body></body></html>`,
  )

  async function packInBrowser(markedInner: string) {
    // Use a string function body so tsx does not inject __name into page.evaluate.
    return page.evaluate(
      new Function(
        "args",
        `const { html, columnStyle, css } = args;
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
        const MM_TO_PX = 96 / 25.4;
        const maxH = (297 - 15 - 15) * MM_TO_PX;
        const contentWidth = "calc(210mm - 30mm)";
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;";
        const column = document.createElement("div");
        column.setAttribute("style", columnStyle + ";width:" + contentWidth + ";margin:0 auto;box-sizing:border-box;");
        column.innerHTML = html;
        host.appendChild(column);
        document.body.appendChild(host);
        const scratch = document.createElement("div");
        scratch.setAttribute("style", columnStyle + ";width:" + contentWidth + ";margin:0 auto;box-sizing:border-box;");
        document.body.appendChild(scratch);
        const measureEls = (els) => {
          scratch.replaceChildren(...els.map((b) => b.cloneNode(true)));
          return scratch.getBoundingClientRect().height;
        };
        const blocks = Array.from(column.querySelectorAll("[data-pdf-block]"));
        const pages = [];
        let current = [];
        let currentKinds = [];
        const pushBlock = (el, kind) => { current.push(el); currentKinds.push(kind); };
        const flushPage = (keepTitle) => {
          if (!current.length) return;
          let carryEl = null;
          let carryKind = null;
          if (keepTitle && currentKinds[currentKinds.length - 1] === "section-title" && current.length > 1) {
            carryEl = current.pop();
            carryKind = currentKinds.pop();
          }
          if (current.length === 1 && currentKinds[0] === "section-title") {
            if (carryEl) pushBlock(carryEl, carryKind);
            return;
          }
          if (current.length) pages.push(current);
          current = [];
          currentKinds = [];
          if (carryEl) pushBlock(carryEl, carryKind);
        };
        for (const el of blocks) {
          const kind = el.getAttribute("data-pdf-block") || "";
          if (current.length && measureEls(current.concat([el])) > maxH + 0.5) flushPage(true);
          pushBlock(el, kind);
        }
        flushPage(false);
        const finalPages = pages.filter((p) => p.length > 0);
        for (const pageBlocks of finalPages) {
          for (const b of pageBlocks) b.classList.remove("pdf-job-continuation--page-start");
          if (pageBlocks[0] && pageBlocks[0].classList.contains("pdf-job-continuation")) {
            pageBlocks[0].classList.add("pdf-job-continuation--page-start");
          }
        }
        let headerVisibleOnPage2 = null;
        if (finalPages.length > 1) {
          const first = finalPages[1][0];
          const thead = first ? first.querySelector("thead") : null;
          headerVisibleOnPage2 = thead ? getComputedStyle(thead).display !== "none" : false;
        }
        const page1TheadCount = finalPages[0]
          ? finalPages[0].filter((b) => {
              const thead = b.querySelector("thead");
              return thead && getComputedStyle(thead).display !== "none";
            }).length
          : 0;
        return {
          pageCount: finalPages.length,
          kinds: finalPages.map((p) => p.map((b) => b.getAttribute("data-pdf-block"))),
          hasTable: column.querySelectorAll("table.cv-md-table").length > 0,
          hasTh: column.querySelectorAll("th").length > 0,
          hasTd: column.querySelectorAll("td").length > 0,
          hasBorders: (column.querySelector("td")?.getAttribute("style") || "").includes("border-bottom:1px solid"),
          page1VisibleHeaderCount: page1TheadCount,
          headerVisibleOnPage2,
          sampleText: (column.textContent || "").includes("Criterion 1"),
        };`,
      ) as (args: {
        html: string
        columnStyle: string
        css: string
      }) => {
        pageCount: number
        kinds: (string | null)[][]
        hasTable: boolean
        hasTh: boolean
        hasTd: boolean
        hasBorders: boolean
        page1VisibleHeaderCount: number
        headerVisibleOnPage2: boolean | null
        sampleText: boolean
      },
      { html: markedInner, columnStyle, css: CV_MARKDOWN_TABLE_CSS },
    )
  }

  const single = await packInBrowser(short.html)
  await page.evaluate(() => {
    document.body.innerHTML = ""
  })
  const multi = await packInBrowser(longWithFiller.html)

  await browser.close()

  if (!single.hasTable || !single.hasTh || !single.hasTd || !single.sampleText) {
    throw new Error("single-page table markup missing semantic cells")
  }
  if (!single.hasBorders) {
    throw new Error("expected visible cell borders")
  }
  if (single.page1VisibleHeaderCount !== 1) {
    throw new Error(
      `expected exactly one visible header on page 1, got ${single.page1VisibleHeaderCount}`,
    )
  }
  if (single.pageCount !== 1) {
    throw new Error(`expected single-page table fit, got ${single.pageCount} pages`)
  }
  if (multi.pageCount < 2) {
    throw new Error(`expected multi-page table span, got ${multi.pageCount} pages`)
  }
  if (multi.headerVisibleOnPage2 !== true) {
    throw new Error("expected repeated header visible when table continues on page 2")
  }

  console.log("verify-markdown-table-pagination: ok")
  console.log(
    JSON.stringify(
      {
        singlePageCount: single.pageCount,
        multiPageCount: multi.pageCount,
        page1VisibleHeaderCount: single.page1VisibleHeaderCount,
        headerVisibleOnPage2: multi.headerVisibleOnPage2,
        hasBorders: single.hasBorders,
        shortChunks: short.chunkCount,
        longChunks: long.chunkCount,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
