/**
 * PDF auto-pagination: manual breaks, job head/bullet/tail splitting, page fill.
 * Run: node scripts/test-pdf-auto-pagination.mjs
 * Logic cases: npx tsx scripts/test-pdf-auto-pagination-cases.ts
 */
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const paginationSource = readFileSync(join(root, "lib/pdf-auto-pagination.ts"), "utf8")
const previewSource = readFileSync(join(root, "components/resume-preview.tsx"), "utf8")
const cssSource = readFileSync(join(root, "app/globals.css"), "utf8")

function assert(cond, msg) {
  if (!cond) {
    console.error(msg)
    process.exit(1)
  }
}

if (/minFillBeforeBreak/.test(paginationSource)) {
  console.error("pdf-auto-pagination still contains minFillBeforeBreak gate")
  process.exit(1)
}

assert(
  /flushPage\(true\)/.test(paginationSource) || /kind === MANUAL_PAGE_BREAK_BLOCK_KIND/.test(paginationSource),
  "pdf-auto-pagination missing unconditional manual page-break flush",
)
assert(/MANUAL_PAGE_BREAK_BLOCK_KIND/.test(paginationSource), "missing MANUAL_PAGE_BREAK_BLOCK_KIND")
assert(/splitEntryLinesIntoPdfChunks/.test(paginationSource), "missing splitEntryLinesIntoPdfChunks")
assert(/packPdfBlocks/.test(paginationSource), "missing packPdfBlocks")
assert(/"job-head"/.test(paginationSource) && /"job-tail"/.test(paginationSource), "missing job-head/job-tail kinds")

assert(
  /PDF_KEEP_TOGETHER_BLOCKS = new Set\(\[[\s\S]*?"job-head"[\s\S]*?"job-tail"/.test(previewSource),
  "PDF_KEEP_TOGETHER_BLOCKS must include job-head and job-tail",
)
{
  const keepSet = previewSource.match(/PDF_KEEP_TOGETHER_BLOCKS = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? ""
  assert(!/\b"job"\b/.test(keepSet), 'PDF_KEEP_TOGETHER_BLOCKS must not include atomic "job"')
  assert(/experience-start/.test(keepSet) && /skills-tools-grid/.test(keepSet), "keep experience-start and skills-tools-grid")
}
assert(/pdf-job-continuation/.test(previewSource), "resume-preview must emit pdf-job-continuation")
assert(/pdf-job-continuation/.test(cssSource), "globals.css must style pdf-job-continuation")
assert(/splitEntryLinesIntoPdfChunks/.test(previewSource), "resume-preview must use splitEntryLinesIntoPdfChunks")

const cases = spawnSync(
  "npx",
  ["tsx", join(here, "test-pdf-auto-pagination-cases.ts")],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
)

if (cases.status !== 0) {
  console.error(cases.stdout || "")
  console.error(cases.stderr || "")
  console.error("test-pdf-auto-pagination-cases.ts failed")
  process.exit(cases.status || 1)
}

process.stdout.write(cases.stdout || "")
console.log("test-pdf-auto-pagination: ok")
