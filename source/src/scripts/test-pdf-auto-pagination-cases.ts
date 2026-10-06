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

// --- splitEntryLinesIntoPdfChunks: header + first bullet, then one block per bullet ---
{
  const one = splitEntryLinesIntoPdfChunks(jobLines(1))
  assert.equal(one.length, 1)
  assert.equal(one[0].kind, "job-head")

  const six = splitEntryLinesIntoPdfChunks(jobLines(6))
  assert.equal(six.length, 6) // head + 5 following bullets
  assert.equal(six[0].kind, "job-head")
  assert.equal(six[0].continuation, false)
  assert.equal(six[0].lines.filter((l) => l.trim().startsWith("-")).length, 1)
  for (let i = 1; i < six.length; i++) {
    assert.equal(six[i].kind, "job-bullet")
    assert.equal(six[i].continuation, true)
    assert.equal(six[i].lines.filter((l) => l.trim().startsWith("-")).length, 1)
  }
  assert.deepEqual(six.flatMap((c) => c.lines), jobLines(6))
}

// --- Scenario: ~35% space left; next job has 6 bullets → head (+ as many bullets as fit) stay ---
{
  const HEADER = 90
  const SECTION = 40
  const JOB_HEAD = 120 // title+company+date + 1 bullet
  const BULLET = 70

  const fillTarget = maxH * 0.65
  const filler: PdfPackBlock[] = [
    { kind: "header", height: HEADER },
    { kind: "section-title", height: SECTION },
  ]
  let used = HEADER + SECTION
  while (used + 80 < fillTarget) {
    filler.push({ kind: "job-head", height: 80 })
    used += 80
  }

  const remaining = maxH - used
  assert.ok(remaining > maxH * 0.25 && remaining < maxH * 0.45)

  const atomicH = JOB_HEAD + BULLET * 5
  assert.ok(atomicH > remaining, `atomic ${atomicH} must exceed remaining ${remaining.toFixed(0)}`)

  const before = packPdfBlocks([...filler, { kind: "job", height: atomicH }], maxH)
  assert.ok(before.pages.length >= 2)
  assert.ok(before.pageUsedHeights[0] < maxH * 0.85)

  const afterBlocks: PdfPackBlock[] = [
    ...filler,
    { kind: "job-head", height: JOB_HEAD },
    ...Array.from({ length: 5 }, () => ({ kind: "job-bullet", height: BULLET })),
  ]
  assert.ok(JOB_HEAD <= remaining, "job-head (header + first bullet) must fit ~35% remainder")

  const after = packPdfBlocks(afterBlocks, maxH)
  assert.ok(after.pages.length >= 2)
  const page1Kinds = after.pages[0].map((i) => afterBlocks[i].kind)
  assert.ok(page1Kinds.includes("job-head"), "page 1 keeps job-head")

  for (let pi = 0; pi < after.pageUsedHeights.length - 1; pi++) {
    const unused = 1 - after.pageUsedHeights[pi] / maxH
    assert.ok(unused <= 0.2 + 0.001, `page ${pi + 1} unused ${(unused * 100).toFixed(1)}% > 20%`)
  }
}

// --- 6-job CV: split fills page 1 better than atomic ---
{
  const jobs = 6
  const headerH = 120
  const sectionH = 40
  // Whole job ~480px: only one fits after header on page 1 (~35%+ blank).
  const headH = 160
  const bulletH = 64
  const bulletsAfterHead = 5
  const wholeJobH = headH + bulletH * bulletsAfterHead
  assert.equal(wholeJobH, 480)

  const atomicBlocks: PdfPackBlock[] = [
    { kind: "header", height: headerH },
    { kind: "section-title", height: sectionH },
  ]
  for (let j = 0; j < jobs; j++) atomicBlocks.push({ kind: "job", height: wholeJobH })

  const splitBlocks: PdfPackBlock[] = [
    { kind: "header", height: headerH },
    { kind: "section-title", height: sectionH },
  ]
  for (let j = 0; j < jobs; j++) {
    splitBlocks.push({ kind: "job-head", height: headH })
    for (let b = 0; b < bulletsAfterHead; b++) {
      splitBlocks.push({ kind: "job-bullet", height: bulletH })
    }
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

  assert.ok(beforeP1Unused > 0.15, "atomic should leave >15% blank on page 1")
  assert.ok(afterP1Unused < beforeP1Unused, "split should fill page 1 better")
  assert.ok(after.pages.length <= before.pages.length)
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
  const titlePage = r.pages.find((page) => page.some((i) => blocks[i].kind === "section-title"))
  assert.ok(titlePage)
  assert.ok(titlePage!.some((i) => blocks[i].kind === "job-head"))
}

// --- Content max height uses 15mm + 15mm margins ---
{
  const expected = ((297 - 15 - 15) * 96) / 25.4
  assert.ok(Math.abs(maxH - expected) < 0.5, `maxH ${maxH} vs expected ${expected}`)
}

console.log("test-pdf-auto-pagination-cases: ok")
