/** Replace the first occurrence of selected text in a cover letter body. */
export function replaceSelectionInCoverLetter(
  letterText: string,
  selectedText: string,
  replacementText: string,
): string | null {
  const sel = selectedText.trim()
  if (!sel) return null
  const idx = letterText.indexOf(sel)
  if (idx < 0) {
    const normalized = sel.replace(/\s+/g, " ")
    const loose = letterText.indexOf(normalized)
    if (loose < 0) return null
    return (
      letterText.slice(0, loose) +
      replacementText.trim() +
      letterText.slice(loose + normalized.length)
    )
  }
  return letterText.slice(0, idx) + replacementText.trim() + letterText.slice(idx + sel.length)
}
