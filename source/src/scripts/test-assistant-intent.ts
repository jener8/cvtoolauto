import assert from "node:assert/strict"
import { resolveAssistantSelectionForDocument } from "../lib/assistant-selection-context"
import { classifyAssistantIntent } from "../lib/unified-assistant/intent"

const coverLetter =
  "Dear Sir or Madam,\n\nI am applying for the Principal Product Designer role at Zalando.\n\nThe lifestyle e-commerce space aligns with my expertise."

assert.equal(
  classifyAssistantIntent("make this shorter", null, "cover_letter"),
  "cover_letter_edit",
)

assert.equal(
  classifyAssistantIntent(
    "tailor this paragraph",
    { source: "resume", text: "lifestyle e-commerce space aligns with my expertise", capturedAt: 1 },
    "cover_letter",
  ),
  "cover_letter_edit",
)

const resolved = resolveAssistantSelectionForDocument(
  { source: "resume", text: "lifestyle e-commerce space aligns with my expertise", capturedAt: 1 },
  "cover_letter",
  coverLetter,
)
assert.equal(resolved?.source, "cover_letter")

const stale = resolveAssistantSelectionForDocument(
  { source: "resume", text: "Senior User Experience Specialist", capturedAt: 1 },
  "cover_letter",
  coverLetter,
)
assert.equal(stale, null)

console.log("test-assistant-intent: ok")
