"use client"

import type { ResumeVersion } from "@/types/resume"

interface ResumePrintViewProps {
  version: ResumeVersion
  accentColorRgb: string
}

interface Section {
  title: string
  content: string[]
}

export function ResumePrintView({ version, accentColorRgb }: ResumePrintViewProps) {
  const parseResumeForViewing = (text: string): Section[] => {
    if (!text) return []
    const lines = text.split("\n")
    const sections: Section[] = []
    let currentSection: Section | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const isSectionHeader =
        line.length > 0 &&
        line === line.toUpperCase() &&
        !line.startsWith("•") &&
        !line.startsWith("-") &&
        !line.startsWith("*") &&
        !line.startsWith("#")

      if (isSectionHeader) {
        if (currentSection && currentSection.content.length > 0) {
          sections.push(currentSection)
        }
        currentSection = { title: line, content: [] }
      } else if (currentSection && line) {
        currentSection.content.push(lines[i])
      }
    }

    if (currentSection && currentSection.content.length > 0) {
      sections.push(currentSection)
    }

    return sections
  }

  const sections = parseResumeForViewing(version.resumeText)

  return (
    <div
      style={{
        width: "800px",
        backgroundColor: "#ffffff",
        color: "#000000",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        lineHeight: "1.5",
        padding: "40px",
      }}
    >
      {/* Header with contact info */}
      <div style={{ marginBottom: "30px", borderBottom: `3px solid ${accentColorRgb}`, paddingBottom: "20px" }}>
        {/* Name */}
        {version.contactInfo?.name && (
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: accentColorRgb,
              margin: "0 0 8px 0",
              textTransform: "uppercase",
            }}
          >
            {version.contactInfo.name}
          </h1>
        )}

        {/* Professional Title */}
        {version.contactInfo?.professionalTitle && (
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "normal",
              color: "#666666",
              margin: "0 0 16px 0",
            }}
          >
            {version.contactInfo.professionalTitle}
          </h2>
        )}

        {/* Contact Details */}
        <div style={{ fontSize: "12px", color: "#444444", lineHeight: "1.8" }}>
          {version.contactInfo?.email && (
            <div>
              <strong>Email:</strong> {version.contactInfo.email}
            </div>
          )}
          {version.contactInfo?.phone && (
            <div>
              <strong>Phone:</strong> {version.contactInfo.phone}
            </div>
          )}
          {version.contactInfo?.linkedin && (
            <div>
              <strong>LinkedIn:</strong> {version.contactInfo.linkedin}
            </div>
          )}
          {version.contactInfo?.address && (
            <div>
              <strong>Address:</strong> {version.contactInfo.address}
            </div>
          )}
        </div>
      </div>

      {/* Resume Sections */}
      {sections.map((section, idx) => (
        <div key={idx} style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: accentColorRgb,
              textTransform: "uppercase",
              margin: "0 0 12px 0",
              borderBottom: `2px solid ${accentColorRgb}`,
              paddingBottom: "6px",
            }}
          >
            {section.title}
          </h3>
          <div style={{ fontSize: "14px", color: "#000000", lineHeight: "1.6" }}>
            {section.content.map((line, lineIdx) => {
              const trimmed = line.trim()
              if (!trimmed) return null

              // Bullet points
              if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
                return (
                  <div
                    key={lineIdx}
                    style={{
                      marginLeft: "20px",
                      marginBottom: "6px",
                      display: "flex",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ color: accentColorRgb, marginRight: "8px", fontWeight: "bold" }}>•</span>
                    <span>{trimmed.substring(1).trim()}</span>
                  </div>
                )
              }

              // Company/institution names (bold)
              if (
                /^[A-ZÄÖÜ]/.test(trimmed) &&
                trimmed !== trimmed.toUpperCase() &&
                trimmed.length > 3 &&
                !trimmed.includes(",") &&
                !trimmed.includes("–")
              ) {
                return (
                  <div key={lineIdx} style={{ fontWeight: "bold", marginTop: "12px", marginBottom: "4px" }}>
                    {trimmed}
                  </div>
                )
              }

              // Regular text
              return (
                <div key={lineIdx} style={{ marginBottom: "6px" }}>
                  {trimmed}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
