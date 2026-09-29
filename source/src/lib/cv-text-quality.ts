/** Shown when uploaded or extracted CV text looks like PDF/binary garbage. */
export const CV_TEXT_QUALITY_ERROR =
  "This PDF could not be read correctly. Please upload a text-based PDF, Word document, or paste your CV text."

export type CvTextQualityResult =
  | { ok: true }
  | { ok: false; reason: string }

const PDF_ARTIFACT_PATTERNS: RegExp[] = [
  /apache\s+fop/i,
  /\bendobj\b/i,
  /\bxref\b/i,
  /\bstream\b/i,
  /\/Type\s*\/Font/i,
  /\/Subtype\s*\//i,
  /\/BaseFont\s*\//i,
  /\/Filter\s*\/FlateDecode/i,
  /BT\s+[\d.]+\s+[\d.]+\s+Td/i,
]

/** Letters, numbers, and common CV punctuation. */
const READABLE_CHAR_RE = /[\p{L}\p{N}\s.,;:'"!?()\-@/&+#%]/u

export function assessCvTextQuality(text: string): CvTextQualityResult {
  const trimmed = text.trim()

  if (trimmed.length < 40) {
    return {
      ok: false,
      reason:
        "We could not detect enough readable text in this file. Try a different export, paste the content manually, or use a plain .txt file.",
    }
  }

  for (const pattern of PDF_ARTIFACT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: CV_TEXT_QUALITY_ERROR }
    }
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(trimmed)) {
    return { ok: false, reason: CV_TEXT_QUALITY_ERROR }
  }

  let readableCount = 0
  for (const char of trimmed) {
    if (READABLE_CHAR_RE.test(char)) readableCount++
  }

  const readableRatio = readableCount / trimmed.length
  if (readableRatio < 0.72) {
    return { ok: false, reason: CV_TEXT_QUALITY_ERROR }
  }

  const gibberishRuns = trimmed.match(/[^\p{L}\p{N}\s]{5,}/gu)?.length ?? 0
  if (gibberishRuns > 4) {
    return { ok: false, reason: CV_TEXT_QUALITY_ERROR }
  }

  const wordLike = trimmed.match(/[\p{L}]{3,}/gu)?.length ?? 0
  if (wordLike < 8) {
    return { ok: false, reason: CV_TEXT_QUALITY_ERROR }
  }

  return { ok: true }
}

export function isCvTextUsable(text: string): CvTextQualityResult {
  return assessCvTextQuality(text)
}
