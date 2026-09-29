"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Briefcase,
  Download,
  FileText,
  Sparkles,
  Target,
} from "lucide-react"

const HOW_TO_STEPS = [
  {
    icon: FileText,
    title: "Add your CV source",
    description:
      "Upload a CV file, paste your resume or LinkedIn profile text, or start from a blank resume.",
  },
  {
    icon: Briefcase,
    title: "Add the job description",
    description: "Paste the full role description so tailoring matches the employer’s language and priorities.",
  },
  {
    icon: Sparkles,
    title: "Generate a tailored CV",
    description:
      "Click Create application — the app builds a role-specific CV automatically. No copy-paste into ChatGPT.",
  },
  {
    icon: Target,
    title: "Review and refine with AI",
    description:
      "Use Resume AI for live edits and Strategy AI for long-term positioning. Your preview updates as you go.",
  },
  {
    icon: Download,
    title: "Save or export your application",
    description:
      "Save versions in your workspace, export PDFs, and add cover letters or interview prep when you need them.",
  },
] as const

export function HowToUseToolDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How to use this tool</DialogTitle>
          <DialogDescription>
            A quick path from your source CV to a tailored application ready to send.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 py-2">
          {HOW_TO_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium leading-snug">{step.title}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}

export function AboutCvToolDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About EquitAI</DialogTitle>
          <DialogDescription>
            Built to speed up job applications without losing control of your story.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            This workspace helps you create <span className="text-foreground font-medium">tailored CVs</span> per
            role, keep versions organized by application, and refine content with AI while you review the live
            preview.
          </p>
          <p>
            Your CV stays the source of truth — the AI reframes real experience for each job; it does not invent
            roles or employers. Optional Strategic Profile guidance shapes tone and positioning across
            applications.
          </p>
          <p>
            Data is stored in your browser and, when configured, synced to your cloud workspace. Use Profile
            Settings to manage your account details and optional profile links.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
