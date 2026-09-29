import type { ApplicationStoryWizardOptionalSources } from "@/lib/application-story-wizard/types"

const MAX_CHARS = 14_000
const FETCH_TIMEOUT_MS = 12_000

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (!["http:", "https:"].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Best-effort fetch of public page text for company intelligence. */
export async function fetchCompanyPageText(url: string): Promise<string> {
  const normalized = normalizeUrl(url)
  if (!normalized) return ""

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "EquitAI-ApplicationStoryWizard/1.0",
      },
      redirect: "follow",
    })
    clearTimeout(timer)
    if (!response.ok) return ""
    const html = await response.text()
    return stripHtml(html).slice(0, MAX_CHARS)
  } catch {
    return ""
  }
}

export function buildOptionalSourcesBlock(
  sources?: ApplicationStoryWizardOptionalSources | null,
): string {
  if (!sources) return ""
  const sections: string[] = []
  const add = (label: string, value?: string) => {
    const text = value?.trim()
    if (text) sections.push(`${label}:\n${text}`)
  }
  add("ABOUT PAGE", sources.aboutPage)
  add("COMPANY VALUES", sources.companyValues)
  add("ANNUAL REPORT EXCERPT", sources.annualReport)
  add("TEAM PAGE", sources.teamPage)
  add("PRODUCT PAGES", sources.productPages)
  add("LINKEDIN COMPANY PAGE", sources.linkedInCompanyPage)
  return sections.length ? `\n\nOPTIONAL COMPANY SOURCES:\n${sections.join("\n\n")}` : ""
}
