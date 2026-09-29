import type { IllustrationSlot } from "@/lib/illustration-slots"
import type { SectionEmptyStateId } from "@/lib/workspace-shell-copy"

/** One unique illustration per section empty state. */
export const SECTION_ILLUSTRATION_SLOTS: Record<SectionEmptyStateId, IllustrationSlot> = {
  careerBrain: "section.careerBrain",
  documents: "section.documents",
  coverLetters: "section.coverLetters",
  savedDocuments: "section.savedDocuments",
  applications: "section.applications",
  recognitionPathways: "section.recognitionPathways",
  workplaceGerman: "section.workplaceGerman",
  bureaucracyNavigator: "section.bureaucracyNavigator",
  mentoringSupport: "section.mentoringSupport",
}
