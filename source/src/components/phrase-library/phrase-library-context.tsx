"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { insertTextAtCursor } from "@/lib/phrase-library/insert-text"
import type { CareerPhrase, PhraseCategoryId } from "@/lib/phrase-library/types"
import type { QualificationProfile } from "@/lib/qualification-profile/types"
import type { StrategicProfile } from "@/lib/strategic-profile"

export type ActivePhraseField = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  element: HTMLTextAreaElement | HTMLInputElement | null
}

type PhraseLibraryContextValue = {
  open: boolean
  openPhraseLibrary: (options?: { categoryId?: PhraseCategoryId }) => void
  closePhraseLibrary: () => void
  initialCategoryId: PhraseCategoryId | null
  activeField: ActivePhraseField | null
  registerField: (field: ActivePhraseField) => void
  clearActiveField: (fieldId: string) => void
  insertPhrase: (phrase: CareerPhrase, textOverride?: string) => boolean
  strategicProfile: StrategicProfile | null
  qualificationProfile: QualificationProfile | null
  pendingEditPhrase: CareerPhrase | null
  openPhraseEditor: (phrase: CareerPhrase) => void
  closePhraseEditor: () => void
}

const PhraseLibraryContext = createContext<PhraseLibraryContextValue | null>(null)

export function PhraseLibraryProvider({
  children,
  strategicProfile = null,
  qualificationProfile = null,
}: {
  children: ReactNode
  strategicProfile?: StrategicProfile | null
  qualificationProfile?: QualificationProfile | null
}) {
  const [open, setOpen] = useState(false)
  const [initialCategoryId, setInitialCategoryId] = useState<PhraseCategoryId | null>(null)
  const [activeField, setActiveField] = useState<ActivePhraseField | null>(null)
  const [pendingEditPhrase, setPendingEditPhrase] = useState<CareerPhrase | null>(null)

  const openPhraseLibrary = useCallback((options?: { categoryId?: PhraseCategoryId }) => {
    setInitialCategoryId(options?.categoryId ?? null)
    setOpen(true)
  }, [])

  const closePhraseLibrary = useCallback(() => {
    setOpen(false)
    setInitialCategoryId(null)
  }, [])

  const registerField = useCallback((field: ActivePhraseField) => {
    setActiveField(field)
  }, [])

  const clearActiveField = useCallback((fieldId: string) => {
    setActiveField((current) => (current?.id === fieldId ? null : current))
  }, [])

  const insertPhrase = useCallback(
    (phrase: CareerPhrase, textOverride?: string) => {
      const text = (textOverride ?? phrase.example).trim()
      if (!text) return false

      if (activeField?.element) {
        insertTextAtCursor({
          element: activeField.element,
          currentValue: activeField.element.value ?? activeField.value,
          text,
          onValueChange: activeField.onChange,
        })
        return true
      }

      return false
    },
    [activeField],
  )

  const value = useMemo(
    () => ({
      open,
      openPhraseLibrary,
      closePhraseLibrary,
      initialCategoryId,
      activeField,
      registerField,
      clearActiveField,
      insertPhrase,
      strategicProfile,
      qualificationProfile,
      pendingEditPhrase,
      openPhraseEditor: setPendingEditPhrase,
      closePhraseEditor: () => setPendingEditPhrase(null),
    }),
    [
      open,
      openPhraseLibrary,
      closePhraseLibrary,
      initialCategoryId,
      activeField,
      registerField,
      clearActiveField,
      insertPhrase,
      strategicProfile,
      qualificationProfile,
      pendingEditPhrase,
    ],
  )

  return <PhraseLibraryContext.Provider value={value}>{children}</PhraseLibraryContext.Provider>
}

export function usePhraseLibrary(): PhraseLibraryContextValue {
  const ctx = useContext(PhraseLibraryContext)
  if (!ctx) {
    throw new Error("usePhraseLibrary must be used within PhraseLibraryProvider")
  }
  return ctx
}

export function useOptionalPhraseLibrary(): PhraseLibraryContextValue | null {
  return useContext(PhraseLibraryContext)
}
