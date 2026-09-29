"use client"

import {
  LINKEDIN_SECTION_LABELS,
  type LinkedInProfileSections,
} from "@/lib/linkedin-profile-types"
import { countPopulatedSections } from "@/lib/linkedin-profile-sections"
import { cn } from "@/lib/utils"
import {
  Award,
  Briefcase,
  FolderKanban,
  GraduationCap,
  Sparkles,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const SECTION_ICONS: Record<keyof LinkedInProfileSections, LucideIcon> = {
  about: User,
  experience: Briefcase,
  projects: FolderKanban,
  education: GraduationCap,
  certificates: Award,
  skills: Sparkles,
}

interface LinkedInProfilePreviewProps {
  sections: LinkedInProfileSections
  className?: string
}

export function LinkedInProfilePreview({ sections, className }: LinkedInProfilePreviewProps) {
  const populated = countPopulatedSections(sections)
  const keys = Object.keys(SECTION_ICONS) as (keyof LinkedInProfileSections)[]

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-muted-foreground">
        {populated > 0
          ? `${populated} section${populated === 1 ? "" : "s"} imported from LinkedIn`
          : "Preview of imported profile sections"}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((key) => {
          const Icon = SECTION_ICONS[key]
          const body = sections[key].trim()
          const hasContent = body.length > 0
          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
                hasContent ? "border-primary/20" : "border-dashed border-muted-foreground/25 opacity-80",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    hasContent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {LINKEDIN_SECTION_LABELS[key]}
                </span>
              </div>
              {hasContent ? (
                <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {body}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70">Not retrieved</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
