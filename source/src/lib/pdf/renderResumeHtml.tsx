import { formattedTextToHtml } from "../resume-inline-links"
import {
  CV_TWO_COLUMN_LIST_CSS,
  parseTwoColumnSectionItems,
  renderCVColumnListHtml,
  resolveSectionColumnCount,
} from "../cv-two-column-section"
import type { Section } from "../types"

export interface ResumeData {
  sections: Section[]
  contactInfo: {
    name?: string
    email?: string
    phone?: string
    location?: string
    website?: string
    linkedin?: string
    github?: string
  }
  profileImage?: string
  companyLogo?: string
}

export function renderResumeHtmlForPdf(data: ResumeData, accentColorRgb: string): string {
  const { sections, contactInfo, profileImage, companyLogo } = data

  const contactHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid ${accentColorRgb}; padding-bottom: 16px;">
      ${profileImage ? `<img src="${profileImage}" alt="Profile" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-right: 16px;" crossOrigin="anonymous" />` : ""}
      <div style="flex: 1;">
        <h1 style="font-size: 32px; font-weight: bold; margin: 0 0 8px 0; color: #000000;">${contactInfo.name || ""}</h1>
        <div style="font-size: 13px; color: #666666; line-height: 1.6;">
          ${contactInfo.location ? `<div>Wohnort: ${contactInfo.location}</div>` : ""}
          ${contactInfo.email ? `<div>E-Mail: ${contactInfo.email}</div>` : ""}
          ${contactInfo.phone ? `<div>Telefon: ${contactInfo.phone}</div>` : ""}
          ${contactInfo.website ? `<div>Website: ${contactInfo.website}</div>` : ""}
          ${contactInfo.linkedin ? `<div>LinkedIn: ${contactInfo.linkedin}</div>` : ""}
          ${contactInfo.github ? `<div>GitHub: ${contactInfo.github}</div>` : ""}
          ${contactInfo.location && typeof contactInfo.location === "string" && contactInfo.location.includes("Staatsangehörigkeit") ? `<div>${contactInfo.location}</div>` : ""}
        </div>
      </div>
      ${companyLogo ? `<img src="${companyLogo}" alt="Company Logo" style="height: 60px; margin-left: 16px;" crossOrigin="anonymous" />` : ""}
    </div>
  `

  const sectionsHTML = sections
    .map((section) => {
      const titleHTML = `<h2 style="font-size: 18px; font-weight: bold; margin: 24px 0 12px 0; color: ${accentColorRgb}; text-transform: uppercase; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;">${section.title}</h2>`

      const contentHTML = renderSectionContent(section.title, section.content, accentColorRgb)

      return `<div style="margin-bottom: 16px;">${titleHTML}${contentHTML}</div>`
    })
    .join("")

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Arial', 'Helvetica', sans-serif; 
            font-size: 14px; 
            line-height: 1.6; 
            color: #000000; 
            background: #ffffff;
            padding: 32px;
            max-width: 210mm;
            margin: 0 auto;
          }
          ${CV_TWO_COLUMN_LIST_CSS}
        </style>
      </head>
      <body>
        ${contactHTML}
        ${sectionsHTML}
      </body>
    </html>
  `
}

function renderSectionContent(
  sectionTitle: string,
  content: string[],
  accentColorRgb: string,
  columns?: 1 | 2 | 3,
): string {
  if (!content || content.length === 0) return ""

  const columnCount = resolveSectionColumnCount({
    title: sectionTitle,
    content,
    columns,
  })

  if (columnCount > 1) {
    const items = parseTwoColumnSectionItems(content)
    if (items.length > 0) {
      return renderCVColumnListHtml(items, columnCount as 2 | 3, {
        symbol: "•",
        color: "#000000",
        size: "1em",
        bulletMargin: 4,
        bulletIndent: 20,
        lineHeight: 1.4,
        fontSize: 14,
        linkColor: accentColorRgb,
      })
    }
  }

  let html = ""
  let i = 0

  while (i < content.length) {
    const line = content[i].trim()

    if (!line) {
      i++
      continue
    }

    // Check if this looks like a heading (bold, larger text)
    if (line.endsWith(":") || (i === 0 && !line.startsWith("•") && !line.startsWith("-"))) {
      // Likely a subsection heading (e.g., job title)
      html += `<p style="font-size: 16px; font-weight: bold; margin: 16px 0 8px 0; color: ${accentColorRgb};">${line}</p>`
      i++
      continue
    }

    // Check if this is company/institution info
    if (i > 0 && !line.startsWith("•") && !line.startsWith("-") && content[i - 1] && !content[i - 1].startsWith("•")) {
      html += `<p style="font-size: 15px; font-weight: 600; margin: 12px 0 4px 0; color: #000000;">${line}</p>`
      i++
      continue
    }

    // Check if this is a date
    if (line.match(/\d{4}/) || line.includes("–") || line.includes("heute") || line.includes("today")) {
      html += `<p style="font-size: 13px; font-style: italic; margin: 4px 0; color: #666666;">${line}</p>`
      i++
      continue
    }

    // Check if this starts a bullet list
    if (line.startsWith("•") || line.startsWith("-")) {
      const bullets = []
      while (i < content.length && (content[i].trim().startsWith("•") || content[i].trim().startsWith("-"))) {
        const bulletText = content[i].trim().replace(/^[•-]\s*/, "")
        bullets.push(bulletText)
        i++
      }
      html += `<ul style="margin: 8px 0; padding-left: 0; list-style-type: none;">`
      bullets.forEach((bullet) => {
        html += `<li style="margin: 4px 0; padding-left: 20px; line-height: 1.4; position: relative;"><span style="position: absolute; left: 0; top: 0.35em;">•</span>${formattedTextToHtml(bullet, { linkColor: accentColorRgb })}</li>`
      })
      html += `</ul>`
      continue
    }

    // Default: regular paragraph
    html += `<p style="margin: 8px 0; line-height: 1.6;">${formattedTextToHtml(line, { linkColor: accentColorRgb })}</p>`
    i++
  }

  return html
}
