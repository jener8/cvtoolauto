import type { YourStory, YourStoryCvEvidenceItem, YourStorySupportLevel } from "@/lib/types"

export const YOUR_STORY_SUPPORT_LABELS: Record<
  YourStorySupportLevel,
  { en: string; de: string; tone: "ok" | "warn" | "risk" }
> = {
  strong: { en: "Supported by CV", de: "Durch CV belegt", tone: "ok" },
  needs_stronger_cv_evidence: {
    en: "Needs stronger CV evidence",
    de: "Braucht stärkere CV-Belege",
    tone: "warn",
  },
  could_be_added_to_cv: {
    en: "Could be added to CV",
    de: "Könnte ins CV aufgenommen werden",
    tone: "warn",
  },
  risk_story_stronger_than_cv_proof: {
    en: "Risk: story stronger than CV proof",
    de: "Risiko: Story stärker als CV-Beleg",
    tone: "risk",
  },
}

export function createEmptyYourStory(resumeVersionId = ""): YourStory {
  const now = Date.now()
  return {
    content: "",
    lastModified: now,
    resumeVersionId,
    cvEvidence: [],
  }
}

export function hasUsableYourStory(story?: YourStory | null): boolean {
  return Boolean(story?.content?.trim())
}

export function yourStoryPreview(content: string, maxChars = 220): string {
  const trimmed = content.trim().replace(/\s+/g, " ")
  if (!trimmed) return ""
  if (trimmed.length <= maxChars) return trimmed
  const slice = trimmed.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(" ")
  const base = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${base}…`
}

export function normalizeYourStoryCvEvidence(
  items: unknown,
): YourStoryCvEvidenceItem[] {
  if (!Array.isArray(items)) return []
  const allowed: YourStorySupportLevel[] = [
    "strong",
    "needs_stronger_cv_evidence",
    "could_be_added_to_cv",
    "risk_story_stronger_than_cv_proof",
  ]
  return items
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const supportLevel = String(row.supportLevel ?? row.support_level ?? "strong")
      return {
        id: String(row.id ?? `evidence-${index + 1}`),
        storyExcerpt: String(row.storyExcerpt ?? row.story_excerpt ?? ""),
        cvSection: String(row.cvSection ?? row.cv_section ?? ""),
        cvReference: String(row.cvReference ?? row.cv_reference ?? ""),
        supportLevel: allowed.includes(supportLevel as YourStorySupportLevel)
          ? (supportLevel as YourStorySupportLevel)
          : "strong",
      } satisfies YourStoryCvEvidenceItem
    })
    .filter((item): item is YourStoryCvEvidenceItem => Boolean(item?.storyExcerpt?.trim()))
}
