"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { JobApplication } from "@/lib/types"
import { ArrowLeft, Save, Copy, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface JobStrategyProps {
  job: JobApplication
  onUpdate: (updates: Partial<JobApplication>) => void
  onBack: () => void
}

export function JobStrategy({ job, onUpdate, onBack }: JobStrategyProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [strategy, setStrategy] = useState(
    job.jobStrategy || {
      intent: "",
      strategicFit: "",
      positioning: "",
      constraints: "",
      successCriteria: "",
      lastModified: Date.now(),
    },
  )
  const [backgroundSummary, setBackgroundSummary] = useState("")
  const [strategySummary, setStrategySummary] = useState(job.strategySummary || "")

  const handleGenerateBackgroundPrompt = () => {
    if (!job.jobDescription) {
      toast({
        title: "Missing job description",
        description: "Please add a job description first.",
        variant: "destructive",
      })
      return
    }

    const prompt = `I need to create a brief professional background summary (5-7 lines) for a job application.

Job Title: ${job.jobTitle}
Company: ${job.company}
Job Description: ${job.jobDescription}

Please create a concise professional summary that highlights:
- My relevant experience and background
- Key skills and expertise areas
- What makes me a strong fit for this specific role

Keep it to 5-7 lines and focus on the most relevant aspects for this position.`

    navigator.clipboard.writeText(prompt)
    toast({
      title: "Prompt copied!",
      description: "Paste this into ChatGPT to generate your background summary.",
    })
  }

  const handleGenerateStrategySummaryPrompt = () => {
    const strategyText = `
Intent: ${strategy.intent || "Not provided"}
Strategic Fit: ${strategy.strategicFit || "Not provided"}
Positioning: ${strategy.positioning || "Not provided"}
Constraints: ${strategy.constraints || "Not provided"}
Success Criteria: ${strategy.successCriteria || "Not provided"}
`.trim()

    if (!strategy.intent && !strategy.strategicFit) {
      toast({
        title: "Missing strategy details",
        description: "Please fill out at least Intent and Strategic Fit sections first.",
        variant: "destructive",
      })
      return
    }

    const prompt = `I have a detailed job application strategy that I need to summarize into 2-3 concise sentences for a dashboard card display.

Job Title: ${job.jobTitle}
Company: ${job.company}

Full Strategy:
${strategyText}

Please create a 2-3 sentence summary that captures:
- The core intent/goal of this application
- Key strategic positioning or value proposition
- What makes this opportunity unique or important

Keep it concise and impactful for quick reference.`

    navigator.clipboard.writeText(prompt)
    toast({
      title: "Prompt copied!",
      description: "Paste this into ChatGPT to generate your strategy summary.",
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    // Simulate brief save operation for user feedback
    await new Promise((resolve) => setTimeout(resolve, 500))

    onUpdate({
      jobStrategy: strategy,
      strategySummary: strategySummary,
    })

    toast({
      title: "Strategy saved",
      description: "Your job strategy has been saved successfully.",
    })

    setIsSaving(false)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={onBack} variant="ghost" disabled={isSaving}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Strategy
              </>
            )}
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">Job Application Strategy</h1>
          <p className="text-muted-foreground">
            {job.jobTitle} at {job.company}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Background Summary Prompt</CardTitle>
            <CardDescription>
              Generate a ChatGPT prompt to create your brief professional background (5-7 lines)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGenerateBackgroundPrompt} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy Background Prompt for ChatGPT
            </Button>
            <Textarea
              placeholder="Paste the generated background summary from ChatGPT here..."
              value={backgroundSummary}
              onChange={(e) => setBackgroundSummary(e.target.value)}
              rows={5}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategy Summary (for card display)</CardTitle>
            <CardDescription>
              Create a 2-3 sentence summary of your strategy to display on the job application card
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGenerateStrategySummaryPrompt} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy Summary Prompt for ChatGPT
            </Button>
            <Textarea
              placeholder="Paste the generated strategy summary from ChatGPT here (2-3 sentences)..."
              value={strategySummary}
              onChange={(e) => setStrategySummary(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1. Intent</CardTitle>
            <CardDescription>Why are you applying? What kind of role is this for you?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={strategy.intent}
              onChange={(e) => setStrategy({ ...strategy, intent: e.target.value })}
              placeholder="Why are you applying for this role? What kind of role is this (bridge, anchor, stretch, option)?"
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Strategic Fit</CardTitle>
            <CardDescription>Why this company and role now? Where's the mutual value?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={strategy.strategicFit}
              onChange={(e) => setStrategy({ ...strategy, strategicFit: e.target.value })}
              placeholder="Why this company? Why this role now? Where is the mutual value?"
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Positioning Choice</CardTitle>
            <CardDescription>How are you positioning yourself? What to emphasize?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={strategy.positioning}
              onChange={(e) => setStrategy({ ...strategy, positioning: e.target.value })}
              placeholder="How are you positioning yourself? What strengths to emphasize? What to deliberately not emphasize?"
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Constraints & Truths</CardTitle>
            <CardDescription>What must remain factually accurate?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={strategy.constraints}
              onChange={(e) => setStrategy({ ...strategy, constraints: e.target.value })}
              placeholder="What must remain factually accurate? What constraints apply? What must not conflict with previous roles?"
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Success Criteria</CardTitle>
            <CardDescription>What would success look like?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={strategy.successCriteria}
              onChange={(e) => setStrategy({ ...strategy, successCriteria: e.target.value })}
              placeholder="What would success look like in 12–24 months? Early warning signs? What would make this the wrong role?"
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
