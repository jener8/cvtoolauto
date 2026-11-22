/**
 * Run: npx tsx scripts/test-employment-duration.ts
 */
import assert from "node:assert/strict"
import {
  calculateEmploymentDurationMonths,
  dateTextAlreadyHasDuration,
  formatEmploymentDateWithDuration,
  formatEmploymentDurationLabel,
  monthsBetweenEmployment,
  parseEmploymentMonthToken,
  splitEmploymentDateRange,
} from "../lib/employment-duration"
import { normalizeContactInfo } from "../lib/contact-info"

const fixedNow = new Date(2026, 10, 22) // Nov 22, 2026

// --- labels ---
assert.equal(formatEmploymentDurationLabel(8), "8 months")
assert.equal(formatEmploymentDurationLabel(12), "1 year")
assert.equal(formatEmploymentDurationLabel(18), "1 year, 6 months")
assert.equal(formatEmploymentDurationLabel(36), "3 years")
assert.equal(formatEmploymentDurationLabel(88), "7 years, 4 months")
assert.equal(formatEmploymentDurationLabel(0), null)
assert.equal(formatEmploymentDurationLabel(12, "de"), "1 Jahr")
assert.equal(formatEmploymentDurationLabel(18, "de"), "1 Jahr, 6 Monate")
assert.equal(formatEmploymentDurationLabel(36, "de"), "3 Jahre")

// --- monthsBetween (no +1 inclusive) ---
assert.equal(
  monthsBetweenEmployment({ year: 2021, month: 1 }, { year: 2024, month: 2 }),
  37,
)
assert.equal(
  monthsBetweenEmployment({ year: 2023, month: 11 }, { year: 2026, month: 11 }),
  36,
)

// --- parse ---
assert.deepEqual(parseEmploymentMonthToken("January 2021"), { year: 2021, month: 1 })
assert.deepEqual(parseEmploymentMonthToken("Feb 2024"), { year: 2024, month: 2 })
assert.deepEqual(parseEmploymentMonthToken("März 2020"), { year: 2020, month: 3 })
assert.deepEqual(parseEmploymentMonthToken("01/2021"), { year: 2021, month: 1 })
assert.deepEqual(parseEmploymentMonthToken("2021-02"), { year: 2021, month: 2 })
assert.deepEqual(parseEmploymentMonthToken("2021"), { year: 2021, month: 1 })
assert.equal(parseEmploymentMonthToken("Present"), "present")
assert.equal(parseEmploymentMonthToken("Heute"), "present")
assert.equal(parseEmploymentMonthToken(""), null)
assert.equal(parseEmploymentMonthToken("sometime soon"), null)

// --- split ---
assert.deepEqual(splitEmploymentDateRange("January 2021 – February 2024"), {
  start: "January 2021",
  end: "February 2024",
})
assert.deepEqual(splitEmploymentDateRange("November 2023 - Present"), {
  start: "November 2023",
  end: "Present",
})
assert.equal(splitEmploymentDateRange("January 2021"), null)

// --- calculate + format EN ---
assert.equal(
  calculateEmploymentDurationMonths("January 2021 – February 2024", fixedNow),
  37,
)
assert.equal(
  formatEmploymentDateWithDuration("January 2021 – February 2024", {
    language: "en",
    now: fixedNow,
  }),
  "January 2021 – February 2024 (3 years, 1 month)",
)

assert.equal(
  formatEmploymentDateWithDuration("November 2023 – Present", {
    language: "en",
    now: fixedNow,
  }),
  "November 2023 – Present (3 years)",
)

assert.equal(
  formatEmploymentDateWithDuration("March 2024 – August 2024", {
    language: "en",
    now: fixedNow,
  }),
  "March 2024 – August 2024 (5 months)",
)

assert.equal(
  formatEmploymentDateWithDuration("January 2020 – January 2021", {
    language: "en",
    now: fixedNow,
  }),
  "January 2020 – January 2021 (1 year)",
)

// --- German ---
assert.equal(
  formatEmploymentDateWithDuration("Januar 2021 – Februar 2024", {
    language: "de",
    now: fixedNow,
  }),
  "Januar 2021 – Februar 2024 (3 Jahre, 1 Monat)",
)

assert.equal(
  formatEmploymentDateWithDuration("November 2023 – Heute", {
    language: "de",
    now: fixedNow,
  }),
  "November 2023 – Heute (3 Jahre)",
)

// --- already has duration: do not duplicate ---
assert.equal(
  dateTextAlreadyHasDuration("January 2021 – February 2024 (3 years, 1 month)"),
  true,
)
assert.equal(
  formatEmploymentDateWithDuration("January 2021 – February 2024 (3 years, 1 month)", {
    now: fixedNow,
  }),
  "January 2021 – February 2024 (3 years, 1 month)",
)

// --- missing / invalid ---
assert.equal(formatEmploymentDateWithDuration("", { now: fixedNow }), "")
assert.equal(
  formatEmploymentDateWithDuration("January 2021 – TBD", { now: fixedNow }),
  "January 2021 – TBD",
)
assert.equal(
  formatEmploymentDateWithDuration("not a date range", { now: fixedNow }),
  "not a date range",
)

// --- year-only convention ---
assert.equal(
  formatEmploymentDateWithDuration("2021 – 2024", { language: "en", now: fixedNow }),
  "2021 – 2024 (3 years)",
)

// --- setting default off ---
assert.equal(normalizeContactInfo(null).showEmploymentDuration, false)
assert.equal(normalizeContactInfo({}).showEmploymentDuration, false)
assert.equal(
  normalizeContactInfo({ showEmploymentDuration: true }).showEmploymentDuration,
  true,
)
assert.equal(
  normalizeContactInfo({ show_employment_duration: true } as Record<string, unknown>)
    .showEmploymentDuration,
  true,
)

console.log("test-employment-duration: ok")
