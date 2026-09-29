"use client"

import { Info, AlertTriangle } from "lucide-react"
import {
  PDF_EXPORT_PRESETS,
  formatPdfSize,
  type PdfExportPreset,
} from "@/lib/pdf-export-presets"
import { pdfSizeWarningLevel, pdfSizeWarningMessage } from "@/lib/pdf-size-estimate"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type PdfExportControlsProps = {
  preset: PdfExportPreset
  onPresetChange: (preset: PdfExportPreset) => void
  estimatedBytes: number | null
  className?: string
  variant?: "default" | "settings"
}

const PRESET_ORDER: PdfExportPreset[] = ["ats", "standard", "high"]

export function PdfExportControls({
  preset,
  onPresetChange,
  estimatedBytes,
  className,
  variant = "default",
}: PdfExportControlsProps) {
  const warningLevel = estimatedBytes != null ? pdfSizeWarningLevel(estimatedBytes) : "none"
  const warningMessage = pdfSizeWarningMessage(warningLevel)

  if (variant === "settings") {
    return (
      <fieldset className={cn("space-y-3 border-0 p-0 m-0", className)} aria-label="PDF export quality">
        <div className="quality-seg" role="group" aria-label="PDF quality preset">
          {PRESET_ORDER.map((id) => {
            const config = PDF_EXPORT_PRESETS[id]
            const active = preset === id
            const button = (
              <button
                key={id}
                type="button"
                onClick={() => onPresetChange(id)}
                className={cn("quality-seg-btn", active && "active")}
                aria-pressed={active}
              >
                {config.shortLabel}
              </button>
            )

            if (id !== "ats") return button

            return (
              <TooltipProvider key={id}>
                <Tooltip>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-sm">
                    <p className="font-medium mb-1">{PDF_EXPORT_PRESETS.ats.shortLabel}</p>
                    <p>{PDF_EXPORT_PRESETS.ats.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
        <p className="quality-desc">{PDF_EXPORT_PRESETS[preset].description}</p>

        {estimatedBytes != null ? (
          <div className="space-y-2">
            <div className="file-size-row">
              {warningLevel !== "none" ? (
                <AlertTriangle
                  className={cn(
                    warningLevel === "strong" ? "text-destructive" : "text-amber-600",
                  )}
                  aria-hidden
                />
              ) : (
                <Info aria-hidden />
              )}
              <span>
                Estimated PDF size:{" "}
                <strong
                  className={cn(
                    warningLevel === "strong"
                      ? "text-destructive"
                      : warningLevel === "warning"
                        ? "text-amber-700"
                        : undefined,
                  )}
                >
                  {formatPdfSize(estimatedBytes)}
                </strong>
              </span>
            </div>
            {warningMessage ? (
              <p
                className={cn(
                  "text-[12px] leading-snug",
                  warningLevel === "strong" ? "text-destructive" : "text-amber-800",
                )}
              >
                {warningMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    )
  }

  return (
    <fieldset
      className={cn("space-y-3", className)}
      aria-label="PDF export quality"
    >
      <div className="ui-segmented-row" role="group" aria-label="PDF quality preset">
        {PRESET_ORDER.map((id) => {
          const config = PDF_EXPORT_PRESETS[id]
          const active = preset === id
          const button = (
            <button
              key={id}
              type="button"
              onClick={() => onPresetChange(id)}
              className={cn(
                "ui-segmented-row__item seg-btn",
                active && "ui-segmented-row__item--active",
              )}
              aria-pressed={active}
            >
              {config.shortLabel}
            </button>
          )

          if (id !== "ats") return button

          return (
            <TooltipProvider key={id}>
              <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-sm">
                  <p className="font-medium mb-1">{PDF_EXPORT_PRESETS.ats.shortLabel}</p>
                  <p>{PDF_EXPORT_PRESETS.ats.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
      <p className="text-[11px] text-[var(--text-secondary)]">{PDF_EXPORT_PRESETS[preset].description}</p>

      {estimatedBytes != null ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {warningLevel !== "none" ? (
              <AlertTriangle
                className={cn(
                  "h-4 w-4 shrink-0",
                  warningLevel === "strong" ? "text-destructive" : "text-amber-600",
                )}
                aria-hidden
              />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
            )}
            <Label className="font-normal text-[12px]">
              Estimated PDF size:{" "}
              <span
                className={cn(
                  "font-medium",
                  warningLevel === "strong"
                    ? "text-destructive"
                    : warningLevel === "warning"
                      ? "text-amber-700"
                      : "text-[var(--text-primary)]",
                )}
              >
                {formatPdfSize(estimatedBytes)}
              </span>
            </Label>
          </div>
          {warningMessage ? (
            <p
              className={cn(
                "text-[11px] leading-snug",
                warningLevel === "strong" ? "text-destructive" : "text-amber-800",
              )}
            >
              {warningMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}
