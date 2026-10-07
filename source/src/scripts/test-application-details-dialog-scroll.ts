/**
 * Source invariants for application details dialog scroll/close UX.
 * Run from source/src: npx tsx scripts/test-application-details-dialog-scroll.ts
 *
 * Manual check: open a long application details dialog, hover pipeline outcomes,
 * scroll with trackpad/wheel (panel should move), then dismiss via X / Escape / backdrop.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dialogPath = join(root, "components/application-details-dialog.tsx")
const uiDialogPath = join(root, "components/ui/dialog.tsx")

const dialogSrc = readFileSync(dialogPath, "utf8")
const uiDialogSrc = readFileSync(uiDialogPath, "utf8")

assert.equal(
  dialogSrc.includes('from "@/components/ui/scroll-area"'),
  false,
  "application-details-dialog must not use Radix ScrollArea (wheel scroll trap)",
)
assert.match(
  dialogSrc,
  /overflow-y-auto overscroll-contain/,
  "dialog body must use native overflow-y-auto overscroll-contain",
)
assert.equal(
  dialogSrc.includes("max-h-[min(70vh,36rem)] overflow-y-auto"),
  false,
  "job description must not nest a tall overflow-y-auto scroll trap",
)
assert.match(
  dialogSrc,
  /pr-14/,
  "header must reserve space so status badge does not cover the close control",
)

assert.match(
  uiDialogSrc,
  /data-slot="dialog-close"[\s\S]*size-10/,
  "DialogClose must expose a larger hit target (size-10)",
)

console.log("application-details-dialog scroll/close UX invariants OK")
