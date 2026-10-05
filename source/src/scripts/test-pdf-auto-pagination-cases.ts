/**
 * Runtime cases for PDF job splitting + page packing.
 * Invoked by test-pdf-auto-pagination.mjs via tsx.
 */
import assert from "node:assert/strict"
import {
  packPdfBlocks,
  pdfPageContentMaxHeightPx,
  splitEntryLinesIntoPdfChunks,
  type PdfPackBlock,
} from "../lib/pdf-auto-pagination"

const maxH = pdfPageContentMaxHeightPx()

function jobLines(bulletCount: number, title = "Engineer"): string[] {
  const lines = [`# ${title}`, "## Acme Corp", "### 2020 – Present"]
  for (let i = 1; i <= bulletCount; i++) {
    lines.push(`- Achievement bullet number ${i} with enough text to matter.`)
  }
  return lines
}

// --- splitEntryLinesIntoPdfChunks ---
{
  const four = splitEntryLinesIntoPdfChunks(jobLines(4))
  assert.equal(four.length, 1)
  assert.equal(four[0].kind, "job-head")
  assert.equal(four[0].continuation, false)

  const six = splitEntryLinesIntoPdfChunks(jobLines(6))
  assert.equal(six.length, 4)
  assert.equal(six[0].kind, "job-head")
  assert.equal(six[0].continuation, false)
  assert.equal(six[1].kind, "job-bullet")
  assert.equal(six[2].kind, "job-bullet")
  assert.equal(six[3].kind, "job-tail")
  assert.ok(six[1].continuation && six[2].continuation && six[3].continuation)

  const headBullets = six[0].lines.filter((l) => l.trim().startsWith("-"))
  const midBullets = [...six[1].lines, ...six[2].lines].filter((l) => l.trim().startsWith("-"))
  const tailBullets = six[3].lines.filter((l) => l.trim().startsWith("-"))
  assert.equal(headBullets.length, 2)
  assert.equal(midBullets.length, 2)
  assert.equal(tailBullets.length, 2)

  // Reconstruct: every original line appears exactly once, in order.
  const rebuilt = six.flatMap((c) => c.lines)
  assert.deepEqual(rebuilt, jobLines(6))
}

// --- Scenario: ~35% space left on page 1, next job has 6 bullets ---
{
  const HEADER = 90
  const SECTION = 40
  // Tall bullets so a full 6-bullet job exceeds ~35% of the page,
  // while job-head (header + 2 bullets) still fits.
  const JOB_HEAD = 160
  const BULLET = 70
  const JOB_TAIL = 140

  // Fill page 1 to ~65% used → ~35% remaining.
  const fillTarget = maxH * 0.65
  const filler: PdfPackBlock[] = [
    { kind: "header", height: HEADER },
    { kind: "section-title", height: SECTION },
  ]
  let used = HEADER + SECTION
  let n = 0
  while (used + 80 < fillTarget) {
    filler.push({ kind: "job-head", height: 80 })
    used += 80
    n += 1
  }
  assert.ok(n >= 1, "expected filler jobs on page 1")

  const remainingBeforeTallJob = maxH - used
  assert.ok(
    remainingBeforeTallJob > maxH * 0.25 && remainingBeforeTallJob < maxH * 0.45,
    `expected ~35% remaining, got ${((remainingBeforeTallJob / maxH) * 100).toFixed(1)}%`,
  )

  // BEFORE (atomic whole job): 6-bullet job taller than remaining → jumps to page 2.
  const atomicJobHeight = JOB_HEAD + BULLET * 2 + JOB_TAIL
  assert.ok(
    atomicJobHeight > remainingBeforeTallJob,
    `atomic job (${atomicJobHeight}) must not fit remaining (${remainingBeforeTallJob.toFixed(0)})`,
  )
  const before = packPdfBlocks(
    [...filler, { kind: "job", height: atomicJobHeight }],
    maxH,
  )
  assert.equal(before.pages.length, 2)
  assert.ok(
    before.pageUsedHeights[0] < maxH * 0.85,
    "before: page 1 left largely empty after atomic push",
  )

  // AFTER (split): head + as many bullets as fit stay on page 1; rest on page 2.
  const afterBlocks: PdfPackBlock[] = [
    ...filler,
    { kind: "job-head", height: JOB_HEAD },
    { kind: "job-bullet", height: BULLET },
    { kind: "job-bullet", height: BULLET },
    { kind: "job-tail", height: JOB_TAIL },
  ]
  assert.ok(JOB_HEAD <= remainingBeforeTallJob, "job-head (2 bullets) must fit remaining ~35%")

  const after = packPdfBlocks(afterBlocks, maxH)
  assert.ok(after.pages.length >= 2, "split job should span pages")

  const page1Kinds = after.pages[0].map((i) => afterBlocks[i].kind)
  const page2Kinds = after.pages[1].map((i) => afterBlocks[i].kind)

  assert.ok(page1Kinds.includes("job-head"), "page 1 keeps job-head")
  // With ~35% left, at least job-head fits; preferably one more chunk too.
  assert.ok(
    page1Kinds.includes("job-head") &&
      (page1Kinds.includes("job-bullet") || page1Kinds.includes("job-tail") || JOB_HEAD + BULLET > remainingBeforeTallJob),
    "page 1 should keep job-head and as many following chunks as fit",
  )

  // Page 2 never starts with / consists of a single stray bullet.
  assert.ok(
    page2Kinds[0] === "job-bullet" || page2Kinds[0] === "job-tail",
    `page 2 should continue the job, got ${page2Kinds[0]}`,
  )
  assert.ok(
    !(page2Kinds.length === 1 && page2Kinds[0] === "job-bullet"),
    "page 2 must never be a single stray job-bullet",
  )

  // Page fill: non-final pages (without manual break) should not waste >15% height.
  for (let pi = 0; pi < after.pageUsedHeights.length - 1; pi++) {
    const unusedRatio = 1 - after.pageUsedHeights[pi] / maxH
    assert.ok(
      unusedRatio <= 0.15 + 0.001,
      `page ${pi + 1} unused ${(unusedRatio * 100).toFixed(1)}% exceeds 15%`,
    )
  }
}

// --- Before/after page counts for a 6-job CV ---
{
  const jobs = 6
  const bulletsPerJob = 6
  const headerH = 120
  const sectionH = 40
  // Atomic jobs ~450px: only one fits after the header on page 1 (~37% blank).
  const headH = 180
  const bulletH = 70
  const tailH = 130
  const wholeJobH = headH + bulletH * 2 + tailH
  assert.equal(wholeJobH, 450)

  const atomicBlocks: PdfPackBlock[] = [
    { kind: "header", height: headerH },
    { kind: "section-title", height: sectionH },
  ]
  for (let j = 0; j < jobs; j++) {
    atomicBlocks.push({ kind: "job", height: wholeJobH })
  }

  const splitBlocks: PdfPackBlock[] = [
    { kind: "header", height: headerH },
    { kind: "section-title", height: sectionH },
  ]
  for (let j = 0; j < jobs; j++) {
    splitBlocks.push({ kind: "job-head", height: headH })
    for (let b = 0; b < bulletsPerJob - 4; b++) {
      splitBlocks.push({ kind: "job-bullet", height: bulletH })
    }
    splitBlocks.push({ kind: "job-tail", height: tailH })
  }

  const before = packPdfBlocks(atomicBlocks, maxH)
  const after = packPdfBlocks(splitBlocks, maxH)

  const beforeP1Unused = 1 - before.pageUsedHeights[0] / maxH
  const afterP1Unused = 1 - after.pageUsedHeights[0] / maxH

  console.log(
    `6-job CV page counts: before(atomic)=${before.pages.length} after(split)=${after.pages.length}`,
  )
  console.log(
    `6-job CV page-1 unused: before=${(beforeP1Unused * 100).toFixed(1)}% after=${(afterP1Unused * 100).toFixed(1)}%`,
  )

  assert.ok(beforeP1Unused > 0.15, "atomic packing should leave >15% blank on page 1")
  assert.ok(afterP1Unused <= 0.15 + 0.001, "split packing should fill page 1 within 15% unused")

  for (let pi = 0; pi < after.pageUsedHeights.length - 1; pi++) {
    const unusedRatio = 1 - after.pageUsedHeights[pi] / maxH
    assert.ok(
      unusedRatio <= 0.15 + 0.001,
      `6-job CV page ${pi + 1} unused ${(unusedRatio * 100).toFixed(1)}% exceeds 15%`,
    )
  }

  assert.ok(
    after.pages.length <= before.pages.length,
    `split should not increase pages (before=${before.pages.length}, after=${after.pages.length})`,
  )
}

// --- Manual page break still flushes ---
{
  const r = packPdfBlocks(
    [
      { kind: "header", height: 50 },
      { kind: "manual-page-break-preference", height: 0 },
      { kind: "job-head", height: 50 },
    ],
    maxH,
  )
  assert.equal(r.pages.length, 2)
}

// --- Section title not orphaned ---
{
  const almostFull = maxH - 30
  const blocks: PdfPackBlock[] = [
    { kind: "header", height: almostFull },
    { kind: "section-title", height: 40 },
    { kind: "job-head", height: 120 },
  ]
  const r = packPdfBlocks(blocks, maxH)
  assert.ok(r.pages.length >= 2)
  const titlePage = r.pages.find((page) => page.some((i) => blocks[i].kind === "section-title"))
  assert.ok(titlePage, "section-title must appear on some page")
  assert.ok(
    titlePage!.some((i) => blocks[i].kind === "job-head"),
    "section-title must share a page with following content",
  )
  assert.ok(
    !(r.pages[0].length === 1 && blocks[r.pages[0][0]].kind === "section-title"),
    "page must not be only a section-title",
  )
}

console.log("test-pdf-auto-pagination-cases: ok")
