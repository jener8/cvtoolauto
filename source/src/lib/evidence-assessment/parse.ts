import {
  EVIDENCE_FITS,
  EVIDENCE_MATURITIES,
  EVIDENCE_SOURCES,
  type EvidenceAssessmentConfidence,
  type EvidenceAssessmentPlan,
  type EvidenceAssessmentRow,
  type EvidenceFit,
  type EvidenceMaturity,
  type EvidenceSourceKind,
} from "@/lib/evidence-assessment/types"

function slugId(phrase: string, index: number): string {
  const base = phrase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `evidence-${base || "row"}-${index}`
}

function asString(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

function normalizeFit(value: unknown): EvidenceFit | null {
  if (typeof value !== "string") return null
  const raw = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  const aliases: Record<string, EvidenceFit> = {
    direct: "direct",
    strong: "direct",
    strong_match: "direct",
    transferable: "transferable",
    transferable_match: "transferable",
    partial: "partial",
    partial_match: "partial",
    not_evidenced: "not_evidenced",
    none: "not_evidenced",
    gap: "not_evidenced",
    no_evidence: "not_evidenced",
  }
  const mapped = aliases[raw]
  return mapped && EVIDENCE_FITS.includes(mapped) ? mapped : null
}

function normalizeMaturity(value: unknown): EvidenceMaturity | null {
  if (typeof value !== "string") return null
  const raw = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  const aliases: Record<string, EvidenceMaturity> = {
    delivered: "delivered",
    completed: "delivered",
    done: "delivered",
    in_progress: "in_progress",
    ongoing: "in_progress",
    proposed: "proposed",
    planned: "proposed",
    concept: "proposed",
  }
  const mapped = aliases[raw]
  return mapped && EVIDENCE_MATURITIES.includes(mapped) ? mapped : null
}

function normalizeSource(value: unknown): EvidenceSourceKind {
  if (typeof value !== "string") return "other"
  const raw = value.trim().toLowerCase()
  if (EVIDENCE_SOURCES.includes(raw as EvidenceSourceKind)) {
    return raw as EvidenceSourceKind
  }
  if (/research|studie|paper/i.test(raw)) return "research"
  if (/project|projekt/i.test(raw)) return "project"
  if (/experience|role|job|beruf/i.test(raw)) return "experience"
  return "other"
}

function normalizeConfidence(value: unknown): EvidenceAssessmentConfidence {
  if (value === "high" || value === "medium" || value === "low") return value
  return "medium"
}

function looksLikePercentage(text: string): boolean {
  return /\d{1,3}\s*%/.test(text) || /\b(match|score)\s*[:=]?\s*\d/i.test(text)
}

function sanitizeOutcomeLabel(value: unknown): string | undefined {
  const text = asString(value, 80)
  if (!text) return undefined
  if (looksLikePercentage(text)) return undefined
  return text
}

function parseRow(raw: unknown, index: number): EvidenceAssessmentRow | null {
  if (typeof raw !== "object" || raw === null) return null
  const row = raw as Record<string, unknown>

  const requirementPhrase =
    asString(row.requirementPhrase ?? row.requirement ?? row.criterion, 120) ?? ""
  const evidenceText = asString(row.evidenceText ?? row.evidence ?? row.example, 400) ?? ""
  const fit = normalizeFit(row.fit ?? row.evidenceFit ?? row.match)
  const maturity = normalizeMaturity(row.maturity ?? row.evidenceMaturity ?? row.status)

  if (!requirementPhrase || !fit || !maturity) return null

  // Gaps may have empty evidence — keep them for review transparency
  const fitRationale =
    asString(row.fitRationale ?? row.rationale ?? row.why, 400) ||
    "Classification based on available candidate evidence."

  return {
    id: asString(row.id, 64) || slugId(requirementPhrase, index),
    requirementPhrase,
    requirementSourceText: asString(row.requirementSourceText ?? row.jdSnippet, 300),
    evidenceText,
    evidenceSource: normalizeSource(row.evidenceSource ?? row.source),
    evidenceSourceRef: asString(row.evidenceSourceRef ?? row.sourceRef, 120),
    fit,
    fitRationale,
    maturity,
    maturityRationale: asString(row.maturityRationale, 300),
    outcomeLabel: sanitizeOutcomeLabel(row.outcomeLabel ?? row.outcome ?? row.deliverable),
    confidence: normalizeConfidence(row.confidence),
    userOverride: false,
    approved: fit !== "not_evidenced" && evidenceText.length > 0,
  }
}

/**
 * Parse AI JSON for evidence assessment. Accepts wrapped `{ rows: [...] }` or a bare array.
 * Never treats percentages as fit scores.
 */
export function parseEvidenceAssessmentResponse(text: string): EvidenceAssessmentPlan | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    let rowsRaw: unknown[] = []
    let employerProblemSummary: string | undefined
    let layoutHint: string | undefined

    if (Array.isArray(parsed)) {
      rowsRaw = parsed
    } else if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>
      if (Array.isArray(obj.rows)) rowsRaw = obj.rows
      else if (Array.isArray(obj.assessments)) rowsRaw = obj.assessments
      else if (Array.isArray(obj.evidence)) rowsRaw = obj.evidence
      else return null
      employerProblemSummary = asString(obj.employerProblemSummary ?? obj.problemSummary, 400)
      layoutHint = asString(obj.layoutHint, 240)
    } else {
      return null
    }

    const rows: EvidenceAssessmentRow[] = []
    const seen = new Set<string>()
    for (const raw of rowsRaw) {
      const row = parseRow(raw, rows.length)
      if (!row) continue
      const key = row.requirementPhrase.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(row)
      if (rows.length >= 6) break
    }

    if (rows.length < 2) return null

    return {
      employerProblemSummary,
      rows: rows.slice(0, 5),
      layoutHint,
    }
  } catch {
    return null
  }
}

/** Normalize a user-edited row before CV generation. */
export function sanitizeEvidenceAssessmentRow(
  row: EvidenceAssessmentRow,
): EvidenceAssessmentRow {
  const fit = EVIDENCE_FITS.includes(row.fit) ? row.fit : "partial"
  const maturity = EVIDENCE_MATURITIES.includes(row.maturity) ? row.maturity : "proposed"
  const evidenceText = row.evidenceText.trim().slice(0, 400)
  const outcome =
    row.outcomeLabel && !looksLikePercentage(row.outcomeLabel)
      ? row.outcomeLabel.trim().slice(0, 80)
      : undefined

  return {
    ...row,
    requirementPhrase: row.requirementPhrase.trim().slice(0, 120),
    evidenceText,
    fit,
    maturity,
    fitRationale: row.fitRationale.trim().slice(0, 400),
    outcomeLabel: outcome,
    approved:
      row.approved === true &&
      fit !== "not_evidenced" &&
      evidenceText.length > 0,
  }
}

export function approvedEvidenceRows(rows: EvidenceAssessmentRow[]): EvidenceAssessmentRow[] {
  return rows.map(sanitizeEvidenceAssessmentRow).filter((r) => r.approved)
}
