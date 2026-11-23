/**
 * Profile-enhanced + Modern Spacious headers must stay compact.
 * Executive Compact sizes are unchanged.
 * Run: npx tsx scripts/test-cv-header-compact.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const src = readFileSync(
  join(__dirname, "../components/resume-preview.tsx"),
  "utf8",
)

// Extract the three human-format header blocks by markers
const profileIdx = src.indexOf("FORMAT 1: PROFILE-ENHANCED")
const execIdx = src.indexOf("FORMAT 2: EXECUTIVE COMPACT")
const modernIdx = src.indexOf("FORMAT 3: MODERN SPACIOUS")
assert.ok(profileIdx > 0 && execIdx > profileIdx && modernIdx > execIdx)

const profileBlock = src.slice(profileIdx, execIdx)
const execBlock = src.slice(execIdx, modernIdx)
const modernBlock = src.slice(modernIdx, modernIdx + 4500)

// Profile-enhanced: compact photo + name
assert.match(profileBlock, /profileImageSize = 70/)
assert.match(profileBlock, /nameFontSize = 26/)
assert.match(profileBlock, /contactFontSize = 9\.5/)
assert.match(profileBlock, /data-cv-header="profile-enhanced"/)
assert.match(profileBlock, /max-height: 34mm/)
assert.match(profileBlock, /data-profile-summary="1"/)
assert.match(profileBlock, /wrapPdfBlock\("profile-summary"/)
assert.doesNotMatch(profileBlock, /profileImageSize = 124/)
assert.doesNotMatch(profileBlock, /nameFontSize = 32/)

// Executive Compact: unchanged dense header
assert.match(execBlock, /sizePx: 60/)
assert.match(execBlock, /font-size: 28px/)
assert.match(execBlock, /text-transform: uppercase/)

// Modern Spacious: compact horizontal header, not 120/42 stacked
assert.match(modernBlock, /sizePx: 72/)
assert.match(modernBlock, /font-size: 28px/)
assert.match(modernBlock, /font-weight: 500/)
assert.match(modernBlock, /data-cv-header="modern-spacious"/)
assert.match(modernBlock, /max-height: 34mm/)
assert.match(modernBlock, /font-size: 9\.5px/)
assert.doesNotMatch(modernBlock, /sizePx: 120/)
assert.doesNotMatch(modernBlock, /font-size: 42px/)
assert.doesNotMatch(modernBlock, /border-bottom: 4px solid/)

console.log("test-cv-header-compact: ok")
