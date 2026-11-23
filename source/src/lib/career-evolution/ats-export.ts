/**
 * ATS compatibility helpers for Career Evolution.
 *
 * The graph is a human-facing enhancement. ATS Optimized PDF export and
 * job-match / CV scoring must rely only on standard CV Markdown text.
 */

import { normalizeCvSectionKey } from "@/lib/import-cv-structure"
import { parseResumeText } from "@/lib/parse-resume-text"
import { stripSectionColumnModifier } from "@/lib/section-column-modifier"
import type { PdfExportPreset } from "@/lib/pdf-export-presets"
import type { CareerEvolutionConfig } from "@/lib/career-evolution/types"

/** ATS Optimized export omits the graph; Standard/High keep it when visible. */
export function shouldRenderCareerEvolutionInPdf(
  preset: PdfExportPreset | null | undefined,
  config: CareerEvolutionConfig | null | undefined,
): boolean {
  if (preset === "ats") return false
  if (!config || config.visible !== true) return false
  if (config.milestones.length > 0) return true
  if (
    config.layout === "alignment" &&
    ((config.alignments?.length || 0) > 0 ||
      Boolean(config.alignmentSourceText?.trim()))
  ) {
    return true
  }
  // Skills Convergence can render from capabilities alone (no milestone dates).
  if (
    config.layout === "convergence" &&
    (config.capabilities || []).filter((c) => Boolean(c.label?.trim())).length >= 2
  ) {
    return true
  }
  return false
}

/**
 * Remove Career Evolution markup from export HTML so ATS text extraction
 * never sees graph labels or SVG text.
 */
export function stripCareerEvolutionFromHtml(html: string): string {
  if (!html) return html
  let next = html
  next = next.replace(
    /<figure\b[^>]*class="[^"]*career-evolution-figure[^"]*"[\s\S]*?<\/figure>/gi,
    "",
  )
  next = next.replace(
    /<(?:div|section)\b[^>]*data-pdf-block=["']career-evolution["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi,
    "",
  )
  next = next.replace(
    /<h2[^>]*>\s*(?:CAREER\s+EVOLUTION|KARRIEREENTWICKLUNG)\s*<\/h2>/gi,
    "",
  )
  return next
}

/** Collapse HTML to ordered plain text for extraction-order assertions. */
export function extractPlainTextOrderFromResumeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

/**
 * Graph labels must not appear inside the EXPERIENCE Markdown body
 * (between job entries). Career Evolution lives in contactInfo / its own section.
 */
export function experienceTextContainsCareerEvolutionNoise(resumeText: string): boolean {
  const experience = parseResumeText(resumeText).find(
    (s) => normalizeCvSectionKey(stripSectionColumnModifier(s.title)) === "EXPERIENCE",
  )
  if (!experience) return false
  const body = experience.content.join("\n")
  return (
    /\bCAREER\s+EVOLUTION\b/i.test(body) ||
    /\bKARRIEREENTWICKLUNG\b/i.test(body) ||
    /^TRACK:\s*/im.test(body) ||
    /^CONNECTION:\s*/im.test(body) ||
    /```\s*career-evolution/i.test(body)
  )
}
