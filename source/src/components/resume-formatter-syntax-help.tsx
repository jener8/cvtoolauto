"use client"

import { useCallback, useState } from "react"
import { Check, Copy } from "lucide-react"

const TABLE_EXAMPLE = `| Criterion | Evidence |
| --- | --- |
| Research | User interviews |
| AI practice | AI literacy training |`

type SyntaxHelpItem = {
  code: string
  title: string
  desc: string
  /** Offer a one-click copy for longer / easy-to-mistype examples */
  copyable?: boolean
}

export function ResumeFormattingSyntaxHelp({ language }: { language: "en" | "de" }) {
  const items: SyntaxHelpItem[] = [
    { code: "# Text", title: "Job Title / Degree Name", desc: "18px, bold, uppercase, accent color" },
    { code: "## Text", title: "Company / Institution Name", desc: "16px, bold, black" },
    { code: "### Text", title: "Date Range / Duration", desc: "14px, regular, italic, gray" },
    { code: "- Text", title: "Bullet Point Item", desc: "14px, regular, with bullet marker" },
    {
      code: "[Text](url)",
      title: "Inline hyperlink",
      desc: "Use in bullets or any line. Allowed: http://, https://, mailto:",
    },
    {
      code: "---PAGE BREAK---",
      title: "2-page A4 break (use once)",
      desc: "Place on its own line immediately before ## where page 2 starts.",
    },
    {
      code: "SKILLS [columns=2]",
      title: "Two-column list section",
      desc: "Add [columns=2] or [columns=3] after a section heading (e.g. FÄHIGKEITEN, SKILLS).",
    },
    {
      code: TABLE_EXAMPLE,
      title: "Markdown table",
      desc: "Pipe tables render as real tables in preview and PDF (two columns ≈ 30% / 70%). Good for Selected Evidence. Use **bold** for a lead phrase in evidence. Keep each cell to one clear point (~40 words) for easier scanning.",
      copyable: true,
    },
  ]

  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyExample = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000)
    } catch {
      // Fallback for restricted clipboard contexts
      const ta = document.createElement("textarea")
      ta.value = code
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000)
    }
  }, [])

  return (
    <div className="formatter-syntax-help">
      {items.map((item) => {
        const isCopied = copiedCode === item.code
        return (
          <div key={item.title} className="formatter-syntax-item">
            <div className="formatter-syntax-code-block">
              <div className="formatter-syntax-code-wrap">
                <pre className="formatter-syntax-code" tabIndex={0}>
                  {item.code}
                </pre>
              </div>
              {item.copyable ? (
                <button
                  type="button"
                  className="formatter-syntax-copy"
                  onClick={() => void copyExample(item.code)}
                  aria-label={isCopied ? "Example copied" : "Copy table example"}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3" aria-hidden />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden />
                      Copy example
                    </>
                  )}
                </button>
              ) : null}
            </div>
            <div className="formatter-syntax-meta">
              <p className="formatter-syntax-title">{item.title}</p>
              <p className="formatter-syntax-desc">{item.desc}</p>
            </div>
          </div>
        )
      })}
      <p className="formatter-popover-hint">
        <strong>Tip:</strong>{" "}
        {language === "de"
          ? "Abschnittsüberschriften (z. B. BERUFSERFAHRUNG) in ALL CAPS ohne Präfix."
          : "Section headers (like EXPERIENCE, EDUCATION) should be in ALL CAPS without any prefix."}
      </p>
    </div>
  )
}
