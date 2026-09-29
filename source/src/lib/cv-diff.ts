import type { CvEditChange, CvEditChangeType } from "@/lib/cv-edit-types"

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, " ")
}

function sectionForLine(line: string, currentSection: string): string {
  const trimmed = line.trim()
  if (!trimmed) return currentSection
  if (/^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&().-]{2,}$/.test(trimmed) && !trimmed.startsWith("#")) {
    return trimmed
  }
  if (trimmed.startsWith("## ")) {
    return trimmed.slice(3).trim()
  }
  if (trimmed.startsWith("# ")) {
    return trimmed.slice(2).trim()
  }
  return currentSection
}

function lineKey(line: string): string {
  const t = line.trim()
  if (t.startsWith("- ")) return `bullet:${normalizeLine(t.slice(2))}`
  if (t.startsWith("### ")) return `date:${normalizeLine(t.slice(4))}`
  if (t.startsWith("## ")) return `company:${normalizeLine(t.slice(3))}`
  if (t.startsWith("# ")) return `title:${normalizeLine(t.slice(2))}`
  if (/^[A-ZÄÖÜ][A-ZÄÖÜ0-9\s/&().-]{2,}$/.test(t)) return `section:${normalizeLine(t)}`
  return `line:${normalizeLine(t)}`
}

export function computeCvDiff(before: string, after: string): CvEditChange[] {
  const beforeLines = before.split("\n")
  const afterLines = after.split("\n")

  const beforeMap = new Map<string, { line: string; section: string }>()
  let section = "PROFILE"
  for (const line of beforeLines) {
    section = sectionForLine(line, section)
    const key = lineKey(line)
    if (line.trim()) beforeMap.set(key, { line: line.trim(), section })
  }

  const afterMap = new Map<string, { line: string; section: string }>()
  section = "PROFILE"
  for (const line of afterLines) {
    section = sectionForLine(line, section)
    const key = lineKey(line)
    if (line.trim()) afterMap.set(key, { line: line.trim(), section })
  }

  const changes: CvEditChange[] = []
  const seen = new Set<string>()

  for (const [key, meta] of afterMap) {
    if (!beforeMap.has(key)) {
      const type: CvEditChangeType = key.startsWith("bullet:") ? "added" : "updated"
      changes.push({
        section: meta.section,
        type,
        after: meta.line,
        description: describeChange(type, meta.line),
      })
      seen.add(key)
    }
  }

  for (const [key, meta] of beforeMap) {
    if (!afterMap.has(key)) {
      changes.push({
        section: meta.section,
        type: "removed",
        before: meta.line,
        description: describeChange("removed", meta.line),
      })
      seen.add(key)
    }
  }

  // Pair similar updated bullets in same section
  const updated = changes.filter((c) => c.type === "updated" && c.after?.startsWith("- "))
  for (const change of updated) {
    const sectionBullets = [...beforeMap.entries()].filter(
      ([, m]) => m.section === change.section && m.line.startsWith("- "),
    )
    const afterNorm = normalizeLine(change.after ?? "")
    const match = sectionBullets.find(([, m]) => {
      const bNorm = normalizeLine(m.line.slice(2))
      return (
        bNorm.slice(0, 24) === afterNorm.slice(0, 24) ||
        wordOverlap(bNorm, afterNorm) > 0.35
      )
    })
    if (match) {
      change.type = "updated"
      change.before = match[1].line
      change.description = describeSectionUpdate(change.section, change.before, change.after)
    }
  }

  return changes.slice(0, 20)
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wb = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  if (wa.size === 0 || wb.size === 0) return 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.max(wa.size, wb.size)
}

function describeChange(type: CvEditChangeType, line: string): string {
  if (type === "removed") {
    if (line.startsWith("- ")) return `Removed bullet: ${truncate(line.slice(2))}`
    return `Removed: ${truncate(line)}`
  }
  if (line.startsWith("- ")) return `Added bullet: ${truncate(line.slice(2))}`
  if (line.startsWith("# ")) return `Updated role: ${truncate(line.slice(2))}`
  if (line.startsWith("## ")) return `Updated company: ${truncate(line.slice(3))}`
  if (line.startsWith("### ")) return `Updated dates: ${truncate(line.slice(4))}`
  return `Updated: ${truncate(line)}`
}

function describeSectionUpdate(section: string, before?: string, after?: string): string {
  const b = before?.startsWith("- ") ? before.slice(2) : before
  const a = after?.startsWith("- ") ? after.slice(2) : after
  return `${section}: reframed "${truncate(b ?? "")}" → "${truncate(a ?? "")}"`
}

function truncate(text: string, max = 80): string {
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export function formatCvEditSummary(changes: CvEditChange[]): string[] {
  const bySection = new Map<string, CvEditChange[]>()
  for (const c of changes) {
    const list = bySection.get(c.section) ?? []
    list.push(c)
    bySection.set(c.section, list)
  }

  const bullets: string[] = []
  for (const [section, sectionChanges] of bySection) {
    const added = sectionChanges.filter((c) => c.type === "added").length
    const removed = sectionChanges.filter((c) => c.type === "removed").length
    const updated = sectionChanges.filter((c) => c.type === "updated").length

    if (updated > 0 && added === 0 && removed === 0) {
      bullets.push(`${section}: updated ${updated} item${updated === 1 ? "" : "s"}.`)
    } else if (added > 0 && removed === 0) {
      bullets.push(`${section}: added ${added} item${added === 1 ? "" : "s"}.`)
    } else if (removed > 0 && added === 0) {
      bullets.push(`${section}: removed ${removed} item${removed === 1 ? "" : "s"} to keep the CV concise.`)
    } else {
      const parts: string[] = []
      if (updated) parts.push(`${updated} updated`)
      if (added) parts.push(`${added} added`)
      if (removed) parts.push(`${removed} removed`)
      bullets.push(`${section}: ${parts.join(", ")}.`)
    }
  }

  if (bullets.length === 0) {
    return ["Refined wording and emphasis across the CV."]
  }
  return bullets
}
