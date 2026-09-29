"use client"

import { Download } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  FormatterPopoverSection,
  FormatterToggleRow,
} from "@/components/formatter-popover-shell"

type FormatterExportPanelProps = {
  onDownloadPdf: () => void
  onDownloadWord: () => void
  isDownloadingPdf: boolean
  estimatedPdfBytes: number | null
  includeExportMetadata: boolean
  onIncludeExportMetadataChange: (v: boolean) => void
  includeTransparencyPage: boolean
  onIncludeTransparencyPageChange: (v: boolean) => void
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FormatterExportPanel({
  onDownloadPdf,
  onDownloadWord,
  isDownloadingPdf,
  estimatedPdfBytes,
  includeExportMetadata,
  onIncludeExportMetadataChange,
  includeTransparencyPage,
  onIncludeTransparencyPageChange,
}: FormatterExportPanelProps) {
  const pdfSize = formatFileSize(estimatedPdfBytes)

  return (
    <>
      <FormatterPopoverSection label="Download">
        <button
          type="button"
          className="formatter-export-row"
          onClick={onDownloadPdf}
          disabled={isDownloadingPdf}
        >
          <span className="formatter-export-row__text">
            <span className="formatter-export-row__title">PDF</span>
            {pdfSize ? <span className="formatter-export-row__sub">{pdfSize}</span> : null}
          </span>
          <Download className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" className="formatter-export-row" onClick={onDownloadWord}>
          <span className="formatter-export-row__title">Word</span>
          <Download className="h-3.5 w-3.5" aria-hidden />
        </button>
      </FormatterPopoverSection>

      <FormatterPopoverSection label="Declarations">
        <FormatterToggleRow
          label="Embed AI metadata"
          description="Saved in PDF file properties"
          checked={includeExportMetadata}
          onChange={onIncludeExportMetadataChange}
        />
        <FormatterToggleRow
          label="Show AI declaration"
          description="Adds transparency page at end of export"
          checked={includeTransparencyPage}
          onChange={onIncludeTransparencyPageChange}
        />
      </FormatterPopoverSection>
    </>
  )
}

export function FormatterPageBreaksContent({
  items,
  overflowWarning,
  showOverflowWarning,
}: {
  items: string[]
  overflowWarning?: string
  showOverflowWarning?: boolean
}) {
  return (
    <div className="formatter-trust-panel" role="region" aria-label="Page breaks guidance">
      {showOverflowWarning && overflowWarning ? (
        <p className="formatter-trust-panel__callout formatter-trust-panel__callout--warn">
          {overflowWarning}
        </p>
      ) : null}
      <ul className="formatter-trust-panel__list">
        {items.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

export function FormatterSettingsPanel({
  humanFormatStyle,
  onHumanFormatStyleChange,
  cvStyleOptions,
}: {
  humanFormatStyle: string
  onHumanFormatStyleChange: (id: string) => void
  cvStyleOptions: { id: string; name: string; desc: string }[]
}) {
  return (
    <>
      <FormatterPopoverSection label="CV style">
        <div className="formatter-style-list" role="radiogroup" aria-label="CV style">
          {cvStyleOptions.map(({ id, name, desc }) => {
            const active = humanFormatStyle === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                className={cn("formatter-style-item", active && "formatter-style-item--active")}
                onClick={() => onHumanFormatStyleChange(id)}
              >
                <span className="formatter-style-item__radio" aria-hidden />
                <span className="min-w-0">
                  <span className="formatter-style-item__name">{name}</span>
                  <span className="formatter-style-item__desc">{desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </FormatterPopoverSection>
    </>
  )
}

export function FormatterVersionsPanel({ children }: { children: React.ReactNode }) {
  return <FormatterPopoverSection label="Versions">{children}</FormatterPopoverSection>
}
