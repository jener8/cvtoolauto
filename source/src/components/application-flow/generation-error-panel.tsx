"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { CvParseDiagnostics } from "@/lib/ai-cv-response"
import type { AiErrorCode } from "@/lib/ai/errors"
import { Check, ChevronDown, Copy, RefreshCw, Sparkles } from "lucide-react"

function friendlyErrorMessage(errorCode?: AiErrorCode, fallback?: string): string {
  switch (errorCode) {
    case "missing_api_key":
      return "AI analysis requires an OpenAI API key. Configure OPENAI_API_KEY in your environment settings and restart the application."
    case "invalid_api_key":
      return "Invalid OpenAI API key. Check OPENAI_API_KEY in .env.local and restart the dev server."
    case "model_not_found":
      return "The configured OpenAI model was not found. Set OPENAI_MODEL in .env.local (e.g. gpt-4o)."
    case "quota_exceeded":
      return "OpenAI quota or billing limit reached. Check your OpenAI account billing and usage."
    case "malformed_request":
      return fallback ?? "The request to OpenAI was rejected. Try shorter CV or job description text."
    case "timeout":
      return "Generation took too long. Try again, or shorten your source CV and job description."
    case "rate_limit":
      return "The AI service is busy. Wait a moment, then try again."
    case "parse_error":
      return "We could not parse a valid resume from the AI response. Try again."
    case "validation_error":
      return (
        fallback ??
        "The generated CV could not be validated. Try again, or use the recovered content below."
      )
    case "api_error":
      return fallback ?? "The AI service returned an error."
    default:
      return fallback ?? "Something went wrong while generating your CV."
  }
}

interface GenerationErrorPanelProps {
  errorMessage?: string
  errorCode?: AiErrorCode
  failureCount: number
  copiedPrompt: boolean
  manualCvFallback: string
  rawAiResponse?: string
  parseDiagnostics?: CvParseDiagnostics
  onRetry: () => void
  onCopyPrompt: () => void
  onManualChange: (value: string) => void
  onManualContinue: () => void
  onUseGeneratedAnyway?: () => void
}

export function GenerationErrorPanel({
  errorMessage,
  errorCode,
  failureCount,
  copiedPrompt,
  manualCvFallback,
  rawAiResponse,
  parseDiagnostics,
  onRetry,
  onCopyPrompt,
  onManualChange,
  onManualContinue,
  onUseGeneratedAnyway,
}: GenerationErrorPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    if (failureCount >= 1) setAdvancedOpen(true)
  }, [failureCount])

  const hasRecoverableContent = Boolean(manualCvFallback.trim())

  return (
    <div className="mt-10 max-w-2xl mx-auto space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Automatic generation failed</p>
        <p className="text-sm text-muted-foreground">
          {friendlyErrorMessage(errorCode, errorMessage)}
        </p>
      </div>

      <Button type="button" className="w-full gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>

      {hasRecoverableContent && onUseGeneratedAnyway && (
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          onClick={onUseGeneratedAnyway}
        >
          <Sparkles className="h-4 w-4" />
          Use generated content anyway
        </Button>
      )}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs text-muted-foreground"
          >
            Advanced fallback options
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2 border-t">
          {(parseDiagnostics || rawAiResponse) && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
              <p className="font-medium text-foreground">Parse diagnostics</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                <dt>AI response received</dt>
                <dd className="text-foreground">{rawAiResponse ? "Yes" : "No"}</dd>
                {parseDiagnostics && (
                  <>
                    <dt>Extracted length</dt>
                    <dd className="text-foreground tabular-nums">{parseDiagnostics.length} chars</dd>
                    <dt>Has # title lines</dt>
                    <dd className="text-foreground">{parseDiagnostics.hasHeading ? "Yes" : "No"}</dd>
                    <dt>Has ## company lines</dt>
                    <dd className="text-foreground">{parseDiagnostics.hasCompanyLine ? "Yes" : "No"}</dd>
                    <dt>Section headers</dt>
                    <dd className="text-foreground">
                      {parseDiagnostics.hasSectionHeader ? "Yes" : "No"}
                    </dd>
                    <dt>Bullet count</dt>
                    <dd className="text-foreground tabular-nums">{parseDiagnostics.bulletCount}</dd>
                    <dt>Looks like JSON</dt>
                    <dd className="text-foreground">
                      {parseDiagnostics.looksLikeJson ? "Yes" : "No"}
                    </dd>
                    <dt>Looks like chat</dt>
                    <dd className="text-foreground">
                      {parseDiagnostics.looksLikeChat ? "Yes" : "No"}
                    </dd>
                    {parseDiagnostics.validationError && (
                      <>
                        <dt>Validation error</dt>
                        <dd className="col-span-2 text-destructive">
                          {parseDiagnostics.validationError}
                        </dd>
                      </>
                    )}
                  </>
                )}
              </dl>
              {parseDiagnostics?.preview && (
                <p className="text-[10px] text-muted-foreground font-mono break-all border-t pt-2">
                  Preview: {parseDiagnostics.preview}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Emergency only: copy the prompt to an external AI tool, then paste the formatted result
            below.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onCopyPrompt}
          >
            {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedPrompt ? "Copied" : "Copy prompt"}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="manualCvFallback" className="text-xs">
              Paste or edit AI result
            </Label>
            <Textarea
              id="manualCvFallback"
              placeholder="Paste the formatted CV from your AI tool…"
              value={manualCvFallback}
              onChange={(e) => onManualChange(e.target.value)}
              className="min-h-[200px] font-mono text-sm bg-muted/20"
            />
          </div>
          <Button
            variant="secondary"
            className="w-full gap-2"
            disabled={!manualCvFallback.trim()}
            onClick={onManualContinue}
          >
            <Sparkles className="h-4 w-4" />
            Continue with pasted CV
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
