export type TextDiffLine = {
  type: "equal" | "insert" | "delete"
  text: string
}

/** Simple line-based diff for before/after document comparison. */
export function computeTextLineDiff(before: string, after: string): TextDiffLine[] {
  const a = before.split("\n")
  const b = after.split("\n")
  const lcs = buildLcsTable(a, b)
  const result: TextDiffLine[] = []
  let i = a.length
  let j = b.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: "equal", text: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      result.unshift({ type: "insert", text: b[j - 1] })
      j--
    } else if (i > 0) {
      result.unshift({ type: "delete", text: a[i - 1] })
      i--
    }
  }

  return result
}

function buildLcsTable(a: string[], b: string[]): number[][] {
  const rows = a.length + 1
  const cols = b.length + 1
  const table: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1])
      }
    }
  }

  return table
}

export function countDiffStats(lines: TextDiffLine[]): {
  added: number
  removed: number
  unchanged: number
} {
  return lines.reduce(
    (acc, line) => {
      if (line.type === "insert") acc.added++
      else if (line.type === "delete") acc.removed++
      else acc.unchanged++
      return acc
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}
