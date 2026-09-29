function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function findSelectionRange(
  resumeText: string,
  selectedText: string,
): { start: number; end: number } | null {
  const sel = selectedText.trim()
  if (!sel) return null

  const directIdx = resumeText.indexOf(sel)
  if (directIdx >= 0) {
    return { start: directIdx, end: directIdx + sel.length }
  }

  const normalizedSel = sel.replace(/\r\n/g, "\n").replace(/\s+/g, " ")
  const looseIdx = resumeText.indexOf(normalizedSel)
  if (looseIdx >= 0) {
    return { start: looseIdx, end: looseIdx + normalizedSel.length }
  }

  const flexPattern = sel
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegex)
    .join("\\s+")
  if (!flexPattern) return null

  const match = resumeText.match(new RegExp(flexPattern, "m"))
  if (match?.index != null) {
    return { start: match.index, end: match.index + match[0].length }
  }

  return null
}

/** Replace the first occurrence of selected text in the resume. */
export function replaceSelectionInResume(
  resumeText: string,
  selectedText: string,
  replacementText: string,
): string | null {
  const replacement = replacementText.trim()
  if (!replacement) return null

  const range = findSelectionRange(resumeText, selectedText)
  if (!range) return null

  return (
    resumeText.slice(0, range.start) + replacement + resumeText.slice(range.end)
  )
}
