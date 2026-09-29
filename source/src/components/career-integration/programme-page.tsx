"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PLATFORM_MISSION,
  PROGRAMME_FRAMING,
  PROGRAMME_FUNDING_NOTE,
} from "@/lib/career-integration-platform"
import { PRODUCT_NAME } from "@/lib/brand"
import { ArrowLeft, HeartHandshake, Sparkles } from "lucide-react"

type ProgrammePageProps = {
  onBack: () => void
}

export function ProgrammePage({ onBack }: ProgrammePageProps) {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 px-6 py-6 lg:px-8">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Programme &amp; partnerships</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{PLATFORM_MISSION}</p>
      </header>

      <div className="grid gap-6 p-6 lg:max-w-3xl lg:p-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartHandshake className="h-4 w-4 text-[var(--color-primary-light)]" />
              For organisations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>{PROGRAMME_FRAMING}</p>
            <p>
              {PRODUCT_NAME} supports refugee women and women with migration or refugee experience
              with career integration — not only CV generation, but documents, job search progress,
              confidence-building narratives, and safe AI guidance.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Sponsored access
            </CardTitle>
            <CardDescription>Programme-facing note</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>{PROGRAMME_FUNDING_NOTE}</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Contact your programme coordinator or{" "}
          <a href="mailto:info@jennifersimonds.com" className="text-[var(--color-primary-light)] underline-offset-4 hover:underline">
            reach out to us
          </a>{" "}
          to discuss pilot partnerships.
        </p>
      </div>
    </div>
  )
}
