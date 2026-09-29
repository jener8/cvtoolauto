import type { YourStory } from "@/lib/types"
import type { ApplicationStoryWizardArtifact } from "@/lib/application-story-wizard/types"

export function hasApplicationStoryWizard(story?: YourStory | null): boolean {
  return Boolean(story?.applicationStoryWizard?.wizardCompletedAt)
}

export function getApplicationStoryWizard(
  story?: YourStory | null,
): ApplicationStoryWizardArtifact | undefined {
  return story?.applicationStoryWizard
}
