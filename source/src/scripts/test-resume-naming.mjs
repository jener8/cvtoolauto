/**
 * Run: node scripts/test-resume-naming.mjs
 */

function normalizeApplicationTitle(title) {
  return title.trim()
}

function parseVersionedResumeName(name) {
  const trimmed = name.trim()
  const match = trimmed.match(/^(.+?)\s+v(\d+)$/i)
  if (match?.[1] && match[2]) {
    const version = Number.parseInt(match[2], 10)
    if (Number.isFinite(version) && version >= 2) {
      return { base: match[1].trim(), version }
    }
  }
  return { base: trimmed, version: null }
}

function isAutoLinkedResumeName(resumeName, applicationTitle) {
  const title = normalizeApplicationTitle(applicationTitle)
  const current = resumeName.trim()
  if (!title) return !current
  if (!current) return true
  if (current === title) return true
  return parseVersionedResumeName(current).base === title
}

function nextApplicationResumeName(applicationTitle, versions) {
  const base = normalizeApplicationTitle(applicationTitle) || "Untitled Resume"
  const names = new Set(versions.map((v) => v.name.trim()))
  if (!names.has(base)) return base
  let version = 2
  while (names.has(`${base} v${version}`)) version++
  return `${base} v${version}`
}

function proposedResumeNameAfterTitleChange(newTitle, currentResumeName) {
  const newBase = normalizeApplicationTitle(newTitle)
  const { version } = parseVersionedResumeName(currentResumeName)
  if (version != null && version >= 2) return `${newBase} v${version}`
  return newBase
}

const cases = [
  {
    name: "base name when unused",
    run: () => nextApplicationResumeName("AI Design Leader", []) === "AI Design Leader",
  },
  {
    name: "v2 when base exists",
    run: () =>
      nextApplicationResumeName("AI Design Leader", [{ name: "AI Design Leader" }]) ===
      "AI Design Leader v2",
  },
  {
    name: "v3 when base and v2 exist",
    run: () =>
      nextApplicationResumeName("AI Design Leader", [
        { name: "AI Design Leader" },
        { name: "AI Design Leader v2" },
      ]) === "AI Design Leader v3",
  },
  {
    name: "auto-linked exact",
    run: () => isAutoLinkedResumeName("AI Design Leader", "AI Design Leader"),
  },
  {
    name: "auto-linked versioned",
    run: () => isAutoLinkedResumeName("AI Design Leader v2", "AI Design Leader"),
  },
  {
    name: "custom name not auto-linked",
    run: () => !isAutoLinkedResumeName("My bespoke CV", "AI Design Leader"),
  },
  {
    name: "title change keeps version suffix",
    run: () =>
      proposedResumeNameAfterTitleChange("AI Design Director", "AI Design Leader v2") ===
      "AI Design Director v2",
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  if (c.run()) {
    passed++
    console.log(`✓ ${c.name}`)
  } else {
    failed++
    console.error(`✗ ${c.name}`)
  }
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
