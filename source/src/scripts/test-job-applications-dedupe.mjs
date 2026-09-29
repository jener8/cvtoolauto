/**
 * Run: node scripts/test-job-applications-dedupe.mjs
 *
 * Verifies dedupe helpers tolerate mixed legacy application shapes.
 */

function normalizeMatchText(value) {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeAppliedTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

function buildApplicationMatchKey(input) {
  const applied = normalizeAppliedTimestamp(input.appliedDate ?? input.lastModified)
  const day = new Date(applied)
  const dayKey = Number.isNaN(day.getTime())
    ? "unknown-day"
    : `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`
  return [
    typeof input.folderId === "string" ? input.folderId : "",
    normalizeMatchText(input.company ?? input.role),
    normalizeMatchText(input.jobTitle ?? input.title),
    dayKey,
  ].join("|")
}

function legacyApp(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    folderId: "folder-1",
    role: "Engineer",
    title: "Senior Engineer",
    appliedDate: Date.parse("2026-01-15"),
    ...overrides,
  }
}

let passed = 0
let failed = 0

function check(name, run) {
  try {
    if (run()) {
      passed++
      console.log(`✓ ${name}`)
    } else {
      failed++
      console.error(`✗ ${name}`)
    }
  } catch (error) {
    failed++
    console.error(`✗ ${name}`, error)
  }
}

check("missing fields do not throw", () => {
  buildApplicationMatchKey({
    folderId: "folder-1",
    company: undefined,
    jobTitle: null,
    role: undefined,
    appliedDate: undefined,
    lastModified: undefined,
  })
  return true
})

check("legacy role/title normalize into match key", () => {
  const key = buildApplicationMatchKey({
    folderId: "folder-1",
    role: "Acme",
    title: "Role",
    appliedDate: Date.parse("2026-03-01"),
  })
  return key.includes("acme") && key.includes("role")
})

check("undefined company and jobTitle produce stable keys", () => {
  const a = buildApplicationMatchKey({ folderId: "f", company: undefined, jobTitle: undefined })
  const b = buildApplicationMatchKey({ folderId: "f", company: null, jobTitle: null })
  return a === b
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
