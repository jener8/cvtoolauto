import type { CvEditRiskAssessment } from "@/lib/cv-edit-types"

function extractTitleLines(cv: string): string[] {
  return cv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("# ") && !l.startsWith("## "))
    .map((l) => l.slice(2).trim())
}

function extractDateLines(cv: string): string[] {
  return cv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("### "))
    .map((l) => l.slice(4).trim())
}

function bulletLines(cv: string): string[] {
  return cv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
}

function newBullets(before: string, after: string): string[] {
  const beforeSet = new Set(bulletLines(before).map((b) => b.toLowerCase()))
  return bulletLines(after).filter((b) => !beforeSet.has(b.toLowerCase()))
}

function removedRatio(before: string, after: string): number {
  const b = before.trim().length
  const a = after.trim().length
  if (b === 0) return 0
  return Math.max(0, (b - a) / b)
}

const RISKY_INSTRUCTION =
  /delete (a |the )?(whole |entire )?section|remove (a |the )?(whole |entire )?section|change (my |the )?job title|change (my |the )?dates?|rewrite (the )?(whole|entire) cv|translate (the )?(whole|entire)|switch to (german|english)|change language/i

export function assessEditRisk(
  before: string,
  after: string,
  instruction: string,
): CvEditRiskAssessment {
  const reasons: string[] = []

  if (RISKY_INSTRUCTION.test(instruction)) {
    reasons.push("Your request may change structural CV facts (sections, titles, or dates).")
  }

  if (removedRatio(before, after) > 0.25) {
    reasons.push("A large portion of the CV text was removed.")
  }

  const beforeTitles = extractTitleLines(before)
  const afterTitles = extractTitleLines(after)
  const titleChanges = afterTitles.filter((t, i) => beforeTitles[i] && beforeTitles[i] !== t)
  if (titleChanges.length > 0) {
    reasons.push("One or more job titles (# lines) were changed.")
  }

  const beforeDates = extractDateLines(before)
  const afterDates = extractDateLines(after)
  const dateChanges = afterDates.filter((d, i) => beforeDates[i] && beforeDates[i] !== d)
  if (dateChanges.length > 0) {
    reasons.push("One or more date ranges (### lines) were changed.")
  }

  const added = newBullets(before, after)
  if (added.length >= 4) {
    reasons.push("Several new achievement bullets were added — review for factual accuracy.")
  }

  const beforeSections = before.split("\n").filter((l) => /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&().-]{2,}$/.test(l.trim()))
  const afterSections = after.split("\n").filter((l) => /^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&().-]{2,}$/.test(l.trim()))
  if (beforeSections.length - afterSections.length >= 2) {
    reasons.push("One or more CV sections may have been removed.")
  }

  return {
    isRisky: reasons.length > 0,
    reasons,
  }
}

export function isSafeAutoApplyInstruction(instruction: string): boolean {
  const m = instruction.toLowerCase().trim()
  return /tailor|stronger|more senior|more strategic|more relevant|shorter|ats|leadership focus|ai focus|rewrite selected|match|align|emphasize|keyword/.test(
    m,
  )
}
