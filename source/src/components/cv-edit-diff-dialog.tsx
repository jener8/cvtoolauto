"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CvEditChange } from "@/lib/cv-edit-types"
import { cn } from "@/lib/utils"

export function CvEditDiffDialog({
  open,
  onOpenChange,
  changes,
  previousResumeText,
  newResumeText,
  title = "CV changes",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  changes: CvEditChange[]
  previousResumeText?: string
  newResumeText?: string
  title?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Added, removed, and updated text from this AI edit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No structured diff available. Compare full versions below.
            </p>
          ) : (
            changes.map((change, idx) => (
              <div
                key={`${change.section}-${change.type}-${idx}`}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                  <span>{change.section}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5",
                      change.type === "added" && "bg-emerald-500/15 text-emerald-700",
                      change.type === "removed" && "bg-destructive/15 text-destructive",
                      change.type === "updated" && "bg-amber-500/15 text-amber-800",
                    )}
                  >
                    {change.type}
                  </span>
                </div>
                {change.description && (
                  <p className="text-sm text-foreground">{change.description}</p>
                )}
                {change.before && (
                  <div className="text-xs rounded-md bg-destructive/5 border border-destructive/15 p-2">
                    <p className="font-medium text-destructive mb-1">Before</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{change.before}</p>
                  </div>
                )}
                {change.after && (
                  <div className="text-xs rounded-md bg-emerald-500/5 border border-emerald-500/15 p-2">
                    <p className="font-medium text-emerald-700 mb-1">After</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{change.after}</p>
                  </div>
                )}
              </div>
            ))
          )}

          {previousResumeText && newResumeText && (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Compare full CV text
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium mb-1 text-muted-foreground">Previous</p>
                  <pre className="text-[11px] whitespace-pre-wrap rounded-md bg-muted/50 p-2 max-h-64 overflow-y-auto">
                    {previousResumeText}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1 text-muted-foreground">Updated</p>
                  <pre className="text-[11px] whitespace-pre-wrap rounded-md bg-muted/50 p-2 max-h-64 overflow-y-auto">
                    {newResumeText}
                  </pre>
                </div>
              </div>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
