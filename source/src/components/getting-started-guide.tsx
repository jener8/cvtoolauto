"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { captureTextareaSelection } from "@/lib/assistant-selection-context"
import { Label } from "@/components/ui/label"
import { loadStrategicProfile } from "@/lib/strategic-profile"
import { COMBINED_PROMPT } from "@/lib/tailored-cv-prompt"

export { COMBINED_PROMPT } from "@/lib/tailored-cv-prompt"
import {
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Globe,
  FileText,
  Briefcase,
  MessageSquare,
} from "lucide-react"

interface GettingStartedGuideProps {
  defaultExpanded?: boolean
  onOpenResumeBuilder?: (resumeContent: string) => void
  updateMode?: boolean
  onUpdateResumeContent?: (resumeContent: string, jobDescription: string) => void
  initialJobDescription?: string
  onCancel?: () => void
}

export function GettingStartedGuide({
  defaultExpanded = true,
  onOpenResumeBuilder,
  updateMode = false,
  onUpdateResumeContent,
  initialJobDescription = "",
  onCancel,
}: GettingStartedGuideProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [jobDescription, setJobDescription] = useState(initialJobDescription)
  const [cvContent, setCvContent] = useState("")
  const [resumeContent, setResumeContent] = useState("")
  const [outputLanguage, setOutputLanguage] = useState<"en" | "de">("en")
  const [currentStep, setCurrentStep] = useState(1)

  const totalSteps = 5
  const prompt = COMBINED_PROMPT(
    jobDescription,
    cvContent,
    outputLanguage,
    typeof window !== "undefined" ? loadStrategicProfile() : null,
  )

  const canContinueStep2 = cvContent.trim().length > 0
  const canContinueStep3 = jobDescription.trim().length > 0
  const canContinueStep5 = resumeContent.trim().length > 0

  const handleLanguageChange = (lang: "en" | "de") => {
    setOutputLanguage(lang)

    if (typeof window !== "undefined") {
      sessionStorage.setItem("cvLanguage", lang)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const openResumeBuilder = () => {
    if (!resumeContent.trim()) return

    if (typeof window !== "undefined") {
      sessionStorage.setItem("cvLanguage", outputLanguage)

      if (jobDescription.trim()) {
        sessionStorage.setItem("pendingJobDescription", jobDescription)
      }
    }

    if (updateMode && onUpdateResumeContent) {
      onUpdateResumeContent(resumeContent, jobDescription)
    } else if (onOpenResumeBuilder) {
      onOpenResumeBuilder(resumeContent)
    }
  }

  const goNext = () => {
    setCurrentStep((step) => Math.min(totalSteps, step + 1))
  }

  const goBack = () => {
    setCurrentStep((step) => Math.max(1, step - 1))
  }

  const renderStepTitle = () => {
    if (currentStep === 1) return "Step 1 of 5 — Choose language"
    if (currentStep === 2) return "Step 2 of 5 — Add your current CV"
    if (currentStep === 3) return "Step 3 of 5 — Add the job description"
    if (currentStep === 4) return "Step 4 of 5 — Copy the ChatGPT prompt"
    return "Step 5 of 5 — Paste the finished CV"
  }

  const renderStepDescription = () => {
    if (currentStep === 1) {
      return "Choose the language for your CV and cover letter, then see what happens next."
    }

    if (currentStep === 2) {
      return "Paste your current CV exactly as it is. No cleaning needed."
    }

    if (currentStep === 3) {
      return "Paste the full job description. The app will use it to create your prompt."
    }

    if (currentStep === 4) {
      return "Copy the prompt into ChatGPT or a similar AI tool, then improve the result through conversation."
    }

    return "Paste the final syntax-formatted CV from ChatGPT, then open the resume builder."
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label>CV &amp; Cover Letter Language</Label>
              </div>

              <p className="text-xs text-muted-foreground">
                Choose the language for your CV and cover letter. All generated content will use this language.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant={outputLanguage === "en" ? "default" : "outline"}
                  onClick={() => handleLanguageChange("en")}
                  className="sm:flex-1"
                >
                  English
                </Button>

                <Button
                  type="button"
                  variant={outputLanguage === "de" ? "default" : "outline"}
                  onClick={() => handleLanguageChange("de")}
                  className="sm:flex-1"
                >
                  Deutsch (German)
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">What will happen next?</p>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">1.</strong> You paste your current CV. You can copy it from Word,
                  PDF, LinkedIn, or an old resume.
                </p>
                <p>
                  <strong className="text-foreground">2.</strong> You paste the job description.
                </p>
                <p>
                  <strong className="text-foreground">3.</strong> This app creates a tailored ChatGPT prompt for you.
                </p>
                <p>
                  <strong className="text-foreground">4.</strong> You copy the prompt into ChatGPT or a similar AI tool.
                  You can ask ChatGPT to improve the CV until it feels right.
                </p>
                <p>
                  <strong className="text-foreground">5.</strong> You paste the final syntax-formatted CV back here and
                  open the resume builder.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium">In the resume builder you can:</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Change the CV format and visual style</li>
                <li>Edit the content again</li>
                <li>Add page breaks</li>
                <li>Create a cover letter</li>
                <li>Export your CV as PDF or Word</li>
              </ul>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Don&apos;t worry about formatting — just copy &amp; paste.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Paste your CV exactly as it is. The AI will clean, structure, and format the content for you.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label>Current CV Content</Label>
              </div>

              <Textarea
                placeholder="Paste your CV/resume content here..."
                value={cvContent}
                onChange={(e) => setCvContent(e.target.value)}
                onMouseUp={(e) =>
                  captureTextareaSelection("resume", e.currentTarget)
                }
                onKeyUp={(e) =>
                  captureTextareaSelection("resume", e.currentTarget)
                }
                className="min-h-[320px] text-sm bg-muted/30"
              />

              <p className="text-xs text-muted-foreground">
                You can paste directly from Word, PDF, or LinkedIn — formatting doesn&apos;t matter.
              </p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Paste the full job description.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Include everything: responsibilities, requirements, benefits, and company information. Long and messy is
                fine.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <Label>Job Description</Label>
              </div>

              <Textarea
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                onMouseUp={(e) =>
                  captureTextareaSelection("job_description", e.currentTarget)
                }
                onKeyUp={(e) =>
                  captureTextareaSelection("job_description", e.currentTarget)
                }
                className="min-h-[320px] text-sm bg-muted/30"
              />

              <p className="text-xs text-muted-foreground">
                The prompt will use this to match your CV to the role.
              </p>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Use this prompt in ChatGPT</p>
              </div>

              <p className="text-sm text-muted-foreground">
                Copy this prompt into ChatGPT or a similar AI tool. ChatGPT will create a CV using the special syntax
                that this resume builder understands.
              </p>

              <div className="rounded-md bg-background p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">You can improve the result before copying it back:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>“Make sure my achievements include measurable % results.”</li>
                  <li>“Bring my independent project experience higher up.”</li>
                  <li>“Make this shorter and more focused.”</li>
                  <li>“Highlight my UX strategy experience more strongly.”</li>
                  <li>“Make the profile sound more senior.”</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                When you are happy with the answer, copy the full code block from ChatGPT and paste it in the next step.
              </p>
            </div>

            <div className="relative">
              <pre className="rounded-lg bg-muted p-4 pr-32 text-xs overflow-x-auto whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                {prompt}
              </pre>

              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 gap-1.5"
                onClick={copyToClipboard}
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Paste the finished CV from ChatGPT.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Copy everything from ChatGPT&apos;s code block and paste it here. You do not need to tidy it up first.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label>Formatted Resume Content</Label>
              </div>

              <Textarea
                placeholder="Paste your syntax-formatted resume from ChatGPT here..."
                value={resumeContent}
                onChange={(e) => setResumeContent(e.target.value)}
                className="min-h-[320px] text-sm font-mono bg-muted/30"
              />
            </div>

            <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Resume Formatting Syntax</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>
                  <code># Text</code> = Job Title or Degree Name
                </li>
                <li>
                  <code>## Text</code> = Company or Institution Name
                </li>
                <li>
                  <code>### Text</code> = Date Range / Duration
                </li>
                <li>
                  <code>- Text</code> = Bullet Point Item
                </li>
                <li>
                  <code>[Text](url)</code> = Inline link in any bullet or line
                </li>
                <li>
                  <code>---PAGE BREAK---</code> = Exactly one break, on its own line before{" "}
                  <code>##</code> where page 2 starts (2-page CV)
                </li>
              </ul>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className={updateMode ? "border-0 shadow-none" : "border-dashed"}>
      {!updateMode && (
        <CardHeader className="cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Getting Started Guide</CardTitle>
              <CardDescription>Learn how to create an ATS-optimized resume in minutes</CardDescription>
            </div>

            <Button variant="ghost" size="icon" className="bg-transparent">
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
        </CardHeader>
      )}

      {(isExpanded || updateMode) && (
        <CardContent className={updateMode ? "space-y-6 p-0" : "space-y-6"}>
          <div className="rounded-xl border bg-card p-5 sm:p-7 space-y-7">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">{renderStepTitle()}</h2>
                <p className="text-sm text-muted-foreground mt-1">{renderStepDescription()}</p>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full ${step <= currentStep ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
            </div>

            {renderStepContent()}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t">
              <div>
                {updateMode && onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={goBack} disabled={currentStep === 1}>
                  Back
                </Button>

                {currentStep < totalSteps ? (
                  <Button
                    onClick={goNext}
                    disabled={
                      (currentStep === 2 && !canContinueStep2) ||
                      (currentStep === 3 && !canContinueStep3)
                    }
                  >
                    Continue
                  </Button>
                ) : (
                  <Button onClick={openResumeBuilder} disabled={!canContinueStep5}>
                    {updateMode ? "Finish & Update Resume" : "Finish & See Resume"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Pro Tip:</strong> Keep your CV truthful. Use ChatGPT to improve
              clarity, order, and impact — but do not invent experience, skills, or metrics.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}