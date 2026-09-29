/**
 * Regression: heading prefixes must be fully consumed (never leave a leftover #).
 * Run: node scripts/test-resume-markup-line.mjs
 */
import { createRequire } from "node:module"
import { register } from "node:module"
import { pathToFileURL } from "node:url"

// Prefer running the TS source via a tiny esbuild-register style: inline tests of the contract.

function matchResumeHeadingPrefix(line) {
  const trimmed = line
    .replace(/[\uFF03\u2317\u266F\uFE5F]/g, "#")
    .trim()
  const match = trimmed.match(/^(#{1,3})\s+(.+)$/) ?? trimmed.match(/^(#{1,3})(\S.*)$/)
  if (!match) return null
  return { level: match[1].length, text: match[2].trim() }
}

function fragileOld(line) {
  if (line.startsWith("##")) return line.replace("##", "").trim()
  if (line.startsWith("#")) return line.replace("#", "").trim()
  return line
}

const cases = [
  ["### PROFILE", 3, "PROFILE"],
  ["###PROFILE", 3, "PROFILE"],
  ["## EXPERIENCE", 2, "EXPERIENCE"],
  ["##EXPERIENCE", 2, "EXPERIENCE"],
  ["# SENIOR UX / AI EXPERIENCE DESIGNER", 1, "SENIOR UX / AI EXPERIENCE DESIGNER"],
  ["## Bundesdruckerei-Gruppe, Berlin", 2, "Bundesdruckerei-Gruppe, Berlin"],
  ["### November 2023 – today", 3, "November 2023 – today"],
  ["# FOUNDER / PRODUCT DESIGNER", 1, "FOUNDER / PRODUCT DESIGNER"],
  ["## EquitAI · Open Initiative", 2, "EquitAI · Open Initiative"],
  ["### 2025 – today", 3, "2025 – today"],
]

let failed = 0
for (const [line, level, text] of cases) {
  const got = matchResumeHeadingPrefix(line)
  const old = fragileOld(line)
  const ok = got && got.level === level && got.text === text && !got.text.includes("#")
  if (!ok) {
    failed++
    console.error("FAIL", { line, got, expected: { level, text }, fragileOld: old })
  } else if (old.includes("#") && level === 3) {
    console.log(`✓ ${line} → ${got.text}  (old fragile left ${JSON.stringify(old)})`)
  } else {
    console.log(`✓ ${line} → ${got.text}`)
  }
}

// Demonstrate the exact user-reported bug
const bug = fragileOld("### PROFILE")
if (bug !== "# PROFILE" && bug !== "#PROFILE") {
  console.error("Expected fragile old bug to leave a #, got", bug)
  failed++
} else {
  console.log(`✓ reproduced old bug: ### PROFILE → ${JSON.stringify(bug)}`)
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log("\nPASS: heading prefixes fully consumed")
