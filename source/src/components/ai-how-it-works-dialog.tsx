"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AI_TOOL_NAME } from "@/lib/ai-transparency"

const SECTIONS = [
  {
    title: "What data is sent to AI",
    body:
      "When you use AI features, the tool may send your CV text, job description excerpts, selected text, strategic profile notes, and your instructions. Data is sent only when you trigger an AI action — not continuously in the background.",
  },
  {
    title: "Which model is used",
    body:
      "The active model depends on your server configuration (OpenAI, Anthropic, or AI Gateway). The exact provider and model name are shown in the AI Information panel and recorded in your change history when you approve an edit.",
  },
  {
    title: "Human review is required",
    body:
      "AI never changes your CV without your explicit approval. Every suggestion offers Accept, Compare, Edit, or Reject. You are responsible for reviewing accuracy before export.",
  },
  {
    title: "Limitations and inaccuracies",
    body:
      "AI can misread context, invent details, or over-optimize for keywords. Factual checks run on some edits, but they cannot catch every error. Always verify employers, dates, titles, and metrics yourself.",
  },
  {
    title: "Your responsibility",
    body:
      "The final CV is yours. AI assists with drafting and refinement — it does not replace your judgment. Use the change history and diff tools to understand what changed before sharing your CV.",
  },
] as const

export function AiHowItWorksContent({ idPrefix = "ai-info" }: { idPrefix?: string }) {
  return (
    <div className="formatter-trust-panel" role="region" aria-label="AI usage explanation">
      <p className="formatter-trust-panel__lead">
        Transparency about data, models, limitations, and your control over the final CV.
      </p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="formatter-trust-panel__section">
          <h3 className="formatter-trust-panel__heading">{section.title}</h3>
          <p className="formatter-trust-panel__body">{section.body}</p>
        </section>
      ))}
    </div>
  )
}

export function AiHowItWorksDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,680px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How AI is used in {AI_TOOL_NAME}</DialogTitle>
          <DialogDescription>
            Transparency about data, models, limitations, and your control over the final CV.
          </DialogDescription>
        </DialogHeader>
        <AiHowItWorksContent />
      </DialogContent>
    </Dialog>
  )
}
