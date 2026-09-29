"use client"

export function ResumeFormattingSyntaxHelp({ language }: { language: "en" | "de" }) {
  const items = [
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
  ]

  return (
    <div className="formatter-syntax-help">
      {items.map((item) => (
        <div key={item.code} className="formatter-syntax-item">
          <code className="formatter-syntax-code">{item.code}</code>
          <div className="min-w-0">
            <p className="formatter-syntax-title">{item.title}</p>
            <p className="formatter-syntax-desc">{item.desc}</p>
          </div>
        </div>
      ))}
      <p className="formatter-popover-hint">
        <strong>Tip:</strong>{" "}
        {language === "de"
          ? "Abschnittsüberschriften (z. B. BERUFSERFAHRUNG) in ALL CAPS ohne Präfix."
          : "Section headers (like EXPERIENCE, EDUCATION) should be in ALL CAPS without any prefix."}
      </p>
    </div>
  )
}
