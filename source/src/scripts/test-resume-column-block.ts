import assert from "node:assert/strict"
import {
  isColumnBlockMarkerLine,
  splitLinesByColumnBlocks,
} from "@/lib/resume-column-block"

const block = `[columns=2]
# Left heading
- Left bullet
[column]
# Right heading
- Right bullet
[/columns]`

const segments = splitLinesByColumnBlocks(block.split("\n"))
assert.equal(segments.length, 1)
assert.equal(segments[0].type, "column-block")
if (segments[0].type !== "column-block") throw new Error("expected column block")

assert.equal(segments[0].columns, 2)
assert.equal(segments[0].columnLines[0].length, 2)
assert.equal(segments[0].columnLines[1].length, 2)
assert.match(segments[0].columnLines[0][0], /Left heading/)
assert.match(segments[0].columnLines[1][0], /Right heading/)

const mixed = `Intro line
[columns=2]
- Alpha
[column]
- Beta
[/columns]
Tail line`

const mixedSegments = splitLinesByColumnBlocks(mixed.split("\n"))
assert.equal(mixedSegments.length, 3)
assert.equal(mixedSegments[0].type, "lines")
assert.equal(mixedSegments[1].type, "column-block")
assert.equal(mixedSegments[2].type, "lines")

assert.equal(isColumnBlockMarkerLine("[columns=2]"), true)
assert.equal(isColumnBlockMarkerLine("[column]"), true)
assert.equal(isColumnBlockMarkerLine("[/columns]"), true)
assert.equal(isColumnBlockMarkerLine("- Normal bullet"), false)

console.log("test-resume-column-block: ok")
