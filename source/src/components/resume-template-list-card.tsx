"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatApplicationDate } from "@/lib/job-application-display"
import {
  getResumeLanguage,
  getResumeLanguageLabel,
} from "@/lib/resume-language"
import type { ResumeVersion } from "@/lib/types"
import { FileText, Trash2 } from "lucide-react"

export interface ResumeTemplateListCardProps {
  version: ResumeVersion
  onOpen: () => void
  onDelete: () => void
}

export function ResumeTemplateListCard({
  version,
  onOpen,
  onDelete,
}: ResumeTemplateListCardProps) {
  const displayDate = formatApplicationDate(version.createdAt ?? version.timestamp)
  const cvLanguage = getResumeLanguage(version)
  const preview =
    version.resumeText.trim().split("\n").find((line) => line.trim())?.slice(0, 120) ?? ""

  return (
    <Card className="ui-workspace-card gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="ui-card-title leading-snug text-foreground">
              {version.name.trim() || "Untitled Resume"}
            </h3>

            {preview && (
              <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 ui-meta">
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-medium text-[var(--accent-primary)]">
                Resume template
              </span>
              <span className="inline-flex rounded-full bg-[var(--color-inset)] px-2 py-0.5 font-medium text-[var(--color-text-muted)]">
                {getResumeLanguageLabel(cvLanguage)}
              </span>
              {displayDate && <span>Saved {displayDate}</span>}
              <span>Reusable CV · link when creating an application</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button onClick={onOpen} variant="outline" size="sm" className="ui-utility-btn h-11">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Open template
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Delete resume template"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
