export function insertTextAtCursor(input: {
  element: HTMLTextAreaElement | HTMLInputElement
  currentValue: string
  text: string
  onValueChange: (value: string) => void
}): { insertStart: number; insertEnd: number } {
  const { element, currentValue, text, onValueChange } = input
  const start = element.selectionStart ?? currentValue.length
  const end = element.selectionEnd ?? currentValue.length
  const before = currentValue.slice(0, start)
  const after = currentValue.slice(end)
  const needsSpace = before.length > 0 && !/[\s\n]$/.test(before)
  const separator = needsSpace ? " " : ""
  const newValue = `${before}${separator}${text}${after}`
  const insertStart = before.length + separator.length
  const insertEnd = insertStart + text.length

  onValueChange(newValue)

  requestAnimationFrame(() => {
    element.focus()
    element.setSelectionRange(insertStart, insertEnd)
    window.setTimeout(() => {
      element.setSelectionRange(insertEnd, insertEnd)
    }, 1600)
  })

  return { insertStart, insertEnd }
}
