"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Globe } from "lucide-react"

export function OutputLanguageToggle({
  language,
  onChange,
  label = "Output language",
  description,
}: {
  language: "en" | "de"
  onChange: (lang: "en" | "de") => void
  label?: string
  description?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <Label className="text-sm">{label}</Label>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5 font-normal">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={language === "en" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange("en")}
        >
          English
        </Button>
        <Button
          type="button"
          variant={language === "de" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange("de")}
        >
          Deutsch
        </Button>
      </div>
    </div>
  )
}
