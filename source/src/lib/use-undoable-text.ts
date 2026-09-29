import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"

type UseUndoableTextOptions = {
  maxHistory?: number
}

/**
 * Text state with Cmd/Ctrl+Z undo and Shift+Cmd/Ctrl+Z (or Ctrl+Y) redo.
 * Native textarea undo does not work with controlled React values.
 */
export function useUndoableText(initialValue = "", options?: UseUndoableTextOptions) {
  const maxHistory = options?.maxHistory ?? 100
  const [value, setValueState] = useState(initialValue)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isUndoRedo = useRef(false)

  const setValue = useCallback(
    (next: string, opts?: { recordHistory?: boolean }) => {
      setValueState((current) => {
        const shouldRecord =
          opts?.recordHistory !== false && !isUndoRedo.current && current !== next
        if (shouldRecord) {
          undoStack.current.push(current)
          if (undoStack.current.length > maxHistory) undoStack.current.shift()
          redoStack.current = []
        }
        return next
      })
    },
    [maxHistory],
  )

  const reset = useCallback((next: string) => {
    undoStack.current = []
    redoStack.current = []
    isUndoRedo.current = false
    setValueState(next)
  }, [])

  const undo = useCallback(() => {
    setValueState((current) => {
      const previous = undoStack.current.pop()
      if (previous === undefined) return current
      redoStack.current.push(current)
      isUndoRedo.current = true
      queueMicrotask(() => {
        isUndoRedo.current = false
      })
      return previous
    })
  }, [])

  const redo = useCallback(() => {
    setValueState((current) => {
      const next = redoStack.current.pop()
      if (next === undefined) return current
      undoStack.current.push(current)
      isUndoRedo.current = true
      queueMicrotask(() => {
        isUndoRedo.current = false
      })
      return next
    })
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }
      if ((event.key === "z" && event.shiftKey) || event.key === "y" || event.key === "Y") {
        event.preventDefault()
        redo()
      }
    },
    [redo, undo],
  )

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value)
    },
    [setValue],
  )

  return {
    value,
    setValue,
    reset,
    undo,
    redo,
    handleChange,
    handleKeyDown,
  }
}
