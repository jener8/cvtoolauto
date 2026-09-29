"use client"

import { createContext, useContext, type ReactNode, type RefObject, type MutableRefObject } from "react"

export type FormatterWorkspaceContextValue = {
  workspaceRef: RefObject<HTMLDivElement | null>
  popoverOpen: boolean
  setPopoverOpen: (open: boolean) => void
  closePopoverRef: MutableRefObject<(() => void) | null>
  openPopoverRef: MutableRefObject<((id: string) => void) | null>
  exportPanel: ReactNode
  settingsPanel: ReactNode
  settingsVersionsPanel?: ReactNode
  pageBreaksPanel: ReactNode
  trustTransparencyPanel: ReactNode
  versionsPanel: ReactNode
  trustFolderId?: string | null
  onTrustDataDeleted?: () => void
  showCoverLetterCta?: boolean
  hasSavedCoverLetter?: boolean
  onOpenCoverLetter?: () => void
  showYourStoryCta?: boolean
  hasYourStory?: boolean
  onOpenYourStory?: () => void
}

const FormatterWorkspaceContext = createContext<FormatterWorkspaceContextValue | null>(null)

export function FormatterWorkspaceProvider({
  value,
  children,
}: {
  value: FormatterWorkspaceContextValue
  children: ReactNode
}) {
  return (
    <FormatterWorkspaceContext.Provider value={value}>
      {children}
    </FormatterWorkspaceContext.Provider>
  )
}

export function useFormatterWorkspace() {
  const ctx = useContext(FormatterWorkspaceContext)
  if (!ctx) {
    throw new Error("useFormatterWorkspace must be used within FormatterWorkspaceProvider")
  }
  return ctx
}

export function useFormatterWorkspaceOptional() {
  return useContext(FormatterWorkspaceContext)
}
