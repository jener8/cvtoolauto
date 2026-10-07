/**
 * Smoke-test about:blank print CSS + fonts timeout + popup cleanup.
 * Mimics the Vercel preview fallback path (no Playwright server PDF).
 *
 * Run: npx tsx scripts/test-pdf-print-window.mjs
 */
import { chromium, webkit } from "playwright"

const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pdf-page {
    width: 210mm;
    height: auto;
    max-height: 297mm;
    box-sizing: border-box;
    padding: 15mm;
    margin: 0 auto;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
  }
  .pdf-page:last-child { page-break-after: auto; }
  .pdf-block-keep-together { break-inside: avoid; }
`

const SAMPLE_HTML = `
  <section class="pdf-page" data-auto-page="1">
    <div style="font-family: Inter, Arial, sans-serif; font-size: 13px; width: 100%; margin: 0; padding: 0;">
      <h1 style="margin:0 0 8px;font-size:22px;">Jennifer Simonds</h1>
      <h2 style="margin:12px 0 8px;font-size:14px;">EXPERIENCE</h2>
      <div data-pdf-block="job-head" class="pdf-resume-block pdf-block-keep-together">
        <p style="font-weight:700;margin:8px 0 4px;color:#0a6;">Product Designer</p>
        <p style="font-weight:700;margin:4px 0;">Anderson Eye Care</p>
        <p style="font-style:italic;margin:4px 0;color:#666;">2020 – Present</p>
        <ul style="margin:6px 0;padding:0;list-style:none;">
          <li style="margin:4px 0;padding-left:16px;position:relative;"><span style="position:absolute;left:0;">•</span>Led redesign of patient intake across web and clinic kiosks.</li>
          <li style="margin:4px 0;padding-left:16px;position:relative;"><span style="position:absolute;left:0;">•</span>Partnered with clinicians on accessibility and workflow fit.</li>
        </ul>
      </div>
    </div>
  </section>
`

const PRINT_BOOTSTRAP = `
  (function() {
    var closed = false;
    window.__closeCount = 0;
    function closeSelf() {
      if (closed) return;
      closed = true;
      window.__closeCount += 1;
      window.__closedAt = Date.now();
    }
    function raceFonts(ms) {
      if (!document.fonts || !document.fonts.ready) return Promise.resolve();
      return new Promise(function(resolve) {
        var done = false;
        var finish = function() { if (done) return; done = true; resolve(); };
        var t = setTimeout(finish, ms);
        document.fonts.ready.then(function() { clearTimeout(t); finish(); }, function() { clearTimeout(t); finish(); });
      });
    }
    window.addEventListener('afterprint', function() { setTimeout(closeSelf, 50); });
    window.__startPrint = function() {
      return raceFonts(3000).then(function() {
        window.__fontsReadyAt = Date.now();
        // Do not call window.print() in headless — just prove we proceed.
        setTimeout(closeSelf, 100);
      });
    };
  })();
`

async function runBrowser(type, name) {
  const browser = await type.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(`<!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
    <style>${PRINT_CSS}</style>
  </head><body>${SAMPLE_HTML}<script>${PRINT_BOOTSTRAP}</script></body></html>`)

  await page.waitForFunction(() => document.fonts?.status === "loaded" || true, null, {
    timeout: 5000,
  }).catch(() => {})

  const metrics = await page.evaluate(async () => {
    const pageEl = document.querySelector(".pdf-page")
    const style = getComputedStyle(pageEl)
    const rect = pageEl.getBoundingClientRect()
    const heading = document.querySelector("h2")
    const headingRect = heading.getBoundingClientRect()
    const bullet = document.querySelector("li")
    const bulletRect = bullet.getBoundingClientRect()
    const pageLeft = rect.left
    const padLeft = parseFloat(style.paddingLeft)
    const padRight = parseFloat(style.paddingRight)

    const t0 = Date.now()
    await window.__startPrint()
    // Wait until closeSelf ran
    await new Promise((r) => {
      const id = setInterval(() => {
        if (window.__closeCount > 0) {
          clearInterval(id)
          r()
        }
      }, 20)
      setTimeout(() => {
        clearInterval(id)
        r()
      }, 4000)
    })

    return {
      padLeft,
      padRight,
      headingOffsetFromPage: headingRect.left - pageLeft,
      bulletOffsetFromPage: bulletRect.left - pageLeft,
      closeCount: window.__closeCount,
      fontsLatencyMs: (window.__fontsReadyAt || 0) - t0,
      jobHeadBullets: document.querySelectorAll('[data-pdf-block="job-head"] li').length,
    }
  })

  await browser.close()

  const MM = 96 / 25.4
  const expectedPad = 15 * MM
  const padOk = Math.abs(metrics.padLeft - expectedPad) < 2 && Math.abs(metrics.padRight - expectedPad) < 2
  const leftInsetOk = metrics.headingOffsetFromPage > expectedPad - 2 && metrics.bulletOffsetFromPage > expectedPad - 2
  const cleanupOk = metrics.closeCount >= 1
  const fontsOk = metrics.fontsLatencyMs < 3500
  const keepOk = metrics.jobHeadBullets >= 2

  console.log(`[${name}] print-window metrics:`, {
    padLeftPx: metrics.padLeft.toFixed(1),
    padRightPx: metrics.padRight.toFixed(1),
    headingInsetPx: metrics.headingOffsetFromPage.toFixed(1),
    bulletInsetPx: metrics.bulletOffsetFromPage.toFixed(1),
    jobHeadBullets: metrics.jobHeadBullets,
    closeCount: metrics.closeCount,
    fontsLatencyMs: metrics.fontsLatencyMs,
  })

  if (!padOk) throw new Error(`[${name}] expected ~15mm padding on both sides`)
  if (!leftInsetOk) throw new Error(`[${name}] heading/bullets must be inset by left padding (not flush)`)
  if (!cleanupOk) throw new Error(`[${name}] print cleanup did not run`)
  if (!fontsOk) throw new Error(`[${name}] fonts wait exceeded timeout guard`)
  if (!keepOk) throw new Error(`[${name}] job-head must keep ≥2 bullets`)

  return { name, ...metrics }
}

async function main() {
  const browsers = [
    { type: chromium, name: "chromium" },
    { type: webkit, name: "webkit" },
  ]
  for (const { type, name } of browsers) {
    try {
      await runBrowser(type, name)
    } catch (err) {
      console.error(`[fail] ${name}:`, err.message || err)
      process.exit(1)
    }
  }
  console.log("test-pdf-print-window: ok")
}

main()
