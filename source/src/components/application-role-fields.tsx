"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  COMPANY_NOT_ADDED,
  JOB_TITLE_NOT_ADDED,
  LOCATION_NOT_ADDED,
} from "@/lib/job-application-display"
import { cn } from "@/lib/utils"
import { MapPin, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

export type ApplicationRoleFieldValues = {
  jobTitle: string
  company: string
  location: string
}

export interface ApplicationRoleFieldsProps {
  values: ApplicationRoleFieldValues
  onSave: (values: ApplicationRoleFieldValues) => void
  layout?: "card" | "form"
  className?: string
  /** When true, edit controls stop click propagation (e.g. inside a clickable card). */
  isolateEditControls?: boolean
}

export function ApplicationRoleFields({
  values,
  onSave,
  layout = "card",
  className,
  isolateEditControls = false,
}: ApplicationRoleFieldsProps) {
  const guardClick = (e: React.MouseEvent) => {
    if (isolateEditControls) e.stopPropagation()
  }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(values)

  useEffect(() => {
    if (!editing) setDraft(values)
  }, [values, editing])

  const persistDraft = () => {
    onSave({
      jobTitle: draft.jobTitle.trim(),
      company: draft.company.trim(),
      location: draft.location.trim(),
    })
  }

  /** Persist changes and leave editing mode. */
  const saveAndClose = () => {
    persistDraft()
    setEditing(false)
  }

  const cancel = () => {
    setDraft(values)
    setEditing(false)
  }

  if (editing || layout === "form") {
    return (
      <div
        className={cn("space-y-2", className)}
        onClick={isolateEditControls ? guardClick : undefined}
        onKeyDown={(e) => {
          if (isolateEditControls) e.stopPropagation()
          if (layout !== "card") return
          if (e.key === "Escape") {
            e.preventDefault()
            cancel()
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            saveAndClose()
          }
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">Job title</Label>
          <Input
            value={draft.jobTitle}
            onChange={(e) => setDraft((prev) => ({ ...prev, jobTitle: e.target.value }))}
            placeholder="e.g. Responsible AI Manager"
            className="h-9"
            autoFocus={layout === "card"}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Company name</Label>
          <Input
            value={draft.company}
            onChange={(e) => setDraft((prev) => ({ ...prev, company: e.target.value }))}
            placeholder="e.g. Heraeus"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Location (optional)</Label>
          <Input
            value={draft.location}
            onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="e.g. Hanau, Germany"
            className="h-9"
          />
        </div>
        {layout === "card" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className="h-9 px-4"
              onClick={(e) => {
                guardClick(e)
                saveAndClose()
              }}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 px-4"
              onClick={(e) => {
                guardClick(e)
                cancel()
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        {layout === "form" && (
          <button type="button" className="sr-only" onClick={persistDraft}>
            Save role fields
          </button>
        )}
      </div>
    )
  }

  const title = values.jobTitle.trim() || JOB_TITLE_NOT_ADDED
  const company = values.company.trim() || COMPANY_NOT_ADDED
  const location = values.location.trim()
  const titleIsPlaceholder = !values.jobTitle.trim()
  const companyIsPlaceholder = !values.company.trim()

  return (
    <div className={cn("group/role relative space-y-0.5", className)}>
      <button
        type="button"
        onClick={(e) => {
          guardClick(e)
          setEditing(true)
        }}
        className="absolute right-0 top-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/role:opacity-100 focus:opacity-100"
        aria-label="Edit job title, company, and location"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <h3
        className={cn(
          "text-[14px] font-medium pr-8 leading-snug text-[var(--text-primary)]",
          titleIsPlaceholder && "italic text-[var(--text-secondary)] font-normal",
        )}
      >
        {title}
      </h3>

      <p
        className={cn(
          "text-[13px] leading-snug",
          companyIsPlaceholder ? "italic text-[var(--text-secondary)]" : "text-[var(--text-secondary)]",
        )}
      >
        {company}
      </p>

      {location ? (
        <p className="flex items-center gap-1 ui-meta">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {location}
        </p>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            guardClick(e)
            setEditing(true)
          }}
          className="flex items-center gap-1 text-sm italic text-muted-foreground/70 hover:text-muted-foreground"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {LOCATION_NOT_ADDED}
        </button>
      )}
    </div>
  )
}
