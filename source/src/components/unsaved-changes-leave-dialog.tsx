"use client"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type UnsavedChangesLeaveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSaving: boolean
  saveError: string | null
  onStay: () => void
  onDiscardAndLeave: () => void
  onSaveAndLeave: () => void | Promise<void>
}

export function UnsavedChangesLeaveDialog({
  open,
  onOpenChange,
  isSaving,
  saveError,
  onStay,
  onDiscardAndLeave,
  onSaveAndLeave,
}: UnsavedChangesLeaveDialogProps) {
  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true)
      return
    }
    if (isSaving) return
    onStay()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent busy={isSaving}>
        <AlertDialogHeader>
          <AlertDialogTitle>Save resume?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Save before leaving so you do not lose your work.
          </AlertDialogDescription>
          {saveError ? (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={isSaving} onClick={onStay}>
            Stay here
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onDiscardAndLeave}
          >
            Discard changes
          </Button>
          <AlertDialogAction
            disabled={isSaving}
            onClick={(event) => {
              event.preventDefault()
              void onSaveAndLeave()
            }}
          >
            {isSaving ? "Saving…" : "Yes, save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
