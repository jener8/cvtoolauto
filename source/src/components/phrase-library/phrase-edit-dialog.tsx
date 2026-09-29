"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { usePhraseLibrary } from "@/components/phrase-library/phrase-library-context"
import type { CareerPhrase } from "@/lib/phrase-library/types"

export function PhraseEditDialog() {
  const { pendingEditPhrase, closePhraseEditor, insertPhrase, activeField } = usePhraseLibrary()
  const [text, setText] = useState("")

  useEffect(() => {
    if (pendingEditPhrase) {
      setText(pendingEditPhrase.example)
    }
  }, [pendingEditPhrase])

  const handleInsert = () => {
    if (!pendingEditPhrase || !text.trim()) return
    const ok = insertPhrase(pendingEditPhrase, text.trim())
    if (ok) closePhraseEditor()
  }

  return (
    <Dialog open={Boolean(pendingEditPhrase)} onOpenChange={(next) => !next && closePhraseEditor()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make it yours</DialogTitle>
          <DialogDescription>
            Edit this phrase so it sounds like you — then insert it into your field.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Edited phrase"
        />
        <p className="phrase-edit-dialog__hint">
          Tip: add a specific example from your own experience to make it more personal.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={closePhraseEditor}>
            Cancel
          </Button>
          <Button type="button" onClick={handleInsert} disabled={!text.trim() || !activeField}>
            Insert into your field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
