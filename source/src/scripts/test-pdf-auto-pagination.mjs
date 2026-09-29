/**
 * Manual page-break markers must always flush the current page (no min-fill gate).
 * Run: node scripts/test-pdf-auto-pagination.mjs
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, "../lib/pdf-auto-pagination"), "utf8")

if (/minFillBeforeBreak/.test(source)) {
  console.error("pdf-auto-pagination still contains minFillBeforeBreak gate")
  process.exit(1)
}

if (!/flushPage\(true\)/.test(source) || !/MANUAL_PAGE_BREAK_BLOCK_KIND/.test(source)) {
  console.error("pdf-auto-pagination missing unconditional manual page-break flush")
  process.exit(1)
}

console.log("test-pdf-auto-pagination: ok")
