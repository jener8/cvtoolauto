"use client"

import { useState } from "react"
import {
  AI_DATA_USAGE_POINTS,
  GDPR_CONTACT_EMAIL,
  PRIVACY_POLICY_SECTIONS,
  TERMS_OF_SERVICE_SECTIONS,
} from "@/lib/gdpr-data-policy"
import {
  collectAllUserData,
  deleteAllAccountData,
  deleteAllCoverLetters,
  deleteAllJobApplications,
  deleteAllResumes,
  downloadUserDataJson,
  downloadUserDataZip,
} from "@/lib/gdpr-user-data"
import { AI_TOOL_NAME } from "@/lib/ai-transparency"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Download, FileJson, Mail, Shield, Trash2 } from "lucide-react"

type DeleteTarget = "cvs" | "coverLetters" | "applications" | "account" | null

type PrivacyCentreContentProps = {
  folderId?: string | null
  onDataDeleted?: () => void
  onOpenAiHowItWorks?: () => void
  /** Render inside formatter dark popover (no dialog chrome). */
  embedded?: boolean
  onDismiss?: () => void
}

export function PrivacyCentreContent({
  folderId,
  onDataDeleted,
  onOpenAiHowItWorks,
  embedded = false,
  onDismiss,
}: PrivacyCentreContentProps) {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)

  const runExport = async (format: "json" | "zip") => {
    setExporting(true)
    try {
      const data = await collectAllUserData(folderId ?? undefined)
      if (format === "json") downloadUserDataJson(data)
      else downloadUserDataZip(data)
      toast({
        title: "Export complete",
        description: `Your data was downloaded as ${format === "json" ? "JSON" : "ZIP"}.`,
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export data.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      let count = 0
      switch (deleteTarget) {
        case "cvs":
          count = await deleteAllResumes(folderId ?? undefined)
          break
        case "coverLetters":
          count = await deleteAllCoverLetters(folderId ?? undefined)
          break
        case "applications":
          count = await deleteAllJobApplications(folderId ?? undefined)
          break
        case "account":
          await deleteAllAccountData()
          break
      }
      toast({
        title: "Deletion complete",
        description:
          deleteTarget === "account"
            ? "All account data on this device has been permanently deleted."
            : `Permanently deleted ${count} record${count === 1 ? "" : "s"}.`,
      })
      onDataDeleted?.()
      if (deleteTarget === "account") onDismiss?.()
    } catch (error) {
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "Could not complete deletion.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const deleteLabels: Record<Exclude<DeleteTarget, null>, string> = {
    cvs: "all CVs",
    coverLetters: "all cover letters",
    applications: "all application records",
    account: "your entire account and all local data",
  }

  const exportBtnClass = embedded
    ? "formatter-popover-btn formatter-popover-btn--inline"
    : "gap-1.5"
  const deleteBtnClass = embedded
    ? "formatter-popover-btn formatter-popover-btn--inline formatter-popover-btn--danger"
    : "justify-start text-destructive hover:text-destructive"
  const deleteAccountBtnClass = embedded
    ? "formatter-popover-btn formatter-popover-btn--inline formatter-popover-btn--danger-solid"
    : "justify-start"
  const linkBtnClass = embedded ? "formatter-trust-panel__link" : "h-auto p-0 text-sm"

  const tabs = (
    <Tabs defaultValue="rights" className={cn("w-full", embedded && "formatter-trust-tabs")}>
      <TabsList
        className={cn(
          "grid w-full grid-cols-4 h-9",
          embedded && "formatter-trust-tabs__list",
        )}
        aria-label="Privacy Centre sections"
      >
        <TabsTrigger value="rights" className={cn("text-xs", embedded && "formatter-trust-tabs__trigger")}>
          Your rights
        </TabsTrigger>
        <TabsTrigger value="policies" className={cn("text-xs", embedded && "formatter-trust-tabs__trigger")}>
          Policies
        </TabsTrigger>
        <TabsTrigger value="ai" className={cn("text-xs", embedded && "formatter-trust-tabs__trigger")}>
          AI data use
        </TabsTrigger>
        <TabsTrigger value="contact" className={cn("text-xs", embedded && "formatter-trust-tabs__trigger")}>
          Contact
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="rights"
        className={cn("mt-4 space-y-5", embedded && "formatter-trust-panel__section")}
      >
        <section aria-labelledby="export-heading">
          <h3
            id="export-heading"
            className={embedded ? "formatter-trust-panel__heading" : "text-sm font-semibold mb-2"}
          >
            Export my data
          </h3>
          <p className={embedded ? "formatter-trust-panel__body" : "text-sm text-muted-foreground mb-3"}>
            Download CVs, cover letters, applications, notes, and AI interaction history
            (machine-readable JSON or ZIP bundle).
          </p>
          <div className="flex flex-wrap gap-2">
            {embedded ? (
              <>
                <button
                  type="button"
                  className={exportBtnClass}
                  disabled={exporting}
                  onClick={() => void runExport("json")}
                >
                  <FileJson className="h-3.5 w-3.5" aria-hidden />
                  Export JSON
                </button>
                <button
                  type="button"
                  className={exportBtnClass}
                  disabled={exporting}
                  onClick={() => void runExport("zip")}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Export ZIP
                </button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={exportBtnClass}
                  disabled={exporting}
                  onClick={() => void runExport("json")}
                >
                  <FileJson className="h-4 w-4" aria-hidden />
                  Export JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={exportBtnClass}
                  disabled={exporting}
                  onClick={() => void runExport("zip")}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export ZIP
                </Button>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="delete-heading">
          <h3
            id="delete-heading"
            className={embedded ? "formatter-trust-panel__heading" : "text-sm font-semibold mb-2"}
          >
            Delete my data
          </h3>
          <p className={embedded ? "formatter-trust-panel__body" : "text-sm text-muted-foreground mb-3"}>
            Permanent deletion — not hidden archiving. Cloud copies are removed where sync is
            enabled.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {embedded ? (
              <>
                <button type="button" className={deleteBtnClass} onClick={() => setDeleteTarget("cvs")}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete all CVs
                </button>
                <button
                  type="button"
                  className={deleteBtnClass}
                  onClick={() => setDeleteTarget("coverLetters")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete cover letters
                </button>
                <button
                  type="button"
                  className={deleteBtnClass}
                  onClick={() => setDeleteTarget("applications")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete applications
                </button>
                <button
                  type="button"
                  className={deleteAccountBtnClass}
                  onClick={() => setDeleteTarget("account")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete account & all data
                </button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={deleteBtnClass}
                  onClick={() => setDeleteTarget("cvs")}
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden />
                  Delete all CVs
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={deleteBtnClass}
                  onClick={() => setDeleteTarget("coverLetters")}
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden />
                  Delete cover letters
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={deleteBtnClass}
                  onClick={() => setDeleteTarget("applications")}
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden />
                  Delete applications
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className={deleteAccountBtnClass}
                  onClick={() => setDeleteTarget("account")}
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden />
                  Delete account & all data
                </Button>
              </>
            )}
          </div>
        </section>
      </TabsContent>

      <TabsContent
        value="policies"
        className={cn("mt-4 space-y-6", embedded && "formatter-trust-panel__section")}
      >
        <section aria-labelledby="privacy-policy-heading">
          <h3
            id="privacy-policy-heading"
            className={embedded ? "formatter-trust-panel__heading" : "text-sm font-semibold mb-3"}
          >
            Privacy Policy
          </h3>
          <div className="space-y-3">
            {PRIVACY_POLICY_SECTIONS.map((section) => (
              <div key={section.title}>
                <h4 className={embedded ? "formatter-trust-panel__subheading" : "text-sm font-medium"}>
                  {section.title}
                </h4>
                <p
                  className={
                    embedded ? "formatter-trust-panel__body" : "text-sm text-muted-foreground leading-relaxed"
                  }
                >
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="terms-heading">
          <h3
            id="terms-heading"
            className={embedded ? "formatter-trust-panel__heading" : "text-sm font-semibold mb-3"}
          >
            Terms of Service
          </h3>
          <div className="space-y-3">
            {TERMS_OF_SERVICE_SECTIONS.map((section) => (
              <div key={section.title}>
                <h4 className={embedded ? "formatter-trust-panel__subheading" : "text-sm font-medium"}>
                  {section.title}
                </h4>
                <p
                  className={
                    embedded ? "formatter-trust-panel__body" : "text-sm text-muted-foreground leading-relaxed"
                  }
                >
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </TabsContent>

      <TabsContent
        value="ai"
        className={cn("mt-4 space-y-4", embedded && "formatter-trust-panel__section")}
      >
        <p className={embedded ? "formatter-trust-panel__body" : "text-sm text-muted-foreground"}>
          How your documents are processed when AI features are used.
        </p>
        <ul className="space-y-3">
          {AI_DATA_USAGE_POINTS.map((point) => (
            <li
              key={point.id}
              className={embedded ? "formatter-trust-panel__card" : "rounded-lg border px-3 py-2.5"}
            >
              <h4 className={embedded ? "formatter-trust-panel__subheading" : "text-sm font-medium"}>
                {point.title}
              </h4>
              <p
                className={
                  embedded
                    ? "formatter-trust-panel__body"
                    : "text-sm text-muted-foreground mt-1 leading-relaxed"
                }
              >
                {point.body}
              </p>
            </li>
          ))}
        </ul>
        {onOpenAiHowItWorks &&
          (embedded ? (
            <button type="button" className={linkBtnClass} onClick={onOpenAiHowItWorks}>
              Read full AI usage information →
            </button>
          ) : (
            <Button type="button" variant="link" className={linkBtnClass} onClick={onOpenAiHowItWorks}>
              Read full AI usage information →
            </Button>
          ))}
      </TabsContent>

      <TabsContent
        value="contact"
        className={cn("mt-4", embedded && "formatter-trust-panel__section")}
      >
        <div className={embedded ? "formatter-trust-panel__card" : "rounded-lg border bg-muted/20 p-4 space-y-2"}>
          <div
            className={
              embedded
                ? "formatter-trust-panel__subheading formatter-trust-panel__subheading--inline"
                : "flex items-center gap-2 text-sm font-medium"
            }
          >
            <Mail className="h-4 w-4" aria-hidden />
            Data protection contact
          </div>
          <p className={embedded ? "formatter-trust-panel__body" : "text-sm text-muted-foreground"}>
            For GDPR requests (access, rectification, erasure, portability), contact:
          </p>
          <a
            href={`mailto:${GDPR_CONTACT_EMAIL}`}
            className={
              embedded
                ? "formatter-trust-panel__link"
                : "text-sm font-medium text-primary underline-offset-4 hover:underline"
            }
          >
            {GDPR_CONTACT_EMAIL}
          </a>
        </div>
      </TabsContent>
    </Tabs>
  )

  return (
    <>
      <div className={cn(embedded && "formatter-trust-panel formatter-trust-panel--privacy")}>
        {embedded ? (
          <p className="formatter-trust-panel__lead">
            GDPR rights, data export, deletion, and AI usage transparency for {AI_TOOL_NAME}.
          </p>
        ) : null}
        {tabs}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete {deleteTarget ? deleteLabels[deleteTarget] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Data will be removed from this device and cloud sync where
              applicable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PrivacyCentreDialog({
  open,
  onOpenChange,
  folderId,
  onDataDeleted,
  onOpenAiHowItWorks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId?: string | null
  onDataDeleted?: () => void
  onOpenAiHowItWorks?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[min(92vh,760px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden />
            Privacy Centre
          </DialogTitle>
          <DialogDescription>
            GDPR rights, data export, deletion, and AI usage transparency for {AI_TOOL_NAME}.
          </DialogDescription>
        </DialogHeader>
        <PrivacyCentreContent
          folderId={folderId}
          onDataDeleted={onDataDeleted}
          onOpenAiHowItWorks={onOpenAiHowItWorks}
          onDismiss={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
