"use client"

import { DialogFooter } from "@/components/ui/dialog"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Calendar,
  Plus,
  FileText,
  Loader2,
  Check,
  RotateCcw,
  FolderOpen,
  ChevronDown,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { captureTextareaSelection } from "@/lib/assistant-selection-context"
import { nextApplicationResumeName, parseVersionedResumeName } from "@/lib/application-resume-naming"
import { snapshotToDisplayResume } from "@/lib/resume-version-history"
import type { ResumeVersion } from "@/lib/types"
import { clearLocalSavedResumeVersions } from "@/lib/storage"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

const VISIBLE_VERSION_COUNT = 5

interface SavedVersionsProps {
  versions: ResumeVersion[]
  currentVersionId: string | null
  currentResumeName?: string
  autosaveLabel?: string
  /** Compact toolbar buttons for formatter top bar */
  variant?: "default" | "toolbar" | "drawer"
  /** PDF / Word / cover letter actions shown in the formatter top bar */
  documentActions?: React.ReactNode
  onSave: (name: string) => Promise<boolean>
  onLoad: (version: ResumeVersion) => void
  onRestoreSnapshot?: (resumeId: string, snapshotId: string) => void
  onDelete: (id: string) => void
  onDeleteSnapshot?: (resumeId: string, snapshotId: string) => void
  onRename: (id: string, newName: string) => void
  onUpdate: () => void
  hasUnsavedChanges: boolean
  onScrollToPreview: () => void
  isUpdating?: boolean
  updateSuccess?: boolean
  onStartAgain?: () => void
  jobDescription?: string
  onJobDescriptionChange?: (jobDescription: string) => void
  defaultVersionName?: string
}

export function SavedVersions({
  versions,
  currentVersionId,
  currentResumeName = "",
  autosaveLabel = "",
  onSave,
  onLoad,
  onRestoreSnapshot,
  onDelete,
  onDeleteSnapshot,
  onRename,
  onUpdate,
  hasUnsavedChanges,
  onScrollToPreview,
  isUpdating = false,
  onStartAgain,
  jobDescription = "",
  onJobDescriptionChange,
  defaultVersionName = "",
  variant = "default",
  documentActions,
}: SavedVersionsProps) {
  const [newVersionName, setNewVersionName] = useState(() => defaultVersionName.trim())
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [showOlderVersions, setShowOlderVersions] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const currentResume = useMemo(
    () => versions.find((v) => v.id === currentVersionId) ?? null,
    [versions, currentVersionId],
  )

  const sortedVersions = useMemo(() => {
    const history = currentResume?.versionHistory ?? []
    if (history.length > 0) {
      return [...history]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((snapshot) => ({
          ...snapshotToDisplayResume(currentResume!, snapshot),
          id: snapshot.id,
        }))
    }
    return [...versions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }, [currentResume, versions])

  const isHistoryView = Boolean(currentResume?.versionHistory?.length)

  const visibleInManage = showOlderVersions
    ? sortedVersions
    : sortedVersions.slice(0, VISIBLE_VERSION_COUNT)
  const hasOlder = sortedVersions.length > VISIBLE_VERSION_COUNT

  useEffect(() => {
    if (!isSaveDialogOpen) return
    const base =
      defaultVersionName.trim() ||
      parseVersionedResumeName(currentResumeName).base ||
      currentResumeName.trim()
    if (!base) return
    const suggested = nextApplicationResumeName(base, versions)
    setNewVersionName((prev) => (prev.trim() ? prev : suggested))
  }, [isSaveDialogOpen, defaultVersionName, currentResumeName, versions])

  const handleSaveDialogOpenChange = (open: boolean) => {
    if (!open && isSaving) return
    setIsSaveDialogOpen(open)
    if (!open) setSaveError(null)
  }

  const handleSave = async () => {
    const trimmed = newVersionName.trim()
    if (!trimmed) {
      setSaveError("Version name is required.")
      return
    }
    if (isSaving) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const result = await onSave(trimmed)
      if (result !== true) {
        setSaveError(
          "Failed to save version. Export your data, then use Clear Saved Versions in Profile Settings.",
        )
        return
      }

      setNewVersionName("")
      setIsSaveDialogOpen(false)
      setTimeout(() => onScrollToPreview(), 300)
    } catch (error) {
      console.error("[saved-versions] Save failed:", error)
      setSaveError(
        error instanceof Error ? error.message : "Failed to save version. Please try again.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (version: ResumeVersion) => {
    const date = new Date(version.updatedAt ?? version.timestamp)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleClearSavedVersions = () => {
    const { snapshots, hadDraft } = clearLocalSavedResumeVersions()
    toast({
      title: "Saved versions cleared",
      description:
        snapshots > 0 || hadDraft
          ? `Removed ${snapshots} local snapshot${snapshots === 1 ? "" : "s"}${hadDraft ? " and the current draft" : ""}. Cloud data is unchanged.`
          : "No local saved versions were stored.",
    })
  }

  const displayTitle =
    currentResumeName.trim() ||
    sortedVersions.find((v) => v.id === currentVersionId)?.name ||
    "Untitled resume"

  const versionsBtnGhost = variant === "drawer" ? "dl-btn ghost" : "ui-btn-ghost"
  const versionsBtnSave =
    variant === "drawer" ? "dl-btn primary full" : "ui-btn-primary"

  const actionButtons = (
    <div className={variant === "drawer" ? "dl-grid" : "flex flex-wrap gap-2 shrink-0"}>
      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogTrigger asChild>
          <button type="button" className={versionsBtnGhost}>
            <FolderOpen className="h-4 w-4" aria-hidden />
            Versions{sortedVersions.length > 0 ? ` (${sortedVersions.length})` : ""}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isHistoryView ? "Version history" : "Saved resume versions"}
            </DialogTitle>
          </DialogHeader>
          {sortedVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No saved versions yet. Use Save Version to create a named snapshot.
            </p>
          ) : (
            <ul className="space-y-2 py-2">
              {visibleInManage.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{version.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {formatDate(version)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!isHistoryView && currentVersionId === version.id ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Current
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (isHistoryView && currentResume && onRestoreSnapshot) {
                            onRestoreSnapshot(currentResume.id, version.id)
                          } else {
                            onLoad(version)
                          }
                          setIsManageOpen(false)
                        }}
                      >
                        {isHistoryView ? "Restore" : "Load"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {hasOlder && !showOlderVersions ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowOlderVersions(true)}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Show {sortedVersions.length - VISIBLE_VERSION_COUNT} older versions
            </Button>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
            {currentVersionId && hasUnsavedChanges ? (
              <Button type="button" variant="secondary" onClick={() => void onUpdate()} disabled={isUpdating}>
                {isUpdating ? "Updating…" : "Update current version"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="text-destructive" onClick={handleClearSavedVersions}>
              Clear Saved Versions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {onStartAgain && (
        <button type="button" className={versionsBtnGhost} onClick={onStartAgain}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Start again
        </button>
      )}

      <Dialog open={isSaveDialogOpen} onOpenChange={handleSaveDialogOpenChange}>
        <DialogTrigger asChild>
          <button type="button" className={versionsBtnSave}>
            <Plus className="h-4 w-4" aria-hidden />
            Save version
          </button>
        </DialogTrigger>
            <DialogContent busy={isSaving}>
              <DialogHeader>
                <DialogTitle>Save version snapshot</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="version-name">Version Name</Label>
                  <Input
                    id="version-name"
                    placeholder="e.g., Software Engineer - Tech Co"
                    value={newVersionName}
                    onChange={(e) => {
                      setNewVersionName(e.target.value)
                      if (saveError) setSaveError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void handleSave()
                      }
                    }}
                    disabled={isSaving}
                    aria-invalid={saveError ? true : undefined}
                  />
                  {saveError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {saveError}
                    </p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveDialogOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!newVersionName.trim() || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
      </Dialog>

      {!currentVersionId && variant === "default" && (
        <Button
          variant="outline"
          onClick={onScrollToPreview}
          className="lg:hidden bg-transparent"
          type="button"
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          Preview
        </Button>
      )}

      {onJobDescriptionChange && variant === "default" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "ui-btn-ghost h-11 min-h-11 gap-2",
                jobDescription && "bg-[var(--brand-teal-bg)] border-[var(--brand-teal)]/30",
              )}
            >
              <FileText className="h-4 w-4" />
              Job Description
              {jobDescription && (
                <span className="w-2 h-2 rounded-full bg-[var(--brand-teal)]" aria-hidden />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Job Description</h4>
                <p className="text-xs text-muted-foreground">Edit or paste the job requirements here</p>
              </div>
              <Textarea
                value={jobDescription}
                onChange={(e) => onJobDescriptionChange(e.target.value)}
                onMouseUp={(e) =>
                  captureTextareaSelection("job_description", e.currentTarget)
                }
                onKeyUp={(e) =>
                  captureTextareaSelection("job_description", e.currentTarget)
                }
                placeholder="Paste the job description here..."
                className="min-h-[200px] text-sm resize-none"
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )

  if (variant === "toolbar") {
    return (
      <div className="ui-formatter-toolbar-actions flex flex-wrap items-center gap-1.5 shrink-0">
        {documentActions}
      </div>
    )
  }

  if (variant === "drawer") {
    return actionButtons
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--card-bg)] px-4 py-3">
        <div className="min-w-0">
          <p className="ui-formatter-eyebrow">Resume Formatter</p>
          <p className="ui-formatter-role-title truncate">{displayTitle}</p>
          <p className="text-[11px] text-[var(--text-meta)] mt-1">
            {autosaveLabel}
            {hasUnsavedChanges && autosaveLabel ? " · " : null}
            {hasUnsavedChanges ? "Unsaved edits" : null}
          </p>
        </div>
        {actionButtons}
      </div>
    </div>
  )
}
