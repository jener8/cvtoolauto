"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Check, Laptop } from "lucide-react"

const benefits = [
  "See your CV structure clearly",
  "Compare versions side by side",
  "Edit long sections comfortably",
  "Review formatting before export",
  "Create tailored CVs faster with AI guidance",
  "Use coaching prompts to improve the quality of each version",
] as const

/**
 * Full-screen guidance when `/app` is opened on a viewport better suited to a larger layout.
 * Intentional, product-led tone — not an error state.
 */
export function LargeScreenRequired() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-10 sm:py-14 md:py-16">
      <Card className="w-full max-w-2xl overflow-hidden border border-border/80 bg-card shadow-xl">
        <CardHeader className="space-y-5 pb-2 text-center sm:space-y-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            EquitAI
          </p>

          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4 ring-1 ring-primary/10">
              <Laptop className="h-8 w-8 text-primary" strokeWidth={1.5} aria-hidden />
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Designed for focused CV editing
            </h1>
            <CardDescription className="mx-auto max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg">
              This tool works best on a larger screen so you can compare, edit, preview, and tailor
              your CV with confidence.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 px-6 pb-8 pt-2 sm:px-8">
          <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">
            <img
              src="/og-cv-tool-v3.jpg"
              alt="CV layout previews from EquitAI"
              width={1200}
              height={630}
              decoding="async"
              className="h-auto w-full object-cover"
            />
          </div>

          <ul className="mx-auto max-w-lg space-y-3.5">
            {benefits.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-left text-sm leading-snug text-muted-foreground sm:text-[15px]"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-3 w-3 text-primary" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>

          <Separator className="bg-border/70" />

          <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-5 text-center sm:px-8">
            <p className="text-pretty text-sm leading-relaxed text-foreground sm:text-base">
              For the best experience, open this tool on a desktop, laptop, or tablet in landscape
              mode.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button asChild size="lg" className="min-h-11 min-w-[min(100%,280px)] px-8 text-base">
              <a href="/">Visit EquitAI</a>
            </Button>
            <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
              You can still share this link with yourself and continue on a larger device.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
