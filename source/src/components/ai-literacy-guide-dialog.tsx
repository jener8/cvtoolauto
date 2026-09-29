"use client"

import type { ReactNode } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AI_TOOL_NAME } from "@/lib/ai-transparency"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Check,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react"

const BEST_PRACTICES = [
  "Review every AI suggestion carefully.",
  "Verify all facts, dates, achievements, and qualifications.",
  "Ensure the CV reflects your actual experience.",
  "Adapt suggestions to your own voice and writing style.",
  "Use AI to improve clarity and structure, not to invent experience.",
  "Compare multiple AI suggestions before accepting changes.",
  "Consider whether the suggestion improves relevance for the role.",
  "Check that AI-generated text remains accurate and authentic.",
] as const

const COMMON_MISTAKES = [
  "Accepting suggestions without review.",
  "Exaggerating skills or achievements.",
  "Including AI-generated content that cannot be supported in an interview.",
  "Using identical AI-generated cover letters for multiple applications.",
  "Over-optimising for ATS keywords at the expense of readability.",
] as const

const AI_LIMITATIONS = [
  "Misinterpret job descriptions",
  "Overstate qualifications",
  "Produce generic language",
  "Miss important context",
  "Generate inaccurate information",
] as const

function ChecklistItem({
  children,
  variant,
}: {
  children: ReactNode
  variant: "do" | "dont"
}) {
  const Icon = variant === "do" ? Check : X
  return (
    <li className="flex gap-2.5 text-sm leading-snug">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          variant === "do" ? "text-emerald-600" : "text-destructive",
        )}
        aria-hidden
      />
      <span className="text-muted-foreground">{children}</span>
    </li>
  )
}

function FormatterChecklistItem({
  children,
  variant,
}: {
  children: ReactNode
  variant: "do" | "dont"
}) {
  const Icon = variant === "do" ? Check : X
  return (
    <li className="formatter-trust-panel__check-item">
      <Icon
        className={cn(
          "formatter-trust-panel__check-icon",
          variant === "do"
            ? "formatter-trust-panel__check-icon--do"
            : "formatter-trust-panel__check-icon--dont",
        )}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  )
}

export function AiLiteracyGuideContent() {
  return (
    <div className="formatter-trust-panel" role="region" aria-label="AI literacy guidance">
      <p className="formatter-trust-panel__lead">
        Use {AI_TOOL_NAME} responsibly — stay in control of your application documents.
      </p>

      <section className="formatter-trust-panel__callout">
        <h3 className="formatter-trust-panel__heading formatter-trust-panel__heading--inline">
          <UserCheck className="h-4 w-4" aria-hidden />
          Using AI effectively
        </h3>
        <p className="formatter-trust-panel__body">
          AI can help improve your CV and cover letter, but it works best when used as a
          collaborator rather than an automatic writer.
        </p>
      </section>

      <details className="formatter-trust-panel__details" open>
        <summary className="formatter-trust-panel__summary">
          <Check className="h-4 w-4 formatter-trust-panel__summary-icon--do" aria-hidden />
          Best practices
        </summary>
        <ul className="formatter-trust-panel__checklist" aria-label="AI best practices">
          {BEST_PRACTICES.map((item) => (
            <FormatterChecklistItem key={item} variant="do">
              {item}
            </FormatterChecklistItem>
          ))}
        </ul>
      </details>

      <details className="formatter-trust-panel__details">
        <summary className="formatter-trust-panel__summary">
          <X className="h-4 w-4 formatter-trust-panel__summary-icon--dont" aria-hidden />
          Common mistakes
        </summary>
        <div className="formatter-trust-panel__details-body">
          <p className="formatter-trust-panel__hint">Avoid:</p>
          <ul className="formatter-trust-panel__checklist" aria-label="Common AI mistakes to avoid">
            {COMMON_MISTAKES.map((item) => (
              <FormatterChecklistItem key={item} variant="dont">
                {item}
              </FormatterChecklistItem>
            ))}
          </ul>
        </div>
      </details>

      <details className="formatter-trust-panel__details">
        <summary className="formatter-trust-panel__summary">
          <Scale className="h-4 w-4" aria-hidden />
          Human responsibility
        </summary>
        <div className="formatter-trust-panel__details-body">
          <p className="formatter-trust-panel__body">You remain responsible for the final document.</p>
          <p className="formatter-trust-panel__body">Recruiters assess:</p>
          <ul className="formatter-trust-panel__list">
            <li>Your experience</li>
            <li>Your judgement</li>
            <li>Your communication</li>
          </ul>
          <p className="formatter-trust-panel__body">AI can support these activities but cannot replace them.</p>
        </div>
      </details>

      <details className="formatter-trust-panel__details">
        <summary className="formatter-trust-panel__summary">
          <AlertTriangle className="h-4 w-4 formatter-trust-panel__summary-icon--warn" aria-hidden />
          AI limitations
        </summary>
        <div className="formatter-trust-panel__details-body">
          <p className="formatter-trust-panel__body">AI may:</p>
          <ul className="formatter-trust-panel__list">
            {AI_LIMITATIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="formatter-trust-panel__emphasis">Always verify content before submitting an application.</p>
        </div>
      </details>

      <details className="formatter-trust-panel__details">
        <summary className="formatter-trust-panel__summary">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Trust by design
        </summary>
        <div className="formatter-trust-panel__details-body">
          <p className="formatter-trust-panel__body">{AI_TOOL_NAME} is designed to:</p>
          <ul className="formatter-trust-panel__list">
            <li>Support human decision-making</li>
            <li>Increase transparency</li>
            <li>Maintain user control</li>
            <li>Encourage critical review of AI output</li>
          </ul>
          <p className="formatter-trust-panel__body">
            AI should help you present your experience more clearly, not replace your professional judgement.
          </p>
        </div>
      </details>
    </div>
  )
}

export function AiLiteracyGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary shrink-0" aria-hidden />
            AI Literacy Guide
          </DialogTitle>
          <DialogDescription>
            Use {AI_TOOL_NAME} responsibly — stay in control of your application documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1" role="region" aria-label="AI literacy guidance">
          <section className="rounded-lg border bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary shrink-0" aria-hidden />
              Using AI effectively
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI can help improve your CV and cover letter, but it works best when used as a
              collaborator rather than an automatic writer.
            </p>
          </section>

          <Accordion type="multiple" defaultValue={["best-practices"]} className="w-full">
            <AccordionItem value="best-practices">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                  Best practices
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2.5 pb-1" aria-label="AI best practices">
                  {BEST_PRACTICES.map((item) => (
                    <ChecklistItem key={item} variant="do">
                      {item}
                    </ChecklistItem>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="common-mistakes">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <X className="h-4 w-4 text-destructive shrink-0" aria-hidden />
                  Common mistakes
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-2">Avoid:</p>
                <ul className="space-y-2.5 pb-1" aria-label="Common AI mistakes to avoid">
                  {COMMON_MISTAKES.map((item) => (
                    <ChecklistItem key={item} variant="dont">
                      {item}
                    </ChecklistItem>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="human-responsibility">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  Human responsibility
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>You remain responsible for the final document.</p>
                <p>Recruiters assess:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your experience</li>
                  <li>Your judgement</li>
                  <li>Your communication</li>
                </ul>
                <p>AI can support these activities but cannot replace them.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ai-limitations">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
                  AI limitations
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>AI may:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {AI_LIMITATIONS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="font-medium text-foreground">
                  Always verify content before submitting an application.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trust-by-design">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  Trust by design
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>{AI_TOOL_NAME} is designed to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Support human decision-making</li>
                  <li>Increase transparency</li>
                  <li>Maintain user control</li>
                  <li>Encourage critical review of AI output</li>
                </ul>
                <p>
                  AI should help you present your experience more clearly, not replace your
                  professional judgement.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  )
}
