import { generateYourStory } from "@/app/actions/generate-your-story"
import type { JobApplication } from "@/lib/types"
import type { StrategicProfile } from "@/lib/strategic-profile"
import { applyJobApplicationUpdates } from "@/lib/storage"

export type AttachYourStoryInput = {
  job: JobApplication
  resumeContent: string
  resumeVersionId: string
  outputLanguage: "en" | "de"
  strategicProfile?: StrategicProfile | null
}

/** Generate Your Story via AI and return merged job application updates. */
export async function buildYourStoryJobUpdate(
  input: AttachYourStoryInput,
): Promise<{ ok: true; updates: Partial<JobApplication> } | { ok: false; error: string }> {
  const result = await generateYourStory({
    language: input.outputLanguage,
    jobTitle: input.job.jobTitle,
    company: input.job.company,
    jobDescription: input.job.jobDescription,
    resumeContent: input.resumeContent,
    resumeVersionId: input.resumeVersionId,
    strategicProfile: input.strategicProfile ?? null,
  })

  if (!result.success || !result.yourStory) {
    return { ok: false, error: result.error ?? "Could not generate Your Story." }
  }

  return {
    ok: true,
    updates: {
      yourStory: result.yourStory,
    },
  }
}

export function mergeYourStoryOntoJob(
  job: JobApplication,
  updates: Partial<JobApplication>,
): JobApplication {
  return applyJobApplicationUpdates(job, updates)
}
