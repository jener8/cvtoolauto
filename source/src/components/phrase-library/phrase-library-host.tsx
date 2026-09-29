"use client"

import { PhraseEditDialog } from "@/components/phrase-library/phrase-edit-dialog"
import { PhraseLibraryPanel } from "@/components/phrase-library/phrase-library-panel"

export function PhraseLibraryHost() {
  return (
    <>
      <PhraseLibraryPanel />
      <PhraseEditDialog />
    </>
  )
}
